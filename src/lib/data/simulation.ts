import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FeedbackCategory, MessageSort } from "@/lib/constants";
import { ARCHIVAL_REMOVAL_TEXT, ARCHIVAL_TAGLINE, PAYMENT_INTENT_TTL_SECONDS, PRICE_USDC } from "@/lib/constants";
import { createWallKey, hashOwnershipSecret, hashWallKey, sha256Hex, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getNetwork, getTreasuryAddress, isArchiveSimulation } from "@/lib/env";
import { bindMessageHash } from "@/lib/payment/fulfillment";
import { trendingScore } from "@/lib/ranking";
import { buildCanonicalArchive } from "@/lib/archive/canonical";
import { highlightFrom } from "@/lib/archive/records";
import type { CertificatePayload, EditionSummary, EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatUtcDate } from "@/lib/utils";
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

export type SimulatedFeedback = {
  id: string;
  body: string;
  category: FeedbackCategory;
  email: string | null;
  createdAt: string;
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
  { n: 1, text: "Dad, I made it to Tuesday. That's all I had in me.", fires: 41, minutesAgo: 348 },
  { n: 2, text: "Sold the guitar in March. I still reach for it when a song comes on.", fires: 18, minutesAgo: 331 },
  { n: 3, text: "I told her I was fine. I was sitting in the parking lot.", fires: 9, minutesAgo: 312 },
  { n: 4, text: "If you are reading this in fifty years, I drove a night bus and I liked the quiet.", fires: 67, minutesAgo: 280 },
  { n: 5, text: "Sorry I missed your birthday. I was on the phone with the hospital.", fires: 12, minutesAgo: 251 },
  { n: 6, text: "Asked my boss for Friday off. Said dentist. It was a funeral.", fires: 23, minutesAgo: 219 },
  { n: 7, text: "We ate cereal for dinner and nobody made a joke about it.", fires: 31, minutesAgo: 188 },
  { n: 8, text: "Message removed under archive policy.", fires: 2, minutesAgo: 170, removed: true },
  { n: 9, text: "I still have your hoodie. I wear it to take the trash out.", fires: 54, minutesAgo: 142 },
  { n: 10, text: "Call your sister. I waited until the funeral and that was stupid.", fires: 7, minutesAgo: 121 },
  { n: 11, text: "The bus was late. I got the job anyway.", fires: 16, minutesAgo: 96 },
  { n: 12, text: "You left the porch light on. I sat in the car for twenty minutes.", fires: 28, minutesAgo: 74 },
  { n: 13, text: "My kid asked if I was happy. I said yes. Working on it.", fires: 19, minutesAgo: 58, hourFires: 8 },
  { n: 14, text: "Quit smoking on a Wednesday because the gum was on sale.", fires: 11, minutesAgo: 44, hourFires: 11 },
  { n: 15, text: "I kept the voicemail. I know that's a little sad.", fires: 36, minutesAgo: 33, hourFires: 22 },
  { n: 16, text: "Moved back in with my mom at 34. She made soup. I slept.", fires: 8, minutesAgo: 21, hourFires: 6 },
  { n: 17, text: "I voted, paid rent, and called my dad. That was the week.", fires: 14, minutesAgo: 12, hourFires: 14 },
  { n: 18, text: "Thanks for sitting with me at the clinic. I never said it out loud.", fires: 5, minutesAgo: 6, hourFires: 5 },
];

const extraFires = new Map<string, number>();
const simulatedReactors = new Set<string>();
const extraWrites: ExtraWrite[] = [];
const intents = new Map<string, SimIntent>();
let archiveSnapshot: SimulatedArchive | null = null;
const sealedEditions: SimulatedArchive[] = [];
let closedOverride: boolean | null = null;
let endsAtOverride: string | null = null;
let startsAtOverride: string | null = null;
let titleOverride: string | null = null;
let windowMsOverride: number | null = null;
let startedOverride: boolean | null = null;
const visitorNotes: SimulatedFeedback[] = [];
let persistLoaded = false;
let persistMtime = 0;

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 24 * HOUR_MS;
const ELAPSED_MS = 6 * HOUR_MS;
export const SIMULATION_HURRY_MS = 10 * 60 * 1000;
export const SIMULATION_MARK_TEXT = "I paid a dollar so this sentence would stay.";

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

type PersistedState = {
  closed?: boolean | null;
  writes?: ExtraWrite[];
  intents?: SimIntent[];
  fires?: [string, number][];
  reactors?: string[];
  archive?: SimulatedArchive | null;
  editions?: SimulatedArchive[];
  endsAt?: string | null;
  startsAt?: string | null;
  title?: string | null;
  windowMs?: number | null;
  started?: boolean | null;
  feedback?: SimulatedFeedback[];
};

