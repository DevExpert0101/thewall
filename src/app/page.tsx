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
      <LandingHero
        event={event}
        inscriptions={preview
          .filter((message) => !message.isRemoved)
          .map((message) => ({
            id: message.id,
            text: message.text,
            fires: message.reactionCount,
          }))}
      />

      <section className="stat-row">
        <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-3">
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
        <section className="section-monument">
          <div className="section-head">
            <p className="kicker">Live on the wall</p>
            <h2 className="section-title">Sentences already carved</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {preview.slice(0, 4).map((message) => (
              <MessageCard key={message.id} message={message} phase={event.phase} event={event} />
            ))}
          </div>
          <div className="mt-10">
            <Link href="/wall" className="btn btn-line">
              Open the wall →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rite-band">
        <div className="section-monument">
          <div className="section-head">
            <p className="kicker">How a sentence is born</p>
            <h2 className="section-title">Three acts. Then stone.</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n="01" title="Write 140 characters" body="One sentence. No name. No profile. No audience to perform for." />
            <Step n="02" title="Pay 1 USDC" body="On Base. The payment buys exactly this sentence — nothing else." />
            <Step n="03" title="It stays" body="When the clock dies, The Wall freezes. Your number is never reused." />
          </div>
        </div>
      </section>

      {preview.length > 0 ? (
        <section className="section-monument">
          <div className="section-head">
            <p className="kicker">Trending</p>
            <h2 className="section-title">What the fire chose</h2>
          </div>
          <div className="mt-8 space-y-4">
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

      <section className="shrine-band">
        <div className="section-monument">
          <p className="kicker">Permanence</p>
          <h2 className="permanence-title">
            A sentence you cannot unwrite, on a wall that cannot reopen.
          </h2>
          <div className="pay-plaque shrine-plaque mt-12 max-w-lg p-7 sm:p-10">
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

      <section id="safety" className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
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
    <div className="stat-tablet">
      <p
        className={`stat-value ${live ? "text-ember" : ember ? "text-flame" : "text-paper"}`}
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
    <div className="rite-step">
      <p className="rite-num">{n}</p>
      <h3 className="mt-5 font-display text-2xl leading-tight text-paper sm:text-3xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}
