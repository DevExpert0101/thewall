import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { MessageSort } from "@/lib/constants";
import { ARCHIVAL_REMOVAL_TEXT, ARCHIVAL_TAGLINE, PAYMENT_INTENT_TTL_SECONDS, PRICE_USDC } from "@/lib/constants";
import { hashOwnershipSecret, sha256Hex, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getNetwork, getTreasuryAddress, isArchiveSimulation } from "@/lib/env";
import { bindMessageHash } from "@/lib/payment/fulfillment";
import { trendingScore } from "@/lib/ranking";
import type { CertificatePayload, EventSnapshot, PublicMessage } from "@/lib/types";
import { formatUtcDate } from "@/lib/utils";
import { pageWindow } from "@/lib/wall/feed";

export const SIMULATION_EVENT_ID = "local";
const SIM_TREASURY = "0x0000000000000000000000000000000000000001" as const;
const MISSING_CLAIM_HASH = hashOwnershipSecret("the-wall-missing-claim-placeholder-key");

type Seed = {
  n: number;
  text: string;
  fires: number;
  minutesAgo: number;
  hourFires?: number;
  removed?: boolean;
};

type ExtraWrite = {
  publicNumber: number;
  text: string;
  claimHash: string;
  publishedAt: string;
  fires: number;
};

export type SimulatedArchive = {
  event: EventSnapshot;
  messages: PublicMessage[];
};

type SimIntent = {
  id: string;
  userId: string;
  text: string;
  messageHash: string;
  claimSecretHash: string;
  amount: string;
  currency: "USDC";
  network: string;
  recipient: string;
  status: "created" | "fulfilled" | "expired";
  expiresAt: string;
  createdAt: string;
  paymentId: string;
};

const SEEDS: Seed[] = [
  { n: 1, text: "I was here, and I was trying.", fires: 41, minutesAgo: 348 },
  { n: 2, text: "Tell my mother I finally said it.", fires: 18, minutesAgo: 331 },
  { n: 3, text: "I loved you more than I ever said out loud.", fires: 9, minutesAgo: 312 },
  { n: 4, text: "If you are reading this in fifty years, we hoped.", fires: 67, minutesAgo: 280 },
  { n: 5, text: "Forgive me for the years I stayed silent.", fires: 12, minutesAgo: 251 },
  { n: 6, text: "I was afraid, and I came anyway.", fires: 23, minutesAgo: 219 },
  { n: 7, text: "We were ordinary. That is why this matters.", fires: 31, minutesAgo: 188 },
  { n: 8, text: "Message removed under archive policy.", fires: 2, minutesAgo: 170, removed: true },
  { n: 9, text: "I forgave you in public and you will never know.", fires: 54, minutesAgo: 142 },
  { n: 10, text: "Do not wait for a kinder century.", fires: 7, minutesAgo: 121 },
  { n: 11, text: "I left this for the one who survives the night.", fires: 16, minutesAgo: 96 },
  { n: 12, text: "You were the reason I stayed.", fires: 28, minutesAgo: 74 },
  { n: 13, text: "Be gentler than the world that made you.", fires: 19, minutesAgo: 58, hourFires: 8 },
  { n: 14, text: "I still believe we were worth the trouble.", fires: 11, minutesAgo: 44, hourFires: 11 },
  { n: 15, text: "To the stranger who finds this: keep going.", fires: 36, minutesAgo: 33, hourFires: 22 },
  { n: 16, text: "If I disappear, let this be proof I meant it.", fires: 8, minutesAgo: 21, hourFires: 6 },
  { n: 17, text: "Remember us as people who tried.", fires: 14, minutesAgo: 12, hourFires: 14 },
  { n: 18, text: "Thank you for being alive at the same time as me.", fires: 5, minutesAgo: 6, hourFires: 5 },
];

const extraFires = new Map<string, number>();
const simulatedReactors = new Set<string>();
const extraWrites: ExtraWrite[] = [];
const intents = new Map<string, SimIntent>();
let archiveSnapshot: SimulatedArchive | null = null;
let closedOverride: boolean | null = null;
let persistLoaded = false;

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 24 * HOUR_MS;
const ELAPSED_MS = 6 * HOUR_MS;

