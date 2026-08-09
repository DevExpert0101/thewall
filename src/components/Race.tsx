"use client";

import Link from "next/link";
import type { MessageRow } from "@/lib/wall";
import { formatCount, formatMessageNumber } from "@/lib/wall";

interface RaceProps {
  leader: MessageRow | null;
  runnerUp: MessageRow | null;
  frozen: boolean;
  reacting: Set<string>;
  reacted: Set<string>;
  onReact: (id: string) => void;
  onFocusWall: () => void;
}

// The 🔥 race — a live duel for the top of the Wall. #1 is whoever is hottest
// right now (velocity), so a challenger is always just a few flames away.
export default function Race({
  leader,
  runnerUp,
  frozen,
  reacting,
  reacted,
  onReact,
  onFocusWall,
}: RaceProps) {
  if (frozen || !leader) return null;

  const leadCount = leader.reactions;
  const secondCount = runnerUp?.reactions ?? 0;
  const leaderAhead = leadCount >= secondCount;
  const gap = Math.abs(leadCount - secondCount);
  const leaderRate = leader.recentReactions ?? 0;
  const runnerRate = runnerUp?.recentReactions ?? 0;
  const runnerClosing = runnerUp && runnerRate > leaderRate;
  const me = reacted.has(leader.id);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-ember/50 bg-gradient-to-b from-ember/[0.14] to-card p-5 glow-pulse sm:p-7">
      <div className="pointer-events-none absolute -right-6 -top-6 text-[7rem] leading-none opacity-10 select-none">
        🔥
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ember">
          🔥 The Race
        </h2>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted">
          <span className="h-2 w-2 rounded-full bg-red-500 flame-float" />
          live
        </span>
      </div>

      {/* Current #1 */}
      <div className="mt-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ember/60 bg-background/70 text-2xl shadow-[0_0_24px_rgba(255,122,26,0.35)]">
          👑
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            Current #1
          </p>
          <p className="truncate font-mono text-[10px] uppercase tracking-widest text-muted">
            Voice #{formatMessageNumber(leader.message_number)}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          <p className="font-mono text-2xl font-bold tabular-nums text-gold time-glow sm:text-3xl">
            {formatCount(leadCount)} <span className="text-lg">🔥</span>
          </p>
          {leaderRate > 0 && (
            <p className="text-[10px] font-medium uppercase tracking-widest text-ember">
              +{formatCount(leaderRate)} in 30m
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 font-display text-2xl italic leading-snug text-gold sm:text-3xl">
        &ldquo;{leader.content}&rdquo;
      </p>

      {/* The challenger */}
      {runnerUp && (
        <div className="mt-5 flex flex-col gap-2 border-t border-ember/30 pt-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">#2</span>
            <p className="min-w-0 truncate text-cream/80">
              &ldquo;{runnerUp.content}&rdquo;
            </p>
            <span className="ml-auto shrink-0 font-mono tabular-nums text-gold">
              {formatCount(secondCount)} 🔥
            </span>
          </div>
          <p className="text-xs text-muted">
            {leaderAhead ? (
              <>
                #2 is only <span className="font-semibold text-ember">{formatCount(gap)} 🔥</span>{" "}
                behind{runnerClosing && <span className="text-gold"> — and surging</span>}
              </>
            ) : (
              <>
                #2 actually leads by{" "}
                <span className="font-semibold text-ember">{formatCount(gap)} 🔥</span>
                {" — but #1 is moving faster"}
              </>
            )}
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onFocusWall}
          className="rounded-full bg-gradient-to-r from-flame to-ember px-6 py-3 text-sm font-bold text-black transition hover:brightness-110 glow-ember"
        >
          Can you knock #1 off the Wall?
        </button>
        <button
          onClick={() => onReact(leader.id)}
          disabled={reacting.has(leader.id) || me}
          aria-label="Flame the current #1"
          className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${
            me
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-ember/50 bg-background/60 text-foreground hover:border-ember hover:bg-ember/15 hover:text-gold"
          }`}
        >
          <span className={me ? "" : "flame-float"}>🔥</span>
          {me ? "You flamed #1" : "Flame #1"}
        </button>
        <Link
          href="/submit"
          className="text-xs font-semibold uppercase tracking-widest text-muted underline decoration-edge-strong underline-offset-4 transition hover:text-gold"
        >
          or etch your own — $1
        </Link>
      </div>
    </section>
  );
}
