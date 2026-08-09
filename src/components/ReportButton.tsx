"use client";

import { useEffect, useRef, useState } from "react";
import { formatMessageNumber } from "@/lib/wall";

const REASONS = [
  { id: "harassment", label: "Harassment" },
  { id: "personal_information", label: "Personal information" },
  { id: "illegal_content", label: "Illegal content" },
  { id: "hate", label: "Hate" },
  { id: "adult_content", label: "Adult content" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["id"];

interface ReportButtonProps {
  messageId: string;
  messageNumber: number;
  content: string;
  /** Compact "link" style for share/certificate pages. */
  variant?: "card" | "link";
}

export default function ReportButton({
  messageId,
  messageNumber,
  content,
  variant = "card",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setState("idle");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason, details }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (state === "sent") {
      setTimeout(() => setOpen(false), 700);
      return;
    }
    setOpen(false);
  };

  const triggerClass =
    variant === "link"
      ? "rounded-full border border-edge px-4 py-2 text-xs font-medium text-muted transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300"
      : "flex items-center gap-1.5 rounded-full border border-edge/70 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-300";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState("idle");
        }}
        className={triggerClass}
        aria-haspopup="dialog"
      >
        ⚑ Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Report message"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "sent" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-5 py-1.5 font-mono text-xs tracking-widest text-emerald-300">
                  ✓ REPORT SENT
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  Thank you — a moderator will review this voice.
                </p>
              </div>
            ) : (
              <>
                <header className="mb-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                    Report message
                  </p>
                  <h2 className="mt-1 font-display text-2xl text-cream">
                    Voice #{formatMessageNumber(messageNumber)}
                  </h2>
                  <p className="mt-2 line-clamp-2 break-words font-display text-lg italic text-gold">
                    “{content}”
                  </p>
                </header>

                <fieldset className="grid grid-cols-1 gap-1.5">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                    Reason
                  </legend>
                  {REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition ${
                        reason === r.id
                          ? "border-ember/60 bg-ember/10 text-gold"
                          : "border-edge bg-surface/50 text-cream/80 hover:border-edge-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="accent-ember"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>

                <textarea
                  ref={detailsRef}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Optional details — links, context, times…"
                  maxLength={1000}
                  rows={2}
                  className="mt-4 w-full resize-none rounded-lg border border-edge bg-surface/60 px-3.5 py-2.5 text-sm text-cream placeholder:text-muted/60 focus:border-ember focus:outline-none"
                />

                {state === "error" && (
                  <p className="mt-2 text-xs text-red-300">
                    Report failed — please try again.
                  </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    onClick={close}
                    className="rounded-full border border-edge px-4 py-2 text-xs text-muted transition hover:text-cream"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2 text-xs font-semibold text-black transition hover:brightness-110 glow-ember disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