function shouldPersist(): boolean {
  return (
    process.env.VITEST !== "true" &&
    process.env.NODE_ENV !== "test" &&
    !process.env.VERCEL
  );
}

function persistPath(): string {
  return join(process.cwd(), ".thewall-local", "state.json");
}

function ensureLoaded() {
  if (persistLoaded) return;
  persistLoaded = true;
  if (!shouldPersist()) return;
  const path = persistPath();
  if (!existsSync(path)) return;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      closed?: boolean | null;
      writes?: ExtraWrite[];
      intents?: SimIntent[];
      fires?: [string, number][];
      reactors?: string[];
      archive?: SimulatedArchive | null;
    };
    closedOverride = raw.closed ?? null;
    extraWrites.splice(0, extraWrites.length, ...(raw.writes ?? []));
    extraFires.clear();
    for (const [id, count] of raw.fires ?? []) extraFires.set(id, count);
    simulatedReactors.clear();
    for (const key of raw.reactors ?? []) simulatedReactors.add(key);
    archiveSnapshot = raw.archive ?? null;
    intents.clear();
    for (const intent of raw.intents ?? []) {
      intents.set(intent.id, intent);
    }
  } catch {
    // local convenience only
  }
}

function persist() {
  if (!shouldPersist()) return;
  const path = persistPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        closed: closedOverride,
        writes: extraWrites,
        intents: [...intents.values()],
        fires: [...extraFires.entries()],
        reactors: [...simulatedReactors],
        archive: archiveSnapshot,
      }),
    );
  } catch {
    // local convenience only
  }
}

export function resetSimulationState() {
  extraFires.clear();
  simulatedReactors.clear();
  extraWrites.splice(0, extraWrites.length);
  intents.clear();
  archiveSnapshot = null;
  closedOverride = null;
  persistLoaded = true;
  if (shouldPersist()) {
    try {
      unlinkSync(persistPath());
    } catch {
      // ignore
    }
  }
}

export function isSimulatedWallClosed(): boolean {
  ensureLoaded();
  if (closedOverride === true) return true;
  if (closedOverride === false) return false;
  return isArchiveSimulation();
}

function carveArchive(now: Date = new Date()): SimulatedArchive {
  const event = simulatedArchivedEvent(now);
  const messages = simulatedMessageList(now, {
    publishedAnchor: new Date(now.getTime() - ELAPSED_MS),
    finalized: true,
  });
  return { event, messages };
}

export function closeSimulatedWall(now: Date = new Date()) {
  ensureLoaded();
  closedOverride = true;
  archiveSnapshot = carveArchive(now);
  persist();
  return archiveSnapshot;
}

export function reopenSimulatedWall() {
  ensureLoaded();
  closedOverride = false;
  archiveSnapshot = null;
  persist();
}

/** Frozen ledger written when this Wall closes. Null while live. */
export function getSimulatedArchive(): SimulatedArchive | null {
  ensureLoaded();
  if (!isSimulatedWallClosed()) return null;
  if (archiveSnapshot) return archiveSnapshot;
  return carveArchive();
}

function minutesAgoIso(minutes: number, now: Date): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function messageId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function snapshotMeta() {
  return {
    id: SIMULATION_EVENT_ID,
    slug: process.env.NEXT_PUBLIC_EVENT_SLUG ?? "the-wall",
    title: "THE WALL",
    treasuryAddress: process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? null,
    network: process.env.NEXT_PUBLIC_BASE_NETWORK ?? "base-sepolia",
    priceUsdc: PRICE_USDC,
  };
}

function withFinalRanks(messages: PublicMessage[]): PublicMessage[] {
  const order = [...messages].sort(
    (a, b) =>
      b.reactionCount - a.reactionCount ||
      a.publishedAt.localeCompare(b.publishedAt) ||
      a.publicNumber - b.publicNumber,
  );
  const rankById = new Map(order.map((message, index) => [message.id, index + 1]));
  return messages.map((message) => ({
    ...message,
    finalRank: rankById.get(message.id) ?? null,
  }));
}

