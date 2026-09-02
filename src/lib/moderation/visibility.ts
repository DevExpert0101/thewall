/** Flagged / pending sentences stay off public feeds until an operator acts. */

export function isHeldStatus(status: string | null | undefined): boolean {
  return status === "flagged" || status === "pending";
}

export function isLivingForPublic<
  T extends { isRemoved?: boolean; isHeld?: boolean },
>(message: T): boolean {
  return message.isRemoved !== true && message.isHeld !== true;
}
