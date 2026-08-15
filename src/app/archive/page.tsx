import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EditionCard } from "@/components/edition-card";
import { loadArchiveEditions, loadEvent } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/archive", kind: "milestone" });
}

export default async function ArchiveIndexPage() {
  if (isSimulation()) await connection();
  const event = await loadEvent();
  const editions = await loadArchiveEditions();
  const simulating = isSimulation();

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">
        Archive
        {simulating ? " · Simulation" : ""}
      </p>
      <h1 className="permanence-title mt-5">A library of completed days.</h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6 max-w-xl">
        Each Wall lives for 24 hours. Then it dies as a conversation and is born as
        history. Editions appear here only after they are sealed — nothing is invented.
      </p>
      <p className="mt-6">
        <Link href="/records" className="kicker hover:text-paper">
          All-time records →
        </Link>
      </p>

      {editions.length === 0 ? (
        <div className="empty-monument mt-16">
          <p className="font-display text-3xl text-paper sm:text-4xl">The library is empty.</p>
          <p className="lede mx-auto mt-4 max-w-md">
            {event.phase === "upcoming"
              ? "No edition has been sealed yet. Start a Wall from stewardship, then finish the day."
              : "This Wall is still open. The first edition will be carved here when the clock reaches zero."}
          </p>
          <Link href="/wall" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
            Return to the live wall →
          </Link>
        </div>
      ) : (
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {editions.map((edition) => (
            <EditionCard key={edition.id} edition={edition} />
          ))}
        </div>
      )}
    </main>
  );
}
