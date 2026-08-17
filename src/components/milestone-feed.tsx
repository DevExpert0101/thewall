import Link from "next/link";
import {
  milestoneHeadline,
  type Milestone,
} from "@/lib/milestones/engine";

export function MilestoneFeed({
  marks,
  phase,
}: {
  marks: Milestone[];
  phase: "upcoming" | "live" | "finalizing" | "archived";
}) {
  if (phase === "upcoming" || marks.length === 0) return null;

  return (
    <section className="milestone-feed" aria-label="Marks on this Wall">
      <p className="kicker text-bronze">Marks on this Wall</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {marks.map((mark) => (
          <li key={mark.id}>
            {mark.kind === "message" ? (
              <Link href={`/message/${mark.value}`} className="font-mono text-xs tracking-[0.12em] text-mist hover:text-paper">
                {milestoneHeadline(mark)}
              </Link>
            ) : (
              <span className="font-mono text-xs tracking-[0.12em] text-mist">{milestoneHeadline(mark)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
