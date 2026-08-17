"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { FailureRecovery } from "@/components/failure-recovery";
import { MessageCard } from "@/components/message-card";
import { RandomMode } from "@/components/random-mode";
import { WallSkeleton } from "@/components/wall-skeleton";
import type { MessageSort } from "@/lib/constants";
import { editionNumberOf, parsePublicNumber } from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";
import { discoveryMethodsFor, discoveryTabs } from "@/lib/wall/discovery";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

type Props = {
  event: EventSnapshot;
  initial: PublicMessage[];
  initialCursor?: string | null;
};

export function ArchiveBrowser({ event, initial, initialCursor = null }: Props) {
  const [sort, setSort] = useState<MessageSort>("hot");
  const [messages, setMessages] = useState(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hideRemoved, setHideRemoved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);

  const searching = Boolean(query.trim());
  const visible = hideRemoved ? messages.filter((message) => !message.isRemoved) : messages;
  const tabs = discoveryTabs(false);

  async function load(input: {
    nextSort?: MessageSort;
    q?: string;
    nextCursor?: string | null;
    append?: boolean;
  }) {
    const nextSort = input.nextSort ?? sort;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: nextSort,
        limit: String(WALL_PAGE_SIZE),
      });
      if (input.q) params.set("q", input.q);
      if (input.nextCursor) params.set("cursor", input.nextCursor);
      if (nextSort === "random") params.set("salt", event.id);
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

  function changeSort(next: MessageSort) {
    if (next === "random") {
      setRandomOpen(true);
      return;
    }
    setSort(next);
    setQuery("");
    setDraft("");
    void load({ nextSort: next });
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
          <span className="kicker">Find a sentence</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="#004291 or a phrase"
              inputMode="search"
              autoComplete="off"
              aria-invalid={Boolean(draft.trim().startsWith("#") && !parsePublicNumber(draft))}
              aria-describedby="archive-search-hint"
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
        <p id="archive-search-hint" className="sr-only">
          Search this Wall by message number like #004291, or by a phrase from the sentence.
        </p>
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

      <Tabs.Root
        value={sort}
        onValueChange={(value) => changeSort(value as MessageSort)}
        className="mt-4"
      >
        <Tabs.List aria-label="Archive filters" className="wall-tabs">
          {tabs.map((tab) => (
            <Tabs.Trigger key={tab.id} value={tab.id} title={tab.hint} className="wall-tab">
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <details className="mt-4 max-w-2xl text-sm text-ash">
          <summary className="kicker cursor-pointer text-bronze hover:text-paper">
            How these lists are ranked
          </summary>
          <p className="mt-3 text-mist">
            These lists are frozen. They do not move. Everyone looking at this
            Wall sees the same order. Nothing is personalized.
          </p>
          <ul className="mt-3 space-y-3">
            {discoveryMethodsFor(false).map((method) => (
              <li key={method.id}>
                <p className="font-display text-paper">{method.title}</p>
                <p className="mt-1">{method.body}</p>
              </li>
            ))}
          </ul>
        </details>
      </Tabs.Root>

      {error ? (
        <div className="mt-6">
          <FailureRecovery
            title="The archive is temporarily unreachable"
            body={error}
            actions={[
              {
                label: "Try again",
                kind: "line",
                onClick: () => void load({ q: query || undefined }),
              },
            ]}
          />
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
              ? "That number is not on this Wall."
              : "No sentence on this Wall contains those words."}
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

      {randomOpen ? (
        <RandomMode event={event} variant="overlay" onClose={() => setRandomOpen(false)} />
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
