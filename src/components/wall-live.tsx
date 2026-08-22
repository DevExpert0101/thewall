"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClosedMonument } from "@/components/closed-monument";
import { ClosingCeremony } from "@/components/closing-ceremony";
import { LivingWall } from "@/components/living-wall";
import { VictorRace } from "@/components/victor-race";
import { FailureRecovery } from "@/components/failure-recovery";
import { MessageCard } from "@/components/message-card";
import { MilestoneFeed } from "@/components/milestone-feed";
import { MilestoneToast } from "@/components/milestone-toast";
import { RandomMode } from "@/components/random-mode";
import { PublishDialog } from "@/components/publish-dialog";
import { PrimaryCta } from "@/components/primary-cta";
import { Countdown } from "@/components/countdown";
import { SharePanel } from "@/components/share-panel";
import { WallSkeleton } from "@/components/wall-skeleton";
import { rarestCelebration, reachedMilestones } from "@/lib/milestones/engine";
import { SUPPORTING_COPY } from "@/lib/constants";
import { useSyncedNow } from "@/lib/event/clock";
import {
  eventPresentation,
  formatEventInstant,
  publishUrgencyLine,
  remainingMsFrom,
  remainingNotice,
} from "@/lib/event/remaining";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE, WAITING_PATH } from "@/lib/launch/cold-start";
import { sharePayloadForEvent } from "@/lib/share/copy";
import { editionNumberOf, formatCount, parsePublicNumber, wallTitle } from "@/lib/utils";
import type { MonumentEntry, VictorRaceLeader } from "@/lib/monument/types";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import type { MessageSort } from "@/lib/constants";
import { isDocumentHidden } from "@/lib/ui/visibility";
import { WALL_COUNT_PULSE_MS, WALL_MIX_PAGE_SIZE, WALL_PAGE_SIZE, WALL_PULSE_MS, WALL_SURFACE_MAX } from "@/lib/wall/constants";
import { discoveryMethodsFor, discoveryTabs } from "@/lib/wall/discovery";
import {
  applyOptimisticReaction,
  applyReactionCounts,
  capFeed,
  feedSortForPhase,
  mergeArrival,
} from "@/lib/wall/feed";
import { spectatorRankLabel, type SpectatorLane } from "@/lib/wall/mix";
import { SHOW_ANOTHER_HUMAN } from "@/lib/wall/random";
import { isEventClosed, publicPhaseLabel, reconcilePublicPhase } from "@/lib/event/state";

type Props = {
  event: EventSnapshot;
  initial: PublicMessage[];
  initialSurface?: PublicMessage[];
  initialCursor?: string | null;
  initialLanes?: Record<string, SpectatorLane>;
  initialLeaders?: VictorRaceLeader[];
  monument?: MonumentEntry | null;
};

