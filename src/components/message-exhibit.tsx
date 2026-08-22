"use client";

import { Countdown } from "@/components/countdown";
import { FireButton } from "@/components/fire-button";
import { useSyncedNow } from "@/lib/event/clock";
import { eventPresentation, remainingMsFrom } from "@/lib/event/remaining";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatCount, formatObjectIdentity, wallTitle } from "@/lib/utils";

export function MessageExhibit({
  event,
  message,
}: {
  event: Pick<EventSnapshot, "phase" | "startsAt" | "endsAt" | "serverNow" | "editionNumber" | "title">;
  message: PublicMessage;
}) {
  const now = useSyncedNow(event.serverNow);
  const target = event.phase === "upcoming" ? event.startsAt : event.endsAt;
  const remaining = remainingMsFrom(target, now);
  const presentation = eventPresentation(event.phase, remaining);
  const live = event.phase === "live" && remaining > 0;
  const sealed = presentation === "closed";
  const edition = editionNumberOf(event);

  return (
    <article className="message-exhibit" data-presentation={presentation}>
      <header className="message-exhibit-brand">
        <p className="message-exhibit-wordmark">{wallTitle(event)}</p>
        {sealed ? (
          <p className="kicker text-bronze">Sealed</p>
        ) : (
          <Countdown
            targetIso={target}
            serverNow={event.serverNow}
            nowMs={now}
            label={event.phase === "upcoming" ? "Until The Wall opens" : "Until The Wall closes"}
            phase={event.phase}
            size="bar"
          />
        )}
      </header>

      <p className="message-exhibit-number">
        {formatObjectIdentity(message.publicNumber, edition)}
      </p>
      <span className="title-rule mt-5 block" aria-hidden="true" />
      <h1
        className={`message-exhibit-text ${message.isRemoved ? "text-ash italic" : "text-paper"}`}
      >
        {message.isRemoved ? message.text : `“${message.text}”`}
      </h1>

      <div className="message-exhibit-meta">
        <FireButton
          messageId={message.id}
          count={message.reactionCount}
          readOnly={!live}
          disabled={!live || message.isRemoved}
        />
        {message.finalRank ? (
          <p className="font-mono text-sm tracking-[0.12em] text-bronze">
            Final rank #{message.finalRank}
          </p>
        ) : null}
      </div>
      <p className="message-exhibit-tagline">
        {formatCount(message.reactionCount)} 🔥
        {live ? " · on this Wall now" : ""}
      </p>
    </article>
  );
}
