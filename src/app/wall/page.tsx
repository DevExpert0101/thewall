import type { Metadata } from "next";
import { WallLive } from "@/components/wall-live";
import { loadEvent, loadPreview } from "@/lib/data/load";
import { listMessages } from "@/lib/data/messages";
import { publicPageMetadata } from "@/lib/share/metadata";
import { wallTitle } from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/wall", kind: "countdown" });
}

export default async function WallPage() {
  const event = await loadEvent();
  let initial = await loadPreview(event);
  let initialCursor: string | null = null;
  try {
    const listed = await listMessages({
      eventId: event.id,
      sort: "trending",
      limit: WALL_PAGE_SIZE,
    });
    initial = listed.messages;
    initialCursor = listed.nextCursor;
  } catch {
    // preview fallback
  }

  return (
    <main className="py-6">
      <h1 className="sr-only">{wallTitle(event)}</h1>
      <p className="wall-enter">{wallTitle(event)}</p>
      <WallLive event={event} initial={initial} initialCursor={initialCursor} />
    </main>
  );
}