function applyPersisted(raw: PersistedState) {
  closedOverride = raw.closed ?? null;
  endsAtOverride = raw.endsAt ?? null;
  startsAtOverride = raw.startsAt ?? null;
  titleOverride = raw.title ?? null;
  windowMsOverride = raw.windowMs && raw.windowMs > 0 ? raw.windowMs : null;
  startedOverride = raw.started === true;
  extraWrites.splice(0, extraWrites.length, ...(raw.writes ?? []));
  extraFires.clear();
  for (const [id, count] of raw.fires ?? []) extraFires.set(id, count);
  simulatedReactors.clear();
  for (const key of raw.reactors ?? []) simulatedReactors.add(key);
  const stored =
    raw.editions && raw.editions.length > 0
      ? raw.editions
      : raw.archive
        ? [raw.archive]
        : [];
  sealedEditions.splice(0, sealedEditions.length, ...stored);
  archiveSnapshot = raw.archive ?? sealedEditions.at(-1) ?? null;
  intents.clear();
  for (const intent of raw.intents ?? []) {
    intents.set(intent.id, intent);
  }
  visitorNotes.splice(0, visitorNotes.length, ...(raw.feedback ?? []));
}

function ensureLoaded() {
  if (!shouldPersist()) {
    persistLoaded = true;
    return;
  }
  const path = persistPath();
  if (!existsSync(path)) {
    persistLoaded = true;
    persistMtime = 0;
    return;
  }
  let mtime = 0;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    persistLoaded = true;
    return;
  }
  if (persistLoaded && mtime === persistMtime) return;
  persistLoaded = true;
  persistMtime = mtime;
  try {
    applyPersisted(JSON.parse(readFileSync(path, "utf8")) as PersistedState);
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
        editions: sealedEditions,
        endsAt: endsAtOverride,
        startsAt: startsAtOverride,
        title: titleOverride,
        windowMs: windowMsOverride,
        started: startedOverride,
        feedback: visitorNotes,
      }),
    );
    try {
      persistMtime = statSync(path).mtimeMs;
    } catch {
      persistMtime = Date.now();
    }
  } catch {
    // local convenience only
  }
}

function clearLiveSimulation() {
  extraFires.clear();
  simulatedReactors.clear();
  extraWrites.splice(0, extraWrites.length);
  intents.clear();
  archiveSnapshot = null;
  closedOverride = null;
  endsAtOverride = null;
  startsAtOverride = null;
}

