"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSyncedNow } from "@/lib/event/clock";
import {
  countdownLiveBucket,
  countdownLiveText,
  countdownSpokenName,
  eventPresentation,
  remainingWholeSeconds,
  type EventPresentation,
} from "@/lib/event/remaining";
import { cn } from "@/lib/utils";

type Props = {
  targetIso: string;
  serverNow: string;
  label: string;
  phase: "upcoming" | "live" | "finalizing" | "archived";
  size?: "hero" | "bar";
  nowMs?: number;
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

function ClockFace({
  label,
  presentation,
  remaining,
  frozen,
  children,
  className,
}: {
  label: string;
  presentation: EventPresentation;
  remaining: number;
  frozen: boolean;
  children: ReactNode;
  className?: string;
}) {
  const name = countdownSpokenName(label, remaining, frozen);
  const bucket = countdownLiveBucket(remaining, frozen || presentation === "closed");
  const live = countdownLiveText(label, bucket);
  return (
    <div className={className} role="group" aria-label={name} data-presentation={presentation}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </span>
      {children}
    </div>
  );
}

export function Countdown({
  targetIso,
  serverNow,
  label,
  phase,
  size = "hero",
  nowMs,
  onZero,
}: Props) {
  const synced = useSyncedNow(serverNow);
  const now = nowMs ?? synced;
  const remaining = new Date(targetIso).getTime() - now;
  const parts = partsFromMs(remaining);
  const presentation = eventPresentation(phase, remaining);
  const lastMinute = presentation === "final-minute" || presentation === "final-seconds";
  const urgent = lastMinute || presentation === "final-ten";
  const frozen = remaining <= 0 && phase !== "upcoming";
  const digits = `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  const shownLabel = lastMinute ? (size === "hero" ? "Final seconds" : "Last minute") : label;
  const shownSeconds = remainingWholeSeconds(remaining);
  const secondFace = presentation === "final-seconds" ? String(shownSeconds) : pad(shownSeconds);
  const onZeroRef = useRef(onZero);
  const firedRef = useRef(false);

  useEffect(() => {
    onZeroRef.current = onZero;
  }, [onZero]);

  useEffect(() => {
    firedRef.current = false;
  }, [targetIso]);

  useEffect(() => {
    if (remaining > 0 || firedRef.current) return;
    firedRef.current = true;
    onZeroRef.current?.();
  }, [remaining]);

  if (size === "bar") {
    return (
      <ClockFace
        className={cn("countdown-bar", urgent && "text-blood", frozen && "opacity-70")}
        label={shownLabel}
        presentation={presentation}
        remaining={remaining}
        frozen={frozen}
      >
        <span className="kicker" aria-hidden="true">
          {shownLabel}
        </span>
        <span className={cn("countdown-bar-digits", urgent && "text-blood")} aria-hidden="true">
          {lastMinute ? secondFace : digits}
        </span>
      </ClockFace>
    );
  }

  if (lastMinute) {
    return (
      <div className="countdown-hero countdown-final-minute" data-presentation={presentation}>
        <p className="kicker" aria-hidden="true">
          {shownLabel}
        </p>
        <ClockFace
          className="countdown-cells"
          label={shownLabel}
          presentation={presentation}
          remaining={remaining}
          frozen={frozen}
        >
          <div className="countdown-slot" aria-hidden="true">
            <div className="countdown-cell">
              <span className="countdown-digit countdown-final-seconds">{secondFace}</span>
              <span className="countdown-unit">{shownSeconds === 1 ? "Second" : "Seconds"}</span>
            </div>
          </div>
        </ClockFace>
      </div>
    );
  }

  const cells = [
    { value: pad(parts.hours), unit: "Hours" },
    { value: pad(parts.minutes), unit: "Minutes" },
    { value: pad(parts.seconds), unit: "Seconds" },
  ];

  return (
    <div className="countdown-hero" data-presentation={presentation}>
      <p className="kicker" aria-hidden="true">
        {shownLabel}
      </p>
      <ClockFace
        className="countdown-cells"
        label={shownLabel}
        presentation={presentation}
        remaining={remaining}
        frozen={frozen}
      >
        {cells.map((cell, index) => (
          <div key={cell.unit} className="countdown-slot" aria-hidden="true">
            {index > 0 ? (
              <span className="countdown-colon" aria-hidden="true">
                :
              </span>
            ) : null}
            <div className="countdown-cell">
              <span
                className={cn(
                  "countdown-digit",
                  (presentation === "final-hour" || presentation === "final-ten") &&
                    "countdown-digit-urgent",
                  frozen && "text-ash",
                )}
              >
                {cell.value}
              </span>
              <span className="countdown-unit">{cell.unit}</span>
            </div>
          </div>
        ))}
      </ClockFace>
    </div>
  );
}
