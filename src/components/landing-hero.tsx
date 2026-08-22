"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ClosedMonument } from "@/components/closed-monument";
import { Countdown } from "@/components/countdown";
import { HeroIntroFilm } from "@/components/hero-intro-film";
import { MonumentCanvas } from "@/components/monument-canvas";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { MonumentTitle } from "@/components/monument-title";
import { SharePanel } from "@/components/share-panel";
import { HERO_PITCH, TAGLINE } from "@/lib/constants";
import { useSyncedNow } from "@/lib/event/clock";
import {
  eventPresentation,
  formatEventInstant,
  phaseAfterClock,
  publishUrgencyLine,
  remainingNotice,
} from "@/lib/event/remaining";
import { reconcilePublicPhase } from "@/lib/event/state";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE, WAITING_PATH, firstHundredLine, launchMoment } from "@/lib/launch/cold-start";
import { sharePayloadForEvent } from "@/lib/share/copy";
import type { MonumentCatalog } from "@/lib/monument/types";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatCount, formatObjectIdentity } from "@/lib/utils";

const TAGLINE_LINES = TAGLINE.split(/(?<=\.)\s+/);

export function LandingHero({
  event,
  featured = null,
  monument = null,
}: {
  event: EventSnapshot;
  featured?: PublicMessage | null;
  monument?: MonumentCatalog | null;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(event);
  const [phase, setPhase] = useState(event.phase);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const [catalog, setCatalog] = useState(monument);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [introDone, setIntroDone] = useState(false);
  const [eventSource, setEventSource] = useState(event);
  const [monumentSource, setMonumentSource] = useState(monument);
  const viewRef = useRef(view);
  const seenMonumentIds = useRef(new Set(monument?.entries.map((entry) => entry.id) ?? []));
  if (event !== eventSource) {
    setEventSource(event);
    setView(event);
    setPhase(event.phase);
    setServerNow(event.serverNow);
  }
  if (monument !== monumentSource) {
    setMonumentSource(monument);
    setCatalog(monument);
  }
  const now = useSyncedNow(serverNow);
  const clock = phaseAfterClock(phase, view.startsAt, view.endsAt, now);
  const clockPhase = clock.phase;
  const remaining = clock.remaining;
  const target = clockPhase === "upcoming" ? view.startsAt : view.endsAt;
  const presentation = eventPresentation(clockPhase, remaining);
  const writable = clockPhase === "live" && remaining > 0;
  const nearOpen = clockPhase === "upcoming" && remaining <= 120_000;
  const closed = clockPhase === "finalizing" || clockPhase === "archived";
  const notice = remainingNotice(presentation, remaining);
  const urgency = publishUrgencyLine(presentation);
  const edition = editionNumberOf(view);

  useEffect(() => {
    viewRef.current = view;
  });

  useEffect(() => {
    for (const entry of monument?.entries ?? []) seenMonumentIds.current.add(entry.id);
  }, [monument]);

  useEffect(() => {
    let cancelled = false;
    let carveTimer = 0;
    async function refreshMonument() {
      try {
        const res = await fetch("/api/monument", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !data || !Array.isArray(data.entries) || !data.canvas) return;
        const added = data.entries
          .filter((row: { id?: unknown }) => typeof row.id === "string" && !seenMonumentIds.current.has(row.id))
          .map((row: { id: string }) => row.id);
        for (const id of added) seenMonumentIds.current.add(id);
        setCatalog({
          entries: data.entries,
          sealedCount: typeof data.sealedCount === "number" ? data.sealedCount : data.entries.length,
          capacity: data.capacity ?? null,
          canvas: data.canvas,
        });
        if (added.length === 0) return;
        setFreshIds(added);
        window.clearTimeout(carveTimer);
        carveTimer = window.setTimeout(() => {
          setFreshIds((current) => current.filter((id) => !added.includes(id)));
        }, 1800);
      } catch {
        // keep the last sealed stone
      }
    }
    async function refresh() {
      try {
        const res = await fetch("/api/event", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.serverNow === "string") setServerNow(data.serverNow);
        if (typeof data.phase !== "string") return;
        const current = viewRef.current;
        const nextStarts = typeof data.startsAt === "string" ? data.startsAt : current.startsAt;
        const nextEnds = typeof data.endsAt === "string" ? data.endsAt : current.endsAt;
        const nextEdition =
          typeof data.editionNumber === "number" ? data.editionNumber : current.editionNumber;
        setPhase((previous) =>
          reconcilePublicPhase({
            reported: data.phase,
            endsAt: nextEnds,
            now: typeof data.serverNow === "string" ? data.serverNow : current.serverNow,
            previous,
            startsAt: nextStarts,
            previousStartsAt: current.startsAt,
            editionNumber: nextEdition,
            previousEditionNumber: current.editionNumber,
          }),
        );
        setView((currentView) => ({
          ...currentView,
          phase: data.phase,
          startsAt: nextStarts,
          endsAt: nextEnds,
          editionNumber: nextEdition,
          totalMessages:
            typeof data.totalMessages === "number" ? data.totalMessages : currentView.totalMessages,
          totalReactions:
            typeof data.totalReactions === "number" ? data.totalReactions : currentView.totalReactions,
          serverNow: typeof data.serverNow === "string" ? data.serverNow : currentView.serverNow,
        }));
      } catch {
        // keep the last good phase
      }
      void refreshMonument();
    }
    void refresh();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, nearOpen || closed ? 5_000 : 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(carveTimer);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [closed, nearOpen]);

  const label =
    clockPhase === "upcoming"
      ? "Until The Wall opens"
      : clockPhase === "live"
        ? "Until The Wall closes"
        : "The Wall has closed";

  return (
    <>
    <section className="hero-monument" data-presentation={presentation}>
      <div className="hero-wall" data-intro={introDone ? "done" : "playing"} aria-hidden="true">
        {!introDone ? <HeroIntroFilm onDone={() => setIntroDone(true)} /> : null}
        <div className="hero-stone" />
        {catalog && catalog.entries.length > 0 ? (
          <MonumentCanvas
            decorative
            canvas={catalog.canvas}
            entries={catalog.entries}
            freshIds={freshIds}
          />
        ) : null}
      </div>
      <div className="hero-urgency-veil" aria-hidden="true" />

      <div className="hero-stage">
        {presentation === "upcoming" ? (
          <p className="kicker">Opens {formatEventInstant(view.startsAt)}</p>
        ) : presentation === "closed" ? (
          <p className="kicker">Closed</p>
        ) : notice ? (
          <p className="hero-live hero-remain-notice" aria-hidden="true">
            {notice}
          </p>
        ) : (
          <p className="hero-live">
            <span className="live-dot" aria-hidden="true" />
            Happening now
          </p>
        )}

        <MonumentTitle />
        <span className="title-rule monument-rule mx-auto mt-4 block animate-ember-draw" aria-hidden="true" />

        {presentation === "closed" ? (
          <ClosedMonument
            editionNumber={edition}
            totalMessages={view.totalMessages}
            sealed={clockPhase === "archived"}
          />
        ) : (
          <>
            <p className="monument-tagline">
              {TAGLINE_LINES.map((line) => (
                <span key={line} className="tagline-line">
                  {line}
                </span>
              ))}
            </p>
            <ul className="hero-pitch">
              {HERO_PITCH.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}

        {presentation !== "closed" ? (
          <div
            className={
              presentation === "live" ||
              presentation === "final-hour" ||
              presentation === "final-ten" ||
              presentation === "final-minute" ||
              presentation === "final-seconds"
                ? "hero-clock hero-clock-live"
                : "hero-clock"
            }
          >
            <Countdown
              targetIso={target}
              serverNow={serverNow}
              nowMs={now}
              label={label}
              phase={clockPhase}
            />
          </div>
        ) : null}

        {writable ? (
          <>
            <HeroLiveStats messages={view.totalMessages} reactions={view.totalReactions} />
            {featured &&
            presentation !== "final-minute" &&
            presentation !== "final-seconds" ? (
              <HeroWitness message={featured} edition={edition} />
            ) : null}
          </>
        ) : presentation === "upcoming" ? (
          <p className="hero-activity">The waiting room is open. The stone is still blank.</p>
        ) : null}

        {urgency ? <p className="hero-urgency-copy">{urgency}</p> : null}

        {presentation !== "closed" ? (
          <div className="hero-actions">
            <PrimaryCta
              phase={writable ? "live" : clockPhase === "live" ? "finalizing" : clockPhase}
              onPublish={() => setOpen(true)}
              className="hero-cta hero-cta-thumb"
            />
            <Link href="/watch" className="btn btn-line hero-secondary">
              Watch the Wall
            </Link>
          </div>
        ) : null}

        {presentation === "upcoming" ? (
          <div className="hero-share">
            <SharePanel
              payload={sharePayloadForEvent({ ...view, phase: "upcoming", serverNow }, WAITING_PATH)}
              via="event"
              primaryLabel="Share the opening"
            />
          </div>
        ) : null}

        <p className="hero-trust">
          {presentation === "closed"
            ? "The day is over. The stone does not reopen."
            : "Reading is free. $1 writes one sentence. It becomes history."}
        </p>
      </div>

      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={writable}
        endsAt={view.endsAt}
        serverNow={serverNow}
        editionNumber={editionNumberOf(view)}
      />
    </section>
    <LandingStatRow
      messages={view.totalMessages}
      reactions={view.totalReactions}
      phase={clockPhase}
    />
    </>
  );
}

function HeroWitness({
  message,
  edition,
}: {
  message: PublicMessage;
  edition: number;
}) {
  return (
    <figure className="hero-witness">
      <blockquote>“{message.text}”</blockquote>
      <figcaption>
        {formatObjectIdentity(message.publicNumber, edition)} · {formatCount(message.reactionCount)} 🔥
      </figcaption>
    </figure>
  );
}

function LandingStatRow({
  messages,
  reactions,
  phase,
}: {
  messages: number;
  reactions: number;
  phase: EventSnapshot["phase"];
}) {
  const clock =
    phase === "live" ? "Open" : phase === "upcoming" ? "Soon" : "Closed";
  return (
    <section className="stat-row" aria-label="Wall totals">
      <div className="mx-auto grid max-w-6xl grid-cols-3">
        <StatTablet label="Voices" value={formatCount(messages)} />
        <StatTablet label="Fire" value={formatCount(reactions)} ember />
        <StatTablet label="The clock" value={clock} live={phase === "live"} />
      </div>
    </section>
  );
}

function StatTablet({
  label,
  value,
  live = false,
  ember = false,
}: {
  label: string;
  value: string;
  live?: boolean;
  ember?: boolean;
}) {
  return (
    <div className="stat-tablet">
      <p className={`stat-value ${live ? "text-ember" : ember ? "text-flame" : "text-paper"}`}>
        {live ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            {value}
          </span>
        ) : (
          value
        )}
      </p>
      <p className="kicker mt-3">{label}</p>
    </div>
  );
}

function HeroLiveStats({ messages, reactions }: { messages: number; reactions: number }) {
  const moment = launchMoment({ phase: "live", totalMessages: messages });
  if (messages === 0 && reactions === 0) {
    return (
      <div className="hero-activity">
        <p>{JUST_OPENED_TITLE}</p>
        <p className="mt-2">{FIRST_HUNDRED_LINE}</p>
      </div>
    );
  }
  return (
    <div>
      <dl className="hero-stats">
        <div>
          <dt>Voices</dt>
          <dd>{formatCount(messages)}</dd>
        </div>
        <div>
          <dt>Fire</dt>
          <dd>{formatCount(reactions)}</dd>
        </div>
      </dl>
      {moment === "just_opened" ? (
        <p className="hero-activity mt-4">{firstHundredLine(messages)}</p>
      ) : null}
    </div>
  );
}
