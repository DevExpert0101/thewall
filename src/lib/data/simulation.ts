import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveMessageSort, type AcceptedSort, type FeedbackCategory, type MessageSort } from "@/lib/constants";
import { ARCHIVAL_REMOVAL_TEXT, ARCHIVAL_TAGLINE, PAYMENT_INTENT_TTL_SECONDS, PRICE_USDC } from "@/lib/constants";
import { createWallKey, hashOwnershipSecret, hashWallKey, sha256Hex, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getNetwork, getTreasuryAddress, isArchiveSimulation } from "@/lib/env";
import { isVercelProduction } from "@/lib/env/production";
import { normalizeMessage } from "@/lib/message/normalize";
import { bindMessageHash } from "@/lib/payment/fulfillment";
import { paidAfterCloseError } from "@/lib/payment/recover";
import { assertCanCharge } from "@/lib/publish/gate";
import { compareRising, inFinalHour, selectHiddenGems } from "@/lib/ranking";
import { buildCanonicalArchive } from "@/lib/archive/canonical";
import { highlightFrom } from "@/lib/archive/records";
import { defaultEventOps, type EventOpsControls } from "@/lib/ops/controls";
import { monumentFromSealedWall } from "@/lib/monument/from-archive";
import { parseMonumentCapacity } from "@/lib/monument/policy";
import type { MonumentEntry } from "@/lib/monument/types";
import type { CertificatePayload, EditionSummary, EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatUtcDate } from "@/lib/utils";
import { pageWindow } from "@/lib/wall/feed";
import { pickPublicNumbers } from "@/lib/wall/random";

export const SIMULATION_EVENT_ID = "local";
const SIM_TREASURY = "0x0000000000000000000000000000000000000001" as const;
const MISSING_CLAIM_HASH = hashOwnershipSecret("the-wall-missing-claim-placeholder-key");

type Seed = {
  n: number;
  text: string;
  fires: number;
  minutesAgo: number;
  hourFires?: number;
  hourMinutes?: number;
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
  moderationStatus?: "approved" | "flagged";
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
  { n: 13, text: "My kid asked if I was happy. I said yes. Working on it.", fires: 19, minutesAgo: 58, hourFires: 8, hourMinutes: 7 },
  { n: 14, text: "Quit smoking on a Wednesday because the gum was on sale.", fires: 11, minutesAgo: 44, hourFires: 11, hourMinutes: 9 },
  { n: 15, text: "I kept the voicemail. I know that's a little sad.", fires: 36, minutesAgo: 33, hourFires: 22, hourMinutes: 12 },
  { n: 16, text: "Moved back in with my mom at 34. She made soup. I slept.", fires: 8, minutesAgo: 21, hourFires: 6, hourMinutes: 5 },
  { n: 17, text: "I voted, paid rent, and called my dad. That was the week.", fires: 14, minutesAgo: 12, hourFires: 14, hourMinutes: 10 },
  { n: 18, text: "Thanks for sitting with me at the clinic. I never said it out loud.", fires: 5, minutesAgo: 6, hourFires: 5, hourMinutes: 5 },
];

const extraFires = new Map<string, number>();
const simulatedReactors = new Set<string>();
const simulatedIdempotency = new Map<string, string>();
const extraWrites: ExtraWrite[] = [];
const winnerDeliveries = new Map<string, { contactEmail: string | null; payoutAddress: string | null }>();
const intents = new Map<string, SimIntent>();
let archiveSnapshot: SimulatedArchive | null = null;
const sealedEditions: SimulatedArchive[] = [];
let closedOverride: boolean | null = null;
let endsAtOverride: string | null = null;
let startsAtOverride: string | null = null;
let titleOverride: string | null = null;
let themeSlugOverride: string | null = null;
let themeQuestionOverride: string | null = null;
let themeDescriptionOverride: string | null = null;
let windowMsOverride: number | null = null;
let startedOverride: boolean | null = null;
const visitorNotes: SimulatedFeedback[] = [];
let opsOverride: EventOpsControls = defaultEventOps();
const opsAudit: SimulatedOpsAudit[] = [];
let persistLoaded = false;
let persistMtime = 0;

export type SimulatedOpsAudit = {
  id?: string;
  action: string;
  actorEmail: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

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
  themeSlug?: string | null;
  themeQuestion?: string | null;
  themeDescription?: string | null;
  windowMs?: number | null;
  started?: boolean | null;
  feedback?: SimulatedFeedback[];
  ops?: EventOpsControls;
  opsAudit?: SimulatedOpsAudit[];
};

