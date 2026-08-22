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
  return publicPageMetadata({ event, path: "/watch", kind: "countdown" });
}

export default async function WatchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const view = parseWatchQuery({
    mode: firstSearch(raw.mode),
    cycle: firstSearch(raw.cycle),
    stream: false,
  });
  const event = await loadEvent();
  const initial = await loadWatchMessages(event, view.mode);

  return (
    <main className="watch-page">
      <h1 className="sr-only">Watch The Wall</h1>
      <WatchDeck
        key={`${view.mode}-${view.cycleSec}`}
        event={event}
        initial={initial}
        mode={view.mode}
        cycleSec={view.cycleSec}
      />
    </main>
  );
}
