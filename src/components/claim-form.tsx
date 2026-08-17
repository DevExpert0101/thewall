"use client";

import { useState } from "react";
import { ProofOfVictory } from "@/components/proof-of-victory";
import type { EventPhase } from "@/lib/event/state";
import type { MonumentEntry } from "@/lib/monument/types";
import { formatObjectIdentity } from "@/lib/utils";

export function ClaimForm({
  publicNumber,
  phase,
  finalRank,
  text,
  editionNumber,
  monument = null,
}: {
  publicNumber: number;
  phase: EventPhase;
  finalRank: number | null;
  text: string;
  editionNumber?: number;
  monument?: MonumentEntry | null;
}) {
  const [wallKey, setWallKey] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [legal, setLegal] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "verified" | "nominated" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const archived = phase === "archived";
  const won = archived && finalRank === 1;

  async function ensureChallenge() {
    const res = await fetch("/api/claim/challenge", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.recovery ?? data.error ?? "Could not start this claim.");
    }
  }

  async function verify() {
    setError(null);
    setStatus("checking");
    try {
      await ensureChallenge();
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicNumber, wallKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.recovery ?? data.error ?? "That Wall Key does not match.");
        return;
      }
      setWallKey("");
      setStatus(data.nominated ? "nominated" : "verified");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Network failure. Try again.");
    }
  }

  async function submitPrize() {
    setError(null);
    setStatus("checking");
    try {
      const res = await fetch("/api/claim/prize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: email.trim() || undefined,
          payoutAddress: address.trim() || undefined,
          legalAcknowledged: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.recovery ?? data.error ?? "Could not save prize details.");
        return;
      }
      setStatus(data.nominated ? "nominated" : "verified");
    } catch {
      setStatus("error");
      setError("Network failure. Try again.");
    }
  }

  return (
    <div className="mt-10">
      {won ? (
        <p className="font-display text-[clamp(2rem,6vw,3.4rem)] leading-[0.95] text-paper">
          THIS MESSAGE WON.
        </p>
      ) : archived ? (
        <p className="font-display text-3xl text-paper">This message did not win The Wall.</p>
      ) : (
        <p className="font-display text-3xl text-paper">The Wall is still open.</p>
      )}
      <p className="lede mt-4">
        {won
          ? "If this is your sentence, prove it with your private Wall Key. No account. No email. No wallet sign-in."
          : archived
            ? "You can still prove ownership of this sentence with your Wall Key."
            : "If this sentence wins, come back here with your Wall Key after the day is sealed."}
      </p>
      <p className="mt-6 font-display text-2xl text-paper">“{text}”</p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em] text-bronze">
        {formatObjectIdentity(publicNumber, editionNumber)}
      </p>

      {status !== "verified" && status !== "nominated" ? (
        <>
          <label className="mt-10 block">
            <span className="kicker">Private Wall Key</span>
            <input
              id="claim-wall-key"
              value={wallKey}
              onChange={(event) => setWallKey(event.target.value)}
              name="wall-key"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="7K9P-X4MF-82QH-K3R2"
              aria-invalid={status === "error"}
              aria-describedby={error ? "claim-error" : "claim-key-hint"}
              className="field mt-2 font-mono tracking-[0.16em]"
            />
          </label>
          <p id="claim-key-hint" className="mt-2 text-xs leading-relaxed text-ash">
            We cannot recover it. Never put this key in a URL or share it.
          </p>
          <details className="mt-4 text-sm text-mist">
            <summary className="kicker cursor-pointer text-bronze hover:text-paper">
              I lost my Wall Key
            </summary>
            <p className="mt-3 leading-relaxed">
              Ownership cannot be recovered. The Wall Key is the only proof that
              this sentence is yours. We do not store a copy. We cannot reset it,
              email it, or reconstruct it from the payment.
            </p>
          </details>
          <button
            type="button"
            className="btn btn-primary mt-4 w-full"
            disabled={!wallKey.trim() || status === "checking"}
            onClick={() => void verify()}
          >
            Verify ownership
          </button>
        </>
      ) : null}

      {status === "verified" || status === "nominated" ? (
        <p className="mt-6 text-sm text-paper" role="status">
          Ownership verified. Payment is not your name.
        </p>
      ) : null}

      {won && (status === "verified" || status === "nominated") && monument ? (
        <ProofOfVictory entry={monument} />
      ) : null}

      {error ? (
        <p id="claim-error" className="mt-4 text-sm text-blood" role="alert">
          {error}
        </p>
      ) : null}

      {won && status === "verified" ? (
        <div className="mt-10 border-t border-line pt-8">
          <p className="font-display text-2xl text-paper">How should we reach you?</p>
          <p className="lede mt-3">
            We collect prize details only after this sentence is proven yours — never
            from everyone in advance. An anonymous payout is not promised. If the
            prize or the law requires identity or tax reporting, that happens now.
          </p>
          <label className="mt-6 block" htmlFor="claim-email">
            <span className="kicker">Contact email</span>
            <input
              id="claim-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="off"
              placeholder="you@example.com"
              className="field mt-2"
            />
          </label>
          <label className="mt-6 block" htmlFor="claim-wallet">
            <span className="kicker">Payout address (optional)</span>
            <input
              id="claim-wallet"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="0x"
              aria-describedby="claim-wallet-hint"
              className="field mt-2 font-mono"
            />
          </label>
          <p id="claim-wallet-hint" className="mt-2 text-xs leading-relaxed text-ash">
            For a payout if one is possible. This does not have to match the payment that published the sentence.
          </p>
          <label className="mt-6 flex items-start gap-3 text-sm text-mist">
            <input
              type="checkbox"
              checked={legal}
              onChange={(event) => setLegal(event.target.checked)}
              className="mt-1 size-4 accent-ember"
            />
            <span>
              I understand a prize may require identity or tax information, and that
              an anonymous payout is not promised.
            </span>
          </label>
          <button
            type="button"
            className="btn btn-ember mt-4 w-full"
            disabled={!legal || (!email.trim() && !/^0x[0-9a-fA-F]{40}$/.test(address))}
            onClick={() => void submitPrize()}
          >
            Send claim
          </button>
        </div>
      ) : null}

      {status === "nominated" ? (
        <p className="mt-6 text-sm text-mist">
          Claim received. We will not publish this contact or any payout address.
        </p>
      ) : null}
    </div>
  );
}
