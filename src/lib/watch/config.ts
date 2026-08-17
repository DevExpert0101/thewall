import { BRAND } from "@/lib/brand";
import type { MessageSort } from "@/lib/constants";

export const WATCH_MODES = ["auto", "rising", "random", "top"] as const;
export type WatchMode = (typeof WATCH_MODES)[number];

export const WATCH_CYCLE_MIN = 5;
export const WATCH_CYCLE_MAX = 60;

export const WATCH_MODE_META: Record<
  WatchMode,
  { label: string; hint: string; sort: MessageSort; limit: number; refreshMs: number }
> = {
  auto: {
    label: "Auto Wall",
    hint: "Newest sentences as they land",
    sort: "new",
    limit: 8,
    refreshMs: 8_000,
  },
  rising: {
    label: BRAND.sorts.rising,
    hint: "Alive now, mixed with new, quiet, and wander",
    sort: "rising",
    limit: 8,
    refreshMs: 10_000,
  },
  random: {
    label: BRAND.sorts.random,
    hint: "One unseen sentence at a time",
    sort: "random",
    limit: 1,
    refreshMs: 12_000,
  },
  top: {
    label: "Top 10",
    hint: "Highest lifetime 🔥",
    sort: "hot",
    limit: 10,
    refreshMs: 15_000,
  },
};

export function isWatchMode(value: string | undefined): value is WatchMode {
  return WATCH_MODES.includes(value as WatchMode);
}

export function defaultCycleSec(mode: WatchMode, stream: boolean): number {
  if (mode === "random") return 12;
  if (mode === "rising" && stream) return 10;
  return 0;
}

export function parseCycleSec(raw: string | undefined, mode: WatchMode, stream: boolean): number {
  if (raw == null || raw === "") return defaultCycleSec(mode, stream);
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) return 0;
  return Math.min(WATCH_CYCLE_MAX, Math.max(WATCH_CYCLE_MIN, n));
}

export function parseWatchQuery(input: {
  mode?: string;
  cycle?: string;
  stream?: boolean;
}): { mode: WatchMode; cycleSec: number; stream: boolean } {
  const mode = isWatchMode(input.mode) ? input.mode : "auto";
  const stream = Boolean(input.stream);
  return {
    mode,
    stream,
    cycleSec: parseCycleSec(input.cycle, mode, stream),
  };
}

export function watchPath(input: {
  stream?: boolean;
  mode?: WatchMode;
  cycleSec?: number;
}): string {
  const stream = Boolean(input.stream);
  const mode = input.mode ?? "auto";
  const params = new URLSearchParams();
  if (mode !== "auto") params.set("mode", mode);
  if (input.cycleSec != null) params.set("cycle", String(input.cycleSec));
  const query = params.toString();
  const path = stream ? "/watch/stream" : "/watch";
  return query ? `${path}?${query}` : path;
}

export function firstSearch(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
