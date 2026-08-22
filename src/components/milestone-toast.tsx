"use client";

import { SharePanel } from "@/components/share-panel";
import { milestoneChorus, milestoneHeadline, type Milestone } from "@/lib/milestones/engine";
import { sharePayloadForMilestone } from "@/lib/share/copy";
import { creativeImagePath } from "@/lib/share/links";
import type { EventSnapshot } from "@/lib/types";

export function MilestoneToast({
  milestone,
  event,
  onDismiss,
}: {
  milestone: Milestone;
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  onDismiss: () => void;
}) {
  const payload = sharePayloadForMilestone({ event, milestone });
  const card = creativeImagePath(
    milestone.kind === "message"
      ? { kind: "milestone", mark: milestone.value }
      : { kind: "milestone", fire: milestone.value },
  );

  return (
    <aside className="milestone-toast animate-monument" role="status" aria-live="polite">
      <p className="kicker text-ember">A MARK WAS REACHED</p>
      <p className="mt-4 font-display text-3xl leading-none tracking-tight text-paper sm:text-4xl">
        {milestoneHeadline(milestone)}
      </p>
      <p className="mt-3 font-mono text-xs tracking-[0.18em] text-bronze">{milestoneChorus(milestone)}</p>
      <div className="mt-6">
        <SharePanel payload={payload} via="milestone" primaryLabel="Share this mark" cards={false} />
      </div>
      <a href={card} className="btn-ghost mt-3 inline-flex min-h-11 items-center text-xs tracking-[0.16em]" rel="nofollow" download>
        Save card
      </a>
      <button type="button" className="btn-ghost mt-2 block text-xs tracking-[0.16em]" onClick={onDismiss}>
        Dismiss
      </button>
    </aside>
  );
}
