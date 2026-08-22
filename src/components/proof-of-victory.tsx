"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { formatMonumentNumber } from "@/lib/monument/format";
import type { MonumentEntry } from "@/lib/monument/types";
import { optionalOwnershipStatement, proofOfVictoryText } from "@/lib/monument/victory";

export function ProofOfVictory({ entry }: { entry: MonumentEntry }) {
  const [copied, setCopied] = useState<"proof" | "statement" | null>(null);
  const proof = proofOfVictoryText(entry);
  const statement = optionalOwnershipStatement(entry);

  async function copy(kind: "proof" | "statement", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-8">
      <p className="kicker text-bronze">{BRAND.monumentWordmark}</p>
      <h2 className="mt-4 font-display text-3xl text-paper">Proof of Victory</h2>
      <pre className="mt-6 whitespace-pre-wrap font-mono text-xs leading-relaxed text-mist">{proof}</pre>
      <button type="button" className="btn btn-line mt-4" onClick={() => void copy("proof", proof)}>
        {copied === "proof" ? "Copied" : "Copy Proof of Victory"}
      </button>
      <p className="lede mt-8">
        Optional. The Monument stays anonymous. This statement is only for you to share.
      </p>
      <p className="mt-3 font-display text-xl text-paper">
        I wrote {formatMonumentNumber(entry.monumentNumber)}.
      </p>
      <button type="button" className="btn btn-line mt-4" onClick={() => void copy("statement", statement)}>
        {copied === "statement" ? "Copied" : "Copy ownership statement"}
      </button>
    </section>
  );
}