function isTestRuntime() {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export function isSimulatedWallStarted(): boolean {
  ensureLoaded();
  if (startedOverride !== null) return startedOverride;
  return isTestRuntime();
}

/** Full wipe, including sealed editions. Used by tests. */
export function resetSimulationState() {
  clearLiveSimulation();
  titleOverride = null;
  windowMsOverride = null;
  startedOverride = null;
  visitorNotes.splice(0, visitorNotes.length);
  sealedEditions.splice(0, sealedEditions.length);
  persistLoaded = true;
  persistMtime = 0;
  if (shouldPersist()) {
    try {
      unlinkSync(persistPath());
    } catch {
      // ignore
    }
  }
}

/** New live day. Sealed editions stay in the library. */
export function resetLiveSimulation() {
  ensureLoaded();
  clearLiveSimulation();
  startedOverride = true;
  persist();
}

export function isSimulatedWallClosed(): boolean {
  ensureLoaded();
  if (closedOverride === true) return true;
  if (closedOverride === false) return false;
  return isArchiveSimulation();
}

function liveEndsAt(now: Date): string {
  return liveWindow(now).endsAt;
}

/** When the clock hits zero, this day is carved into the library. */
export function sealExpiredSimulatedWall(now: Date = new Date()) {
  ensureLoaded();
  if (!isSimulatedWallStarted() || isSimulatedWallClosed()) return archiveSnapshot;
  if (Date.parse(liveEndsAt(now)) > now.getTime()) return null;
  return closeSimulatedWall(now);
}

function carveArchive(now: Date = new Date()): SimulatedArchive {
  const event = simulatedArchivedEvent(now);
  const messages = simulatedMessageList(now, {
    publishedAnchor: new Date(now.getTime() - ELAPSED_MS),
    finalized: true,
  });
  return { event, messages };
}

export function simulatedEditionEventId(editionNumber: number): string {
  return `local-${String(editionNumber).padStart(3, "0")}`;
}

export function editionNumberFromEventId(eventId: string | undefined): number | null {
  if (!eventId) return null;
  const match = eventId.match(/^local-(\d+)$/);
  if (!match) return null;
  const n = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function editionMessageId(editionNumber: number, publicNumber: number): string {
  return `00000000-0000-4000-8${String(editionNumber).padStart(3, "0")}-${String(publicNumber).padStart(12, "0")}`;
}

function nextEditionNumber(): number {
  return sealedEditions.length + 1;
}

function summaryFromArchive(snapshot: SimulatedArchive): EditionSummary {
  const winning =
    [...snapshot.messages].sort(
      (a, b) =>
        (a.finalRank ?? 9999) - (b.finalRank ?? 9999) ||
        b.reactionCount - a.reactionCount,
    )[0] ?? null;
  return {
    id: snapshot.event.id,
    editionNumber: editionNumberOf(snapshot.event),
    slug: snapshot.event.slug,
    title: snapshot.event.title,
    startsAt: snapshot.event.startsAt,
    endsAt: snapshot.event.endsAt,
    finalizedAt: snapshot.event.finalizedAt,
    totalMessages: snapshot.event.totalMessages,
    totalReactions: snapshot.event.totalReactions,
    archiveHash: snapshot.event.archiveHash ?? null,
    merkleRoot: snapshot.event.merkleRoot ?? null,
    archiveUri: snapshot.event.archiveUri ?? null,
    proofTx: snapshot.event.proofTx ?? null,
    winning: highlightFrom(winning),
  };
}

function sealSimulatedArchive(snapshot: SimulatedArchive): SimulatedArchive {
  const sealed = buildCanonicalArchive({ event: snapshot.event, messages: snapshot.messages });
  return {
    event: {
      ...snapshot.event,
      editionNumber: editionNumberOf(snapshot.event),
      archiveHash: sealed.archiveHash,
      merkleRoot: sealed.merkleRoot,
      archiveUri: null,
      proofTx: null,
    },
    messages: snapshot.messages,
  };
}

export function closeSimulatedWall(now: Date = new Date()) {
  ensureLoaded();
  if (closedOverride === true && archiveSnapshot) {
    if (!sealedEditions.some((row) => row.event.id === archiveSnapshot?.event.id)) {
      sealedEditions.push(archiveSnapshot);
      persist();
    }
    return archiveSnapshot;
  }
  const editionNumber = nextEditionNumber();
  const carved = carveArchive(now);
  const eventId = simulatedEditionEventId(editionNumber);
  archiveSnapshot = sealSimulatedArchive({
    event: {
      ...carved.event,
      id: eventId,
      slug: String(editionNumber).padStart(3, "0"),
      editionNumber,
    },
    messages: carved.messages.map((message) => ({
      ...message,
      id: editionMessageId(editionNumber, message.publicNumber),
      eventId,
    })),
  });
  sealedEditions.push(archiveSnapshot);
  closedOverride = true;
  persist();
  return archiveSnapshot;
}

export function listSimulatedEditions(): EditionSummary[] {
  ensureLoaded();
  sealExpiredSimulatedWall();
  if (sealedEditions.length === 0 && archiveSnapshot) {
    sealedEditions.push(archiveSnapshot);
  }
  if (sealedEditions.length === 0 && isSimulatedWallClosed()) {
    closeSimulatedWall();
  }
  return sealedEditions.map(summaryFromArchive);
}

export function getSimulatedEdition(editionNumber: number): SimulatedArchive | null {
  ensureLoaded();
  return (
    sealedEditions.find((row) => editionNumberOf(row.event) === editionNumber) ?? null
  );
}

export function reopenSimulatedWall() {
  resetLiveSimulation();
}

function windowLengthMs() {
  return windowMsOverride && windowMsOverride > 0 ? windowMsOverride : WINDOW_MS;
}

function liveWindow(now: Date): { startsAt: string; endsAt: string } {
  const windowMs = windowLengthMs();
  if (startsAtOverride && endsAtOverride) {
    return { startsAt: startsAtOverride, endsAt: endsAtOverride };
  }
  if (endsAtOverride) {
    const ends = new Date(endsAtOverride);
    return {
      startsAt: startsAtOverride ?? new Date(ends.getTime() - windowMs).toISOString(),
      endsAt: ends.toISOString(),
    };
  }
  if (startsAtOverride) {
    const starts = new Date(startsAtOverride);
    return {
      startsAt: starts.toISOString(),
      endsAt: new Date(starts.getTime() + windowMs).toISOString(),
    };
  }
  const elapsed = Math.min(ELAPSED_MS, Math.floor(windowMs / 4));
  return {
    startsAt: new Date(now.getTime() - elapsed).toISOString(),
    endsAt: new Date(now.getTime() + (windowMs - elapsed)).toISOString(),
  };
}

export type SimulatedWallConfig = {
  title?: string;
  durationMinutes?: number;
  remainingMinutes?: number;
  startsAt?: string;
  endsAt?: string;
};

function clampTitle(value: string) {
  return value.trim().slice(0, 80);
}

export function configureSimulatedWall(input: SimulatedWallConfig) {
  ensureLoaded();
  if (input.title !== undefined) {
    const next = clampTitle(input.title);
    titleOverride = next.length > 0 ? next : "THE WALL";
  }
  if (input.durationMinutes !== undefined) {
    windowMsOverride = Math.max(60_000, Math.round(input.durationMinutes) * 60_000);
    if (startsAtOverride) {
      endsAtOverride = new Date(Date.parse(startsAtOverride) + windowMsOverride).toISOString();
    } else if (endsAtOverride) {
      startsAtOverride = new Date(Date.parse(endsAtOverride) - windowMsOverride).toISOString();
    }
  }
  if (input.startsAt) startsAtOverride = input.startsAt;
  if (input.endsAt) endsAtOverride = input.endsAt;
  if (input.remainingMinutes !== undefined) {
    if (isSimulatedWallClosed()) {
      throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall is closed.", 403);
    }
    if (!isSimulatedWallStarted()) {
      throw new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 403);
    }
    endsAtOverride = new Date(Date.now() + Math.max(1, input.remainingMinutes) * 60_000).toISOString();
    startsAtOverride = new Date(Date.parse(endsAtOverride) - windowLengthMs()).toISOString();
  }
  persist();
  return currentSimulatedEvent();
}

export function holdSimulatedWall() {
  ensureLoaded();
  startedOverride = false;
  closedOverride = false;
  archiveSnapshot = null;
  endsAtOverride = null;
  startsAtOverride = null;
  persist();
  return currentSimulatedEvent();
}

export function startSimulatedWall(input: SimulatedWallConfig = {}) {
  ensureLoaded();
  if (input.title !== undefined) {
    const next = clampTitle(input.title);
    titleOverride = next.length > 0 ? next : "THE WALL";
  }
  if (input.durationMinutes !== undefined) {
    windowMsOverride = Math.max(60_000, Math.round(input.durationMinutes) * 60_000);
  }
  sealExpiredSimulatedWall();
  if (isSimulatedWallClosed()) {
    extraFires.clear();
    simulatedReactors.clear();
    extraWrites.splice(0, extraWrites.length);
    intents.clear();
    archiveSnapshot = null;
    closedOverride = false;
  }
  startedOverride = true;
  const windowMs = windowLengthMs();
  const start = input.startsAt ? new Date(input.startsAt) : new Date();
  startsAtOverride = start.toISOString();
  endsAtOverride = input.endsAt
    ? input.endsAt
    : new Date(start.getTime() + windowMs).toISOString();
  persist();
  return currentSimulatedEvent();
}

export function hurrySimulatedClock(ms: number = SIMULATION_HURRY_MS) {
  ensureLoaded();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall is closed.", 403);
  }
  if (!isSimulatedWallStarted()) {
    throw new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 403);
  }
  endsAtOverride = new Date(Date.now() + Math.max(1_000, ms)).toISOString();
  persist();
  return endsAtOverride;
}

