import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EditionCard } from "@/components/edition-card";
import { loadArchiveEditions, loadEvent } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";

export const revalidate = 60;

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
    <main className="archive-index mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="kicker">
        Archive
        {simulating ? " · Simulation" : ""}
      </p>
      <h1 className="permanence-title mt-5">A library of completed days.</h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6 max-w-xl">
        Each Wall lived for 24 hours. What remains here does not move. Sealed
        Walls appear only after they are finished — nothing is invented.
      </p>
      <p className="mt-6">
        <Link href="/records" className="kicker hover:text-paper">
          All-time records →
        </Link>
      </p>

      {editions.length === 0 ? (
        <div className="empty-monument mt-20">
          <p className="font-display text-3xl text-paper sm:text-4xl">The library is empty.</p>
          <p className="lede mx-auto mt-4 max-w-md">
            {event.phase === "upcoming"
              ? "No Wall has been sealed yet. The library waits for the first finished day."
              : event.phase === "finalizing"
                ? "This Wall is closed for review. It appears here after the day is finished."
                : event.phase === "archived"
                  ? "No sealed Wall is listed yet."
                  : "This Wall is still open. The first sealed Wall appears here after the day is finished."}
          </p>
          <Link href="/wall" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
            Return to the live wall →
          </Link>
        </div>
      ) : (
        <ol className="mt-16 grid gap-6">
          {editions.map((edition) => (
            <li key={edition.id}>
              <EditionCard edition={edition} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
