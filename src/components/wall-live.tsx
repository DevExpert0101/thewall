"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCard } from "@/components/message-card";
import { PublishDialog } from "@/components/publish-dialog";
import { PrimaryCta } from "@/components/primary-cta";
import { Countdown } from "@/components/countdown";
import { WallSkeleton } from "@/components/wall-skeleton";
import { formatCount, parsePublicNumber } from "@/lib/utils";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import type { MessageSort } from "@/lib/constants";
import { WALL_PAGE_SIZE, WALL_PULSE_MS } from "@/lib/wall/constants";
import {
  applyOptimisticReaction,
  applyReactionCounts,
  arrivalFromRealtime,
  capFeed,
  feedSortForPhase,
  mergeArrival,
} from "@/lib/wall/feed";
import { realtimeChannelName, realtimeEventFilter } from "@/lib/wall/realtime";
import { isEventClosed } from "@/lib/event/state";

const TABS: { id: MessageSort; label: string; hint: string }[] = [
  { id: "trending", label: "Trending", hint: "Heat over time" },
  { id: "hot", label: "Most 🔥", hint: "All-time fire" },
  { id: "hour", label: "This hour", hint: "Last 60 minutes" },
  { id: "new", label: "New", hint: "Just arrived" },
  { id: "random", label: "Random", hint: "A wander" },
];

type Props = {
  event: EventSnapshot;
  initial: PublicMessage[];
  initialCursor?: string | null;
};

