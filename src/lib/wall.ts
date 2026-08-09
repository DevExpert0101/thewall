export interface WallRow {
  id: string;
  title: string;
  created_at: string;
  ends_at: string;
  frozen: boolean;
  /** False while an admin has paused submissions (wall still visible). */
  accepting?: boolean;
}

export interface MessageRow {
  id: string;
  wall_id: string;
  message_number: number;
  content: string;
  reactions: number;
  status: string;
  created_at: string;
  /** Reactions received in the last 30 minutes (from trend_scores RPC). */
  recentReactions?: number;
  /** Distinct devices among those recent reactions. */
  distinctReactions?: number;
}

// ---- Velocity-based trending ---------------------------------------------
// Mirrors the trend score used to rank TRENDING mode. Raw reaction count gives
// the earliest poster an unfair lead; velocity rewards what is hot right now,
// so a message posted late into the event can still explode.
//
//   trend = sqrt(velocity) × quality × timeAdjust
//
// velocity: recent reactions per minute (30-min window), falling back to the
//           lifetime rate for legacy messages with no reaction_events.
// quality:  0.5 + 0.5 × spread, where spread = distinct reactors / reactions
//           (punishes a single device stacking reactions on one message).
// timeAdjust: 1 / (1 + ageHours)^0.5 — a mild gravity, keeps the feed alive.
const TREND_WINDOW_MIN = 30;
const TREND_GRAVITY = 0.5;

export function trendScore(
  m: Pick<
    MessageRow,
    "created_at" | "reactions" | "recentReactions" | "distinctReactions"
  >,
  now: number = Date.now(),
): number {
  const ageMin = Math.max(
    (now - new Date(m.created_at).getTime()) / 60000,
    0.001,
  );
  const recent = m.recentReactions ?? 0;
  const recentRate = recent / Math.max(Math.min(TREND_WINDOW_MIN, ageMin), 0.001);
  const velocity = recent > 0 ? recentRate : m.reactions / ageMin;
  const spread =
    recent > 0 ? (m.distinctReactions ?? recent) / Math.max(recent, 1) : 1;
  const quality = 0.5 + 0.5 * spread;
  const timeAdjust = 1 / Math.pow(1 + ageMin / 60, TREND_GRAVITY);
  return Math.sqrt(Math.max(velocity, 0)) * quality * timeAdjust;
}

export function isFrozen(wall: Pick<WallRow, "frozen" | "ends_at">): boolean {
  if (wall.frozen) return true;
  return new Date(wall.ends_at).getTime() <= Date.now();
}

// A wall accepts new messages only while it is live AND an admin has not
// paused submissions.
export function isOpen(wall: Pick<WallRow, "frozen" | "ends_at" | "accepting">): boolean {
  if (isFrozen(wall)) return false;
  return wall.accepting !== false;
}

// The number is a place in history, not a counter: #000001, #000221, #428913.
export function formatMessageNumber(n: number): string {
  return String(n).padStart(6, "0");
}

export function formatDuration(
  createdAt: string,
  endsAt: string,
): string {
  const ms = new Date(endsAt).getTime() - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// "AUG 9 2026" — the compact wall date shown on share cards. UTC so the
// printed date never shifts with the viewer's timezone.
export function formatShortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .replace(",", "")
    .toUpperCase();
}

// "AUGUST 8, 2026" — the event date, as printed on the frozen monument.
// UTC so it never shifts with the viewer's timezone.
export function formatLongDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

// "42,913th" — the voice's place in history, as printed on certificates.
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n.toLocaleString("en-US")}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

// The event's date. Walls are titled "The Wall — August 8, 2026"; that date is
// the event identity (share cards and certificates print it). Falls back to the
// wall's creation timestamp if the title carries no date.
export function wallEventDate(wall: Pick<WallRow, "title" | "created_at">): string {
  const m = wall.title.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month >= 0) {
      return new Date(Date.UTC(Number(m[3]), month, Number(m[2]))).toISOString();
    }
  }
  return wall.created_at;
}

export function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function randomTxHash(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function explorerLink(
  coin: string | null | undefined,
  txHash: string | null | undefined,
): string | null {
  if (!txHash) return null;
  const c = (coin ?? "BTC").toUpperCase();
  if (c === "BTC") return `https://mempool.space/tx/${txHash}`;
  if (c === "ETH") return `https://etherscan.io/tx/${txHash}`;
  return null;
}
