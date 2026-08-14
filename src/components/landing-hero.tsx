"use client";

import { useState } from "react";
import { Countdown } from "@/components/countdown";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { TAGLINE } from "@/lib/constants";
import type { EventSnapshot } from "@/lib/types";

export function LandingHero({ event }: { event: EventSnapshot }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(event.phase);
  const target = phase === "upcoming" ? event.startsAt : event.endsAt;
  const label =
    phase === "upcoming" ? "Until The Wall opens" : phase === "live" ? "Until The Wall closes" : "The Wall is closed";

  return (
    <section className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center px-4 py-16 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl text-center">
        <p className="kicker">A 24-hour monument</p>
        <h1 className="mt-5 font-display text-[clamp(3.35rem,16vw,11.5rem)] leading-[0.82] text-paper">
          THE WALL
        </h1>
        <span className="title-rule mx-auto mt-6 block animate-ember-draw" aria-hidden="true" />
        <p className="mt-5 text-[0.7rem] uppercase tracking-[0.28em] text-bronze sm:text-xs">
          {TAGLINE}
        </p>
        <p className="lede mx-auto mt-7 max-w-xl">
          For 24 hours, the world gets one anonymous wall. Anyone can read it. One
          dollar buys one 140-character message. When the clock reaches zero, no one
          can add another word.
        </p>
        <p className="mx-auto mt-6 max-w-md text-[0.7rem] uppercase leading-relaxed tracking-[0.18em] text-ash sm:text-xs">
          No account. No followers. No profile. No identity.
          <br />
          Just your words.
        </p>
        <div className="mt-12 sm:mt-14">
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
        <div className="mt-10 sm:mt-12">
          <PrimaryCta phase={phase} onPublish={() => setOpen(true)} className="w-full sm:w-auto" />
        </div>
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
