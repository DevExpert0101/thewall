import { AppError, ERROR_CODES } from "@/lib/errors";

export const REACTION_VELOCITY = {
  ipBurst: { count: 20, windowMs: 60_000 },
  sessionFarm: { newUsers: 8, windowMs: 5 * 60_000 },
  messageSpike: { count: 25, windowMs: 60_000 },
  challengeHoldMs: 15 * 60_000,
  signalDedupeMs: 60_000,
  maxEvents: 4_000,
  maxSignals: 100,
} as const;

export const REACTION_SIGNAL_KINDS = [
  "ip_burst",
  "session_farm",
  "message_spike",
  "challenge",
  "scripted_client",
] as const;

export type ReactionSignalKind = (typeof REACTION_SIGNAL_KINDS)[number];

export type ReactionSignal = {
  kind: ReactionSignalKind;
  subject: string;
  count: number;
  createdAt: string;
  note: string;
};

export type ReactionObserveInput = {
  at?: number;
  ipHash: string;
  userId: string;
  messageId: string;
  newSession: boolean;
  userAgent?: string | null;
};

export type ReactionDecision = {
  allow: true;
  challenge: boolean;
  signals: ReactionSignal[];
};

type ReactionEvent = {
  at: number;
  ipHash: string;
  userId: string;
  messageId: string;
  newSession: boolean;
};

const events: ReactionEvent[] = [];
const signals: ReactionSignal[] = [];
const challengeUntil = new Map<string, number>();

export function resetReactionIntegrity() {
  events.length = 0;
  signals.length = 0;
  challengeUntil.clear();
}

export function publicReactionSubject(kind: "addr" | "msg", value: string): string {
  const compact = value.replace(/[^a-f0-9]/gi, "").slice(0, 12).toLowerCase();
  return `${kind}:${compact || "unknown"}`;
}

export function looksScriptedClient(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return /curl|wget|python-requests|axios\/|go-http-client|libwww|httpclient|scrapy|headlesschrome|phantomjs|puppeteer/i.test(
    userAgent,
  );
}

function prune(now: number) {
  const cutoff = now - REACTION_VELOCITY.sessionFarm.windowMs;
  while (events.length > 0 && events[0]!.at < cutoff) {
    events.shift();
  }
  while (events.length > REACTION_VELOCITY.maxEvents) {
    events.shift();
  }
}

function signal(
  kind: ReactionSignalKind,
  subject: string,
  count: number,
  now: number,
  note: string,
): ReactionSignal {
  return {
    kind,
    subject,
    count,
    createdAt: new Date(now).toISOString(),
    note,
  };
}

export function evaluateReactionIntegrity(input: ReactionObserveInput): ReactionDecision {
  const now = input.at ?? Date.now();
  prune(now);
  const found: ReactionSignal[] = [];
  const addr = publicReactionSubject("addr", input.ipHash);
  const msg = publicReactionSubject("msg", input.messageId);

  const recentIp = events.filter(
    (row) => row.ipHash === input.ipHash && now - row.at <= REACTION_VELOCITY.ipBurst.windowMs,
  );
  if (recentIp.length >= REACTION_VELOCITY.ipBurst.count) {
    found.push(
      signal(
        "ip_burst",
        addr,
        recentIp.length,
        now,
        `${recentIp.length} 🔥 from one address in 60s.`,
      ),
    );
  }

  const farm = events.filter(
    (row) =>
      row.ipHash === input.ipHash &&
      row.newSession &&
      now - row.at <= REACTION_VELOCITY.sessionFarm.windowMs,
  );
  const newUsers = new Set(farm.map((row) => row.userId));
  if (input.newSession) newUsers.add(input.userId);
  if (newUsers.size > REACTION_VELOCITY.sessionFarm.newUsers) {
    found.push(
      signal(
        "session_farm",
        addr,
        newUsers.size,
        now,
        `${newUsers.size} new sessions from one address reacted in 5m.`,
      ),
    );
  }

  const spike = events.filter(
    (row) =>
      row.ipHash === input.ipHash &&
      row.messageId === input.messageId &&
      now - row.at <= REACTION_VELOCITY.messageSpike.windowMs,
  );
  if (spike.length >= REACTION_VELOCITY.messageSpike.count) {
    found.push(
      signal(
        "message_spike",
        msg,
        spike.length,
        now,
        `${spike.length} 🔥 on one sentence from one address in 60s.`,
      ),
    );
  }

  if (looksScriptedClient(input.userAgent)) {
    found.push(
      signal(
        "scripted_client",
        addr,
        1,
        now,
        "Request looked scripted. A check is required; 🔥 is not dropped.",
      ),
    );
  }

  const held = (challengeUntil.get(input.ipHash) ?? 0) > now;
  return {
    allow: true,
    challenge: found.length > 0 || held,
    signals: found,
  };
}

export function rememberReactionChallenge(ipHash: string, at = Date.now()) {
  challengeUntil.set(ipHash, at + REACTION_VELOCITY.challengeHoldMs);
}

export function observeReactionSuccess(input: ReactionObserveInput) {
  const now = input.at ?? Date.now();
  events.push({
    at: now,
    ipHash: input.ipHash,
    userId: input.userId,
    messageId: input.messageId,
    newSession: input.newSession,
  });
  prune(now);
}

export function recordReactionSignals(next: ReactionSignal[]) {
  const now = Date.now();
  for (const row of next) {
    const existing = signals.find(
      (seen) =>
        seen.kind === row.kind &&
        seen.subject === row.subject &&
        now - Date.parse(seen.createdAt) < REACTION_VELOCITY.signalDedupeMs,
    );
    if (existing) {
      existing.count = Math.max(existing.count, row.count);
      existing.createdAt = row.createdAt;
      existing.note = row.note;
      continue;
    }
    signals.unshift(row);
  }
  signals.splice(REACTION_VELOCITY.maxSignals);
}

export function listReactionSignals(limit = 25): ReactionSignal[] {
  return signals.slice(0, limit);
}

export function challengeReactionOrThrow(
  input: ReactionObserveInput,
  token: string | undefined,
): ReactionDecision {
  const decision = evaluateReactionIntegrity(input);
  if (!decision.challenge) return decision;
  if (token && token.length >= 10) return decision;

  rememberReactionChallenge(input.ipHash, input.at);
  const challenge = signal(
    "challenge",
    publicReactionSubject("addr", input.ipHash),
    1,
    input.at ?? Date.now(),
    "Turnstile required. 🔥 was not silently dropped.",
  );
  const rows = [...decision.signals, challenge];
  recordReactionSignals(rows);
  void persistReactionSignals(rows);
  throw new AppError(
    ERROR_CODES.TURNSTILE,
    "Complete the check to keep reacting. You can still read the wall.",
  );
}

export async function persistReactionSignals(rows: ReactionSignal[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { hasSupabaseConfig, isSimulation } = await import("@/lib/env");
    if (isSimulation() || !hasSupabaseConfig()) return;
    const { createServiceSupabase } = await import("@/lib/supabase/admin");
    const db = createServiceSupabase();
    await db.from("reaction_signals").insert(
      rows.map((row) => ({
        kind: row.kind,
        subject: row.subject,
        count: row.count,
        note: row.note,
        created_at: row.createdAt,
      })),
    );
  } catch {
    // Visibility is best-effort. Never fail a legitimate 🔥.
  }
}