function extraPublishedAt(write: ExtraWrite, anchor: Date, now: Date): string {
  const raw = Date.parse(write.publishedAt);
  if (!Number.isFinite(raw)) return minutesAgoIso(1, anchor);
  if (anchor.getTime() !== now.getTime() && raw > anchor.getTime()) {
    return new Date(anchor.getTime() - 60_000).toISOString();
  }
  return write.publishedAt;
}

export function simulatedLiveEvent(now: Date = new Date()): EventSnapshot {
  const messages = simulatedMessageList(now);
  return {
    ...snapshotMeta(),
    startsAt: new Date(now.getTime() - ELAPSED_MS).toISOString(),
    endsAt: new Date(now.getTime() + (WINDOW_MS - ELAPSED_MS)).toISOString(),
    archivedAt: null,
    finalizedAt: null,
    phase: "live",
    serverNow: now.toISOString(),
    totalMessages: messages.length,
    totalReactions: messages.reduce((sum, message) => sum + message.reactionCount, 0),
  };
}

/** Frozen 24-hour window for `/archive` while the live wall mock stays open. */
export function simulatedArchivedEvent(now: Date = new Date()): EventSnapshot {
  const endsAt = new Date(now.getTime() - ELAPSED_MS);
  const messages = simulatedMessageList(now, {
    publishedAnchor: endsAt,
    finalized: true,
  });
  const closed = endsAt.toISOString();
  return {
    ...snapshotMeta(),
    startsAt: new Date(endsAt.getTime() - WINDOW_MS).toISOString(),
    endsAt: closed,
    archivedAt: closed,
    finalizedAt: closed,
    phase: "archived",
    serverNow: now.toISOString(),
    totalMessages: messages.length,
    totalReactions: messages.reduce((sum, message) => sum + message.reactionCount, 0),
  };
}

export function currentSimulatedEvent(now: Date = new Date()): EventSnapshot {
  ensureLoaded();
  if (archiveSnapshot && isSimulatedWallClosed()) {
    return { ...archiveSnapshot.event, serverNow: now.toISOString() };
  }
  return isSimulatedWallClosed() ? simulatedArchivedEvent(now) : simulatedLiveEvent(now);
}

export function simulatedMessageList(
  now: Date = new Date(),
  options: { publishedAnchor?: Date; finalized?: boolean } = {},
): PublicMessage[] {
  ensureLoaded();
  const anchor = options.publishedAnchor ?? now;
  const seeds = SEEDS.map((seed) => {
    const id = messageId(seed.n);
    const extra = extraFires.get(id) ?? 0;
    return {
      id,
      eventId: SIMULATION_EVENT_ID,
      publicNumber: seed.n,
      text: seed.removed ? ARCHIVAL_REMOVAL_TEXT : seed.text,
      isRemoved: Boolean(seed.removed),
      reactionCount: seed.fires + extra,
      publishedAt: minutesAgoIso(seed.minutesAgo, anchor),
      finalRank: null as number | null,
    };
  });
  const published = extraWrites.map((write) => {
    const id = messageId(write.publicNumber);
    return {
      id,
      eventId: SIMULATION_EVENT_ID,
      publicNumber: write.publicNumber,
      text: write.text,
      isRemoved: false,
      reactionCount: write.fires + (extraFires.get(id) ?? 0),
      publishedAt: extraPublishedAt(write, anchor, now),
      finalRank: null as number | null,
    };
  });
  const messages = [...seeds, ...published];
  return options.finalized ? withFinalRanks(messages) : messages;
}

