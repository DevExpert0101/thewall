import type { Metadata } from "next";
import { LiveOverlay } from "@/components/live-overlay";
import { loadEvent } from "@/lib/data/load";
import { loadLiveBoard } from "@/lib/live/load";
import { publicPageMetadata } from "@/lib/share/metadata";

export const revalidate = 5;

const CYCLE_MIN = 8;
const CYCLE_MAX = 30;
const CYCLE_DEFAULT = 14;

type Props = { searchParams: Promise<{ cycle?: string | string[] }> };

function parseCycle(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === "") return CYCLE_DEFAULT;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) return CYCLE_DEFAULT;
  return Math.min(CYCLE_MAX, Math.max(CYCLE_MIN, n));
}

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return {
    ...publicPageMetadata({ event, path: "/live", kind: "countdown" }),
    robots: { index: false, follow: false },
  };
}

export default async function LivePage({ searchParams }: Props) {
  const raw = await searchParams;
  const cycleSec = parseCycle(raw.cycle);
  const event = await loadEvent();
  const initial = await loadLiveBoard(event);

  return (
    <main className="live-page">
      <h1 className="sr-only">The Wall — live for streamers</h1>
      <LiveOverlay event={event} initial={initial} cycleSec={cycleSec} />
    </main>
  );
}
