"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCount } from "@/lib/wall";

interface FinaleProps {
  /** Event date, e.g. "AUGUST 8, 2026". */
  eventDate: string;
  /** Unique voices etched — one voice per message. */
  voices: number;
  reactions: number;
  /**
   * True when the wall just froze in this browser session: the takeover
   * plays "THE WALL IS CLOSED." before the finale screen. False for
   * already-frozen visitors, who get the finale as an in-flow section.
   */
  live: boolean;
  certHref: string;
  hasMine: boolean;
  onFindMine: () => void;
  onExplore: () => void;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-40 flex-col items-center gap-1.5 rounded-2xl border border-edge/70 bg-card/50 px-8 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <b className="font-mono text-3xl leading-none text-gold sm:text-4xl">
        {formatCount(value)}
      </b>
      <span className="text-[10px] uppercase tracking-[0.3em] text-muted">
        {label}
      </span>
    </div>
  );
}

export default function Finale({
  eventDate,
  voices,
  reactions,
  live,
  certHref,
  hasMine,
  onFindMine,
  onExplore,
}: FinaleProps) {
  const [beatDone, setBeatDone] = useState(false);

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setBeatDone(true), 2600);
    return () => clearTimeout(t);
  }, [live]);

  const screen = (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
        The final wall
      </p>
      <h2 className="text-shimmer font-display text-7xl leading-none sm:text-9xl">
        THE WALL
      </h2>
      <p className="font-mono text-xs uppercase tracking-[0.35em] text-muted">
        {eventDate}
      </p>
      <div className="mt-2 flex flex-wrap items-stretch justify-center gap-3">
        <Stat value={voices} label="People" />
        <Stat value={voices} label="Messages" />
        <Stat value={reactions} label="🔥" />
      </div>
      <p className="font-display text-2xl italic text-gold time-glow sm:text-3xl">
        The Wall will never change.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          onClick={onExplore}
          className="rounded-full bg-gradient-to-r from-flame to-ember px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-black transition hover:brightness-110 glow-ember"
        >
          Explore the final wall
        </button>
        <button
          onClick={onFindMine}
          className="rounded-full border border-edge px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-ember hover:bg-ember/10 hover:text-gold"
        >
          Find your message
        </button>
        <Link
          href={certHref}
          className="rounded-full border border-gold/50 bg-gold/10 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold transition hover:bg-gold/20 glow-ember"
        >
          Get your certificate
        </Link>
      </div>
      {hasMine && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          ✦ Your voice is among them
        </p>
      )}
    </div>
  );

  if (!live) {
    return (
      <section className="flex flex-col items-center rounded-2xl border border-ember/40 bg-gradient-to-b from-ember/10 to-transparent px-6 py-14">
        {screen}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background px-4 py-12">
      {beatDone ? (
        screen
      ) : (
        <p className="animate-pulse text-center font-display text-5xl leading-tight text-gold time-glow sm:text-7xl">
          THE WALL IS CLOSED.
        </p>
      )}
    </div>
  );
}
