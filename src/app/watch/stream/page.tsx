import type { Metadata } from "next";
import { WatchDeck } from "@/components/watch-deck";
import { loadEvent } from "@/lib/data/load";
import { publicPageMetadata } from "@/lib/share/metadata";
import { firstSearch, parseWatchQuery } from "@/lib/watch/config";
import { loadWatchMessages } from "@/lib/watch/load";

export const revalidate = 5;

type Props = { searchParams: Promise<{ mode?: string | string[]; cycle?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return {
    ...publicPageMetadata({ event, path: "/watch/stream", kind: "countdown" }),
    robots: { index: false, follow: false },
  };
}

export default async function WatchStreamPage({ searchParams }: Props) {
  const raw = await searchParams;
  const view = parseWatchQuery({
    mode: firstSearch(raw.mode),
    cycle: firstSearch(raw.cycle),
    stream: true,
  });
  const event = await loadEvent();
  const initial = await loadWatchMessages(event, view.mode);

  return (
    <main className="watch-page watch-page-stream">
      <h1 className="sr-only">The Wall — stream</h1>
      <WatchDeck
        key={`${view.mode}-${view.cycleSec}`}
        event={event}
        initial={initial}
        mode={view.mode}
        stream
        cycleSec={view.cycleSec}
      />
    </main>
  );
}
