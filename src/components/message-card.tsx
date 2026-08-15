"use client";

import { memo } from "react";
import Link from "next/link";
import { editionMessagePath, editionNumberOf, formatPublicNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FireButton } from "@/components/fire-button";
import { SharePanel } from "@/components/share-panel";
import { sharePayloadForMessage } from "@/lib/share/copy";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import type { EventPhase } from "@/lib/event/state";

export const MessageCard = memo(function MessageCard({
  message,
  phase,
  rankLabel,
  dense = false,
  fresh = false,
  featured = false,
  event,
  onReacted,
}: {
  message: PublicMessage;
  phase: EventPhase;
  rankLabel?: string;
  dense?: boolean;
  fresh?: boolean;
  featured?: boolean;
  event?: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  onReacted?: (id: string, count: number) => void;
}) {
  const href =
    event && (event.phase === "archived" || event.phase === "finalizing")
      ? editionMessagePath(editionNumberOf(event), message.publicNumber)
      : `/message/${message.publicNumber}`;
  const payload = sharePayloadForMessage({
    event: event ?? { phase, endsAt: new Date(0).toISOString(), serverNow: new Date().toISOString() },
    message,
  });

  return (
    <article
      className={cn(
        "inscribe p-4 sm:p-5",
        dense && "wall-card p-3.5 sm:p-4",
        fresh && "wall-card-fresh animate-message-in",
        featured && "wall-card-featured",
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Link href={href} className="message-number">
          {formatPublicNumber(message.publicNumber)}
        </Link>
        {rankLabel ? (
          <span className="kicker text-ember">{rankLabel}</span>
        ) : null}
      </div>
      <p
        className={cn(
          "message-text font-display text-paper",
          featured ? "message-text-featured" : dense ? "message-text-dense" : "message-text-card",
          message.isRemoved && "text-ash italic",
        )}
      >
        {message.isRemoved ? message.text : `“${message.text}”`}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <FireButton
          messageId={message.id}
          count={message.reactionCount}
          disabled={phase !== "live" || message.isRemoved}
          onReacted={onReacted}
        />
        <div className="flex items-center gap-2">
          <time
            className="hidden font-mono text-[0.65rem] tracking-widest text-ash sm:inline"
            dateTime={message.publishedAt}
          >
            {new Date(message.publishedAt).toISOString().slice(11, 19)} UTC
          </time>
          <SharePanel payload={payload} via="card" compact />
          {!message.isRemoved ? (
            <Link
              href={`${href}#report`}
              className="btn-ghost min-h-11 px-1 text-[0.65rem] tracking-[0.16em] text-ash hover:text-paper"
            >
              Report
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
});
