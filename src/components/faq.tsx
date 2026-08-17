"use client";

import * as Accordion from "@radix-ui/react-accordion";

const ITEMS = [
  {
    q: "What is The Wall?",
    a: "A 24-hour anonymous monument. Anyone can read it. One dollar buys one 140-character sentence. When the clock hits zero, no one can add another word.",
  },
  {
    q: "Is my message really anonymous?",
    a: "The Wall does not show your name, wallet, or profile. You do not sign in. Payment publishes the sentence. A private Wall Key proves it is yours. That is not the same as untraceable.",
  },
  {
    q: "What happens when time runs out?",
    a: "Writing and 🔥 stop at once, even if a browser still shows a few seconds. The day is sealed as The Wall №001. Later days become №002, №003, and so on. The conversation ends. The record remains.",
  },
  {
    q: "Can I get a refund?",
    a: "Canceled or incomplete payments take no money and publish nothing. A verified $1 publishes one sentence only while the Wall is still live. If the clock has already reached zero when the payment is checked, the sentence is not published, the transfer is not reversed, and a refund is not promised.",
  },
  {
    q: "What can get a message removed?",
    a: "Illegal content and serious policy violations. Removed messages keep their number. The public text becomes: “Message removed under archive policy.”",
  },
  {
    q: "How long does a sentence stay?",
    a: "A sealed day is frozen into a public file, given a fingerprint, and offered for download. Extra copies exist only when they are configured. The live site is a working copy. It is not, by itself, a promise that one vendor will run forever.",
  },
  {
    q: "How do I claim a prize?",
    a: "When a Wall is sealed, /claim announces only the winning Wall, number, sentence, and final 🔥. If that sentence is yours, prove it with your Wall Key. Prize details — contact, payout, or any identity or tax forms the law requires — are collected only after that proof. An anonymous payout is not promised.",
  },
  {
    q: "What is The Monument?",
    a: "When a Wall is finished, the inscription ranked #1 becomes The Victor. That sentence is permanently promoted into The Monument. You cannot buy a place there. You have to win one. The Monument stays anonymous.",
  },
  {
    q: "How do certificates work?",
    a: "Before you pay, The Wall gives you a Wall Key. Save it. It proves you own the sentence. The Ownership Receipt contains that key — never share it. The Certificate is safe to share: message, rank, reactions, and Archive proof, never the key, a wallet, or your name. We cannot recover a lost key.",
  },
];

export function Faq() {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-line border-y border-line">
      {ITEMS.map((item) => (
        <Accordion.Item key={item.q} value={item.q}>
          <Accordion.Header>
            <Accordion.Trigger className="faq-trigger flex min-h-14 w-full items-center justify-between gap-4 py-5 text-left font-display text-xl leading-snug text-paper sm:text-2xl">
              {item.q}
              <span aria-hidden="true" className="faq-mark font-sans text-lg text-bronze">
                +
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-6 text-[1.05rem] leading-relaxed text-mist">
            {item.a}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
