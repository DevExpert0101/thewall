import { applyAdminEventControl } from "@/lib/admin/event-control";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addSimulatedReaction,
  closeSimulatedWall,
  createSimulatedIntent,
  currentSimulatedEvent,
  expireSimulatedWall,
  fulfillSimulatedPayment,
  listSimulatedMonumentEntries,
  resetSimulationState,
  startSimulatedWall,
  verifySimulatedClaim,
} from "@/lib/data/simulation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertAutomatedTestSafe } from "@/lib/testing/guard";

export type PaidMark = {
  text: string;
  userId: string;
  wallKey: string;
  intentId: string;
  paymentId: string;
  publicNumber: number;
  messageId: string;
};

let markSerial = 0;

function nextMarkText(): string {
  markSerial += 1;
  return `QA left mark ${markSerial} ${Date.now().toString(36)}.`;
}

function nextUserId(label = "qa"): string {
  markSerial += 1;
  return `local-sim-${label}-${markSerial}`;
}

/** Wipe the local mock. Safe only inside automated tests. */
export function resetAutomatedWall(): void {
  assertAutomatedTestSafe();
  resetSimulationState();
}

export function openAutomatedWall(title = "QA WALL"): ReturnType<typeof currentSimulatedEvent> {
  assertAutomatedTestSafe();
  resetSimulationState();
  return startSimulatedWall({
    title,
    durationMinutes: 60,
    startsAt: new Date(Date.now() - 60_000).toISOString(),
  });
}

/** Next live day. Sealed Monument entries stay. */
export function openNextAutomatedWall(title = "QA WALL NEXT"): ReturnType<typeof currentSimulatedEvent> {
  assertAutomatedTestSafe();
  return startSimulatedWall({
    title,
    durationMinutes: 60,
    startsAt: new Date().toISOString(),
  });
}

export function payAndPublish(text = nextMarkText(), userId = nextUserId()): PaidMark {
  assertAutomatedTestSafe();
  if (currentSimulatedEvent().phase !== "live") {
    throw new AppError(ERROR_CODES.EVENT_NOT_LIVE, "The Wall is not open for a test write.", 403);
  }
  const wallKey = createWallKey();
  const checkout = createSimulatedIntent({
    text,
    userId,
    claimSecretHash: hashWallKey(wallKey),
  });
  const published = fulfillSimulatedPayment({
    intentId: checkout.intentId,
    userId,
    paymentId: checkout.simulatedPaymentId,
  });
  return {
    text,
    userId,
    wallKey,
    intentId: checkout.intentId,
    paymentId: checkout.simulatedPaymentId,
    publicNumber: published.publicNumber,
    messageId: published.messageId,
  };
}

export function reactOnce(messageId: string, userId = nextUserId("fire"), now?: Date): number {
  assertAutomatedTestSafe();
  return addSimulatedReaction(messageId, userId, undefined, now);
}

export function addReactions(messageId: string, count: number): number {
  let last = 0;
  for (let i = 0; i < count; i += 1) {
    last = reactOnce(messageId, `local-sim-bulk-${messageId}-${i}`);
  }
  return last;
}

export function openUpcomingWall(title = "QA UPCOMING") {
  assertAutomatedTestSafe();
  resetSimulationState();
  return startSimulatedWall({
    title,
    durationMinutes: 5,
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}

export function openShortLiveWall(minutes = 5) {
  assertAutomatedTestSafe();
  resetSimulationState();
  return startSimulatedWall({
    title: "QA SHORT WALL",
    durationMinutes: minutes,
    startsAt: new Date(Date.now() - 1000).toISOString(),
  });
}

export function createUnpaidIntent(text: string, userId = nextUserId("intent"), now?: Date) {
  assertAutomatedTestSafe();
  const wallKey = createWallKey();
  const checkout = createSimulatedIntent({
    text,
    userId,
    claimSecretHash: hashWallKey(wallKey),
    now,
  });
  return { text, userId, wallKey, checkout };
}

export function closeForReview() {
  assertAutomatedTestSafe();
  return expireSimulatedWall();
}

export async function discloseResults() {
  assertAutomatedTestSafe();
  if (currentSimulatedEvent().phase === "live") {
    expireSimulatedWall();
  }
  return applyAdminEventControl({
    action: "finish",
    confirm: true,
    confirmText: "FINISH",
  });
}

export function sealAutomatedWall(now = new Date()) {
  assertAutomatedTestSafe();
  return closeSimulatedWall(now);
}

export function claimWithKey(publicNumber: number, wallKey: string) {
  assertAutomatedTestSafe();
  return verifySimulatedClaim({ publicNumber, wallKey });
}

export function monumentCatalog() {
  assertAutomatedTestSafe();
  return listSimulatedMonumentEntries();
}
