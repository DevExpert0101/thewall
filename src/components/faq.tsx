"use client";

import * as Accordion from "@radix-ui/react-accordion";

const ITEMS = [
  {
    q: "What is The Wall?",
    a: "A 24-hour anonymous monument. Anyone can read it. One USDC on Base buys one 140-character sentence. When the clock hits zero, no one can add another word.",
  },
  {
    q: "Is my message really anonymous?",
    a: "Publicly, yes. The Wall never shows wallet addresses, usernames, or profiles. You do not connect a wallet as an account. Payment publishes the sentence. A private Wall Key proves ownership.",
  },
  {
    q: "What happens when time runs out?",
    a: "Publishing and reactions stop immediately, even if a browser still shows a few seconds. This Wall becomes the archive. There is no previous Wall to browse.",
  },
  {
    q: "Can I get a refund?",
    a: "A successful, verified payment publishes exactly one message. Incomplete, canceled, or rejected payments do not publish and do not consume a message number.",
  },
  {
    q: "What can get a message removed?",
    a: "Illegal content and serious policy violations. Removed messages keep their number. The public text becomes: “Message removed under archive policy.”",
  },
  {
    q: "How do certificates work?",
    a: "Before you pay, The Wall gives you a Wall Key. Save it. It proves you own the sentence. The public certificate never includes the key, a wallet, or your name. We cannot recover a lost key.",
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
