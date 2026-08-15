import type { Metadata } from "next";
import { siteUrl } from "@/lib/utils";

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
      <div className="mt-10 space-y-12 text-[1.05rem] leading-relaxed text-mist">
        <p>
          The Wall is a 24-hour internet event. Anyone may read an anonymous wall
          of 140-character sentences. Publishing costs 1.00 USDC on Base. When the
          clock reaches zero, writing stops. That day is sealed as a numbered
          edition — THE WALL №001, then №002, and so on. The Archive is the library
          of those completed days. A sealed Wall does not reopen.
        </p>
        <p>
          Supabase is the working copy the site reads. The permanent artifact is
          the final moderated dataset: a canonical JSON file, its SHA-256 hash, and
          a Merkle root. Off-site replicas (Arweave, a Base proof, public downloads)
          can hold that sealed record. Raw unmoderated submissions are never pushed
          to irreversible storage.
        </p>
        <p>
          There are no usernames, avatars, or follower counts. No email. No
          Connect Wallet. Anonymity is the visual identity as much as the policy.
        </p>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Payment</h2>
          <p className="mt-4">
            Payment is USDC on Base via Base Pay — pay, do not sign in. The server
            verifies the transaction independently. A client checkbox is never proof
            of payment. The same transaction cannot publish two messages. The paying
            wallet is not your identity. Message numbers are assigned atomically in
            the database, not in the browser.
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
            If the clock, the payment, or the stone is wrong, write to the stewards
            from the bottom of the front page. That note is not a sentence on the Wall.
            An email is optional and never published.
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="font-display text-3xl leading-tight text-paper">Certificates</h2>
          <p className="mt-4">
            Before you pay, you receive a Wall Key. That key is the only way to prove
            ownership or claim a prize. Do not share it. The public certificate never
            includes the key. We cannot recover it.
          </p>
        </section>
      </div>
    </main>
  );
}
