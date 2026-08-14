"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  targetIso: string;
  serverNow: string;
  label: string;
  phase: "upcoming" | "live" | "finalizing" | "archived";
  size?: "hero" | "bar";
  onZero?: () => void;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partsFromMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { hours, minutes, seconds, total };
}

export function Countdown({
  targetIso,
  serverNow,
  label,
  phase,
  size = "hero",
  onZero,
}: Props) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const remaining = new Date(targetIso).getTime() - now;
  const parts = partsFromMs(remaining);
  const urgent = phase === "live" && parts.total <= 60 && parts.total > 0;
  const frozen = remaining <= 0 && phase !== "upcoming";
  const digits = `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  const onZeroRef = useRef(onZero);
  const firedRef = useRef(false);

  useEffect(() => {
    onZeroRef.current = onZero;
  }, [onZero]);

  useEffect(() => {
    firedRef.current = false;
  }, [targetIso]);

  useEffect(() => {
    const originClient = Date.now();
    const originServer = new Date(serverNow).getTime();
    const tick = () => {
      const next = originServer + (Date.now() - originClient);
      setNow(next);
      if (new Date(targetIso).getTime() - next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onZeroRef.current?.();
      }
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [serverNow, targetIso]);

  if (size === "bar") {
    return (
      <div
        className={cn("countdown-bar", urgent && "text-blood", frozen && "opacity-70")}
        role="timer"
        aria-live="polite"
        aria-label={`${label}: ${digits}`}
      >
        <span className="kicker">{label}</span>
        <span className={cn("countdown-bar-digits", urgent && "text-blood")}>{digits}</span>
      </div>
    );
  }

  const cells = [
    { value: pad(parts.hours), unit: "Hours" },
    { value: pad(parts.minutes), unit: "Minutes" },
    { value: pad(parts.seconds), unit: "Seconds" },
  ];

  return (
    <div className="text-center">
      <p className="kicker mb-5">{label}</p>
      <div
        className="countdown-cells"
        role="timer"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${label}: ${digits}`}
      >
        {cells.map((cell) => (
          <div key={cell.unit} className="countdown-cell">
            <span
              className={cn(
                "countdown-digit",
                urgent && "text-blood",
                frozen && "text-ash",
              )}
            >
              {cell.value.split("").map((ch, i) => (
                <span key={`${cell.unit}-${ch}-${i}`} className="inline-block animate-tick">
                  {ch}
                </span>
              ))}
            </span>
            <span className="countdown-unit">{cell.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