export function WallLive({
  event,
  initial,
  initialSurface,
  initialCursor = null,
  initialLanes = {},
  initialLeaders = [],
  monument = null,
}: Props) {
  const [phase, setPhase] = useState(event.phase);
  const [sort, setSort] = useState<MessageSort>(() =>
    isEventClosed(event.phase) ? "hot" : "rising",
  );
  const [messages, setMessages] = useState(initial);
  const [surface, setSurface] = useState(initialSurface ?? initial);
  const [surfaceOpen, setSurfaceOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [hideRemoved, setHideRemoved] = useState(false);
  const [open, setOpen] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [frozen, setFrozen] = useState(isEventClosed(event.phase));
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    messages: event.totalMessages,
    reactions: event.totalReactions,
  });
  const verifiedTotals = useRef({
    messages: event.totalMessages,
    reactions: event.totalReactions,
  });
  const [marks, setMarks] = useState(() =>
    reachedMilestones({ messages: event.totalMessages, reactions: event.totalReactions }),
  );
  const [celebration, setCelebration] = useState<ReturnType<typeof rarestCelebration>>(null);
  const [pendingArrivals, setPendingArrivals] = useState<PublicMessage[]>([]);
  const [liveLink, setLiveLink] = useState<"ok" | "paused">("ok");
  const pulseFails = useRef(0);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [lanes, setLanes] = useState<Record<string, SpectatorLane>>(initialLanes);
  const [leaders, setLeaders] = useState<VictorRaceLeader[]>(initialLeaders);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const [clock, setClock] = useState({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    editionNumber: event.editionNumber,
  });
  const now = useSyncedNow(serverNow);
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLButtonElement | null>(null);
  const sortRef = useRef(sort);
  const queryRef = useRef(query);
  const messagesRef = useRef(messages);
  const phaseRef = useRef(phase);
  const remainingRef = useRef(0);

  useEffect(() => {
    sortRef.current = sort;
    queryRef.current = query;
    messagesRef.current = messages;
    phaseRef.current = phase;
    remainingRef.current = remainingMsFrom(
      phase === "upcoming" ? clock.startsAt : clock.endsAt,
      now,
    );
  });

  const searching = Boolean(query.trim());
  const visible = hideRemoved ? messages.filter((message) => !message.isRemoved) : messages;
  const surfaceVisible = hideRemoved ? surface.filter((message) => !message.isRemoved) : surface;

  const load = useCallback(
    async (input: {
      nextSort: MessageSort;
      q?: string;
      nextCursor?: string | null;
      append?: boolean;
    }) => {
      const id = ++requestId.current;
      if (input.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const mix = input.nextSort === "rising" && !input.q;
        const params = new URLSearchParams({
          sort: input.nextSort,
          limit: String(mix ? WALL_MIX_PAGE_SIZE : WALL_PAGE_SIZE),
        });
        if (input.q) params.set("q", input.q);
        if (input.nextCursor) params.set("cursor", input.nextCursor);
        if (input.nextSort === "random") params.set("salt", event.id);
        if (mix) params.set("mix", "1");
        const res = await fetch(`/api/messages?${params.toString()}`);
        const data = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok) {
          setError(data.recovery ?? data.error ?? "The wall could not be loaded.");
          return;
        }
        const page = (data.messages ?? []) as PublicMessage[];
        const nextLanes = (data.lanes ?? {}) as Record<string, SpectatorLane>;
        setLanes((current) => (input.append ? { ...current, ...nextLanes } : nextLanes));
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
    [event.id],
  );

  const applyVerifiedTotals = useCallback((incoming: { messages?: number; reactions?: number }) => {
    const next = {
      messages: incoming.messages ?? verifiedTotals.current.messages,
      reactions: incoming.reactions ?? verifiedTotals.current.reactions,
    };
    const crossed = rarestCelebration(verifiedTotals.current, next);
    verifiedTotals.current = next;
    setTotals(next);
    setMarks(reachedMilestones(next));
    if (crossed) setCelebration(crossed);
  }, []);

  const applyRemotePhase = useCallback((
    next: EventSnapshot["phase"],
    remoteNow?: string,
    remote?: { startsAt?: string; endsAt?: string; editionNumber?: number },
  ) => {
    const nextStarts = remote?.startsAt ?? clock.startsAt;
    const nextEnds = remote?.endsAt ?? clock.endsAt;
    const nextEdition = remote?.editionNumber ?? clock.editionNumber;
    const resolved = reconcilePublicPhase({
      reported: next,
      endsAt: nextEnds,
      now: remoteNow ?? serverNow,
      previous: phaseRef.current,
      startsAt: nextStarts,
      previousStartsAt: clock.startsAt,
      editionNumber: nextEdition,
      previousEditionNumber: clock.editionNumber,
    });
    if (
      nextStarts !== clock.startsAt ||
      nextEnds !== clock.endsAt ||
      nextEdition !== clock.editionNumber
    ) {
      setClock({ startsAt: nextStarts, endsAt: nextEnds, editionNumber: nextEdition });
    }
    const current = phaseRef.current;
    if (current === resolved) return;
    setPhase(resolved);
    const closed = isEventClosed(resolved);
    setFrozen(closed);
    if (closed) setPendingArrivals([]);
    if (closed && sortRef.current === "rising") {
      setSort("hot");
      void load({ nextSort: "hot" });
    }
  }, [clock.editionNumber, clock.endsAt, clock.startsAt, load, serverNow]);

  const applyBeat = useCallback(
    (data: {
      totalMessages?: number;
      totalReactions?: number;
      latestPublicNumber?: number;
      counts?: Record<string, number>;
      serverNow?: string;
      phase?: EventSnapshot["phase"];
      startsAt?: string;
      endsAt?: string;
      editionNumber?: number;
    }) => {
      if (typeof data.serverNow === "string") setServerNow(data.serverNow);
      if (data.phase) {
        applyRemotePhase(data.phase, data.serverNow, {
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          editionNumber: data.editionNumber,
        });
      }
      if (remainingRef.current <= 0) return;
      if (typeof data.totalMessages === "number" && typeof data.totalReactions === "number") {
        applyVerifiedTotals({ messages: data.totalMessages, reactions: data.totalReactions });
      }
      if (data.counts) {
        setMessages((current) => applyReactionCounts(current, data.counts as Record<string, number>));
        setSurface((current) => applyReactionCounts(current, data.counts as Record<string, number>));
      }
    },
    [applyRemotePhase, applyVerifiedTotals],
  );

  const ingestArrivals = useCallback((incoming: PublicMessage[]) => {
    if (remainingRef.current <= 0) return;
    const fresh = incoming.filter((row) => row.eventId === event.id || event.id === "local");
    if (fresh.length === 0) return;
    setSurface((list) => fresh.reduce((acc, row) => mergeArrival(acc, row, WALL_SURFACE_MAX), list));
    if ((sortRef.current === "new" || sortRef.current === "rising") && !queryRef.current) {
      setMessages((list) => fresh.reduce((acc, row) => mergeArrival(acc, row), list));
      setFreshIds((ids) => [...fresh.map((row) => row.id), ...ids].slice(0, 12));
      if (sortRef.current === "rising") {
        setLanes((current) => {
          const next = { ...current };
          for (const row of fresh) next[row.id] = "fresh";
          return next;
        });
      }
    } else {
      setPendingArrivals((list) => {
        const seen = new Set(list.map((row) => row.id));
        const next = fresh.filter((row) => !seen.has(row.id));
        return next.length === 0 ? list : [...next, ...list].slice(0, 24);
      });
    }
  }, [event.id]);

  const beat = useCallback(async () => {
    if (isDocumentHidden() || remainingRef.current <= 0) return;
    const params = new URLSearchParams();
    if (event.id !== "local") params.set("eventId", event.id);
    try {
      const res = await fetch(`/api/messages/pulse?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        pulseFails.current += 1;
        if (pulseFails.current >= 2) setLiveLink("paused");
        return;
      }
      pulseFails.current = 0;
      setLiveLink("ok");
      applyBeat(data);
      if (remainingRef.current > 0) {
        try {
          const hot = await fetch("/api/messages?sort=hot&limit=3");
          const body = await hot.json();
          if (hot.ok && Array.isArray(body.messages)) {
            setLeaders(
              (body.messages as PublicMessage[]).map((message) => ({
                publicNumber: message.publicNumber,
                text: message.text,
                isRemoved: message.isRemoved,
                reactionCount: message.reactionCount,
                publishedAt: message.publishedAt,
              })),
            );
          }
        } catch {
          // keep the last good race
        }
      }
      const latest =
        typeof data.latestPublicNumber === "number" ? data.latestPublicNumber : data.totalMessages;
      const maxLocal = messagesRef.current.reduce(
        (max, message) => Math.max(max, message.publicNumber),
        0,
      );
      if (typeof latest === "number" && latest > maxLocal) {
        const feed = await fetch(`/api/messages?sort=new&limit=${WALL_PAGE_SIZE}`);
        const body = await feed.json();
        if (feed.ok && Array.isArray(body.messages)) {
          ingestArrivals(
            (body.messages as PublicMessage[]).filter((row) => row.publicNumber > maxLocal),
          );
        }
      }
    } catch {
      pulseFails.current += 1;
      if (pulseFails.current >= 2) setLiveLink("paused");
    }
  }, [applyBeat, event.id, ingestArrivals]);

  const syncCounts = useCallback(async () => {
    if (isDocumentHidden()) return;
    const list = messagesRef.current;
    if (list.length === 0) return;
    const ids = list.slice(0, WALL_PAGE_SIZE * 4).map((message) => message.id);
    const params = new URLSearchParams({ ids: ids.join(",") });
    if (event.id !== "local") params.set("eventId", event.id);
    try {
      const res = await fetch(`/api/messages/pulse?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      applyBeat(data);
    } catch {
      // keep the last good counts
    }
  }, [applyBeat, event.id]);

  const remainingForWrite = remainingMsFrom(
    phase === "upcoming" ? clock.startsAt : clock.endsAt,
    now,
  );
  const displayPhase =
    phase === "live" && remainingForWrite <= 0 ? "finalizing" : phase;
  const cardEvent = useMemo(
    () => ({ phase: displayPhase, endsAt: clock.endsAt, serverNow, editionNumber: clock.editionNumber }),
    [clock.editionNumber, clock.endsAt, displayPhase, serverNow],
  );
  const onReacted = useCallback((id: string, count: number) => {
    setMessages((current) => applyOptimisticReaction(current, id, count));
    setSurface((current) => applyOptimisticReaction(current, id, count));
    setTotals((current) => ({ ...current, reactions: current.reactions + 1 }));
  }, []);

  useEffect(() => {
    if (phase === "archived") return;
    const closed = isEventClosed(phase);
    let countAt = 0;
    const id = window.setInterval(() => {
      if (isDocumentHidden()) return;
      if (isEventClosed(phaseRef.current)) {
        void fetch("/api/event")
          .then((res) => res.json())
          .then((data) => {
            if (typeof data.serverNow === "string") setServerNow(data.serverNow);
            if (data.phase) applyRemotePhase(data.phase as EventSnapshot["phase"], data.serverNow);
          })
          .catch(() => undefined);
        return;
      }
      void beat();
      countAt += WALL_PULSE_MS;
      if (countAt >= WALL_COUNT_PULSE_MS) {
        countAt = 0;
        void syncCounts();
      }
    }, closed ? 30_000 : WALL_PULSE_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible" || isEventClosed(phaseRef.current)) return;
      void beat();
      void syncCounts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, beat, syncCounts, applyRemotePhase]);

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
    if (next === "random") {
      setRandomOpen(true);
      return;
    }
    const resolved = feedSortForPhase(phase, next);
    setSort(resolved);
    setQuery("");
    setDraftQuery("");
    setPendingArrivals([]);
    setLanes({});
    void load({ nextSort: resolved });
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

  const target = phase === "upcoming" ? clock.startsAt : clock.endsAt;
  const remaining = remainingMsFrom(target, now);
  const presentation = eventPresentation(phase, remaining);
  const writable = phase === "live" && remaining > 0;
  const notice = remainingNotice(presentation, remaining);
  const urgency = publishUrgencyLine(presentation);
  const label =
    phase === "upcoming" ? "Until launch" : phase === "live" ? "Remaining" : "Closed";

  const emptyCopy = emptyMessage({
    phase,
    sort,
    searching,
    query,
    totalMessages: event.totalMessages,
  });

  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-28"
      data-presentation={presentation}
    >
      {liveLink === "paused" ? (
        <div className="mb-4">
          <FailureRecovery
            title="Live updates paused"
            body="The Wall is still here. You can keep reading and searching. New arrivals will resume when the connection returns."
            actions={[
              {
                label: "Try live updates again",
                kind: "line",
                onClick: () => {
                  pulseFails.current = 0;
                  setLiveLink("ok");
                  void beat();
                },
              },
            ]}
          />
        </div>
      ) : null}
      <div
        className="wall-chrome sticky z-30 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6"
        data-presentation={presentation}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate font-display text-lg text-paper sm:text-xl">
              {wallTitle(event)}
            </p>
            {writable ? (
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
                <span className="live-dot" aria-hidden="true" />
                {notice ? (
                  <>
                    <span className="sr-only">Live</span>
                    <span aria-hidden="true">{notice}</span>
                  </>
                ) : (
                  "Live"
                )}
              </span>
            ) : (
              <span className="kicker">
                {publicPhaseLabel(phase === "live" && remaining <= 0 ? "finalizing" : phase)}
              </span>
            )}
            <Countdown
              targetIso={target}
              serverNow={serverNow}
              nowMs={now}
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
            {phase === "upcoming"
              ? `Opens ${formatEventInstant(clock.startsAt)}`
              : `${formatCount(totals.messages)} voices · ${formatCount(totals.reactions)} 🔥`}
            {event.id === "local" ? " · Simulation" : ""}
          </p>
        </div>
        <MilestoneFeed marks={marks} phase={displayPhase === "finalizing" ? "finalizing" : phase} />
      </div>

      {frozen || (phase === "live" && remaining <= 0) ? (
        <div className="empty-monument event-freeze my-6 py-10">
          <ClosedMonument
            editionNumber={clock.editionNumber ?? editionNumberOf(event)}
            totalMessages={totals.messages}
            sealed={phase === "archived"}
          />
          {phase === "archived" ? <ClosingCeremony entry={monument} /> : null}
        </div>
      ) : null}

      {writable ? <VictorRace leaders={leaders} live /> : null}

      {writable && urgency ? (
        <p className="mt-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ember">
          {urgency}
        </p>
      ) : null}

      {writable && pendingArrivals.length > 0 ? (
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
              Find a sentence
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="#004291 or a phrase"
                inputMode="search"
                autoComplete="off"
                aria-invalid={Boolean(draftQuery.trim().startsWith("#") && !parsePublicNumber(draftQuery))}
                aria-describedby="wall-search-hint"
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
          <p id="wall-search-hint" className="sr-only">
            Search by message number like #004291, or by a phrase from the sentence.
          </p>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {surfaceVisible.length > 0 ? (
            <button type="button" className="btn btn-line" onClick={() => setSurfaceOpen(true)}>
              View the wall
            </button>
          ) : null}
          {writable ? (
            <div className="hidden sm:block">
              <PrimaryCta phase="live" onPublish={() => setOpen(true)} />
            </div>
          ) : null}
        </div>
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
          {discoveryTabs(!frozen).map((tab) => (
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
        <details className="mt-4 max-w-2xl text-sm text-ash">
          <summary className="kicker cursor-pointer text-bronze hover:text-paper">
            How these lists are ranked
          </summary>
          <p className="mt-3 text-mist">
            Everyone looking at this Wall sees the same lists. Nothing is personalized.
          </p>
          <ul className="mt-3 space-y-3">
            {discoveryMethodsFor(!frozen).map((method) => (
              <li key={method.id}>
                <p className="font-display text-paper">{method.title}</p>
                <p className="mt-1">{method.body}</p>
              </li>
            ))}
          </ul>
        </details>

        <Tabs.Content value={sort} className="mt-4" aria-busy={loading}>
          {error ? (
            <FailureRecovery
              title="The Wall is temporarily unreachable"
              body={error}
              actions={[
                {
                  label: "Try again",
                  kind: "line",
                  onClick: () =>
                    void load({
                      nextSort: sort,
                      q: query || undefined,
                      nextCursor: cursor,
                      append: messages.length > 0,
                    }),
                },
              ]}
            />
          ) : null}

          {loading && messages.length === 0 ? <WallSkeleton count={9} /> : null}

          {!loading && !error && visible.length === 0 ? (
            <div className="empty-monument">
              <p className="font-display text-3xl sm:text-4xl">{emptyCopy.title}</p>
              <p className="lede mx-auto mt-4 max-w-md">{emptyCopy.body}</p>
              {writable && !searching ? (
                <button
                  type="button"
                  className="btn btn-primary mt-8"
                  onClick={() => setOpen(true)}
                >
                  Be the first sentence
                </button>
              ) : null}
              {phase === "upcoming" && !searching ? (
                <div className="mx-auto mt-8 max-w-md">
                  <p className="mb-4 text-xs uppercase tracking-[0.18em] text-bronze">
                    Opens {formatEventInstant(clock.startsAt)}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <PrimaryCta phase="upcoming" />
                  </div>
                  <div className="mt-6">
                    <SharePanel
                      payload={sharePayloadForEvent({ ...event, phase: "upcoming", serverNow }, WAITING_PATH)}
                      via="event"
                      primaryLabel="Share the opening"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="wall-columns">
              {visible.map((message, index) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  phase={displayPhase}
                  dense
                  fresh={freshIds.includes(message.id)}
                  featured={false}
                  event={cardEvent}
                  rankLabel={spectatorRankLabel(
                    lanes[message.id],
                    sort,
                    index,
                    freshIds.includes(message.id),
                  )}
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

          {visible.length > 0 && !searching && !randomOpen ? (
            <button
              type="button"
              onClick={() => setRandomOpen(true)}
              className="btn-ghost mt-4 w-full min-h-11 text-bronze hover:text-paper"
            >
              {SHOW_ANOTHER_HUMAN}
            </button>
          ) : null}
        </Tabs.Content>
      </Tabs.Root>

      {surfaceOpen ? (
        <div className="living-overlay" role="dialog" aria-label="The Wall">
          <div className="living-overlay-bar">
            <button type="button" className="btn btn-line" onClick={() => setSurfaceOpen(false)}>
              Back to sentences
            </button>
          </div>
          <div className="living-stage">
            <LivingWall
              messages={surfaceVisible}
              phase={displayPhase}
              event={cardEvent}
              onReacted={onReacted}
            />
          </div>
        </div>
      ) : null}

      {writable ? (
        <div className="wall-dock fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <PrimaryCta phase="live" onPublish={() => setOpen(true)} className="w-full" />
        </div>
      ) : null}

      {randomOpen ? (
        <RandomMode event={event} variant="overlay" onClose={() => setRandomOpen(false)} />
      ) : null}

      {celebration ? (
        <MilestoneToast
          milestone={celebration}
          event={{
            phase: displayPhase,
            endsAt: clock.endsAt,
            serverNow,
            editionNumber: clock.editionNumber ?? editionNumberOf(event),
          }}
          onDismiss={() => setCelebration(null)}
        />
      ) : null}

      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={writable}
        endsAt={clock.endsAt}
        serverNow={serverNow}
        editionNumber={clock.editionNumber ?? editionNumberOf(event)}
      />
    </div>
  );
}

function emptyMessage(input: {
  phase: EventSnapshot["phase"];
  sort: MessageSort;
  searching: boolean;
  query: string;
  totalMessages: number;
}): { title: string; body: string } {
  if (input.phase === "upcoming") {
    return {
      title: "Blank stone.",
      body: SUPPORTING_COPY,
    };
  }
  if (input.phase === "live" && input.totalMessages === 0 && !input.searching) {
    return {
      title: JUST_OPENED_TITLE,
      body: FIRST_HUNDRED_LINE,
    };
  }
  if (input.searching) {
    const n = parsePublicNumber(input.query);
    return {
      title: n ? `No ${String(n).padStart(6, "0")}.` : "No match.",
      body: n
        ? "That number is not on this Wall. Try another, or wander the lists."
        : "No sentence on this Wall contains those words.",
    };
  }
  if (input.sort === "rising") {
    return {
      title: "Quiet hour.",
      body: "No 🔥 in the last sixty minutes. Lifetime totals do not count here.",
    };
  }
  if (input.sort === "gems") {
    return {
      title: "No hidden gems yet.",
      body: "A gem needs at least 3 🔥 and must sit outside the loudest 20%.",
    };
  }
  if (input.sort === "final") {
    return input.phase === "live"
      ? {
          title: "The final hour has not begun.",
          body: "Sentences published in the last 60 minutes before this Wall closes will appear here.",
        }
      : {
          title: "No last-hour sentences.",
          body: "Nobody published in the final 60 minutes of this Wall.",
        };
  }
  if (input.sort === "random") {
    return {
      title: "Nothing to wander.",
      body: "The Wall is empty. Anyone can read. One dollar writes.",
    };
  }
  return {
    title: "The Wall is listening.",
    body: "Anyone can read every sentence. You do not have to pay to stay. If you have one line, the wall will keep it.",
  };
}
