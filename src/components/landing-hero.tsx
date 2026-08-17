"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ClosedMonument } from "@/components/closed-monument";
import { Countdown } from "@/components/countdown";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { MonumentTitle } from "@/components/monument-title";
import { SharePanel } from "@/components/share-panel";
import { HERO_PITCH, TAGLINE } from "@/lib/constants";
import { useSyncedNow } from "@/lib/event/clock";
import {
  eventPresentation,
  formatEventInstant,
  publishUrgencyLine,
  remainingMsFrom,
  remainingNotice,
} from "@/lib/event/remaining";
import { reconcilePublicPhase } from "@/lib/event/state";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE, WAITING_PATH, firstHundredLine, launchMoment } from "@/lib/launch/cold-start";
import { sharePayloadForEvent } from "@/lib/share/copy";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatCount, formatObjectIdentity } from "@/lib/utils";

const TAGLINE_LINES = TAGLINE.split(/(?<=\.)\s+/);

export function LandingHero({
  event,
  featured = null,
}: {
  event: EventSnapshot;
  featured?: PublicMessage | null;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(event);
  const [phase, setPhase] = useState(event.phase);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const viewRef = useRef(view);
  viewRef.current = view;
  const now = useSyncedNow(serverNow);
  const target = phase === "upcoming" ? view.startsAt : view.endsAt;
  const remaining = remainingMsFrom(target, now);
  const presentation = eventPresentation(phase, remaining);
  const writable = phase === "live" && remaining > 0;
  const nearOpen = phase === "upcoming" && remaining <= 120_000;
  const closed = phase === "finalizing" || phase === "archived";
  const notice = remainingNotice(presentation, remaining);
  const urgency = publishUrgencyLine(presentation);
  const edition = editionNumberOf(view);

  useEffect(() => {
    setView(event);
    setPhase(event.phase);
    setServerNow(event.serverNow);
  }, [event]);

  useEffect(() => {
    let cancelled = false;
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
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [closed, nearOpen]);

  useEffect(() => {
    if (phase === "upcoming" && remaining <= 0) setPhase("live");
    if (phase === "live" && remaining <= 0) setPhase("finalizing");
  }, [phase, remaining]);

  const label =
    phase === "upcoming"
      ? "Until The Wall opens"
      : phase === "live"
        ? "Until The Wall closes"
        : "The Wall has closed";

  return (
    <section className="hero-monument" data-presentation={presentation}>
      <div className="hero-wall" aria-hidden="true">
        <video
          className="hero-wall-video"
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          poster="/hero-wall.png"
          onEnded={(event) => {
            const video = event.currentTarget;
            const last = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : 0;
            video.pause();
            video.currentTime = last;
          }}
        >
          <source src="/hero-wall.mp4" type="video/mp4" />
        </video>
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
            sealed={phase === "archived"}
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
              phase={phase}
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
              phase={writable ? "live" : phase === "live" ? "finalizing" : phase}
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