function hashSort(id: string, salt: string): string {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function listSimulatedMessages(input: {
  sort: MessageSort;
  limit: number;
  salt?: string;
  now?: Date;
  finalized?: boolean;
  cursor?: string;
}): { messages: PublicMessage[]; nextCursor: string | null } {
  const now = input.now ?? new Date();
  const closed = isSimulatedWallClosed();
  const finalized = input.finalized ?? closed;
  const publishedAnchor = finalized ? new Date(now.getTime() - ELAPSED_MS) : now;
  const all =
    closed && archiveSnapshot && input.finalized !== false
      ? archiveSnapshot.messages
      : simulatedMessageList(now, {
          publishedAnchor,
          finalized,
        });
  let ordered = all;

  if (input.sort === "new") {
    ordered = [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.publicNumber - a.publicNumber);
  } else if (input.sort === "hot") {
    ordered = [...all].sort(
      (a, b) =>
        b.reactionCount - a.reactionCount ||
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.publicNumber - b.publicNumber,
    );
  } else if (input.sort === "hour") {
    const hour = SEEDS.filter((seed) => (seed.hourFires ?? 0) > 0 || seed.minutesAgo <= 60)
      .sort((a, b) => (b.hourFires ?? 0) - (a.hourFires ?? 0) || a.minutesAgo - b.minutesAgo)
      .map((seed) => all.find((message) => message.publicNumber === seed.n))
      .filter((message): message is PublicMessage => Boolean(message));
    const extras = all.filter(
      (message) =>
        message.publicNumber > SEEDS.length &&
        now.getTime() - Date.parse(message.publishedAt) <= HOUR_MS,
    );
    const combined = [...hour, ...extras];
    ordered = combined.length > 0 ? combined : [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  } else if (input.sort === "random") {
    const salt = input.salt ?? "simulation";
    ordered = [...all].sort((a, b) => hashSort(a.id, salt).localeCompare(hashSort(b.id, salt)));
  } else {
    ordered = [...all].sort((a, b) => {
      const sa = trendingScore(a.reactionCount, new Date(a.publishedAt), now);
      const sb = trendingScore(b.reactionCount, new Date(b.publishedAt), now);
      return sb - sa || b.publishedAt.localeCompare(a.publishedAt);
    });
  }

  const windowed = pageWindow(ordered, input.cursor, input.limit);
  return {
    messages: windowed.items,
    nextCursor: windowed.nextCursor,
  };
}

export function getSimulatedMessage(publicNumber: number): PublicMessage {
  ensureLoaded();
  const closed = isSimulatedWallClosed();
  const found = (
    closed && archiveSnapshot
      ? archiveSnapshot.messages
      : simulatedMessageList(new Date(), {
          publishedAnchor: closed ? new Date(Date.now() - ELAPSED_MS) : undefined,
          finalized: closed,
        })
  ).find((message) => message.publicNumber === publicNumber);
  if (!found) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }
  return found;
}

export function addSimulatedReaction(messageId: string, userId = "local-sim"): number {
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall is closed.", 403);
  }
  const message = simulatedMessageList().find((row) => row.id === messageId);
  if (!message || message.isRemoved) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }
  const key = `${userId}:${messageId}`;
  if (simulatedReactors.has(key)) {
    throw new AppError(ERROR_CODES.DUPLICATE_REACTION, "Already reacted.");
  }
  simulatedReactors.add(key);
  const next = (extraFires.get(messageId) ?? 0) + 1;
  extraFires.set(messageId, next);
  persist();
  return message.reactionCount + 1;
}

export function isSimulationEvent(eventId: string): boolean {
  return eventId === SIMULATION_EVENT_ID;
}

function simulationRecipient(): `0x${string}` {
  try {
    return getTreasuryAddress();
  } catch {
    return SIM_TREASURY;
  }
}

function simulatedPaymentId(intentId: string): `0x${string}` {
  return `0x${sha256Hex(`thewall:sim:${intentId}`)}`;
}

