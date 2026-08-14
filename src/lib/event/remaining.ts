function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function remainingMsFrom(endsAt: string, now: Date | string | number): number {
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  return Math.max(0, new Date(endsAt).getTime() - nowMs);
}

export function formatRemainingClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function remainingLabel(endsAt: string, now: Date | string | number = new Date()): string {
  return `${formatRemainingClock(remainingMsFrom(endsAt, now))} REMAINING`;
}

/** Honest remaining language for share copy. Floors whole units — never rounds up. */
export function remainClause(endsAt: string, now: Date | string | number = new Date()): string {
  const ms = remainingMsFrom(endsAt, now);
  if (ms <= 0) return "The Wall is closed";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000);
  if (hours >= 2) return `${hours} hours remain`;
  if (hours === 1) return "1 hour remains";
  if (minutes >= 2) return `${minutes} minutes remain`;
  if (minutes === 1) return "1 minute remains";
  return "Moments remain";
}

export function untilOpenClause(startsAt: string, now: Date | string | number = new Date()): string {
  const ms = remainingMsFrom(startsAt, now);
  if (ms <= 0) return "The Wall is open";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000);
  if (hours >= 2) return `The Wall opens in ${hours} hours`;
  if (hours === 1) return "The Wall opens in 1 hour";
  if (minutes >= 2) return `The Wall opens in ${minutes} minutes`;
  if (minutes === 1) return "The Wall opens in 1 minute";
  return "The Wall opens in moments";
}
