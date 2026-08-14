import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { ArchiveBrowser } from "@/components/archive-browser";
import { loadEvent } from "@/lib/data/load";
import { listMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";
import { formatCount } from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";
import type { PublicMessage } from "@/lib/types";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/archive", kind: "milestone" });
}

const cachedLedger = unstable_cache(
  async (eventId: string, finalizedAt: string) => {
    void finalizedAt;
    return listMessages({ eventId, sort: "hot", limit: WALL_PAGE_SIZE });
  },
  ["archive-ledger"],
  { revalidate: 3600 },
);

export default async function ArchivePage() {
  const event = await loadEvent();
  const closed = event.phase === "archived" || event.phase === "finalizing";
  const simulating = isSimulation();
  let messages: PublicMessage[] = [];
  let nextCursor: string | null = null;
  if (closed) {
    try {
      const listed =
        simulating || !(event.phase === "archived" && event.finalizedAt)
          ? await listMessages({ eventId: event.id, sort: "hot", limit: WALL_PAGE_SIZE })
          : await cachedLedger(event.id, event.finalizedAt);
      messages = listed.messages;
      nextCursor = listed.nextCursor;
    } catch {
      messages = [];
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">
        Archive
        {simulating ? " · Simulation" : ""}
      </p>
      <h1 className="permanence-title mt-5">
        {closed ? "The Wall, frozen." : "Not yet."}
      </h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6 max-w-xl">
        {closed
          ? event.phase === "finalizing"
            ? "Writing has stopped. Final ranks are being carved. This is the same Wall — not a previous day."
            : "This is the same Wall after the clock. There is no earlier Wall — only this day, frozen. Rankings below are final."
          : "There is no previous Wall. This page becomes the record of this day when the clock reaches zero."}
      </p>
      {closed ? (
        <p className="mt-6 font-mono text-xs tracking-[0.14em] text-bronze">
          {formatCount(event.totalMessages)} messages · {formatCount(event.totalReactions)} 🔥 ·{" "}
          {event.phase === "archived" ? "Closed · ranks final" : "Closed · ranks pending"}
        </p>
      ) : (
        <Link href="/wall" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
          Return to the live wall →
        </Link>
      )}
      {closed && messages.length === 0 ? (
        <div className="empty-monument mt-16">
          <p className="font-display text-3xl text-paper sm:text-4xl">No inscriptions remain public.</p>
          <p className="lede mx-auto mt-4 max-w-md">The clock closed on an empty stone — or every line was removed under policy.</p>
        </div>
      ) : null}
      {closed && messages.length > 0 ? (
        <ArchiveBrowser event={event} initial={messages} initialCursor={nextCursor} />
      ) : null}
    </main>
  );
}
