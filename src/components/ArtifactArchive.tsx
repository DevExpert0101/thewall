"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatCount,
  formatMessageNumber,
  ordinal,
  trendScore,
} from "@/lib/wall";

export interface ArtifactEntry {
  id: string;
  message_number: number;
  content: string;
  reactions: number;
  created_at: string;
  recentReactions: number;
  distinctReactions: number;
  rank: number;
}

interface ArtifactArchiveProps {
  wallTitle: string;
  /** Event date label, e.g. "AUGUST 8, 2026". */
  eventDate: string;
  total: number;
  totalReactions: number;
  durationLabel: string;
  /** Wall end time — the trend ranking clock stopped here. */
  endsAt: string;
  entries: ArtifactEntry[];
}

type SortKey =
  | "reacted"
  | "random"
  | "number"
  | "trending"
  | "newest"
  | "oldest";

const FILTERS: Array<{ id: SortKey; label: string }> = [
  { id: "reacted", label: "Most reacted" },
  { id: "random", label: "Random" },
  { id: "number", label: "Message number" },
  { id: "trending", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
];

const PAGE_SIZE = 80;

// Deterministic shuffle: same seed, same order — RANDOM is stable across
// renders and only changes when the user asks for another shuffle.
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export default function ArtifactArchive({
  wallTitle,
  eventDate,
  total,
  totalReactions,
  durationLabel,
  endsAt,
  entries,
}: ArtifactArchiveProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SortKey>("reacted");
  const [randomSeed, setRandomSeed] = useState(0);
  const [shown, setShown] = useState(PAGE_SIZE);

  const q = query.trim().toLowerCase();

  // The wall is dead — trend ranking is computed against its end time so the
  // final order is permanent (same reference the server used to freeze it).
  const trendNow = new Date(endsAt).getTime();

  const matches = useMemo(() => {
    const base = q
      ? entries.filter((e) => e.content.toLowerCase().includes(q))
      : entries;
    switch (filter) {
      case "reacted":
        return [...base].sort(
          (a, b) =>
            b.reactions - a.reactions ||
            a.message_number - b.message_number,
        );
      case "number":
        return [...base].sort(
          (a, b) => a.message_number - b.message_number,
        );
      case "trending":
        return [...base].sort(
          (a, b) =>
            trendScore(b, trendNow) - trendScore(a, trendNow) ||
            a.message_number - b.message_number,
        );
      case "newest":
        return [...base].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime() ||
            b.message_number - a.message_number,
        );
      case "oldest":
        return [...base].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime() ||
            a.message_number - b.message_number,
        );
      case "random":
        return seededShuffle(base, randomSeed);
    }
  }, [entries, q, filter, randomSeed, trendNow]);

  const list = matches.slice(0, shown);

  const pickFilter = (id: SortKey) => {
    if (id === "random" && filter === "random") {
      setRandomSeed((s) => s + 1);
      setShown(PAGE_SIZE);
      return;
    }
    setFilter(id);
    setShown(PAGE_SIZE);
  };

  return (
    <>
      {/* Interactive read-only archive */}
      <section className="flex flex-col gap-5 print:hidden">
        <div className="flex flex-col items-center gap-4">
          <h2 className="font-display text-3xl text-cream sm:text-4xl">
            Search The Wall
          </h2>

          <div className="relative w-full max-w-xl">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="Search The Wall…"
              aria-label="Search archived messages"
              className="w-full rounded-full border border-edge bg-background/70 py-3 pl-10 pr-4 text-base text-foreground placeholder:text-muted focus:border-ember focus:outline-none"
            />
          </div>

          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {formatCount(matches.length)}{" "}
            {matches.length === 1 ? "result" : "results"}
            {q && (
              <>
                {" "}
                for &ldquo;<span className="text-gold">{query.trim()}</span>
                &rdquo;
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-[10px] uppercase tracking-[0.3em] text-muted">
              Filters
            </span>
            {FILTERS.map((f) => {
              const active = f.id === filter;
              return (
                <button
                  key={f.id}
                  onClick={() => pickFilter(f.id)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                    active
                      ? "bg-gradient-to-r from-flame to-ember text-black glow-ember"
                      : "border border-edge text-muted hover:border-ember hover:text-gold"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {ordinal(total)} voices · sealed forever
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
            >
              Download PDF
            </button>
            <a
              href="/api/artifact"
              className="rounded-full border border-edge px-5 py-2 text-sm font-medium text-muted transition hover:border-ember hover:bg-ember/10 hover:text-gold"
            >
              Download JSON
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {list.map((e) => (
            <article
              key={e.id}
              className={`group flex items-start gap-5 rounded-xl border p-4 transition-colors ${
                e.rank <= 3
                  ? "border-ember/50 bg-gradient-to-r from-ember/10 to-transparent glow-ember"
                  : "border-edge bg-surface/70 hover:border-ember/40"
              }`}
            >
              {filter === "reacted" && (
                <span
                  className={`w-12 shrink-0 pt-1 text-center text-2xl ${
                    e.rank === 1
                      ? "text-gold time-glow"
                      : e.rank <= 3
                        ? "text-ember"
                        : "text-muted"
                  }`}
                >
                  {e.rank}
                </span>
              )}
              <Link
                href={`/artifact/${e.id}`}
                className={`font-display flex min-w-0 flex-1 items-start gap-5 ${
                  e.rank <= 3 ? "text-gold time-glow" : ""
                }`}
                aria-label={`View archived message ${e.message_number}`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block break-words leading-snug ${
                      e.rank <= 3
                        ? "font-display text-xl italic text-cream"
                        : "text-[15px] text-cream/85"
                    }`}
                  >
                    {e.content}
                  </span>
                  <span className="mt-1 block font-mono text-xs uppercase tracking-widest text-muted">
                    Message #{formatMessageNumber(e.message_number)}
                  </span>
                </span>
              </Link>
              <span
                className={`shrink-0 font-mono text-sm ${
                  e.rank <= 3 ? "text-gold time-glow" : "text-ember"
                }`}
              >
                🔥 {formatCount(e.reactions)}
              </span>
            </article>
          ))}
        </div>

        {shown < matches.length && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onClick={() => setShown((s) => s + PAGE_SIZE)}
              className="rounded-full border border-edge px-8 py-3 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
            >
              Load {Math.min(PAGE_SIZE, matches.length - shown)} more
            </button>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Showing {formatCount(shown)} of {formatCount(matches.length)}
            </p>
          </div>
        )}

        {matches.length === 0 && (
          <p className="py-24 text-center font-display text-3xl text-muted">
            No voices match &ldquo;{query.trim()}&rdquo; in the permanent
            record.
          </p>
        )}
      </section>

      {/* Printable edition — the PDF collectible */}
      <div className="hidden print:block">
        <div className="mx-auto max-w-3xl py-6">
          <h1 className="text-center text-3xl font-bold uppercase tracking-[0.3em] text-neutral-900">
            THE WALL
          </h1>
          <p className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-neutral-600">
            {wallTitle} · {eventDate}
          </p>
          <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {total.toLocaleString("en-US")} messages ·{" "}
            {totalReactions.toLocaleString("en-US")} reactions ·{" "}
            {durationLabel} · the wall will never change again
          </p>
          <p className="mt-4 border-t border-neutral-300 pt-2 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            Every message, exactly as etched · {total.toLocaleString("en-US")}{" "}
            entries
          </p>
          <div className="mt-4 space-y-1.5">
            {entries.map((e) => (
              <p key={e.id} className="text-[11px] leading-snug text-neutral-800">
                <span className="font-mono font-semibold">
                  {formatMessageNumber(e.message_number)}
                </span>
                <span className="mx-1.5 text-neutral-400">·</span>
                {e.content}
                <span className="float-right font-mono text-neutral-600">
                  🔥 {e.reactions.toLocaleString("en-US")}
                </span>
              </p>
            ))}
          </div>
          <p className="mt-8 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
            {ordinal(total)} voices · one permanent record ·{" "}
            {"the wall".toUpperCase()}
          </p>
        </div>
      </div>
    </>
  );
}
