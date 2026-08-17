import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { closesInClause } from "@/lib/event/remaining";
import type { EventPhase } from "@/lib/event/state";
import { editionPath, formatWallPlace } from "@/lib/utils";

type Props = {
  phase: EventPhase;
  endsAt: string;
  serverNow: string;
  editionNumber?: number;
};

export function VisitLoop({ phase, endsAt, serverNow, editionNumber }: Props) {
  const place = formatWallPlace(editionNumber);

  if (phase === "live") {
    return (
      <aside className="pay-plaque mt-12 p-6 text-left">
        <p className="kicker text-bronze">ONE SENTENCE AMONG MANY</p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          {closesInClause(endsAt, serverNow)}. Anyone can read. One dollar writes one sentence.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href="/wall" className="btn btn-primary flex-1">
            Browse the Wall
          </Link>
          <Link href="/wall" className="btn btn-line flex-1">
            {BRAND.leaveYourMarkCta}
          </Link>
        </div>
        <Link href="/watch" className="btn-ghost mt-3 inline-flex min-h-11 items-center text-xs tracking-[0.16em]">
          Watch the Wall
        </Link>
      </aside>
    );
  }

  if (phase === "finalizing") {
    return (
      <aside className="pay-plaque mt-12 p-6 text-left">
        <p className="kicker text-bronze">{place.toUpperCase()} IS CLOSED</p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          No one can add another word. The sentences already here are still public.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href="/wall" className="btn btn-primary flex-1">
            Browse the Wall
          </Link>
          <Link href="/watch" className="btn btn-line flex-1">
            Watch
          </Link>
        </div>
      </aside>
    );
  }

  if (phase === "archived") {
    return (
      <aside className="pay-plaque mt-12 p-6 text-left">
        <p className="kicker text-bronze">THIS WALL IS FROZEN</p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          {place} does not reopen. Other sentences from that day are still here to read.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href={editionPath(editionNumber ?? 1)} className="btn btn-primary flex-1">
            Browse this Wall
          </Link>
          <Link href="/wall" className="btn btn-line flex-1">
            Current Wall
          </Link>
        </div>
      </aside>
    );
  }

  return null;
}
