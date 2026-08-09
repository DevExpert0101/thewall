import Link from "next/link";
import LiveWall from "@/components/LiveWall";
import ViewerCount from "@/components/ViewerCount";
import Countdown from "@/components/Countdown";
import FindYourMessage from "@/components/FindYourMessage";
import TrackView from "@/components/TrackView";
import { getLiveMessages, getWall } from "@/lib/server";
import {
  isFrozen,
  formatCount,
  formatDuration,
  wallEventDate,
  formatLongDate,
  formatShortDate,
} from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.v === "string" ? Number.parseInt(sp.v, 10) : NaN;
  const focusNumber =
    Number.isInteger(raw) && raw > 0 ? raw : undefined;

  const wall = await getWall();
  const messages = wall ? await getLiveMessages(wall.id) : [];
  const frozen = wall ? isFrozen(wall) : true;
  const totalReactions = messages.reduce((s, m) => s + m.reactions, 0);
  const durationLabel = wall
    ? formatDuration(wall.created_at, wall.ends_at)
    : "24 hours";
  const [durNum, durUnit] = durationLabel.split(" ");

  return (
    <main className="flex w-full flex-1 flex-col">
      <TrackView event="landing_view" />
      {/* Hero / masthead */}
      <header className="relative flex flex-col items-center px-4 pb-14 pt-16 text-center sm:pt-24">
        {frozen && wall ? (
          /* The monument — the product is dead, the artifact lives. */
          <>
            <p className="mb-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-muted sm:text-xs">
              <span className="h-px w-8 bg-edge-strong" />
              The permanent record
              <span className="h-px w-8 bg-edge-strong" />
            </p>

            <h1 className="text-shimmer font-display text-[22vw] font-normal leading-none tracking-tight sm:text-[10rem]">
              The Wall
            </h1>

            <p className="mt-5 font-mono text-xs uppercase tracking-[0.5em] text-gold sm:text-sm">
              {formatLongDate(wallEventDate(wall))}
            </p>

            <p className="mt-6 font-display text-3xl italic leading-snug text-cream time-glow sm:text-4xl">
              {messages.length.toLocaleString("en-US")} voices.
            </p>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">
              The Wall is closed. Every voice below is permanent — a time
              capsule from {formatShortDate(wallEventDate(wall))} that can
              never be edited or erased.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/archive"
                className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
              >
                Explore the archive
              </Link>
              <FindYourMessage
                label="Find your message"
                className="rounded-full border border-edge px-8 py-3.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
              />
              <FindYourMessage
                label="Download certificate"
                className="rounded-full border border-edge px-8 py-3.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
              />
            </div>
          </>
        ) : (
          /* Live wall */
          <>
            <p className="mb-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-muted sm:text-xs">
              <span className="h-px w-8 bg-edge-strong" />
              One wall · One day · One permanent record
              <span className="h-px w-8 bg-edge-strong" />
            </p>

            <h1 className="text-shimmer font-display text-[22vw] font-normal leading-none tracking-tight sm:text-[10rem]">
              The Wall
            </h1>

            <p className="mt-6 font-display text-2xl italic leading-snug text-gold time-glow sm:text-3xl">
              One dollar. One message. One day. Forever.
            </p>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              The Wall is a 24-hour anonymous global time capsule. For $1, you
              get 140 characters and a permanent place in history. When the
              clock reaches zero, the Wall closes forever.
            </p>

            {wall && (
              <div className="mt-9 rounded-3xl border border-edge/70 bg-card/40 px-8 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                <Countdown endsAt={wall.ends_at} createdAt={wall.created_at} />
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-widest text-muted">
              <span className="flex min-w-28 flex-col items-center gap-1 rounded-2xl border border-edge/70 bg-card/50 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                <b className="font-mono text-2xl leading-none text-gold">
                  {formatCount(messages.length)}
                </b>
                voices etched
              </span>
              <span className="flex min-w-28 flex-col items-center gap-1 rounded-2xl border border-edge/70 bg-card/50 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                <b className="font-mono text-2xl leading-none text-gold">
                  {formatCount(totalReactions)}
                </b>
                🔥 reactions
              </span>
              <ViewerCount />
              <span className="flex min-w-28 flex-col items-center gap-1 rounded-2xl border border-edge/70 bg-card/50 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                <b className="font-mono text-2xl leading-none text-gold">{durNum}</b>
                {durUnit} — then gone
              </span>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#wall"
                className="rounded-full border border-edge px-8 py-3.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
              >
                Read the Wall
              </a>
              {wall?.accepting === false ? (
                <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-8 py-3.5 text-sm font-semibold text-amber-300">
                  Submissions paused — check back soon
                </span>
              ) : (
                <Link
                  href="/submit"
                  className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
                >
                  Etch your message — $1
                </Link>
              )}
            </div>
          </>
        )}
      </header>

      {/* The wall */}
      <section
        id="wall"
        className="mx-auto w-full max-w-6xl flex-1 scroll-mt-24 px-4 pb-16"
      >
        {!wall && (
          <p className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center text-sm text-red-300">
            No wall found. Is Supabase running? Start it with{" "}
            <code className="font-mono">npx supabase start</code>.
          </p>
        )}

        {wall && (
          <LiveWall
            wall={{
              id: wall.id,
              created_at: wall.created_at,
              ends_at: wall.ends_at,
              frozen: wall.frozen,
              title: wall.title,
            }}
            initialMessages={messages}
            initialFrozen={frozen}
            focusNumber={focusNumber}
          />
        )}
      </section>

      {/* What happens when it ends */}
      <section className="border-t border-edge/60 bg-card/20 px-4 py-20">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
            After the clock hits zero
          </p>
          <h2 className="font-display text-4xl italic leading-tight text-gold sm:text-5xl">
            What happens when it ends?
          </h2>
          <div className="flex flex-col gap-4">
            <p className="font-display text-2xl text-cream">
              The Wall freezes.
            </p>
            <p className="font-display text-2xl text-cream">
              Nothing changes.
            </p>
            <p className="max-w-lg text-sm leading-relaxed text-muted">
              Every message becomes part of a permanent digital time capsule —
              browsable forever, ranked by the flames it earned, uneditable and
              unerasable.
            </p>
            <p className="max-w-lg text-sm leading-relaxed text-muted">
              And every participant gets a certificate proving they were there:
              their voice, their number, their final rank, and proof it can
              never be rewritten.
            </p>
          </div>
          <Link
            href={frozen ? "/artifact" : "/submit"}
            className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
          >
            {frozen ? "See the permanent record" : "Be part of it — $1"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-edge/60 py-8 text-center">
        <p className="text-xs tracking-widest text-muted">
          THE WALL · A ONE-DAY MONUMENT TO THE HUMAN VOICE · MESSAGES ARE
          PERMANENT AND CANNOT BE EDITED OR DELETED
        </p>
      </footer>
    </main>
  );
}
