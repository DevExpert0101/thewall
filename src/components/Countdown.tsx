"use client";

import { useEffect, useRef, useState } from "react";

interface CountdownProps {
  endsAt: string;
  createdAt?: string;
  onExpire?: () => void;
  /** "compact" renders a single small line — for checkout, certificates, cards. */
  variant?: "full" | "compact";
}

function format(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export default function Countdown({
  endsAt,
  createdAt,
  onExpire,
  variant = "full",
}: CountdownProps) {
  const ends = new Date(endsAt).getTime();
  const starts = createdAt ? new Date(createdAt).getTime() : null;

  const [now, setNow] = useState<number>(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (ends - n <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ends, onExpire]);

  const remaining = ends - now;
  const expired = remaining <= 0;
  const finalSeconds = !expired && remaining <= 3000;
  const elapsed =
    starts !== null && ends > starts
      ? Math.min(1, Math.max(0, (now - starts) / (ends - starts)))
      : 0;

  if (variant === "compact") {
    return (
      <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        {!expired && <span className="h-1.5 w-1.5 rounded-full bg-red-500 flame-float" />}
        <span suppressHydrationWarning>
          {expired
            ? "The wall has frozen"
            : finalSeconds
              ? `The wall is ending · ${format(remaining)}`
              : `Closes in ${format(remaining)}`}
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-[10px] uppercase tracking-[0.3em] text-muted"
        suppressHydrationWarning
      >
        {expired
          ? "The wall has frozen"
          : finalSeconds
            ? "The wall is ending"
            : "Time left on the wall"}
      </span>
      <div className="flex items-center gap-3">
        {!expired && (
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 flame-float" />
        )}
        <span
          suppressHydrationWarning
          className={`font-mono font-semibold tabular-nums tracking-tight ${
            expired
              ? "text-muted"
              : finalSeconds
                ? "animate-pulse text-6xl text-red-400 time-glow sm:text-7xl"
                : "text-gold time-glow"
          } ${finalSeconds ? "" : "text-4xl sm:text-5xl"}`}
        >
          {expired ? "00:00:00" : format(remaining)}
        </span>
      </div>
      {starts !== null && (
        <div className="mt-1 h-1 w-48 overflow-hidden rounded-full bg-surface">
          <div
            suppressHydrationWarning
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
              expired
                ? "bg-muted"
                : finalSeconds
                  ? "bg-red-500 glow-pulse"
                  : "bg-gradient-to-r from-ember to-gold glow-pulse"
            }`}
            style={{ width: `${expired ? 100 : elapsed * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