export function WallLive({ event, initial, initialCursor = null }: Props) {
  const [phase, setPhase] = useState(event.phase);
  const [sort, setSort] = useState<MessageSort>("trending");
  const [messages, setMessages] = useState(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [hideRemoved, setHideRemoved] = useState(false);
  const [salt, setSalt] = useState("wall");
  const [open, setOpen] = useState(false);
  const [frozen, setFrozen] = useState(isEventClosed(event.phase));
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    messages: event.totalMessages,
    reactions: event.totalReactions,
  });
  const [pendingArrivals, setPendingArrivals] = useState<PublicMessage[]>([]);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLButtonElement | null>(null);
  const sortRef = useRef(sort);
  const queryRef = useRef(query);
  const messagesRef = useRef(messages);
  const phaseRef = useRef(phase);

  useEffect(() => {
    sortRef.current = sort;
    queryRef.current = query;
    messagesRef.current = messages;
    phaseRef.current = phase;
  });

  const searching = Boolean(query.trim());
  const visible = hideRemoved ? messages.filter((message) => !message.isRemoved) : messages;

  const load = useCallback(
    async (input: {
      nextSort: MessageSort;
      q?: string;
      nextCursor?: string | null;
      nextSalt?: string;
      append?: boolean;
    }) => {
      const id = ++requestId.current;
      if (input.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          sort: input.nextSort,
          limit: String(WALL_PAGE_SIZE),
        });
        if (input.q) params.set("q", input.q);
        if (input.nextCursor) params.set("cursor", input.nextCursor);
        if (input.nextSort === "random") params.set("salt", input.nextSalt ?? salt);
        const res = await fetch(`/api/messages?${params.toString()}`);
        const data = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok) {
          setError(data.recovery ?? data.error ?? "The wall could not be loaded.");
          return;
        }
        const page = (data.messages ?? []) as PublicMessage[];
        setMessages((current) =>
          capFeed(
            input.append
              ? [...current, ...page.filter((row) => !current.some((m) => m.id === row.id))]
              : page,
          ),
        );
        setCursor(data.nextCursor ?? null);
      } catch {
        if (id !== requestId.current) return;
        setError("Network failure. The wall is still here — try again.");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [salt],
  );

  const applyRemotePhase = useCallback((next: EventSnapshot["phase"]) => {
    const current = phaseRef.current;
    if (current === next) return;
    setPhase(next);
    const closed = isEventClosed(next);
    setFrozen(closed);
    if (closed && (sortRef.current === "trending" || sortRef.current === "hour")) {
      setSort("hot");
      void load({ nextSort: "hot" });
    }
  }, [load]);

  const pulse = useCallback(async () => {
    const list = messagesRef.current;
    if (list.length === 0) {
      try {
        const res = await fetch("/api/event");
        const data = await res.json();
        if (res.ok) {
          setTotals((current) => ({
            messages: data.totalMessages ?? current.messages,
            reactions: data.totalReactions ?? current.reactions,
          }));
          if (data.phase) applyRemotePhase(data.phase as EventSnapshot["phase"]);
        }
      } catch {
        // keep last totals
      }
      return;
    }
    const ids = list.slice(0, WALL_PAGE_SIZE * 4).map((message) => message.id);
    const params = new URLSearchParams({ ids: ids.join(",") });
    if (event.id !== "local") params.set("eventId", event.id);
    try {
      const res = await fetch(`/api/messages/pulse?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      setTotals((current) => ({
        messages: data.totalMessages ?? current.messages,
        reactions: data.totalReactions ?? current.reactions,
      }));
      if (data.counts) {
        setMessages((current) => applyReactionCounts(current, data.counts as Record<string, number>));
      }
      if (data.phase) applyRemotePhase(data.phase as EventSnapshot["phase"]);
    } catch {
      // keep the last good feed
    }
  }, [applyRemotePhase, event.id]);

  const cardEvent = useMemo(
    () => ({ phase, endsAt: event.endsAt, serverNow: event.serverNow }),
    [phase, event.endsAt, event.serverNow],
  );
  const onReacted = useCallback((id: string, count: number) => {
    setMessages((current) => applyOptimisticReaction(current, id, count));
    setTotals((current) => ({ ...current, reactions: current.reactions + 1 }));
  }, []);

  useEffect(() => {
    if (phase === "archived") return;
    const id = window.setInterval(() => {
      void pulse();
    }, WALL_PULSE_MS);
    return () => window.clearInterval(id);
  }, [phase, pulse]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || phase !== "live") return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("@/lib/supabase/browser").then(({ createRealtimeSupabase }) => {
      if (cancelled) return;
      const client = createRealtimeSupabase();
      const channel = client
        .channel(realtimeChannelName(event.id))
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "public_message_events",
            filter: realtimeEventFilter(event.id),
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              event_id: string;
              public_number: number;
              text: string;
              reaction_count: number;
              published_at: string;
            };
            if (row.event_id !== event.id) return;
            const incoming = arrivalFromRealtime(row);
            setTotals((current) => ({
              ...current,
              messages: current.messages + 1,
            }));
            if (sortRef.current === "new" && !queryRef.current) {
              setMessages((list) => mergeArrival(list, incoming));
              setFreshIds((ids) => [incoming.id, ...ids].slice(0, 12));
            } else {
              setPendingArrivals((list) =>
                list.some((row) => row.id === incoming.id) ? list : [incoming, ...list].slice(0, 24),
              );
            }
          },
        )
        .subscribe();
      if (cancelled) {
        void client.removeChannel(channel);
        return;
      }
      dispose = () => {
        void client.removeChannel(channel);
      };
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [phase, event.id]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor || searching || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void load({ nextSort: sort, q: query, nextCursor: cursor, append: true });
        }
      },
      { rootMargin: "640px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, searching, loading, loadingMore, sort, query, load]);

  function changeSort(next: MessageSort) {
    const resolved = feedSortForPhase(phase, next);
    setSort(resolved);
    setQuery("");
    setDraftQuery("");
    setPendingArrivals([]);
    void load({ nextSort: resolved, nextSalt: salt });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const raw = draftQuery.trim();
    setQuery(raw);
    if (!raw) {
      void load({ nextSort: sort });
      return;
    }
    void load({ nextSort: sort, q: raw });
  }

  function revealArrivals() {
    const incoming = pendingArrivals;
    setPendingArrivals([]);
    setSort("new");
    setQuery("");
    setDraftQuery("");
    setMessages((current) => incoming.reduce((list, row) => mergeArrival(list, row), current));
    setFreshIds(incoming.map((row) => row.id));
    void load({ nextSort: "new" });
  }

  const target = phase === "upcoming" ? event.startsAt : event.endsAt;
  const label =
    phase === "upcoming" ? "Until launch" : phase === "live" ? "Remaining" : "Closed";

  const emptyCopy = emptyMessage({
    phase,
    sort,
    searching,
    query,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6">
      <div className="wall-chrome sticky top-14 z-30 -mx-4 px-4 py-3 sm:top-16 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {phase === "live" ? (
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
                <span className="live-dot" aria-hidden="true" />
                Live
              </span>
            ) : (
              <span className="kicker">
                {phase}
              </span>
            )}
            <Countdown
              targetIso={target}
              serverNow={event.serverNow}
              label={label}
              phase={phase}
              size="bar"
              onZero={() => {
                if (phase === "upcoming") applyRemotePhase("live");
                if (phase === "live") applyRemotePhase("finalizing");
              }}
            />
          </div>
          <p className="font-mono text-[0.7rem] tracking-[0.08em] text-bronze sm:text-xs">
            {formatCount(totals.messages)} sentences · {formatCount(totals.reactions)} 🔥
            {event.id === "local" ? " · Simulation" : ""}
          </p>
        </div>
      </div>

      {frozen ? (
        <div className="empty-monument my-6 py-10">
          <p className="font-display text-2xl sm:text-3xl">The Wall is frozen.</p>
          <p className="mt-2 text-sm text-ash">
            {phase === "finalizing"
              ? "Publishing and 🔥 have stopped. Final ranks are being carved."
              : "No further sentences. Publishing and 🔥 have stopped."}
          </p>
          <a href="/archive" className="btn btn-primary mt-6">
            Enter the archive
          </a>
        </div>
      ) : null}

      {pendingArrivals.length > 0 ? (
        <button
          type="button"
          onClick={revealArrivals}
          className="btn btn-ember mt-4 w-full"
        >
          {pendingArrivals.length === 1
            ? "1 new sentence just landed — read it"
            : `${pendingArrivals.length} new sentences just landed — read them`}
        </button>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <form className="block flex-1" onSubmit={submitSearch}>
          <label className="block">
            <span className="kicker">
              Search by number
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="#004291"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={Boolean(draftQuery.trim() && !parsePublicNumber(draftQuery))}
                className="field min-w-[10rem] flex-1 font-mono text-sm"
              />
              <button
                type="submit"
                className="btn btn-line shrink-0 px-4"
              >
                Find
              </button>
              {searching ? (
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => {
                    setQuery("");
                    setDraftQuery("");
                    void load({ nextSort: sort });
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </label>
        </form>
        {phase === "live" ? (
          <div className="hidden sm:block">
            <PrimaryCta phase={phase} onPublish={() => setOpen(true)} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex min-h-11 items-center gap-2 kicker">
          <input
            type="checkbox"
            checked={hideRemoved}
            onChange={(e) => setHideRemoved(e.target.checked)}
            className="size-4 accent-ember"
          />
          Hide removed
        </label>
        {sort === "random" ? (
          <button
            type="button"
            className="btn-ghost text-ember hover:text-paper"
            onClick={() => {
              const next = crypto.randomUUID();
              setSalt(next);
              void load({ nextSort: "random", nextSalt: next });
            }}
          >
            Shuffle
          </button>
        ) : null}
      </div>

      <Tabs.Root
        value={sort}
        onValueChange={(value) => changeSort(value as MessageSort)}
        className="mt-4"
      >
        <Tabs.List
          aria-label="Wall filters"
          className="wall-tabs"
        >
          {TABS.filter((tab) => !frozen || (tab.id !== "trending" && tab.id !== "hour")).map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              title={tab.hint}
              className="wall-tab"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value={sort} className="mt-4" aria-busy={loading}>
          {error ? (
            <div className="border border-blood/40 bg-blood/10 p-5" role="alert">
              <p className="text-sm text-paper">{error}</p>
              <button
                type="button"
                className="btn-ghost mt-3 text-ember hover:text-paper"
                onClick={() => void load({ nextSort: sort, q: query || undefined, nextCursor: cursor, append: messages.length > 0 })}
              >
                Try again
              </button>
            </div>
          ) : null}

          {loading && messages.length === 0 ? <WallSkeleton /> : null}

          {!loading && !error && visible.length === 0 ? (
            <div className="empty-monument">
              <p className="font-display text-3xl sm:text-4xl">{emptyCopy.title}</p>
              <p className="lede mx-auto mt-4 max-w-md">{emptyCopy.body}</p>
              {phase === "live" && !searching ? (
                <button
                  type="button"
                  className="btn btn-primary mt-8"
                  onClick={() => setOpen(true)}
                >
                  Be the first sentence
                </button>
              ) : null}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="wall-columns">
              {visible.map((message, index) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  phase={phase}
                  dense
                  fresh={freshIds.includes(message.id)}
                  featured={sort === "trending" && !searching && index === 0}
                  event={cardEvent}
                  rankLabel={
                    freshIds.includes(message.id)
                      ? "Just arrived"
                      : sort === "trending" && index < 3
                        ? "Trending"
                        : sort === "hot" && index === 0
                          ? "Most 🔥"
                          : undefined
                  }
                  onReacted={onReacted}
                />
              ))}
            </div>
          ) : null}

          {cursor && !searching && !error ? (
            <button
              ref={sentinelRef}
              type="button"
              onClick={() => void load({ nextSort: sort, q: query || undefined, nextCursor: cursor, append: true })}
              disabled={loadingMore}
              className="btn btn-line mt-6 w-full text-ash hover:text-paper"
            >
              {loadingMore ? "Loading more…" : "Load more sentences"}
            </button>
          ) : null}
        </Tabs.Content>
      </Tabs.Root>

      {phase === "live" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-void/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <PrimaryCta phase={phase} onPublish={() => setOpen(true)} className="w-full" />
        </div>
      ) : null}

      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={phase === "live"}
        endsAt={event.endsAt}
        serverNow={event.serverNow}
      />
    </div>
  );
}

function emptyMessage(input: {
  phase: EventSnapshot["phase"];
  sort: MessageSort;
  searching: boolean;
  query: string;
}): { title: string; body: string } {
  if (input.phase === "upcoming") {
    return {
      title: "Blank stone.",
      body: "The Wall has not opened. Come back when the countdown reaches zero.",
    };
  }
  if (input.searching) {
    const n = parsePublicNumber(input.query);
    return {
      title: n ? `No ${String(n).padStart(6, "0")}.` : "Not a number.",
      body: n
        ? "That number is not on this Wall. Try another, or wander the feeds."
        : "Search looks like #004291 — six digits, nothing else.",
    };
  }
  if (input.sort === "hour") {
    return {
      title: "Quiet hour.",
      body: "No 🔥 in the last sixty minutes. The rest of the wall is still burning.",
    };
  }
  if (input.sort === "random") {
    return {
      title: "Nothing to wander.",
      body: "The Wall is empty. Anyone can read. One USDC writes.",
    };
  }
  return {
    title: "The Wall is listening.",
    body: "Anyone can read every sentence. You do not have to pay to stay. If you have one line, the wall will keep it.",
  };
}