function applyPersisted(raw: PersistedState) {
  closedOverride = raw.closed ?? null;
  endsAtOverride = raw.endsAt ?? null;
  startsAtOverride = raw.startsAt ?? null;
  titleOverride = raw.title ?? null;
  themeSlugOverride = raw.themeSlug ?? null;
  themeQuestionOverride = raw.themeQuestion ?? null;
  themeDescriptionOverride = raw.themeDescription ?? null;
  windowMsOverride = raw.windowMs && raw.windowMs > 0 ? raw.windowMs : null;
  startedOverride = raw.started === true;
  extraWrites.splice(0, extraWrites.length, ...(raw.writes ?? []));
  extraFires.clear();
  for (const [id, count] of raw.fires ?? []) extraFires.set(id, count);
  simulatedReactors.clear();
  simulatedIdempotency.clear();
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
  opsOverride = raw.ops ? { ...defaultEventOps(), ...raw.ops } : defaultEventOps();
  opsAudit.splice(0, opsAudit.length, ...(raw.opsAudit ?? []));
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
        themeSlug: themeSlugOverride,
        themeQuestion: themeQuestionOverride,
        themeDescription: themeDescriptionOverride,
        windowMs: windowMsOverride,
        started: startedOverride,
        feedback: visitorNotes,
        ops: opsOverride,
        opsAudit,
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
  simulatedIdempotency.clear();
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
  themeSlugOverride = null;
  themeQuestionOverride = null;
  themeDescriptionOverride = null;
  windowMsOverride = null;
  startedOverride = null;
  visitorNotes.splice(0, visitorNotes.length);
  sealedEditions.splice(0, sealedEditions.length);
  winnerDeliveries.clear();
  opsOverride = defaultEventOps();
  opsAudit.splice(0, opsAudit.length);
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
  const now = new Date();
  const windowMs = windowLengthMs();
  startsAtOverride = now.toISOString();
  endsAtOverride = new Date(now.getTime() + windowMs).toISOString();
  opsOverride = defaultEventOps();
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

function isSimulatedWallExpired(now: Date = new Date()) {
  ensureLoaded();
  if (!isSimulatedWallStarted() || isSimulatedWallClosed()) return false;
  return Date.parse(liveEndsAt(now)) <= now.getTime();
}

function assertSimulatedWallWritable(now: Date = new Date()) {
  if (!isSimulatedWallStarted()) {
    throw new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 403);
  }
  if (isSimulatedWallClosed() || isSimulatedWallExpired(now)) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
  }
}

