"use client";

import { useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/constants";

export function FeedbackForm() {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("product");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [recovery, setRecovery] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending" || status === "ok") return;
    setStatus("sending");
    setRecovery(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          category,
          email: email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("err");
        setRecovery(data.recovery ?? data.error ?? "The note could not be sent.");
        return;
      }
      setStatus("ok");
      setBody("");
      setEmail("");
    } catch {
      setStatus("err");
      setRecovery("Network failure. Try again in a moment.");
    }
  }

  return (
    <section id="feedback" className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
      <p className="kicker">Send a note</p>
      <h2 className="section-title mt-4">Tell us if the stone is wrong.</h2>
      <p className="lede mt-4 max-w-xl">
        This is not a sentence on the Wall. We read it. The public does not.
        No name required.
      </p>
      {status === "ok" ? (
        <p className="mt-8 text-sm text-mist" role="status">
          Received. Thank you.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-8 max-w-md space-y-4">
          <label className="block">
            <span className="kicker">What is this about</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
              className="field mt-2 w-full"
            >
              {FEEDBACK_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {FEEDBACK_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block" htmlFor="feedback-note">
            <span className="kicker">Your note</span>
            <textarea
              id="feedback-note"
              required
              minLength={8}
              maxLength={800}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-invalid={status === "err"}
              aria-describedby={recovery ? "feedback-error" : undefined}
              className="field mt-2 w-full"
              placeholder="The clock jumped. I could not pay. The type is too small."
            />
          </label>
          <label className="block">
            <span className="kicker">Email if you want a reply</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field mt-2 w-full"
              autoComplete="email"
            />
            <span className="mt-2 block text-xs text-ash">
              Optional. Never shown on the Wall.
            </span>
          </label>
          {recovery ? (
            <p id="feedback-error" className="text-sm text-blood" role="alert">
              {recovery}
            </p>
          ) : null}
          <button type="submit" disabled={status === "sending"} className="btn btn-line">
            {status === "sending" ? "Sending…" : "Send the note"}
          </button>
        </form>
      )}
    </section>
  );
}
