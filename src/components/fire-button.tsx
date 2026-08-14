"use client";

import { useState } from "react";
import { hasLocalReaction, rememberLocalReaction } from "@/lib/reactions/local";
import { cn, formatCount } from "@/lib/utils";

export function FireButton({
  messageId,
  count,
  disabled,
  onReacted,
}: {
  messageId: string;
  count: number;
  disabled?: boolean;
  onReacted?: (id: string, count: number) => void;
}) {
  const [local, setLocal] = useState(count);
  const [trackedId, setTrackedId] = useState(messageId);
  const [reacted, setReacted] = useState(() => hasLocalReaction(messageId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  if (trackedId !== messageId) {
    setTrackedId(messageId);
    setLocal(count);
    setReacted(hasLocalReaction(messageId));
  }

  const value = Math.max(local, count);
  const locked = Boolean(disabled || reacted || pending);

  function markReacted() {
    rememberLocalReaction(messageId);
    setReacted(true);
  }

  async function react() {
    if (locked) return;
    const previous = value;
    setLocal(previous + 1);
    setPulse(true);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocal(previous);
        if (data.code === "DUPLICATE_REACTION") {
          markReacted();
          setError(null);
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
      {error ? (
        <p className="mt-1 max-w-[16rem] text-[11px] text-blood" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
