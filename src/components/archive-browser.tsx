"use client";

import { useState } from "react";
import { MessageCard } from "@/components/message-card";
import { WallSkeleton } from "@/components/wall-skeleton";
import { editionNumberOf, parsePublicNumber } from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

type Props = {
  event: EventSnapshot;
  initial: PublicMessage[];
  initialCursor?: string | null;
};

export function ArchiveBrowser({ event, initial, initialCursor = null }: Props) {
  const [messages, setMessages] = useState(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hideRemoved, setHideRemoved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searching = Boolean(query.trim());
  const visible = hideRemoved ? messages.filter((message) => !message.isRemoved) : messages;

  async function load(input: { q?: string; nextCursor?: string | null; append?: boolean }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: "hot",
        limit: String(WALL_PAGE_SIZE),
      });
      if (input.q) params.set("q", input.q);
      if (input.nextCursor) params.set("cursor", input.nextCursor);
      if (event.editionNumber || event.phase === "archived") {
        params.set("edition", String(editionNumberOf(event)));
      }
      const res = await fetch(`/api/messages?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.recovery ?? data.error ?? "The archive could not be loaded.");
        return;
      }
      const page = (data.messages ?? []) as PublicMessage[];
      setMessages((current) =>
        input.append ? [...current, ...page.filter((row) => !current.some((m) => m.id === row.id))] : page,
      );
      setCursor(data.nextCursor ?? null);
    } catch {
      setError("Network failure. The archive is still here — try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSearch(form: React.FormEvent) {
    form.preventDefault();
    const raw = draft.trim();
    setQuery(raw);
    if (!raw) {
      void load({});
      return;
    }
    void load({ q: raw });
  }

  const miss = searching && !loading && visible.length === 0;
  const n = parsePublicNumber(query);

  return (
    <div>
      <form className="mt-10" onSubmit={onSearch}>
        <label className="block">
          <span className="kicker">Search by number or words</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="#004291 or a phrase"
              inputMode="search"
              autoComplete="off"
              aria-invalid={Boolean(draft.trim().startsWith("#") && !parsePublicNumber(draft))}
              className="field min-w-[10rem] flex-1 font-mono text-sm"
            />
            <button type="submit" className="btn btn-line shrink-0 px-4">
              Find
            </button>
            {searching ? (
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => {
                  setQuery("");
                  setDraft("");
                  void load({});
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </label>
      </form>

      <label className="mt-4 inline-flex min-h-11 items-center gap-2 kicker">
        <input
          type="checkbox"
          checked={hideRemoved}
          onChange={(e) => setHideRemoved(e.target.checked)}
          className="size-4 accent-ember"
        />
        Hide removed
      </label>

      {error ? (
        <div className="mt-6 border border-blood/40 bg-blood/10 p-5" role="alert">
          <p className="text-sm text-paper">{error}</p>
          <button type="button" className="btn-ghost mt-3 text-ember" onClick={() => void load({ q: query || undefined })}>
            Try again
          </button>
        </div>
      ) : null}

      {loading && messages.length === 0 ? <div className="mt-8"><WallSkeleton /></div> : null}

      {miss ? (
        <div className="empty-monument mt-10">
          <p className="font-display text-3xl">
            {n ? `No ${String(n).padStart(6, "0")}.` : "No match."}
          </p>
          <p className="lede mx-auto mt-4 max-w-md">
            {n
              ? "That number is not in this edition."
              : "No sentence in this edition contains those words."}
          </p>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="mt-10 space-y-3">
          {visible.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              phase={event.phase}
              event={event}
              rankLabel={message.finalRank ? `Rank #${message.finalRank}` : undefined}
            />
          ))}
        </div>
      ) : null}

      {cursor && !searching && !error ? (
        <button
          type="button"
          onClick={() => void load({ q: query || undefined, nextCursor: cursor, append: true })}
          disabled={loading}
          className="btn btn-line mt-6 w-full text-ash hover:text-paper"
        >
          {loading ? "Loading more…" : "Load more sentences"}
        </button>
      ) : null}
    </div>
  );
}
