import Link from "next/link";
import {
  CLOSED_LOCK_LINE,
  closedCensusLine,
  closedEditionHeadline,
} from "@/lib/event/remaining";

export function ClosedMonument({
  editionNumber,
  totalMessages,
  sealed = false,
}: {
  editionNumber: number;
  totalMessages: number;
  sealed?: boolean;
}) {
  return (
    <div className="closed-monument" data-sealed={sealed ? "on" : "off"}>
      <p className="closed-monument-kicker">{closedEditionHeadline(editionNumber)}</p>
      <p className="closed-monument-census">{closedCensusLine(totalMessages)}</p>
      <p className="closed-monument-lock">{CLOSED_LOCK_LINE}</p>
      {sealed ? (
        <Link href="/archive" className="btn btn-primary closed-monument-cta">
          Enter the Archive
        </Link>
      ) : (
        <p className="closed-monument-review">
          The day is under review. Final ranks are not public yet.
        </p>
      )}
    </div>
  );
}
