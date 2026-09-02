"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { useSyncedNow } from "@/lib/event/clock";
import { phaseAfterClock } from "@/lib/event/remaining";
import { isEventClosed, reconcilePublicPhase } from "@/lib/event/state";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE } from "@/lib/launch/cold-start";
import type { LiveBoard } from "@/lib/live/load";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import {
  editionNumberOf,
  formatCount,
  formatMessageMark,
  formatPublicNumber,
  formatWallEdition,
} from "@/lib/utils";
import { formatExclude } from "@/lib/wall/random";

type Props = {
  event: EventSnapshot;
  initial: LiveBoard;
  cycleSec: number;
};

type ListResponse = { messages?: PublicMessage[] };

function sentence(message: PublicMessage) {
  return message.isRemoved ? message.text : `“${message.text}”`;
}

export function LiveOverlay({ event, initial, cycleSec }: Props) {
  const [phase, setPhase] = useState(event.phase);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const [clock, setClock] = useState({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    editionNumber: event.editionNumber,
  });
  const [leader, setLeader] = useState(initial.leader);
  const [rising, setRising] = useState(initial.rising);
  const [random, setRandom] = useState(initial.random);
  const [seen, setSeen] = useState(() =>
    [initial.random?.publicNumber, initial.leader?.publicNumber].filter(
      (n): n is number => typeof n === "number",
    ),
  );
  const seenRef = useRef(seen);
  const remainingRef = useRef(0);
  const now = useSyncedNow(serverNow);
  const derived = phaseAfterClock(phase, clock.startsAt, clock.endsAt, now);
  const remaining = derived.remaining;
  const displayPhase = derived.phase;
  const edition = clock.editionNumber ?? editionNumberOf(event);
  const target = displayPhase === "upcoming" ? clock.startsAt : clock.endsAt;
  const label = displayPhase === "upcoming" ? "Until launch" : displayPhase === "live" ? "Remaining" : "Closed";

  useEffect(() => {
    seenRef.current = seen;
  });

  useEffect(() => {
    remainingRef.current = remaining;
  });

  const refreshLists = useCallback(async () => {
    const [hotRes, risingRes] = await Promise.all([
      fetch("/api/messages?sort=hot&limit=8"),
      fetch("/api/messages?sort=rising&mix=1&limit=8"),
    ]);
    const hot = (await hotRes.json()) as ListResponse;
    const nextRising = (await risingRes.json()) as ListResponse;
    if (!hotRes.ok) return;
    const living = (hot.messages ?? []).filter((message) => !message.isRemoved);
    const nextLeader =
      living.find((message) => message.finalRank === 1) ?? living[0] ?? null;
    setLeader(nextLeader);
    if (risingRes.ok) {
      setRising(
        (nextRising.messages ?? [])
          .filter((message) => !message.isRemoved && message.id !== nextLeader?.id)
          .slice(0, 4),
      );
    }
  }, []);

  const refreshRandom = useCallback(async () => {
    const params = new URLSearchParams({ count: "1" });
    const exclude = formatExclude(seenRef.current);
    if (exclude) params.set("exclude", exclude);
    const res = await fetch(`/api/messages/random?${params.toString()}`);
    const data = (await res.json()) as ListResponse;
    if (!res.ok) return;
    let next = data.messages?.[0] ?? null;
    if (!next && seenRef.current.length > 0) {
      seenRef.current = [];
      setSeen([]);
      const fresh = await fetch("/api/messages/random?count=1");
      const retry = (await fresh.json()) as ListResponse;
      next = retry.messages?.[0] ?? null;
    }
    if (!next) return;
    setRandom(next);
    setSeen((current) => [...current, next.publicNumber].slice(-36));
  }, []);

  useEffect(() => {
    const lists = window.setInterval(() => {
      if (document.hidden) return;
      void refreshLists();
    }, 8_000);
    return () => window.clearInterval(lists);
  }, [refreshLists]);

  useEffect(() => {
    if (cycleSec <= 0) return;
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      void refreshRandom();
    }, cycleSec * 1000);
    return () => window.clearInterval(tick);
  }, [cycleSec, refreshRandom]);

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
    }, 10_000);
    return () => window.clearInterval(id);
  }, [clock.editionNumber, clock.endsAt, clock.startsAt, event.serverNow]);

  const empty =
    displayPhase === "upcoming"
      ? "The waiting room is open. The countdown is the show."
      : isEventClosed(displayPhase)
        ? "The Wall is frozen. Reading is free."
        : FIRST_HUNDRED_LINE;

  return (
    <div className="live-overlay" data-phase={displayPhase}>
      <header className="live-chrome">
        <div>
          <p className="live-wordmark">{formatWallEdition(edition)}</p>
          <p className="live-kicker">$1 · one sentence · anyone can read</p>
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

      <div className="live-grid">
        <section className="live-panel live-leader" aria-label="Current number one">
          <p className="live-label">Current #1</p>
          {leader ? (
            <>
              <p className="live-mark">{formatMessageMark(leader.publicNumber)}</p>
              <p className={`live-quote live-quote-lead ${leader.isRemoved ? "is-removed" : ""}`}>
                {sentence(leader)}
              </p>
              <p className="live-meta">
                <span aria-hidden="true">{formatCount(leader.reactionCount)} 🔥</span>
                <span className="sr-only">{formatCount(leader.reactionCount)} reactions</span>
                <span aria-hidden="true"> · </span>
                {leader.finalRank === 1 ? "The Victor" : "By fire · provisional"}
              </p>
            </>
          ) : (
            <p className="live-empty">
              {displayPhase === "upcoming" ? "No sentences yet." : JUST_OPENED_TITLE}
            </p>
          )}
        </section>

        <section className="live-panel live-rising" aria-label="Rising sentences">
          <p className="live-label">Rising</p>
          {rising.length > 0 ? (
            <ol className="live-rising-list">
              {rising.map((message) => (
                <li key={message.id}>
                  <span className="live-rising-num">{formatPublicNumber(message.publicNumber)}</span>
                  <p className={message.isRemoved ? "is-removed" : ""}>{sentence(message)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="live-empty">{empty}</p>
          )}
        </section>

        <section className="live-panel live-random" aria-label="Random sentence">
          <p className="live-label">Random</p>
          {random ? (
            <>
              <p className={`live-quote ${random.isRemoved ? "is-removed" : ""}`}>{sentence(random)}</p>
              <p className="live-meta">{formatMessageMark(random.publicNumber)}</p>
            </>
          ) : (
            <p className="live-empty">{empty}</p>
          )}
        </section>
      </div>

      <p className="live-foot">Leave one sentence at the wall. Never shows wallets or keys.</p>
    </div>
  );
}
