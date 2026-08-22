import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditionRecordBook } from "@/components/edition-records";
import { recordsFromMessages } from "@/lib/archive/records";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `m${n}`,
    eventId: "evt",
    publicNumber: n,
    text: `Sentence ${n}.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: "2026-08-13T10:00:00.000Z",
    finalRank: n,
    ...extra,
  };
}

const event: Pick<EventSnapshot, "startsAt" | "endsAt" | "totalMessages" | "totalReactions"> = {
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  totalMessages: 2,
  totalReactions: 3,
};

describe("EditionRecordBook", () => {
  it("links each message record back to the Wall and the sentence", () => {
    const records = recordsFromMessages(1, event, [
      message(1, { finalRank: 2, reactionCount: 1 }),
      message(4, { finalRank: 1, reactionCount: 2 }),
    ]);
    render(<EditionRecordBook records={records} />);
    expect(screen.getAllByRole("link", { name: /message #000001/i })[0]).toHaveAttribute(
      "href",
      "/archive/001/1",
    );
    expect(screen.getAllByRole("link", { name: /the wall №001/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/winning message/i)).toBeInTheDocument();
    expect(screen.queryByText(/fastest to 100/i)).not.toBeInTheDocument();
    expect(screen.getByText(/reaction ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/final ranking/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /message #000004/i })[0]).toHaveAttribute(
      "href",
      "/archive/001/4",
    );
  });
});