export function publishSimulatedMark(text: string = SIMULATION_MARK_TEXT) {
  ensureLoaded();
  const wallKey = createWallKey();
  const checkout = createSimulatedIntent({
    text,
    userId: "local-sim-mark",
    claimSecretHash: hashWallKey(wallKey),
  });
  const published = fulfillSimulatedPayment({
    intentId: checkout.intentId,
    userId: "local-sim-mark",
    paymentId: checkout.simulatedPaymentId,
  });
  return { ...published, wallKey };
}

export function warmSimulatedFires(count = 4) {
  ensureLoaded();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall is closed.", 403);
  }
  const targets = simulatedMessageList()
    .filter((message) => !message.isRemoved)
    .slice(0, Math.max(1, count));
  const warmed: number[] = [];
  for (const message of targets) {
    warmed.push(addSimulatedReaction(message.id, `local-sim-warm-${randomUUID()}`));
  }
  return { count: warmed.length, totals: warmed };
}

export function runFullSimulation() {
  resetLiveSimulation();
  const published = publishSimulatedMark();
  const fires = warmSimulatedFires();
  const endsAt = hurrySimulatedClock();
  return {
    publicNumber: published.publicNumber,
    endsAt,
    fires: fires.count,
  };
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
  const editionNumber = nextEditionNumber();
  return {
    id: SIMULATION_EVENT_ID,
    slug: process.env.NEXT_PUBLIC_EVENT_SLUG ?? "the-wall",
    title: titleOverride?.trim() || "THE WALL",
    treasuryAddress: process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? null,
    network: process.env.NEXT_PUBLIC_BASE_NETWORK ?? "base-sepolia",
    priceUsdc: PRICE_USDC,
    editionNumber,
    archiveHash: null as string | null,
    merkleRoot: null as string | null,
    archiveUri: null as string | null,
    proofTx: null as string | null,
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
  const window = liveWindow(now);
  const remaining = Date.parse(window.endsAt) - now.getTime();
  const untilStart = Date.parse(window.startsAt) - now.getTime();
  return {
    ...snapshotMeta(),
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    archivedAt: null,
    finalizedAt: null,
    phase: untilStart > 0 ? "upcoming" : remaining <= 0 ? "finalizing" : "live",
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
    startsAt: new Date(endsAt.getTime() - windowLengthMs()).toISOString(),
    endsAt: closed,
    archivedAt: closed,
    finalizedAt: closed,
    phase: "archived",
    serverNow: now.toISOString(),
    totalMessages: messages.length,
    totalReactions: messages.reduce((sum, message) => sum + message.reactionCount, 0),
  };
}

function simulatedUpcomingEvent(now: Date = new Date()): EventSnapshot {
  const windowMs = windowLengthMs();
  const configuredStart = startsAtOverride ? Date.parse(startsAtOverride) : Number.NaN;
  const startsAt =
    Number.isFinite(configuredStart) && configuredStart > now.getTime()
      ? new Date(configuredStart).toISOString()
      : new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...snapshotMeta(),
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + windowMs).toISOString(),
    archivedAt: null,
    finalizedAt: null,
    phase: "upcoming",
    serverNow: now.toISOString(),
    totalMessages: 0,
    totalReactions: 0,
  };
}