export function createSimulatedIntent(input: {
  text: string;
  userId: string;
  claimSecretHash: string;
}): {
  intentId: string;
  amount: string;
  currency: "USDC";
  network: string;
  recipient: `0x${string}`;
  expiresAt: string;
  messageHash: string;
  simulated: true;
  simulatedPaymentId: `0x${string}`;
} {
  ensureLoaded();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall closed during checkout.", 403);
  }
  const id = randomUUID();
  const now = new Date();
  const ttl = Number(process.env.PAYMENT_INTENT_TTL_SECONDS) || PAYMENT_INTENT_TTL_SECONDS;
  const recipient = simulationRecipient();
  const network = getNetwork();
  const messageHash = bindMessageHash(input.text);
  const paymentId = simulatedPaymentId(id);
  const intent: SimIntent = {
    id,
    userId: input.userId,
    text: input.text,
    messageHash,
    claimSecretHash: input.claimSecretHash,
    amount: PRICE_USDC,
    currency: "USDC",
    network,
    recipient,
    status: "created",
    expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
    createdAt: now.toISOString(),
    paymentId,
  };
  intents.set(id, intent);
  persist();
  return {
    intentId: id,
    amount: PRICE_USDC,
    currency: "USDC",
    network,
    recipient,
    expiresAt: intent.expiresAt,
    messageHash,
    simulated: true,
    simulatedPaymentId: paymentId,
  };
}

export function fulfillSimulatedPayment(input: {
  intentId: string;
  userId: string;
  paymentId: string;
}): { publicNumber: number; messageId: string; publishedAt: string } {
  ensureLoaded();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall closed during checkout.", 403);
  }
  const intent = intents.get(input.intentId);
  if (!intent) {
    throw new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent not found.");
  }
  if (intent.userId !== input.userId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "This payment does not belong to you.", 403);
  }
  if (intent.status === "fulfilled") {
    throw new AppError(ERROR_CODES.INTENT_FULFILLED, "Payment already used.");
  }
  if (intent.status === "expired" || Date.parse(intent.expiresAt) <= Date.now()) {
    intent.status = "expired";
    persist();
    throw new AppError(ERROR_CODES.INTENT_EXPIRED, "Payment window expired.");
  }
  if (intent.paymentId !== input.paymentId.toLowerCase()) {
    throw new AppError(ERROR_CODES.PAYMENT_FAILED, "The payment did not complete.");
  }
  if (bindMessageHash(intent.text) !== intent.messageHash) {
    throw new AppError(ERROR_CODES.HASH_MISMATCH, "The paid message no longer matches checkout.");
  }

  const publicNumber = SEEDS.length + extraWrites.length + 1;
  const publishedAt = new Date().toISOString();
  extraWrites.push({
    publicNumber,
    text: intent.text,
    claimHash: intent.claimSecretHash,
    publishedAt,
    fires: 0,
  });
  intent.status = "fulfilled";
  persist();
  return {
    publicNumber,
    messageId: messageId(publicNumber),
    publishedAt,
  };
}

export function lookupSimulatedCertificate(token: string): CertificatePayload | null {
  ensureLoaded();
  const submitted = hashOwnershipSecret(token);
  const write = extraWrites.find((row) => tokensEqual(row.claimHash, submitted));
  if (!write) {
    tokensEqual(MISSING_CLAIM_HASH, submitted);
    return null;
  }
  const message = getSimulatedMessage(write.publicNumber);
  const event = currentSimulatedEvent();
  return {
    publicNumber: message.publicNumber,
    text: message.text,
    reactionCount: message.reactionCount,
    finalRank: message.finalRank,
    publishedAt: message.publishedAt,
    eventTitle: event.title,
    eventDate: formatUtcDate(event.startsAt),
    tagline: ARCHIVAL_TAGLINE,
  };
}

export function verifySimulatedClaim(input: {
  publicNumber: number;
  wallKey: string;
}): { messageId: string; won: boolean; nominated: boolean } {
  ensureLoaded();
  const submitted = hashOwnershipSecret(input.wallKey);
  const write = extraWrites.find((row) => row.publicNumber === input.publicNumber);
  const stored = write?.claimHash ?? MISSING_CLAIM_HASH;
  if (!write || !tokensEqual(stored, submitted)) {
    throw new AppError(ERROR_CODES.CLAIM_INVALID, "That Wall Key does not match this message.", 404);
  }
  const message = getSimulatedMessage(input.publicNumber);
  return {
    messageId: message.id,
    won: message.finalRank === 1,
    nominated: false,
  };
}
