"use client";

import { useState } from "react";
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS, type ReportCategory } from "@/lib/constants";
import { ensureAnonymousSession } from "@/lib/session-client";

export function ReportMessage({
  messageId,
  disabled = false,
}: {
  messageId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("other");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [recovery, setRecovery] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || status === "sending" || status === "ok") return;
    setStatus("sending");
    setRecovery(null);
    const session = await ensureAnonymousSession();
    if (!session.configured || session.error) {
      setStatus("err");
      setRecovery(session.recovery ?? "Reporting is unavailable right now.");
      return;
    }
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("err");
        setRecovery(data.recovery ?? data.error ?? "The report could not be sent.");
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("err");
      setRecovery("Network failure. Try again in a moment.");
    }
  }

  return (
    <div id="report" className="border-t border-line pt-8">
      {status === "ok" ? (
        <p className="text-sm text-mist">Report received. Moderators will review it privately.</p>
      ) : open ? (
        <form onSubmit={(event) => void submit(event)} className="max-w-md">
          <p className="kicker">Report this sentence</p>
          <p className="mt-2 text-sm text-ash">
            Reports are private. They do not appear on the wall.
          </p>
          <label className="mt-4 block" htmlFor="report-reason">
            <span className="kicker">Reason</span>
            <select
              id="report-reason"
              value={category}
              onChange={(event) => setCategory(event.target.value as ReportCategory)}
              className="field mt-2 w-full"
            >
              {REPORT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {REPORT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          {recovery ? (
            <p className="mt-3 text-sm text-blood" role="alert">
              {recovery}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={disabled || status === "sending"} className="btn btn-line">
              {status === "sending" ? "Sending…" : "Submit report"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setOpen(false);
                setRecovery(null);
                setStatus("idle");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn-ghost px-0 text-ash hover:text-paper"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          Report this sentence
        </button>
      )}
    </div>
  );
}
