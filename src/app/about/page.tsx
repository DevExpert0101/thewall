import type { Metadata } from "next";
import Link from "next/link";
import { DISCOVERY_METHODS } from "@/lib/wall/discovery";
import { siteUrl } from "@/lib/utils";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "About",
  description: "What The Wall is, how payment works, and how moderation keeps the monument legible.",
  alternates: { canonical: `${siteUrl()}/about` },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">About</p>
      <h1 className="permanence-title mt-5">
        A monument, not a feed.
      </h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="mt-8 text-[1.05rem] leading-relaxed text-mist">
        The short record of payment, numbers, 🔥, freeze, and verification is on{" "}
        <Link href="/how-it-works" className="text-paper underline decoration-line underline-offset-4 hover:decoration-bronze">
          How it works
        </Link>
        .
      </p>
      <div className="mt-10 space-y-12 text-[1.05rem] leading-relaxed text-mist">
        <p>
          The Wall is a 24-hour monument. Anyone may read it. $1 writes one
          140-character sentence. When the clock hits zero, writing stops. That
          day is sealed as THE WALL №001, then №002, and so
          on. The Archive is the library of those completed days. A sealed Wall
          does not reopen.
        </p>
        <p>
          What stays is a file, not a vendor. The live site is a working copy. When
          a day is sealed, the public sentences are frozen, fingerprinted, and
          offered for download. Extra copies and an independent notice are
          published only when they are configured.           You can check a sealed Wall
          without signing in. Unpublished drafts are never treated as the record.
        </p>
        <p>
          There are no usernames, avatars, or follower counts. No email. No
          Connect Wallet. Anonymity is the visual identity as much as the policy.
        </p>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Discovery</h2>
          <p className="mt-4">
            Everyone looking at the same Wall sees the same lists. Nothing is
            personalized from hidden behavior. There are no paid boosts and no
            wallet weight. Rising uses a published score so a newer sentence can
            compete with an old pile of 🔥. Abuse limits and burst signals sit
            outside that formula — they do not secretly re-rank the list. Message
            search finds a sentence by its public number, or by a phrase. Random
            Mode is a time capsule: SHOW ME ANOTHER HUMAN opens one unseen
            sentence, drawn by public number, never by sorting the whole table.
          </p>
          <ul className="mt-6 space-y-4">
            {DISCOVERY_METHODS.map((method) => (
              <li key={method.id}>
                <p className="font-display text-xl text-paper">{method.title}</p>
                <p className="mt-2">{method.body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Spectator</h2>
          <p className="mt-4">
            Most people only watch. /watch is the free deck: Auto Wall, Rising,
            Random, and Top 10. Stream mode at /watch/stream drops
            the site chrome for OBS, Twitch, YouTube, TikTok Live, and hall
            screens. It shows the countdown and message numbers. It does not
            play sound, and it never shows wallets, keys, or emails. /live
            opens the same room. /open is the shareable waiting room for the
            scheduled opening. /invite is the same waiting room with an
            invitation line — it does not grant a special right to publish.
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Payment</h2>
          <p className="mt-4">
            Pay $1 once. No account. No wallet sign-in. The site checks the payment
            on its own. A checkbox is never proof. The same payment cannot publish
            two sentences. Payment is not your name. Numbers are given when the
            sentence is carved, not in the browser.
          </p>
        </section>
        <section id="safety" className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Moderation</h2>
          <p className="mt-4">
            Messages are validated and screened before payment whenever possible, so
            you are not charged for text the application already knows it will refuse.
            Published violations can still be removed from a message’s page report
            or the operator panel. The number stays. The public line becomes:
            “Message removed under archive policy.”
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Feedback</h2>
          <p className="mt-4">
            If the clock, the payment, or the stone is wrong, send a note from the
            bottom of the front page. That note is not a sentence on the Wall.
            An email is optional and never published.
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Winner claim</h2>
          <p className="mt-4">
            /claim is a public announcement, not a ledger of owners. It shows the
            sealed Wall, the winning number, the sentence, and the final 🔥.
            The owner proves control with a Wall Key. Failed attempts are rate
            limited and audited without storing the key. Delivery details are
            asked only after that proof. If the law requires identity or tax
            reporting, that happens then — not from every visitor in advance, and
            not as a promise of an anonymous payout.
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Certificates</h2>
          <p className="mt-4">
            Before you pay, you receive a Wall Key. That key is the only way to prove
            ownership or claim a prize. The Ownership Receipt contains the key —
            never share it. The Certificate is safe to share: message, rank,
            reactions, and Archive proof, never the key. We cannot recover it.
          </p>
        </section>
      </div>
    </main>
  );
}
