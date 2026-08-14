"use client";

import Link from "next/link";
import { useState } from "react";
import { Countdown } from "@/components/countdown";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { TAGLINE } from "@/lib/constants";
import type { EventSnapshot } from "@/lib/types";

const TAGLINE_LINES = TAGLINE.split(/(?<=\.)\s+/);

export type WallInscription = {
  id: string;
  text: string;
  fires: number;
};

function writePace(text: string): "short" | "mid" | "long" {
  if (text.length < 34) return "short";
  if (text.length < 50) return "mid";
  return "long";
}

function LivingInscriptions({ inscriptions }: { inscriptions: WallInscription[] }) {
  const shown = inscriptions.filter((item) => item.text.trim().length > 0).slice(0, 6);
  if (shown.length === 0) return null;

  return (
    <div className="hero-ghosts" aria-hidden="true">
      {shown.map((item, index) => (
        <p
          key={item.id}
          className="hero-ghost"
          data-pace={writePace(item.text)}
          data-size={String((index % 4) + 1)}
        >
          <span className="hero-ghost-inner">“{item.text}”</span>
        </p>
      ))}
    </div>
  );
}

export function LandingHero({
  event,
  inscriptions = [],
}: {
  event: EventSnapshot;
  inscriptions?: WallInscription[];
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(event.phase);
  const target = phase === "upcoming" ? event.startsAt : event.endsAt;
  const label =
    phase === "upcoming" ? "Until The Wall opens" : phase === "live" ? "Until The Wall closes" : "The Wall is closed";

  return (
    <section className="hero-monument">
      <div className="hero-wall" aria-hidden="true" />
      <LivingInscriptions inscriptions={inscriptions} />

      <div className="hero-stage">
        {phase === "live" ? (
          <p className="hero-live">
            <span className="live-dot" aria-hidden="true" />
            Open now
          </p>
        ) : (
          <p className="kicker">A 24-hour monument</p>
        )}

        <h1 className="monument-title">
          <span className="monument-the">THE</span>
          <span className="monument-wall">WALL</span>
        </h1>
        <span className="title-rule monument-rule mx-auto mt-5 block animate-ember-draw" aria-hidden="true" />
        <p className="monument-tagline">
          {TAGLINE_LINES.map((line) => (
            <span key={line} className="tagline-line">
              {line}
            </span>
          ))}
        </p>

        <div className={phase === "live" ? "hero-clock hero-clock-live" : "hero-clock"}>
          <Countdown
            targetIso={target}
            serverNow={event.serverNow}
            label={label}
            phase={phase}
            onZero={() => {
              if (phase === "live") setPhase("finalizing");
              if (phase === "upcoming") setPhase("live");
            }}
          />
        </div>

        <div className="hero-actions">
          <PrimaryCta phase={phase} onPublish={() => setOpen(true)} className="hero-cta" />
          {phase === "live" ? (
            <Link href="/wall" className="btn btn-line hero-secondary">
              See The Wall
            </Link>
          ) : null}
        </div>
        <p className="hero-trust">One dollar. One sentence. No account.</p>
      </div>

      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={phase === "live"}
        endsAt={event.endsAt}
        serverNow={event.serverNow}
      />
    </section>
  );
}