/** Clock expiry only stops writes. Results stay private until Finish. */
export function sealExpiredSimulatedWall() {
  return null;
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
    monumentNumber: sealedEditions.findIndex((row) => row.event.id === snapshot.event.id) + 1 || null,
    themeQuestion: snapshot.event.themeQuestion ?? null,
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

export function listSimulatedMonumentEntries(): MonumentEntry[] {
  const editions = listSimulatedEditions();
  const entries: MonumentEntry[] = [];
  editions.forEach((edition, index) => {
    const stored = getSimulatedEdition(edition.editionNumber);
    if (!stored) return;
    const entry = monumentFromSealedWall({
      monumentNumber: index + 1,
      event: stored.event,
      messages: stored.messages,
    });
    if (entry) entries.push(entry);
  });
  return entries;
}

export function getSimulatedMonumentEntry(monumentNumber: number): MonumentEntry | null {
  return listSimulatedMonumentEntries().find((row) => row.monumentNumber === monumentNumber) ?? null;
}

export function simulatedMonumentCapacity(): number | null {
  return parseMonumentCapacity(process.env.MONUMENT_CAPACITY);
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
  if (startedOverride === true) {
    if (startsAtOverride) {
      const starts = new Date(startsAtOverride);
      return {
        startsAt: starts.toISOString(),
        endsAt: (endsAtOverride
          ? new Date(endsAtOverride)
          : new Date(starts.getTime() + windowMs)
        ).toISOString(),
      };
    }
    if (endsAtOverride) {
      const ends = new Date(endsAtOverride);
      return {
        startsAt: new Date(ends.getTime() - windowMs).toISOString(),
        endsAt: ends.toISOString(),
      };
    }
    const closed = new Date(now.getTime() - 1000);
    return {
      startsAt: new Date(closed.getTime() - windowMs).toISOString(),
      endsAt: closed.toISOString(),
    };
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
  themeSlug?: string;
  themeQuestion?: string;
  themeDescription?: string;
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
  if (input.themeSlug !== undefined) {
    const slug = input.themeSlug.trim().toLowerCase();
    themeSlugOverride = slug.length > 0 ? slug.slice(0, 80) : null;
  }
  if (input.themeQuestion !== undefined) {
    const next = input.themeQuestion.trim().slice(0, 280);
    themeQuestionOverride = next.length > 0 ? next : null;
  }
  if (input.themeDescription !== undefined) {
    const next = input.themeDescription.trim().slice(0, 800);
    themeDescriptionOverride = next.length > 0 ? next : null;
  }
  if (input.startsAt) startsAtOverride = input.startsAt;
  if (input.endsAt) endsAtOverride = input.endsAt;
  if (input.durationMinutes !== undefined) {
    windowMsOverride = Math.max(60_000, Math.round(input.durationMinutes) * 60_000);
    if (startsAtOverride) {
      endsAtOverride = new Date(Date.parse(startsAtOverride) + windowMsOverride).toISOString();
    } else if (endsAtOverride) {
      startsAtOverride = new Date(Date.parse(endsAtOverride) - windowMsOverride).toISOString();
    }
  }
  if (input.remainingMinutes !== undefined) {
    if (isSimulatedWallClosed()) {
      throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
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
  if (isSimulatedWallExpired()) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      "Finish this Wall before opening the next day.",
      409,
    );
  }
  if (isSimulatedWallClosed()) {
    extraFires.clear();
    simulatedReactors.clear();
    simulatedIdempotency.clear();
    extraWrites.splice(0, extraWrites.length);
    intents.clear();
    archiveSnapshot = null;
    closedOverride = false;
  }
  startedOverride = true;
  const windowMs = windowLengthMs();
  const start = input.startsAt ? new Date(input.startsAt) : new Date();
  startsAtOverride = start.toISOString();
  endsAtOverride =
    input.durationMinutes !== undefined
      ? new Date(start.getTime() + windowMs).toISOString()
      : input.endsAt
        ? input.endsAt
        : new Date(start.getTime() + windowMs).toISOString();
  persist();
  return currentSimulatedEvent();
}

/** Stop writes without disclosing ranks or carving an edition. */
export function expireSimulatedWall(now: Date = new Date()) {
  ensureLoaded();
  if (isSimulatedWallClosed()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "This Wall is already sealed.", 409);
  }
  if (!isSimulatedWallStarted()) {
    throw new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 409);
  }
  endsAtOverride = now.toISOString();
  persist();
  return currentSimulatedEvent(now);
}

export function hurrySimulatedClock(ms: number = SIMULATION_HURRY_MS) {
  ensureLoaded();
  assertSimulatedWallWritable();
  endsAtOverride = new Date(Date.now() + Math.max(1_000, ms)).toISOString();
  persist();
  return endsAtOverride;
}

export function simulatedTextAlreadyPublished(text: string): boolean {
  ensureLoaded();
  const needle = normalizeMessage(text);
  if (!needle) return false;
  if (extraWrites.some((row) => normalizeMessage(row.text) === needle)) return true;
  return SEEDS.some((seed) => !seed.removed && normalizeMessage(seed.text) === needle);
}

