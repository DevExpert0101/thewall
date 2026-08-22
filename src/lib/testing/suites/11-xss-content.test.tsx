import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageCard } from "@/components/message-card";
import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";
import { graphemeCount, validateMessage } from "@/lib/message/normalize";
import { serializeJsonLd } from "@/lib/security/csp";
import { AppError } from "@/lib/errors";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "\"><svg onload=alert(1)>",
  "🙂🔥".repeat(10),
  "שלום עולם",
  "a\u0301".repeat(20),
  "supercalifragilisticexpialidocious".repeat(2),
  "one\nline",
];

const message: PublicMessage = {
  id: "00000000-0000-4000-8000-000000000099",
  eventId: "local",
  publicNumber: 99,
  text: "<script>alert(1)</script>",
  isRemoved: false,
  reactionCount: 0,
  publishedAt: "2026-08-19T10:00:00.000Z",
  finalRank: null,
};

const event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber"> = {
  phase: "live",
  endsAt: "2026-08-20T00:00:00.000Z",
  serverNow: "2026-08-19T10:00:00.000Z",
};

describe("suite 11 — XSS and malformed content", () => {
  it("renders payloads as text and keeps JSON-LD escaped", () => {
    for (const text of PAYLOADS) {
      expect(validateMessage(text)).toBeTruthy();
    }
    render(<MessageCard message={message} phase="live" event={event} />);
    const visible = screen.getByText(/<script>alert\(1\)<\/script>/);
    expect(visible.tagName).toBe("P");
    expect(visible.querySelector("script")).toBeNull();
    expect(visible.querySelector("img")).toBeNull();
    const jsonLd = serializeJsonLd({ name: "<script>alert(1)</script>" });
    expect(jsonLd).not.toContain("<script>");
  });

  it("uses grapheme semantics at 139 / 140 / 141", () => {
    expect(graphemeCount("a".repeat(139))).toBe(139);
    expect(validateMessage("a".repeat(139))).toHaveLength(139);
    expect(validateMessage("a".repeat(MESSAGE_MAX_GRAPHEMES))).toHaveLength(140);
    expect(() => validateMessage("a".repeat(141))).toThrow(AppError);
    expect(validateMessage("a".repeat(139) + "🔥")).toBeTruthy();
    expect(validateMessage("\u0000only")).toBe("only");
  });
});
