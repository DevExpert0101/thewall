"use client";

import { useState } from "react";
import { formatPublicNumber } from "@/lib/utils";
import type { EventPhase } from "@/lib/event/state";

export function ClaimForm({
  publicNumber,
  phase,
  finalRank,
  text,
}: {
  publicNumber: number;
  phase: EventPhase;
  finalRank: number | null;
  text: string;
}) {
  const [wallKey, setWallKey] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "verified" | "nominated" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const archived = phase === "archived";
  const won = archived && finalRank === 1;

  async function submit(nominate: boolean) {
    setError(null);
    setStatus("checking");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicNumber,
          wallKey,
          ...(nominate ? { payoutMethod: "usdc", payoutAddress: address } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.recovery ?? data.error ?? "That Wall Key does not match.");
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
          ? "Enter your private Wall Key. No account. No email. No wallet sign-in."
          : archived
            ? "You can still prove ownership of this sentence with your Wall Key."
            : "If this sentence wins, come back here with your Wall Key after the clock."}
      </p>
      <p className="mt-6 font-display text-2xl text-paper">“{text}”</p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em] text-bronze">
        {formatPublicNumber(publicNumber)}
      </p>

      <label className="mt-10 block">
        <span className="kicker">Private Wall Key</span>
        <input
          value={wallKey}
          onChange={(event) => setWallKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="7K9P-X4MF-82QH-K3R2"
          className="field mt-2 font-mono tracking-[0.16em]"
        />
      </label>
      <button
        type="button"
        className="btn btn-primary mt-4 w-full"
        disabled={!wallKey.trim() || status === "checking"}
        onClick={() => void submit(false)}
      >
        Verify ownership
      </button>

      {status === "verified" || status === "nominated" ? (
        <p className="mt-6 text-sm text-paper" role="status">
          Ownership verified. The paying wallet is not your identity.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-blood" role="alert">
          {error}
        </p>
      ) : null}

      {won && status === "verified" ? (
        <div className="mt-10 border-t border-line pt-8">
          <p className="font-display text-2xl text-paper">How would you like to receive your prize?</p>
          <p className="lede mt-3">USDC. This does not have to be the wallet that paid.</p>
          <label className="mt-6 block">
            <span className="kicker">Payout wallet</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="0x"
              className="field mt-2 font-mono"
            />
          </label>
          <button
            type="button"
            className="btn btn-ember mt-4 w-full"
            disabled={!/^0x[0-9a-fA-F]{40}$/.test(address)}
            onClick={() => void submit(true)}
          >
            Save payout address
          </button>
        </div>
      ) : null}

      {status === "nominated" ? (
        <p className="mt-6 text-sm text-mist">Payout instructions saved. We will not publish this address.</p>
      ) : null}
    </div>
  );
}
