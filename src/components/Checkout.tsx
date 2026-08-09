"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import NewWallButton from "@/components/NewWallButton";
import ShareButtons from "@/components/ShareButtons";
import Countdown from "@/components/Countdown";
import { track } from "@/lib/analytics";
import { shortHash, formatMessageNumber } from "@/lib/wall";

interface CheckoutProps {
  frozen: boolean;
  wallTitle?: string;
  /** Wall timestamps — the countdown reminds buyers this is a today-only wall. */
  endsAt?: string;
  createdAt?: string;
}

type Phase = "composing" | "paying" | "confirming" | "confirmed";

interface CheckoutPayload {
  paymentId: string;
  messageId: string;
  messageNumber: number;
  content: string;
  address: string;
  amount: string;
  coin: string;
  qr: string;
}

interface StatusInfo {
  txHash?: string;
  confirmations?: number;
  verifyLink?: string | null;
}

interface SavedMessage {
  id: string;
  number: number;
  content: string;
  savedAt: string;
}

function loadSaved(): SavedMessage[] {
  try {
    return JSON.parse(localStorage.getItem("wall-messages") ?? "[]");
  } catch {
    return [];
  }
}

export default function Checkout({ frozen, wallTitle, endsAt, createdAt }: CheckoutProps) {
  const [phase, setPhase] = useState<Phase>("composing");
  const [content, setContent] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({});
  const [saved, setSaved] = useState<SavedMessage[]>(() =>
    typeof window === "undefined" ? [] : loadSaved(),
  );

  const handleCompose = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.slice(0, 140);
    if (v.length > 0 && content.length === 0) track("message_start");
    setContent(v);
  };

  const saveMessage = (c: CheckoutPayload) => {
    const list = loadSaved();
    const entry: SavedMessage = {
      id: c.messageId,
      number: c.messageNumber,
      content: c.content,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      "wall-messages",
      JSON.stringify([entry, ...list.filter((m) => m.id !== c.messageId)]),
    );
    setSaved([entry, ...list.filter((m) => m.id !== c.messageId)]);
  };

  const startCheckout = async () => {
    setError(null);
    if (content.trim().length < 1) {
      setError("Say something. Anything.");
      return;
    }
    if (!agreed) {
      setError("You must agree to The Wall rules before you etch.");
      return;
    }
    setBusy(true);
    track("checkout_started");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setCheckout(data);
      track("payment_started");
      setPhase("paying");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!checkout) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payment-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: checkout.paymentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment not found.");
        return;
      }
      setStatusInfo({
        txHash: data.txHash,
        verifyLink: data.verifyLink,
        confirmations: 0,
      });
      setPhase("confirming");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/messages")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const list: Array<{ id: string }> = (d as { messages?: Array<{ id: string }> }).messages ?? [];
        const live = new Set(list.map((m) => m.id));
        setSaved((prev) => {
          const pruned = prev.filter((m) => live.has(m.id));
          if (pruned.length !== prev.length) {
            localStorage.setItem("wall-messages", JSON.stringify(pruned));
          }
          return pruned;
        });
      })
      .catch(() => {
        // offline / wall down: keep saved list as-is
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "confirming" || !checkout) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payment-status?paymentId=${checkout.paymentId}`,
        );
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(id);
          setStatusInfo({
            txHash: data.txHash,
            confirmations: data.confirmations,
            verifyLink: data.verifyLink,
          });
          track("payment_confirmed");
          track("message_published");
          saveMessage(checkout);
          setPhase("confirmed");
        } else {
          setStatusInfo({
            txHash: data.txHash,
            confirmations: data.confirmations,
            verifyLink: data.verifyLink,
          });
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(id);
  }, [phase, checkout]);

  const copyAddress = async () => {
    if (!checkout) return;
    try {
      await navigator.clipboard.writeText(checkout.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const copyHash = async () => {
    if (!statusInfo.txHash) return;
    try {
      await navigator.clipboard.writeText(statusInfo.txHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1500);
    } catch {
      // ignore
    }
  };

  if (frozen) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-16 text-center">
        <p className="font-display text-4xl text-gold time-glow">
          The Wall has frozen.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          No new messages can be added. The clock hit zero; the record is
          permanent.
        </p>
        <Link
          href="/artifact"
          className="mx-auto rounded-full bg-gradient-to-r from-flame to-ember px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
        >
          Download the artifact
        </Link>
        <NewWallButton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10">
      <header className="text-center">
        <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-muted">
          One dollar. One message. One day. Forever.
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          Etch your message
        </h1>
        {!frozen && endsAt && (
          <div className="mt-4">
            <Countdown endsAt={endsAt} createdAt={createdAt} variant="compact" />
          </div>
        )}
      </header>

      {phase === "composing" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-edge bg-surface/70 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted">
            <label htmlFor="message">Your message</label>
            <span
              className={`font-mono ${content.length >= 130 ? "text-ember" : ""}`}
            >
              {content.length}/140
            </span>
          </div>
          <div className="relative">
            <textarea
              id="message"
              value={content}
              onChange={handleCompose}
              rows={4}
              placeholder="What do you want the world to know?"
              className="w-full resize-none rounded-xl border border-edge bg-card/80 p-4 text-lg leading-relaxed text-cream placeholder:text-muted/50 outline-none transition focus:border-ember/60 focus:glow-ember"
            />
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-card">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                content.length >= 130
                  ? "bg-ember"
                  : "bg-gradient-to-r from-flame to-ember"
              }`}
              style={{ width: `${(content.length / 140) * 100}%` }}
            />
          </div>
          {content.trim().length > 0 && (
            <div className="rounded-xl border border-edge/60 bg-background/50 p-4 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted">
                Preview — as it will appear
              </p>
              <p className="font-display text-xl italic text-gold">
                “{content}”
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <label className="flex cursor-pointer items-center justify-center gap-2.5 text-sm text-muted transition hover:text-gold">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-ember"
            />
            <span>
              I agree to{" "}
              <Link
                href="/rules"
                className="underline decoration-edge-strong underline-offset-2 hover:text-gold"
              >
                The Wall rules
              </Link>{" "}
              — including the{" "}
              <span className="text-muted">payment &amp; refund policy</span>
            </span>
          </label>
          <button
            onClick={startCheckout}
            disabled={busy || !agreed}
            className="w-full rounded-full bg-gradient-to-r from-flame to-ember py-3.5 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 glow-ember"
          >
            {busy ? "Preparing your stone…" : "Pay $1"}
          </button>
          <p className="text-center text-xs text-muted">
            Anonymous · immutable · one dollar
          </p>
        </div>
      )}

      {phase === "paying" && checkout && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-ember/40 bg-surface/70 p-8 text-center backdrop-blur-sm">
          <p className="font-display text-5xl text-gold time-glow">
            Pay $1
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Your message is reserved. Pay $1 to etch it into The Wall forever.
          </p>
          <div className="rounded-2xl border border-edge bg-card p-4 glow-ember">
            <QRCodeSVG
              value={checkout.qr}
              size={184}
              fgColor="#ffd28a"
              bgColor="#110b07"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">
              Send ≈ {checkout.amount} {checkout.coin} — always $1.00
            </span>
          </div>
          <div className="flex w-full items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-edge bg-card px-3 py-2.5 font-mono text-xs text-cream/80">
              {checkout.address}
            </code>
            <button
              onClick={copyAddress}
              className="shrink-0 rounded-lg border border-edge px-3 py-2.5 text-xs text-muted transition hover:border-ember hover:text-gold"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={confirmPayment}
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-flame to-ember py-3.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50 glow-ember"
            >
              {busy ? "Broadcasting…" : "I've sent it — check the network"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <p className="text-xs leading-relaxed text-muted">
              Prototype: payments are simulated. A fake transaction broadcasts,
              confirms, and your message goes live — just like the real thing.
            </p>
          </div>
        </div>
      )}

      {phase === "confirming" && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-edge bg-surface/70 p-10 text-center backdrop-blur-sm">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="orbit absolute inset-0 rounded-full border-2 border-transparent border-t-ember border-r-ember/40" />
            <div className="absolute inset-2 rounded-full border border-edge" />
            <span className="text-2xl">⛓️</span>
          </div>
          <p className="font-mono text-sm text-gold">
            Waiting for confirmations…
            {typeof statusInfo.confirmations === "number" && (
              <span className="text-muted">
                {" "}
                ({statusInfo.confirmations})
              </span>
            )}
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Your transaction is on the network. Your message appears on the
            Wall the moment it confirms.
          </p>
          {statusInfo.txHash && (
            <div className="w-full rounded-xl border border-edge bg-card/70 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-muted">
                  Transaction hash
                </p>
                <span className="flex items-center gap-1 font-mono text-[10px] text-gold">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold flame-float" />
                  broadcasting
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-edge bg-background px-3 py-2 font-mono text-xs text-cream/80">
                  {shortHash(statusInfo.txHash)}
                </code>
                <button
                  onClick={copyHash}
                  className="shrink-0 rounded-lg border border-edge px-3 py-2 text-xs text-muted transition hover:border-ember hover:text-gold"
                >
                  {copiedHash ? "Copied ✓" : "Copy"}
                </button>
              </div>
              {statusInfo.verifyLink && (
                <a
                  href={statusInfo.verifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs text-muted underline decoration-edge underline-offset-4 transition hover:text-gold"
                >
                  Verify on the block explorer ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "confirmed" && checkout && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-ember/50 bg-gradient-to-b from-ember/10 to-surface/70 p-10 text-center glow-ember">
          <p className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-5 py-1.5 font-mono text-xs tracking-widest text-emerald-300">
            ✓ MESSAGE ACCEPTED
          </p>
          <p className="font-display text-4xl leading-tight text-gold time-glow">
            You are officially part of
            <br />
            <span className="text-cream">{wallTitle ?? "The Wall"}</span>
          </p>
          <p className="max-w-md break-words font-display text-2xl italic text-cream">
            “{checkout.content}”
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-edge bg-card/60 px-4 py-2 font-mono text-sm text-ember">
              Message #{formatMessageNumber(checkout.messageNumber)}
            </span>
            <span className="rounded-full border border-edge bg-card/60 px-4 py-2 font-mono text-sm text-gold">
              🔥 0
            </span>
          </div>
          {statusInfo.txHash && (
            <div className="flex w-full flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400">
                <span>✓</span> Payment verified — {statusInfo.confirmations ?? 6}{" "}
                confirmations
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-cream/80">
                  {shortHash(statusInfo.txHash)}
                </code>
                <button
                  onClick={copyHash}
                  className="shrink-0 rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400 transition hover:bg-emerald-500/10"
                >
                  {copiedHash ? "Copied ✓" : "Copy"}
                </button>
                {statusInfo.verifyLink && (
                  <a
                    href={statusInfo.verifyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    Verify ↗
                  </a>
                )}
              </div>
            </div>
          )}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/?v=${checkout.messageNumber}`}
            className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
          >
            View my message
          </Link>
            <Link
              href={`/certificate/${checkout.messageId}`}
              className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
            >
              Your certificate
            </Link>
            <Link
              href={`/card/${checkout.messageId}`}
              className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
            >
              Share card
            </Link>
          </div>
          {!frozen && endsAt && (
            <Countdown endsAt={endsAt} createdAt={createdAt} variant="compact" />
          )}
          <div className="w-full border-t border-edge/60 pt-5">
            <ShareButtons
              url={`${window.location.origin}/?v=${checkout.messageNumber}`}
              title={`Message #${formatMessageNumber(checkout.messageNumber)} · The Wall`}
              text={`I'm on The Wall — Message #${formatMessageNumber(checkout.messageNumber)} · “${checkout.content}”`}
            />
          </div>
        </div>
      )}

      {saved.length > 0 && phase !== "confirmed" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-edge/60 pt-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
            Your messages on this device
          </p>
          {saved.map((m) => (
            <Link
              key={m.id}
              href={`/certificate/${m.id}`}
              className="flex items-center justify-between rounded-lg border border-edge bg-surface/60 px-4 py-3 text-sm transition hover:border-ember/50 hover:glow-ember"
            >
              <span className="truncate pr-3 text-cream/80">{m.content}</span>
              <span className="shrink-0 font-mono text-xs text-ember">
                #{formatMessageNumber(m.number)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
