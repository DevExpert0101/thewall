"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Countdown } from "@/components/countdown";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { SharePanel } from "@/components/share-panel";
import { useSyncedNow } from "@/lib/event/clock";
import { remainingMsFrom } from "@/lib/event/remaining";
import {
  STREAM_PATH,
  WAITING_PATH,
  launchCopy,
  nextMarkLine,
} from "@/lib/launch/cold-start";
import { sharePayloadForEvent } from "@/lib/share/copy";
import type { EventSnapshot } from "@/lib/types";
import { editionNumberOf } from "@/lib/utils";

export function WaitingRoom({
  event,
  invited = false,
}: {
  event: EventSnapshot;
  invited?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(event.phase);
  const [serverNow, setServerNow] = useState(event.serverNow);
  const [voices, setVoices] = useState(event.totalMessages);
  const now = useSyncedNow(serverNow);
  const target = phase === "upcoming" ? event.startsAt : event.endsAt;
  const remaining = remainingMsFrom(target, now);
  const writable = phase === "live" && remaining > 0;
  const nearOpen = phase === "upcoming" && remaining <= 120_000;
  const copy = launchCopy({ ...event, phase, totalMessages: voices }, invited);
  const mark = nextMarkLine(voices);
  const edition = editionNumberOf(event);

  useEffect(() => {
    if (phase === "archived") return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/event");
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.phase === "string") setPhase(data.phase);
        if (typeof data.serverNow === "string") setServerNow(data.serverNow);
        if (typeof data.totalMessages === "number") setVoices(data.totalMessages);
      } catch {
        // keep the last good snapshot
      }
    }
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, nearOpen ? 5_000 : 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nearOpen, phase]);

  const label =
    phase === "upcoming"
      ? "Until The Wall opens"
      : phase === "live"
        ? "Until The Wall closes"
        : "The Wall has closed";

  return (
    <section className="section-monument" data-launch={copy.moment}>
      <p className="kicker">{copy.kicker}</p>
      <h1 className="permanence-title mt-5">{copy.title}</h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6 max-w-xl">{copy.body}</p>
      {mark && copy.moment !== "closed" ? (
        <p className="mt-3 text-sm text-mist">{mark}</p>
      ) : null}

      <div className="hero-clock mt-10">
        <Countdown
          targetIso={target}
          serverNow={serverNow}
          nowMs={now}
          label={label}
          phase={phase}
          onZero={() => {
            if (phase === "upcoming") setPhase("live");
            if (phase === "live") setPhase("finalizing");
          }}
        />
      </div>

      <div className="hero-actions mt-10">
        <PrimaryCta
          phase={writable ? "live" : phase === "live" ? "finalizing" : phase}
          onPublish={() => setOpen(true)}
          className="hero-cta hero-cta-thumb"
        />
        {copy.moment !== "closed" ? (
          <Link href="/watch" className="btn btn-line">
            Watch the Wall
          </Link>
        ) : null}
        {copy.moment === "waiting" ? (
          <Link href={STREAM_PATH} className="btn btn-line">
            Stream mode
          </Link>
        ) : null}
      </div>

      {copy.moment === "waiting" || copy.moment === "just_opened" ? (
        <div className="hero-share mt-10">
          <SharePanel
            payload={sharePayloadForEvent({ ...event, phase, serverNow, totalMessages: voices }, WAITING_PATH)}
            via="event"
            primaryLabel={copy.moment === "waiting" ? "Share the opening" : "Share the first hundred"}
          />
        </div>
      ) : null}

      <p className="hero-trust mt-8">
        {copy.moment === "closed"
          ? "The day is over. The stone does not reopen."
          : "Reading is free. $1 writes one sentence. Counts on this page are real."}
      </p>

      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={writable}
        endsAt={event.endsAt}
        serverNow={serverNow}
        editionNumber={edition}
      />
    </section>
  );
}
