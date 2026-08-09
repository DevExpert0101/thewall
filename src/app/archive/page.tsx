import Link from "next/link";
import BackNav from "@/components/BackNav";
import FindYourMessage from "@/components/FindYourMessage";
import { getWallSummaries } from "@/lib/server";
import {
  isFrozen,
  formatCount,
  wallEventDate,
  formatLongDate,
} from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const walls = await getWallSummaries();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-14">
      <BackNav />

      <header className="flex flex-col items-center gap-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The permanent record
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">The Archive</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted">
          Every Wall ever sealed — browsable forever. Each one is a permanent
          time capsule that can never be edited or erased.
        </p>
        <FindYourMessage
          label="Find your message"
          className="rounded-full border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
        />
      </header>

      {walls.length === 0 ? (
        <p className="py-24 text-center font-display text-3xl text-muted">
          No walls yet. History is being written right now.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {walls.map((w) => {
            const live = !isFrozen(w);
            return (
              <li key={w.id}>
                <Link
                  href={live ? "/" : `/archive/${w.id}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-edge/70 bg-surface/50 p-5 transition hover:border-ember/60 hover:bg-card/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-xl text-cream transition group-hover:text-gold">
                      {w.title}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                        live
                          ? "border border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                          : "border border-edge bg-background/60 text-muted"
                      }`}
                    >
                      {live ? "● Live now" : "Permanent"}
                    </span>
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
                    {formatLongDate(wallEventDate(w))} ·{" "}
                    {formatCount(w.total_messages)} voices ·{" "}
                    {formatCount(w.total_reactions)} 🔥
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="flex justify-center">
        <Link
          href="/artifact"
          className="rounded-full border border-edge px-6 py-2.5 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Latest permanent record
        </Link>
      </footer>
    </main>
  );
}