export function currentSimulatedEvent(now: Date = new Date()): EventSnapshot {
  ensureLoaded();
  sealExpiredSimulatedWall(now);
  if (archiveSnapshot && isSimulatedWallClosed()) {
    return { ...archiveSnapshot.event, serverNow: now.toISOString() };
  }
  if (isSimulatedWallClosed()) return simulatedArchivedEvent(now);
  if (!isSimulatedWallStarted()) return simulatedUpcomingEvent(now);
  return simulatedLiveEvent(now);
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
  eventId?: string;
}): { messages: PublicMessage[]; nextCursor: string | null } {
  const now = input.now ?? new Date();
  const edition = getSimulatedEdition(editionNumberFromEventId(input.eventId) ?? 0);
  const closed = isSimulatedWallClosed();
  if (!edition && !closed && !isSimulatedWallStarted()) {
    return { messages: [], nextCursor: null };
  }
  const finalized = input.finalized ?? (Boolean(edition) || closed);
  const publishedAnchor = finalized ? new Date(now.getTime() - ELAPSED_MS) : now;
  const all = edition
    ? edition.messages
    : closed && archiveSnapshot && input.finalized !== false
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

export function getSimulatedMessage(publicNumber: number, eventId?: string): PublicMessage {
  ensureLoaded();
  const edition = getSimulatedEdition(editionNumberFromEventId(eventId) ?? 0);
  const closed = isSimulatedWallClosed();
  const found = (
    edition
      ? edition.messages
      : closed && archiveSnapshot
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
  return eventId === SIMULATION_EVENT_ID || editionNumberFromEventId(eventId) !== null;
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
  sealExpiredSimulatedWall();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall closed during checkout.", 403);
  }
  if (!isSimulatedWallStarted()) {
    throw new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 403);
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
    editionNumber: editionNumberOf(event),
    totalMessages: event.totalMessages,
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

export function addSimulatedFeedback(input: {
  body: string;
  category: FeedbackCategory;
  email?: string | null;
}): SimulatedFeedback {
  ensureLoaded();
  const note: SimulatedFeedback = {
    id: randomUUID(),
    body: input.body.trim(),
    category: input.category,
    email: input.email?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  visitorNotes.unshift(note);
  persist();
  return note;
}

export function listSimulatedFeedback(limit = 50): SimulatedFeedback[] {
  ensureLoaded();
  return visitorNotes.slice(0, limit);
}
