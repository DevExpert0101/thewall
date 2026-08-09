import Link from "next/link";
import BackNav from "@/components/BackNav";
import TrackView from "@/components/TrackView";
import { getWall, getArtifactWall, getLiveMessages } from "@/lib/server";
import {
  formatMessageNumber,
  formatCount,
  wallEventDate,
  formatShortDate,
} from "@/lib/wall";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trending — The Wall",
  description:
    "The most-reacted voices on The Wall. Ranked forever by the flames they earned.",
};

// The most-reacted voices of the latest Wall — live or sealed. Ranking is
// reactions descending, ties broken by earlier entry (the same rule the
// certificates print), so the order is permanent once the Wall freezes.
export default async function TrendingPage() {
  const current = await getWall();
  const record = await getArtifactWall();
  const wall = record ?? current;
  if (!wall) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-4 py-20 text-center">
        <BackNav />
        <p className="py-24 text-center font-display text-3xl text-muted">
          No Wall yet. History is being written.
        </p>
      </main>
    );
  }

  const messages = await getLiveMessages(wall.id);
  const top = [...messages]
    .sort(
      (a, b) =>
        b.reactions - a.reactions ||
        a.message_number - b.message_number,
    )
    .slice(0, 50);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-14">
      <TrackView event="trending_viewed" />
      <BackNav />
      <header className="text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The most-reacted voices
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">🔥 Trending</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          {wall.title} · {formatShortDate(wallEventDate(wall))}. These are the
          voices the crowd lifted highest — ranked forever by the flames they
          earned.
        </p>
      </header>

      {top.length === 0 ? (
        <p className="py-24 text-center font-display text-3xl text-muted">
          No reactions yet. The crowd is still warming up.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((m, i) => (
            <li key={m.id}>
              <Link
                href={`/message/${m.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-edge/70 bg-surface/50 p-4 transition hover:border-ember/60 hover:bg-card/50"
              >
                <span className="font-display w-12 shrink-0 text-center text-3xl text-ember">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    Voice #{formatMessageNumber(m.message_number)}
                  </p>
                  <p className="mt-1 truncate font-display text-lg italic text-cream group-hover:text-gold">
                    “{m.content}”
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-gold">
                  {formatCount(m.reactions)} 🔥
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <footer className="flex justify-center">
        <Link
          href="/archive"
          className="rounded-full border border-edge px-6 py-2.5 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          All walls
        </Link>
      </footer>
    </main>
  );
}
