import { formatCount, formatMessageMark } from "@/lib/utils";

export type MilestoneKind = "message" | "fire";

export type Milestone = {
  id: string;
  kind: MilestoneKind;
  value: number;
  celebrate: boolean;
};

export type Totals = {
  messages: number;
  reactions: number;
};

/** Exact public numbers that become a mark. Sparse on purpose. */
export const MESSAGE_MARKS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;

/** Extra archive-only number kept from the original record book. */
export const ARCHIVE_MESSAGE_MARKS = [250_000] as const;

/** Verified 🔥 totals. No invented peaks. */
export const FIRE_MARKS = [10_000, 100_000, 1_000_000] as const;

const CELEBRATE_MESSAGE = new Set([1, 1_000, 10_000, 100_000, 1_000_000]);
const CELEBRATE_FIRE = new Set([10_000, 100_000, 1_000_000]);

function messageMark(value: number, celebrate = CELEBRATE_MESSAGE.has(value)): Milestone {
  return { id: `message:${value}`, kind: "message", value, celebrate };
}

function fireMark(value: number): Milestone {
  return { id: `fire:${value}`, kind: "fire", value, celebrate: CELEBRATE_FIRE.has(value) };
}

export function isMessageMark(value: number): boolean {
  return (MESSAGE_MARKS as readonly number[]).includes(value);
}

export function isFireMark(value: number): boolean {
  return (FIRE_MARKS as readonly number[]).includes(value);
}

export function parseMilestoneQuery(input: {
  mark?: string | null;
  fire?: string | null;
}): Milestone | null {
  if (input.mark && input.fire) return null;
  if (input.mark) {
    const value = Number.parseInt(input.mark, 10);
    if (!Number.isInteger(value) || !isMessageMark(value)) return null;
    return messageMark(value);
  }
  if (input.fire) {
    const value = Number.parseInt(input.fire, 10);
    if (!Number.isInteger(value) || !isFireMark(value)) return null;
    return fireMark(value);
  }
  return null;
}

export function hasReachedMilestone(totals: Totals, milestone: Milestone): boolean {
  if (milestone.kind === "message") return totals.messages >= milestone.value;
  return totals.reactions >= milestone.value;
}

export function reachedMilestones(totals: Totals): Milestone[] {
  const marks: Milestone[] = [];
  for (const value of MESSAGE_MARKS) {
    if (totals.messages >= value) marks.push(messageMark(value));
  }
  for (const value of FIRE_MARKS) {
    if (totals.reactions >= value) marks.push(fireMark(value));
  }
  return marks;
}

export function crossedMilestones(previous: Totals, next: Totals): Milestone[] {
  if (next.messages < previous.messages || next.reactions < previous.reactions) return [];
  return reachedMilestones(next).filter((mark) => !hasReachedMilestone(previous, mark));
}

/** One toast at a time. Highest value wins so a burst does not stack. */
export function rarestCelebration(previous: Totals, next: Totals): Milestone | null {
  const hits = crossedMilestones(previous, next).filter((mark) => mark.celebrate);
  if (hits.length === 0) return null;
  return [...hits].sort((a, b) => b.value - a.value || (a.kind === "message" ? -1 : 1))[0] ?? null;
}

export function milestoneHeadline(milestone: Milestone): string {
  if (milestone.kind === "message") return formatMessageMark(milestone.value);
  return `${formatCount(milestone.value)} 🔥`;
}

export function milestoneChorus(milestone: Milestone): string {
  if (milestone.kind === "message") {
    if (milestone.value === 1) return "THE FIRST SENTENCE.";
    return `${formatCount(milestone.value)} PEOPLE HAVE SPOKEN.`;
  }
  return "THE FIRE IS RISING.";
}

export function archiveMessageMarks(): number[] {
  return [...MESSAGE_MARKS, ...ARCHIVE_MESSAGE_MARKS].sort((a, b) => a - b);
}
