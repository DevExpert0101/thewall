"use client";

import { useMemo, useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/constants";

const NOTE_MAX = 800;

export function FeedbackForm() {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("product");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [recovery, setRecovery] = useState<string | null>(null);
  const count = useMemo(() => body.length, [body]);

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
    <section id="feedback" className="rite-band">
      <div className="section-monument">
        <div className="note-desk">
          <div className="section-head">
            <p className="kicker">Send a note</p>
            <h2 className="section-title">Tell us if the stone is wrong.</h2>
            <p className="lede mt-5 max-w-md">
              This is not a sentence on the Wall. We read it. The public does not.
              No name required.
            </p>
          </div>

          {status === "ok" ? (
            <div className="inscribe note-plaque" role="status">
              <p className="kicker">The note is in</p>
              <p className="mt-4 font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight text-paper">
                Received. Thank you.
              </p>
              <p className="lede mt-4 max-w-md">
                It stays off the Wall. If you left an email, a reply can reach you.
                If you did not, this is the last you will see of it.
              </p>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="inscribe note-plaque">
              <fieldset className="min-w-0">
                <legend className="kicker">What is this about</legend>
                <div className="note-choices">
                  {FEEDBACK_CATEGORIES.map((item) => (
                    <label key={item} className="note-choice">
                      <input
                        type="radio"
                        name="feedback-category"
                        value={item}
                        checked={category === item}
                        onChange={() => setCategory(item)}
                        className="sr-only"
                      />
                      {FEEDBACK_CATEGORY_LABELS[item]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mt-6 block" htmlFor="feedback-note">
                <span className="kicker">Your note</span>
                <textarea
                  id="feedback-note"
                  required
                  minLength={8}
                  maxLength={NOTE_MAX}
                  rows={6}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  aria-invalid={status === "err"}
                  aria-describedby={recovery ? "feedback-error feedback-count" : "feedback-count"}
                  className="field note-field mt-2 w-full"
                  placeholder="The clock jumped. I could not pay. The type is too small."
                />
              </label>
              <div className="note-meta">
                <p className="text-xs text-ash">Private. Never carved.</p>
                <p id="feedback-count" className="font-mono text-xs tabular text-ash">
                  {count} / {NOTE_MAX}
                </p>
              </div>

              <label className="mt-6 block" htmlFor="feedback-email">
                <span className="kicker">Email if you want a reply</span>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="field mt-2 w-full"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <span className="mt-2 block text-xs text-ash">
                  Optional. Never shown on the Wall.
                </span>
              </label>

              {recovery ? (
                <p id="feedback-error" className="mt-4 text-sm text-blood" role="alert">
                  {recovery}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="btn btn-primary mt-7 w-full sm:w-auto"
              >
                {status === "sending" ? "Sending…" : "Send the note"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
