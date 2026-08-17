"use client";

import { useEffect, useState } from "react";
import { TurnstileGate } from "@/components/turnstile-gate";
import { hasLocalReaction, reactionIdempotencyKey, rememberLocalReaction } from "@/lib/reactions/local";
import { cn, formatCount } from "@/lib/utils";

export function FireButton({
  messageId,
  count,
  disabled,
  readOnly,
  onReacted,
}: {
  messageId: string;
  count: number;
  disabled?: boolean;
  readOnly?: boolean;
  onReacted?: (id: string, count: number) => void;
}) {
  const [local, setLocal] = useState(count);
  const [trackedId, setTrackedId] = useState(messageId);
  const [reacted, setReacted] = useState(false);
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // localStorage is client-only; sync after mount without blocking SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from local store
    setReacted(hasLocalReaction(messageId));
  }, [messageId]);

  if (trackedId !== messageId) {
    setTrackedId(messageId);
    setLocal(count);
    setReacted(false);
    setChallenge(false);
  }

  const value = Math.max(local, count);
  const locked = Boolean(disabled || reacted || pending || challenge);

  if (readOnly) {
    return (
      <p className="fire-mark fire-mark-sealed" aria-label={`${formatCount(count)} reactions`}>
        <span className="text-base" aria-hidden="true">
          🔥
        </span>
        <span className="font-mono tabular">{formatCount(count)}</span>
      </p>
    );
  }

  function markReacted() {
    rememberLocalReaction(messageId);
    setReacted(true);
    setChallenge(false);
  }

  async function react(turnstileToken?: string | null) {
    if (disabled || reacted || pending) return;
    if (challenge && !turnstileToken) return;
    const previous = value;
    setLocal(previous + 1);
    setPulse(true);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          idempotencyKey: reactionIdempotencyKey(messageId),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocal(previous);
        if (data.code === "DUPLICATE_REACTION") {
          markReacted();
          setError(null);
          return;
        }
        if (data.code === "TURNSTILE") {
          setChallenge(true);
          setError(data.recovery ?? data.error ?? "Complete the check to keep reacting.");
          return;
        }
        setError(data.recovery ?? data.error ?? "Could not react.");
        return;
      }
      setLocal(data.reactionCount);
      markReacted();
      onReacted?.(messageId, data.reactionCount);
    } catch {
      setLocal(previous);
      setError("Network failure. Try again.");
    } finally {
      setPending(false);
      window.setTimeout(() => setPulse(false), 280);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void react()}
        disabled={locked}
        aria-pressed={reacted}
        aria-busy={pending}
        aria-label={
          reacted
            ? `Already reacted with fire. ${formatCount(value)} reactions`
            : `React with fire. ${formatCount(value)} reactions`
        }
        className={cn("fire-mark", pulse && "text-flame", reacted && "text-flame")}
      >
        <span className={cn("text-base", pulse && "animate-ember")} aria-hidden="true">
          🔥
        </span>
        <span className="font-mono tabular">{formatCount(value)}</span>
      </button>
      {challenge ? (
        <div className="mt-2">
          <TurnstileGate
            purpose="react"
            disabled={pending}
            onToken={(token) => {
              if (token) void react(token);
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p className="mt-1 max-w-[16rem] text-[11px] text-blood" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
