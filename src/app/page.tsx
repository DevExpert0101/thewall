import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Faq } from "@/components/faq";
import { LandingHero } from "@/components/landing-hero";
import { MessageCard } from "@/components/message-card";
import { TAGLINE } from "@/lib/constants";
import { loadEvent, loadPreview } from "@/lib/data/load";
import { publicPageMetadata } from "@/lib/share/metadata";
import { formatCount } from "@/lib/utils";
import type { Metadata } from "next";

export const revalidate = 5;

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/", kind: "countdown" });
}

export default async function HomePage() {
  const event = await loadEvent();
  const preview = await loadPreview(event);

  return (
    <main>
      <JsonLd event={event} />
      <LandingHero event={event} />

      <section className="border-y border-line bg-ink/30">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat label="Sentences" value={formatCount(event.totalMessages)} />
          <Stat label="Fire" value={formatCount(event.totalReactions)} ember />
          <Stat
            label="Status"
            value={event.phase === "live" ? "LIVE" : event.phase.toUpperCase()}
            live={event.phase === "live"}
          />
        </div>
      </section>

      {preview.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="kicker">Live on the wall</p>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {preview.slice(0, 4).map((message) => (
              <MessageCard key={message.id} message={message} phase={event.phase} event={event} />
            ))}
          </div>
          <div className="mt-8">
            <Link href="/wall" className="btn-ghost kicker hover:text-paper">
              Open the wall →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="border-y border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="kicker">How a sentence is born</p>
          <div className="mt-10 grid gap-12 md:grid-cols-3 md:gap-8">
            <Step n="01" title="Write 140 characters" body="One sentence. No name. No profile. No audience to perform for." />
            <Step n="02" title="Pay 1 USDC" body="On Base. The payment buys exactly this sentence — nothing else." />
            <Step n="03" title="It stays" body="When the clock dies, The Wall freezes. Your number is never reused." />
          </div>
        </div>
      </section>

      {preview.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="kicker">Trending</p>
          <div className="mt-7 space-y-3">
            {preview.map((message, i) => (
              <MessageCard
                key={`t-${message.id}`}
                message={message}
                phase={event.phase}
                event={event}
                featured={i === 0}
                rankLabel={i === 0 ? "Trending" : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-y border-line bg-ink/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="kicker">Permanence</p>
          <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,6vw,4.6rem)] leading-[0.95] text-paper">
            A sentence you cannot unwrite, on a wall that cannot reopen.
          </h2>
          <div className="pay-plaque mt-12 max-w-lg p-7 sm:p-10">
            <p className="font-mono text-[0.7rem] tracking-[0.22em] text-bronze">MESSAGE #004291</p>
            <p className="mt-5 font-display text-2xl leading-snug text-paper sm:text-3xl">
              “I hope whoever finds this in 50 years knows we were trying.”
            </p>
            <p className="mt-8 kicker">Final rank · 🔥 · published timestamp</p>
            <p className="mt-6 text-[0.65rem] uppercase tracking-[0.22em] text-mist">{TAGLINE}</p>
          </div>
          <p className="mt-4 text-xs text-ash">Certificate preview — sample composition, not a live statistic.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="kicker mb-8">FAQ</p>
        <Faq />
      </section>

      <section id="safety" className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <p className="kicker">Safety</p>
        <p className="lede mt-5">
          Messages are published as plain text, never as HTML. Illegal content is
          refused or removed. Reports are private. Administrators act through an
          audited panel. Public anonymity is not a license to harm.
        </p>
        <div className="mt-10">
          <Link href="/wall" className="btn btn-primary">
            {event.phase === "archived" ? "Enter the archive" : "See The Wall"}
          </Link>
        </div>
      </section>
    </main>
  );
}

function Stat({
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
    <div className="px-6 py-9 text-center sm:py-11">
      <p
        className={`font-mono text-3xl tabular tracking-tight sm:text-4xl ${live ? "text-ember" : ember ? "text-flame" : "text-paper"}`}
      >
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

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="step-rule">
      <p className="font-mono text-xs tracking-[0.18em] text-bronze">{n}</p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-paper sm:text-3xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}
