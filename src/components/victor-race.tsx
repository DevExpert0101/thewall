import { BRAND } from "@/lib/brand";
import type { VictorRaceLeader } from "@/lib/monument/types";
import { formatCount, formatPublicNumber } from "@/lib/utils";

export function VictorRace({
  leaders,
  live,
}: {
  leaders: VictorRaceLeader[];
  live: boolean;
}) {
  const first = leaders[0];
  if (!first || !live) return null;
  const second = leaders[1];
  const third = leaders[2];
  const gap = (row: VictorRaceLeader) => first.reactionCount - row.reactionCount;

  return (
    <section className="victor-race my-6" aria-label="Provisional Monument race">
      <p className="kicker text-bronze">Currently entering The Monument</p>
      <p className="mt-3 font-mono text-xs tracking-[0.18em] text-ember">Current leader</p>
      <p className="mt-2 font-mono text-sm tracking-[0.16em] text-mist">
        {formatPublicNumber(first.publicNumber)}
      </p>
      <p className={`victor-race-lead mt-3 ${first.isRemoved ? "text-ash italic" : "text-paper"}`}>
        {first.isRemoved ? first.text : `“${first.text}”`}
      </p>
      <p className="mt-4 font-mono text-sm tracking-[0.14em] text-bronze">
        {formatCount(first.reactionCount)} 🔥
      </p>
      {second ? (
        <p className="mt-3 text-sm text-mist">
          #2 is {formatCount(gap(second))} 🔥 behind
        </p>
      ) : null}
      <ol className="mt-6 space-y-3 border-t border-line pt-4">
        <li className="text-sm text-mist">
          <span className="font-mono tracking-[0.16em] text-bronze">#1</span>
          <span className="ml-3">Currently entering {BRAND.monument}.</span>
        </li>
        {second ? (
          <li className="text-sm text-mist">
            <span className="font-mono tracking-[0.16em] text-bronze">#2</span>
            <span className="ml-3">
              {formatPublicNumber(second.publicNumber)} · {formatCount(gap(second))} 🔥 from #1
            </span>
          </li>
        ) : null}
        {third ? (
          <li className="text-sm text-mist">
            <span className="font-mono tracking-[0.16em] text-bronze">#3</span>
            <span className="ml-3">
              {formatPublicNumber(third.publicNumber)} · {formatCount(gap(third))} 🔥 from #1
            </span>
          </li>
        ) : null}
      </ol>
      <p className="mt-5 text-sm leading-relaxed text-mist">
        If the Wall closed now, this inscription would enter {BRAND.monument}. Rankings stay
        provisional until sealing.
      </p>
    </section>
  );
}