export function publishSimulatedMark(text: string = SIMULATION_MARK_TEXT) {
  ensureLoaded();
  const checked = assertCanCharge(text);
  if (simulatedTextAlreadyPublished(checked.text)) {
    throw new AppError(
      ERROR_CODES.MODERATION_REJECTED,
      "This sentence cannot be published.",
      422,
    );
  }
  const wallKey = createWallKey();
  const checkout = createSimulatedIntent({
    text: checked.text,
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
  assertSimulatedWallWritable();
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
    themeSlug: themeSlugOverride,
    themeQuestion: themeQuestionOverride,
    themeDescription: themeDescriptionOverride,
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

function pickFromList(
  all: PublicMessage[],
  exclude: number[],
  count: number,
  random?: () => number,
): { messages: PublicMessage[]; remaining: number; total: number } {
  const maxNumber = all.reduce((max, message) => Math.max(max, message.publicNumber), 0);
  const numbers = pickPublicNumbers({ maxNumber, exclude, count, random });
  const byNumber = new Map(all.map((message) => [message.publicNumber, message]));
  const messages = numbers
    .map((n) => byNumber.get(n))
    .filter((message): message is PublicMessage => Boolean(message));
  const blocked = new Set(exclude.filter((n) => n >= 1 && n <= maxNumber));
  return {
    messages,
    remaining: Math.max(0, maxNumber - blocked.size - messages.length),
    total: maxNumber,
  };
}

export function pickSimulatedRandomMessages(input: {
  eventId?: string;
  exclude?: number[];
  count?: number;
  now?: Date;
  random?: () => number;
}): { messages: PublicMessage[]; remaining: number; total: number } {
  const listed = listSimulatedMessages({
    sort: "new",
    limit: 10_000,
    eventId: input.eventId,
    now: input.now,
  });
  return pickFromList(listed.messages, input.exclude ?? [], input.count ?? 2, input.random);
}

export function listSimulatedMessages(input: {
  sort: AcceptedSort | MessageSort;
  limit: number;
  salt?: string;
  now?: Date;
  finalized?: boolean;
  cursor?: string;
  eventId?: string;
  endsAt?: string;
}): { messages: PublicMessage[]; nextCursor: string | null } {
  const now = input.now ?? new Date();
  const sort = resolveMessageSort(input.sort);
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
  const endsAt = input.endsAt ?? edition?.event.endsAt ?? currentSimulatedEvent(now).endsAt;
  let ordered = all;

  if (sort === "new") {
    ordered = [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.publicNumber - a.publicNumber);
  } else if (sort === "hot") {
    ordered = [...all].sort(
      (a, b) =>
        b.reactionCount - a.reactionCount ||
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.publicNumber - b.publicNumber,
    );
  } else if (sort === "rising") {
    const byNumber = new Map(SEEDS.map((seed) => [seed.n, seed]));
    const scored = all
      .map((message) => {
        const seed = byNumber.get(message.publicNumber);
        const extra = extraFires.get(message.id) ?? 0;
        const hourCount = (seed?.hourFires ?? 0) + extra;
        const ageMinutes = Math.max(1, Math.ceil((now.getTime() - Date.parse(message.publishedAt)) / 60_000));
        const recordedMinutes = (seed?.hourMinutes ?? 0) + extra;
        const hourMinutes = Math.min(
          60,
          recordedMinutes > 0 ? recordedMinutes : hourCount > 0 ? Math.min(hourCount, ageMinutes) : 0,
        );
        return { message, hourCount, hourMinutes };
      })
      .filter((row) => row.hourCount > 0);
    ordered =
      scored.length > 0
        ? scored
            .sort((a, b) =>
              compareRising(
                {
                  hourCount: a.hourCount,
                  hourMinutes: a.hourMinutes,
                  reactionCount: a.message.reactionCount,
                  publishedAt: a.message.publishedAt,
                  publicNumber: a.message.publicNumber,
                },
                {
                  hourCount: b.hourCount,
                  hourMinutes: b.hourMinutes,
                  reactionCount: b.message.reactionCount,
                  publishedAt: b.message.publishedAt,
                  publicNumber: b.message.publicNumber,
                },
                now,
              ),
            )
            .map((row) => row.message)
        : [...all].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  } else if (sort === "random") {
    const picked = pickFromList(all, [], input.limit);
    ordered = picked.messages;
  } else if (sort === "gems") {
    const gemNow = Date.parse(endsAt) <= now.getTime() ? new Date(endsAt) : now;
    ordered = selectHiddenGems(all, gemNow);
  } else if (sort === "final") {
    ordered = [...all]
      .filter((message) => inFinalHour(message.publishedAt, endsAt))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.publicNumber - a.publicNumber);
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

export function addSimulatedReaction(
  messageId: string,
  userId = "local-sim",
  idempotencyKey?: string,
): number {
  assertSimulatedWallWritable();
  const message = simulatedMessageList().find((row) => row.id === messageId);
  if (!message || message.isRemoved) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }
  if (idempotencyKey) {
    const prior = simulatedIdempotency.get(`${userId}:${idempotencyKey}`);
    if (prior && prior !== messageId) {
      throw new AppError(ERROR_CODES.VALIDATION, "Reaction replay does not match this sentence.");
    }
    if (prior === messageId) {
      return message.reactionCount;
    }
  }
  const key = `${userId}:${messageId}`;
  if (simulatedReactors.has(key)) {
    throw new AppError(ERROR_CODES.DUPLICATE_REACTION, "Already reacted.");
  }
  simulatedReactors.add(key);
  if (idempotencyKey) {
    simulatedIdempotency.set(`${userId}:${idempotencyKey}`, messageId);
  }
  const next = (extraFires.get(messageId) ?? 0) + 1;
  extraFires.set(messageId, next);
  persist();
  return message.reactionCount + 1;
}

export function isSimulationEvent(eventId: string): boolean {
  return eventId === SIMULATION_EVENT_ID || editionNumberFromEventId(eventId) !== null;
}

/** Vercel production must never checkout or react against the local mock. */
export function assertNotSimulatedInProduction(eventId: string): void {
  if (!isVercelProduction()) return;
  if (!isSimulationEvent(eventId)) return;
  throw new AppError(ERROR_CODES.CONFIG, "The live Wall is not configured.", 503);
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
  assertSimulatedWallWritable();
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
}): { publicNumber: number; messageId: string; publishedAt: string; recovered?: true } {
  ensureLoaded();
  const intent = intents.get(input.intentId);
  if (!intent) {
    throw new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent not found.");
  }
  if (intent.userId !== input.userId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "This payment does not belong to you.", 403);
  }
  if (intent.status === "fulfilled") {
    const write = extraWrites.find((row) => tokensEqual(row.claimHash, intent.claimSecretHash));
    if (write) {
      return {
        publicNumber: write.publicNumber,
        messageId: messageId(write.publicNumber),
        publishedAt: write.publishedAt,
        recovered: true,
      };
    }
    throw new AppError(ERROR_CODES.INTENT_FULFILLED, "Payment already used.");
  }
  if (isSimulatedWallClosed() || isSimulatedWallExpired()) {
    if (intent.paymentId === input.paymentId.toLowerCase()) {
      throw paidAfterCloseError();
    }
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall closed during checkout.", 403);
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

  const checked = assertCanCharge(intent.text);
  if (checked.text !== intent.text) {
    throw new AppError(ERROR_CODES.HASH_MISMATCH, "The paid message no longer matches checkout.");
  }
  if (simulatedTextAlreadyPublished(checked.text)) {
    throw new AppError(
      ERROR_CODES.MODERATION_REJECTED,
      "This sentence cannot be published.",
      422,
    );
  }

  const publicNumber = SEEDS.length + extraWrites.length + 1;
  const publishedAt = new Date().toISOString();
  extraWrites.push({
    publicNumber,
    text: intent.text,
    claimHash: intent.claimSecretHash,
    publishedAt,
    fires: 0,
    moderationStatus: checked.moderationStatus === "flagged" ? "flagged" : "approved",
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
    archiveHash: event.archiveHash ?? null,
    merkleRoot: event.merkleRoot ?? null,
    proofTx: event.proofTx ?? null,
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
    nominated: winnerDeliveries.has(message.id),
  };
}

export function saveSimulatedWinnerDelivery(input: {
  messageId: string;
  contactEmail: string | null;
  payoutAddress: string | null;
}) {
  winnerDeliveries.set(input.messageId, {
    contactEmail: input.contactEmail,
    payoutAddress: input.payoutAddress,
  });
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

export function getSimulatedOps(): EventOpsControls {
  ensureLoaded();
  return { ...opsOverride };
}

export function setSimulatedOps(next: EventOpsControls): EventOpsControls {
  ensureLoaded();
  opsOverride = {
    publishEnabled: next.publishEnabled !== false,
    reactEnabled: next.reactEnabled !== false,
    strictBot: next.strictBot === true,
  };
  persist();
  return getSimulatedOps();
}

export function recordSimulatedOpsAction(row: SimulatedOpsAudit) {
  ensureLoaded();
  opsAudit.unshift({
    id: row.id ?? randomUUID(),
    action: row.action,
    actorEmail: row.actorEmail,
    before: row.before,
    after: row.after,
    createdAt: row.createdAt,
  });
  if (opsAudit.length > 80) opsAudit.length = 80;
  persist();
}

export function listSimulatedOpsAudit(limit = 40): Array<SimulatedOpsAudit & { id: string }> {
  ensureLoaded();
  return opsAudit.slice(0, limit).map((row) => ({
    ...row,
    id: row.id ?? randomUUID(),
  }));
}

export function listSimulatedIntents(): Array<{ status: SimIntent["status"]; createdAt: string }> {
  ensureLoaded();
  return [...intents.values()].map((intent) => ({
    status: intent.status,
    createdAt: intent.createdAt,
  }));
}
