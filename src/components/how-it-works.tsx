import Link from "next/link";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { PAY_AT_CLOSE_POLICY } from "@/lib/payment/close-policy";

const STEPS = [
  {
    label: "PAY",
    title: "One dollar. One sentence.",
    body: "Pay $1 once. That dollar is the price of one sentence — not a tip and not a subscription. The site checks the payment on its own. If you cancel, or the check fails, nothing is carved and no number is used. A verified payment publishes exactly one sentence, or the site tells you it could not. The same payment cannot publish twice.",
  },
  {
    label: "MARK",
    title: "Your sentence gets a number.",
    body: "Numbers are given when the sentence is published, not in the browser. Text the site already knows it will refuse is stopped before payment. A number is not reused on that day. Knowing the words is not ownership.",
  },
  {
    label: "REACT",
    title: "Anyone can add fire while the day is open.",
    body: "🔥 is counted on the server. One visit can add one fire to a given sentence. The site does not invent popularity and does not sell rank. A count is a record, not proof that nobody coordinated.",
  },
  {
    label: "FREEZE",
    title: "When the clock hits zero, writing stops.",
    body: "Publishing and 🔥 stop at once — even if a browser still shows a few seconds. The Wall does not seal itself. It stays under review until the day is finished. Public ranks and the winner are not shown until then.",
  },
  {
    label: "ARCHIVE",
    title: "The day becomes The Wall №001.",
    body: `Before that seal, illegal or immoral sentences can be removed. Removal keeps the number and replaces the public line with “${ARCHIVAL_REMOVAL_TEXT}” Removing a sentence can change who has the most 🔥. Fire is not added by hand. After the day is finished, the sealed file is the public record. A sealed Wall does not reopen.`,
  },
  {
    label: "MONUMENT",
    title: "The Victor enters The Monument.",
    body: "Rank #1 becomes The Victor of that Wall. The original inscription stays in its Archive. The Monument receives one permanent reference — M-0001, then M-0002 — assigned by the database when the Wall is finished. Nobody can buy a Monument position. Administrators cannot casually replace a sealed Victor.",
  },
  {
    label: "VERIFY",
    title: "You can check the sealed file.",
    body: "A sealed Wall is a downloadable file with a fingerprint built from every sentence. Anyone can check those values without signing in. The live site is a working copy. Extra copies exist only when they are configured.",
  },
] as const;

const ANSWERS = [
  {
    q: "Why does this cost $1?",
    a: "One dollar buys one sentence. The price is scarcity and a single voice — not a donation and not access to a feed.",
  },
  {
    q: "Will my payment disappear?",
    a: `Only a verified $1 payment publishes. If you cancel, or the check fails, nothing is carved and no number is used. ${PAY_AT_CLOSE_POLICY.visitorLine}`,
  },
  {
    q: "Is the reaction count fake?",
    a: "No. Counts are stored when someone reacts. They are not written by hand and not padded for launch. They can still be gamed by many visits.",
  },
  {
    q: "Can administrators change the winner?",
    a: "During review they can remove sentences that violate the rules, which can change who stands first. They cannot rewrite a sealed file, and they do not add 🔥. Results stay hidden until they finish the Wall.",
  },
  {
    q: "Is the Wall actually permanent?",
    a: "What we claim is the sealed public file, its fingerprint, the download on this site, and any extra copies that are actually configured — not that one vendor will run forever.",
  },
  {
    q: "Is my message really anonymous?",
    a: "Publicly, yes: no usernames, wallets, or profiles on the Wall. That is not the same as untraceable. Payment happens in public. The site uses a nameless session and hashed signals to limit abuse. Operators can see those hashed signals. They do not publish them.",
  },
  {
    q: "What does the Wall Key do?",
    a: "It is given before you pay. A hash of it is stored. The key itself is the only way to prove you own the sentence or to claim a prize. We cannot recover it. It never appears in a public URL.",
  },
  {
    q: "Can someone steal my message?",
    a: "They cannot take your number or republish your payment. They can claim the sentence only with your Wall Key. Sharing the key, or losing it, is how the proof leaves you.",
  },
  {
    q: "What happens if content is removed?",
    a: `The number stays. The public text becomes: “${ARCHIVAL_REMOVAL_TEXT}”`,
  },
  {
    q: "What happens when the timer reaches zero?",
    a: "Writing and 🔥 stop. The day is under review. The archive and the winner appear only after this Wall is finished.",
  },
] as const;

export function HowItWorks() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">How it works</p>
      <h1 className="permanence-title mt-5">Seven steps. No theater.</h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="mt-10 text-[1.05rem] leading-relaxed text-mist">
        This page is the short record of how a sentence is paid for, numbered,
        reacted to, frozen, sealed, and checked. It does not promise more than
        the system can do.
      </p>

      <ol className="mt-14 space-y-12">
        {STEPS.map((step) => (
          <li key={step.label}>
            <p className="kicker text-bronze">{step.label}</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-paper">{step.title}</h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-mist">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-16 border-t border-line pt-12">
        <p className="kicker">Straight answers</p>
        <h2 className="mt-3 font-display text-3xl leading-tight text-paper">
          What people usually doubt
        </h2>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {ANSWERS.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="font-display text-xl leading-snug text-paper sm:text-2xl">{item.q}</dt>
              <dd className="mt-3 text-[1.05rem] leading-relaxed text-mist">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-12 text-[1.05rem] leading-relaxed text-mist">
        More on discovery, certificates, and claims lives on{" "}
        <Link href="/about" className="text-paper underline decoration-line underline-offset-4 hover:decoration-bronze">
          About
        </Link>
        . Sealed days are in the{" "}
        <Link href="/archive" className="text-paper underline decoration-line underline-offset-4 hover:decoration-bronze">
          Archive
        </Link>
        .
      </p>
    </main>
  );
}
