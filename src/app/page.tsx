import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Faq } from "@/components/faq";
import { FeedbackForm } from "@/components/feedback-form";
import { LandingHero } from "@/components/landing-hero";
import { LandingPreviewActions } from "@/components/landing-preview-actions";
import { MessageCard } from "@/components/message-card";
import { WitnessPlaque } from "@/components/witness-plaque";
import { loadEvent, loadLandingWitness, loadLatestPublicWinner } from "@/lib/data/load";
import { monumentCanvasFromEnv } from "@/lib/monument/canvas";
import { listMonumentEntries } from "@/lib/monument/store";
import { publicPageMetadata } from "@/lib/share/metadata";
import type { Metadata } from "next";
import type { PublicMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/", kind: "countdown" });
}

export default async function HomePage() {
  const event = await loadEvent();
  const carved = await loadLandingWitness(event);
  const featured = event.phase === "live" ? (carved[0] ?? null) : null;
  const shrine = event.phase === "archived" ? await resolveShrine(event) : null;
  const monument = await listMonumentEntries().catch(() => ({
    entries: [],
    sealedCount: 0,
    capacity: null,
    canvas: monumentCanvasFromEnv(),
  }));

  return (
    <main>
      <JsonLd event={event} />
      <LandingHero event={event} featured={featured} monument={monument} />

      {carved.length > 0 ? (
        <section className="section-monument">
          <div className="section-head">
            <p className="kicker">On the wall</p>
            <h2 className="section-title">Already on the stone</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {carved.map((message) => (
              <MessageCard key={message.id} message={message} phase={event.phase} event={event} />
            ))}
          </div>
          <LandingPreviewActions event={event} />
        </section>
      ) : null}

      <section className="rite-band">
        <div className="section-monument">
          <div className="section-head">
            <p className="kicker">How a sentence stays</p>
            <h2 className="section-title">Write. Pay $1. Take your number.</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n="01" title="Write 140 characters" body="One sentence. No name. No profile. No audience to perform for." />
            <Step n="02" title="Pay one dollar" body="$1, once. No account. The payment is not your name. Nothing else is sold." />
            <Step n="03" title="Take your number" body="When the clock hits zero, this Wall is sealed. Your number is never reused on that day." />
          </div>
          <div className="mt-10">
            <Link href="/how-it-works" className="btn-ghost kicker hover:text-paper">
              How it works →
            </Link>
          </div>
        </div>
      </section>

      <section className="rite-band">
        <div className="section-monument">
          <div className="section-head">
            <p className="kicker">The Monument</p>
            <h2 className="section-title">The world gets one Wall.</h2>
          </div>
          <p className="lede mt-8 max-w-xl">
            For 24 hours, anyone can leave one anonymous sentence. Thousands may
            speak. Only one becomes the Victor. Every Victor earns a permanent
            place in The Monument.
          </p>
          <p className="mt-6 font-monument text-sm tracking-[0.16em] text-bronze">
            ONE WALL. ONE VICTOR. ONE PLACE IN THE MONUMENT.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/wall" className="btn btn-primary">
              Enter the live Wall
            </Link>
            <Link href="/monument" className="btn btn-line">
              Visit the Monument
            </Link>
          </div>
        </div>
      </section>

      {event.phase === "archived" && shrine ? (
        <section className="shrine-band">
          <div className="section-monument">
            <p className="kicker">The standing sentence</p>
            <h2 className="sr-only">The sentence that stood first on this Wall</h2>
            <WitnessPlaque message={shrine} event={event} />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="kicker mb-8">FAQ</p>
        <Faq />
      </section>

      <section id="safety" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <p className="kicker">Safety</p>
        <p className="lede mt-5">
          Messages are published as plain text, never as HTML. Illegal content is
          refused or removed. Reports are private. Administrators act through an
          audited panel. Public anonymity is not a license to harm.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={event.phase === "archived" ? "/archive" : "/watch"} className="btn btn-line">
            {event.phase === "archived" ? "Enter the Archive" : "Watch the Wall"}
          </Link>
          <Link href="/monument" className="btn btn-line">
            Visit the Monument
          </Link>
        </div>
      </section>

      <FeedbackForm />
    </main>
  );
}

async function resolveShrine(
  event: Awaited<ReturnType<typeof loadEvent>>,
): Promise<PublicMessage | null> {
  const winner = await loadLatestPublicWinner();
  if (!winner || winner.isRemoved) return null;
  return {
    id: `winner-${winner.editionNumber}-${winner.publicNumber}`,
    eventId: event.id,
    publicNumber: winner.publicNumber,
    text: winner.text,
    isRemoved: false,
    reactionCount: winner.reactionCount,
    publishedAt: event.finalizedAt ?? event.endsAt,
    finalRank: 1,
  };
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rite-step">
      <p className="rite-num">{n}</p>
      <h3 className="rite-title">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}
