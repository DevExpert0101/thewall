"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Countdown } from "@/components/countdown";
import { useSyncedNow } from "@/lib/event/clock";
import { formatEventInstant, phaseAfterClock } from "@/lib/event/remaining";
import { isEventClosed, reconcilePublicPhase } from "@/lib/event/state";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE } from "@/lib/launch/cold-start";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import {
  editionNumberOf,
  formatCount,
  formatMessageMark,
  formatPublicNumber,
  formatWallEdition,
} from "@/lib/utils";
import { formatExclude } from "@/lib/wall/random";
import {
  WATCH_MODE_META,
  WATCH_MODES,
  type WatchMode,
  watchPath,
} from "@/lib/watch/config";

type Props = {
  event: EventSnapshot;
  initial: PublicMessage[];
  mode: WatchMode;
  stream?: boolean;
  cycleSec?: number;
};

type ListResponse = { messages?: PublicMessage[] };

export function WatchDeck({
  event,
  initial,
  mode,
  stream = false,
  cycleSec = 0,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState(event.phase);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const [clock, setClock] = useState({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    editionNumber: event.editionNumber,
  });
  const [messages, setMessages] = useState(initial);
  const [focus, setFocus] = useState(0);
  const [seen, setSeen] = useState(() => initial.map((message) => message.publicNumber));
  const seenRef = useRef(seen);
  const now = useSyncedNow(serverNow);
  const edition = clock.editionNumber ?? editionNumberOf(event);
  const meta = WATCH_MODE_META[mode];
  const derived = phaseAfterClock(phase, clock.startsAt, clock.endsAt, now);
  const remaining = derived.remaining;
  const remainingRef = useRef(remaining);
  const displayPhase = derived.phase;
  const target = displayPhase === "upcoming" ? clock.startsAt : clock.endsAt;
  const reduceMotion = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    () => false,
  );
  const [cycleOverride, setCycleOverride] = useState(false);
  const cycling = cycleSec > 0 && (stream || !reduceMotion || cycleOverride);
  const focusLayout = mode === "random" || (cycling && mode === "rising");

  const loadList = useCallback(async () => {
    if (remainingRef.current <= 0) return;
    const params = new URLSearchParams({
      sort: meta.sort,
      limit: String(meta.limit),
    });
    if (meta.sort === "rising") params.set("mix", "1");
    const res = await fetch(`/api/messages?${params.toString()}`);
    const data = (await res.json()) as ListResponse;
    if (!res.ok || remainingRef.current <= 0) return;
    setMessages(data.messages ?? []);
    setFocus(0);
  }, [meta.limit, meta.sort]);

  const loadRandom = useCallback(async () => {
    if (remainingRef.current <= 0) return;
    const params = new URLSearchParams({ count: "1" });
    const exclude = formatExclude(seenRef.current);
    if (exclude) params.set("exclude", exclude);
    const res = await fetch(`/api/messages/random?${params.toString()}`);
    const data = (await res.json()) as ListResponse & { remaining?: number };
    if (!res.ok || remainingRef.current <= 0) return;
    const page = data.messages ?? [];
    if (page.length === 0 && seenRef.current.length > 0) {
      seenRef.current = [];
      setSeen([]);
      const fresh = await fetch("/api/messages/random?count=1");
      const next = (await fresh.json()) as ListResponse;
      if (remainingRef.current <= 0) return;
      const first = next.messages?.[0];
      if (first) {
        setMessages([first]);
        setSeen([first.publicNumber]);
      }
      return;
    }
    const first = page[0];
    if (!first) return;
    setMessages([first]);
    setSeen((current) => [...current, first.publicNumber].slice(-48));
  }, []);

  useEffect(() => {
    seenRef.current = seen;
  });

  useEffect(() => {
    remainingRef.current = remaining;
  });

  useEffect(() => {
    const refresh = window.setInterval(() => {
      if (document.hidden || mode === "random" || remainingRef.current <= 0) return;
      void loadList();
    }, meta.refreshMs);
    return () => window.clearInterval(refresh);
  }, [loadList, meta.refreshMs, mode]);

  useEffect(() => {
    if (!cycling || remaining <= 0) return;
    const tick = window.setInterval(() => {
      if (remainingRef.current <= 0) return;
      if (mode === "random") {
        void loadRandom();
        return;
      }
      setFocus((index) => {
        if (messages.length === 0) return 0;
        return (index + 1) % messages.length;
      });
    }, cycleSec * 1000);
    return () => window.clearInterval(tick);
  }, [cycleSec, cycling, loadRandom, messages.length, mode, remaining]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void fetch("/api/event", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.serverNow === "string") setServerNow(data.serverNow);
          const nextStarts = typeof data.startsAt === "string" ? data.startsAt : clock.startsAt;
          const nextEnds = typeof data.endsAt === "string" ? data.endsAt : clock.endsAt;
          const nextEdition =
            typeof data.editionNumber === "number" ? data.editionNumber : clock.editionNumber;
          if (data.phase) {
            setPhase((current) =>
              reconcilePublicPhase({
                reported: data.phase as EventSnapshot["phase"],
                endsAt: nextEnds,
                now: typeof data.serverNow === "string" ? data.serverNow : event.serverNow,
                previous: current,
                startsAt: nextStarts,
                previousStartsAt: clock.startsAt,
                editionNumber: nextEdition,
                previousEditionNumber: clock.editionNumber,
              }),
            );
          }
          if (
            nextStarts !== clock.startsAt ||
            nextEnds !== clock.endsAt ||
            nextEdition !== clock.editionNumber
          ) {
            setClock({ startsAt: nextStarts, endsAt: nextEnds, editionNumber: nextEdition });
          }
        })
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [clock.editionNumber, clock.endsAt, clock.startsAt, event.serverNow]);

  function setMode(next: WatchMode) {
    router.replace(watchPath({ stream, mode: next, cycleSec: cycling ? cycleSec : undefined }));
  }

  function setCycle(next: number) {
    router.replace(watchPath({ stream, mode, cycleSec: next }));
  }

  const focused = messages[Math.min(focus, Math.max(messages.length - 1, 0))] ?? null;
  const streamHref = useMemo(
    () => watchPath({ stream: true, mode, cycleSec: cycling ? cycleSec : 0 }),
    [cycleSec, cycling, mode],
  );
  const label = displayPhase === "upcoming" ? "Until launch" : displayPhase === "live" ? "Remaining" : "Closed";

  return (
    <div className="watch-deck" data-stream={stream ? "on" : "off"} data-mode={mode}>
      <header className="watch-chrome">
        <div className="watch-brand">
          <p className="watch-wordmark">{formatWallEdition(edition)}</p>
          <p className="watch-kicker">
            {displayPhase === "upcoming" ? `Opens ${formatEventInstant(clock.startsAt)}` : meta.label}
          </p>
        </div>
        <Countdown
          targetIso={target}
          serverNow={serverNow}
          nowMs={now}
          label={label}
          phase={displayPhase}
          size="bar"
        />
      </header>

      {!stream ? (
        <div className="watch-controls">
          <div className="watch-modes" role="tablist" aria-label="Spectator modes">
            {WATCH_MODES.map((id, index) => (
              <button
                key={id}
                id={`watch-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={mode === id}
                aria-controls="watch-stage"
                tabIndex={mode === id ? 0 : -1}
                title={WATCH_MODE_META[id].hint}
                className="watch-mode"
                onClick={() => setMode(id)}
                onKeyDown={(event) => {
                  const last = WATCH_MODES.length - 1;
                  let next = index;
                  if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
                  else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = last;
                  else return;
                  event.preventDefault();
                  const nextId = WATCH_MODES[next];
                  if (!nextId) return;
                  setMode(nextId);
                  window.queueMicrotask(() => document.getElementById(`watch-tab-${nextId}`)?.focus());
                }}
              >
                {WATCH_MODE_META[id].label}
              </button>
            ))}
          </div>
          <label className="watch-cycle">
            <input
              type="checkbox"
              checked={cycling}
              onChange={(e) => {
                const on = e.target.checked;
                setCycleOverride(on);
                setCycle(on ? Math.max(cycleSec, 12) : 0);
              }}
            />
            Auto cycle
            <span className="sr-only">
              {cycling
                ? `, every ${Math.max(cycleSec, 12)} seconds. Uncheck to stop.`
                : reduceMotion
                  ? ". Off because reduced motion is preferred."
                  : ""}
            </span>
          </label>
          <Link href={streamHref} className="btn btn-line watch-stream-link">
            Stream mode
            <span className="sr-only"> for OBS, no wallets</span>
          </Link>
        </div>
      ) : null}

      {cycling ? (
        <p className="sr-only" aria-live="polite">
          Sentences are cycling automatically.
        </p>
      ) : null}

      <div
        id="watch-stage"
        role={stream ? undefined : "tabpanel"}
        aria-labelledby={stream ? undefined : `watch-tab-${mode}`}
        aria-live="off"
      >
      {messages.length === 0 ? (
        <div className="watch-empty">
          <p className="font-display text-3xl text-paper">
            {isEventClosed(displayPhase)
              ? "The Wall is frozen."
              : displayPhase === "upcoming"
                ? "The waiting room is open."
                : JUST_OPENED_TITLE}
          </p>
          <p className="lede mt-4">
            {displayPhase === "upcoming"
              ? "No sentences yet. The countdown is the show."
              : isEventClosed(displayPhase)
                ? "The Wall is sealed. Reading is free."
                : FIRST_HUNDRED_LINE}
          </p>
        </div>
      ) : focusLayout && focused ? (
        <article className="watch-focus watch-fade" key={focused.id}>
          <p className="watch-number">{formatMessageMark(focused.publicNumber)}</p>
          <p className={`watch-sentence ${focused.isRemoved ? "is-removed" : ""}`}>
            {focused.isRemoved ? focused.text : `“${focused.text}”`}
          </p>
          <p className="watch-meta">
            <span aria-hidden="true">{formatCount(focused.reactionCount)} 🔥</span>
            <span className="sr-only">{formatCount(focused.reactionCount)} reactions</span>
          </p>
        </article>
      ) : (
        <ol className="watch-stack">
          {messages.map((message, index) => (
            <li
              key={message.id}
              className="watch-line"
              data-focus={cycling && index === focus ? "on" : "off"}
            >
              {mode === "top" ? (
                <span className="watch-rank">{index + 1}</span>
              ) : null}
              <span className="watch-number">{formatPublicNumber(message.publicNumber)}</span>
              <p className={`watch-line-text ${message.isRemoved ? "is-removed" : ""}`}>
                {message.isRemoved ? message.text : `“${message.text}”`}
              </p>
              <span className="watch-meta">
                <span aria-hidden="true">{formatCount(message.reactionCount)} 🔥</span>
                <span className="sr-only">{formatCount(message.reactionCount)} reactions</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      </div>
      <p className="watch-foot">Anyone can read.</p>
    </div>
  );
}
