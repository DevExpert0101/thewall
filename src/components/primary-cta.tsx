"use client";

import Link from "next/link";
import type { EventPhase } from "@/lib/event/state";
import { cn } from "@/lib/utils";

export function PrimaryCta({
  phase,
  className,
  onPublish,
}: {
  phase: EventPhase;
  className?: string;
  onPublish?: () => void;
}) {
  if (phase === "upcoming") {
    return (
      <a href="/api/remind" download="the-wall.ics" className={cn("btn btn-primary", className)}>
        Remind me
      </a>
    );
  }
  if (phase === "live") {
    return (
      <button type="button" onClick={onPublish} className={cn("btn btn-primary", className)}>
        Leave your mark
      </button>
    );
  }
  return (
    <Link href="/archive" className={cn("btn btn-primary", className)}>
      Enter the archive
    </Link>
  );
}
