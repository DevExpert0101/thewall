import type { Metadata } from "next";
import { WallLive } from "@/components/wall-live";
import { listSpectatorPage, loadEditionMonument, loadEvent, loadLiveSurface, loadPreview, loadVictorRace } from "@/lib/data/load";
import { listMessages } from "@/lib/data/messages";
import { publicPageMetadata } from "@/lib/share/metadata";
import { wallTitle } from "@/lib/utils";
import { WALL_MIX_PAGE_SIZE, WALL_PAGE_SIZE } from "@/lib/wall/constants";
import { feedSortForPhase } from "@/lib/wall/feed";
import type { SpectatorLane } from "@/lib/wall/mix";

export const revalidate = 5;

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/wall", kind: "countdown" });
}

export default async function WallPage() {
  const event = await loadEvent();
  let initial = await loadPreview(event);
  let initialCursor: string | null = null;
  let initialLanes: Record<string, SpectatorLane> = {};
  let initialSurface = initial;
  try {
    if (event.phase === "live") {
      const mixed = await listSpectatorPage(event, { limit: WALL_MIX_PAGE_SIZE });
      initial = mixed.messages;
      initialCursor = mixed.nextCursor;
      initialLanes = mixed.lanes;
      initialSurface = await loadLiveSurface(event);
    } else {
      const listed = await listMessages({
        eventId: event.id,
        sort: feedSortForPhase(event.phase, "rising"),
        limit: WALL_PAGE_SIZE,
        endsAt: event.endsAt,
      });
      initial = listed.messages;
      initialCursor = listed.nextCursor;
    }
  } catch {
    // preview fallback
  }

  const leaders = await loadVictorRace(event);
  const monument = await loadEditionMonument(event);

  return (
    <main className="py-6">
      <h1 className="sr-only">{wallTitle(event)}</h1>
      <p className="wall-enter">{wallTitle(event)}</p>
      {event.themeQuestion ? (
        <p className="mx-auto mt-3 max-w-2xl px-4 text-center text-sm leading-relaxed text-mist sm:text-base">
          {event.themeQuestion}
        </p>
      ) : null}
      <WallLive
        event={event}
        initial={initial}
        initialSurface={initialSurface}
        initialCursor={initialCursor}
        initialLanes={initialLanes}
        initialLeaders={leaders}
        monument={monument}
      />
    </main>
  );
}
