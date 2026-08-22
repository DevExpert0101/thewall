import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, formatCount, formatObjectIdentity } from "@/lib/utils";

export function WitnessPlaque({
  message,
  event,
}: {
  message: PublicMessage;
  event: Pick<EventSnapshot, "phase" | "editionNumber">;
}) {
  const live = event.phase === "live";
  return (
    <figure className="pay-plaque shrine-plaque mt-12 max-w-lg p-7 sm:p-10">
      <p className="font-mono text-[0.7rem] tracking-[0.18em] text-bronze">
        {formatObjectIdentity(message.publicNumber, editionNumberOf(event))}
      </p>
      <blockquote className="mt-5 font-display text-2xl leading-snug text-paper sm:text-3xl">
        “{message.text}”
      </blockquote>
      <figcaption className="mt-8 kicker">
        {formatCount(message.reactionCount)} 🔥
        {live ? " · on this Wall now" : event.phase === "archived" ? " · sealed" : " · carved"}
      </figcaption>
    </figure>
  );
}
