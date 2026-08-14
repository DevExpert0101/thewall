import { describe, expect, it } from "vitest";
import { remainClause, remainingLabel, untilOpenClause } from "@/lib/event/remaining";
import { sharePayloadForMessage, sharePayloadForEvent, ogCopyForMessage } from "@/lib/share/copy";
import { composeCreative, resolveCreativeRatio, CREATIVE_SIZES } from "@/lib/share/compose";
import { creativeImageUrl, parseShareableUrl, redditShareUrl, telegramShareUrl, xShareUrl } from "@/lib/share/links";
import { publicMessageMetadata, publicPageMetadata } from "@/lib/share/metadata";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const live: EventSnapshot = {
  id: "evt",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  archivedAt: null,
  finalizedAt: null,
  phase: "live",
  serverNow: "2026-08-13T12:00:00.000Z",
  totalMessages: 18,
  totalReactions: 401,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
};

const message: PublicMessage = {
  id: "m",
  eventId: "evt",
  publicNumber: 4291,
  text: "I hope we were trying.",
  isRemoved: false,
  reactionCount: 12,
  publishedAt: "2026-08-13T10:00:00.000Z",
  finalRank: null,
};

describe("share copy", () => {
  it("writes the live message post from real remaining time", () => {
    expect(remainClause(live.endsAt, live.serverNow)).toBe("6 hours remain");
    const payload = sharePayloadForMessage({ event: live, message });
    expect(payload.text).toBe(
      [
        "I'm Message #004291 on The Wall.",
        "6 hours remain.",
        "Find me before the internet loses its chance to speak.",
      ].join("\n"),
    );
    expect(payload.path).toBe("/message/4291");
    expect(payload.url).toContain("/message/4291");
  });

  it("does not invent a live countdown after close", () => {
    const frozen = { ...live, phase: "archived" as const, totalMessages: 18 };
    const payload = sharePayloadForMessage({
      event: frozen,
      message: { ...message, finalRank: 4 },
    });
    expect(payload.text).toContain("Final rank #4.");
    expect(payload.text).not.toMatch(/hours remain/i);
  });

  it("uses the real sentence count on event posts", () => {
    const payload = sharePayloadForEvent(live, "/wall");
    expect(payload.text).toContain("18 sentences");
    expect(payload.text).not.toMatch(/thousands|millions|viral/i);
    const empty = sharePayloadForEvent({ ...live, totalMessages: 0 });
    expect(empty.text).toContain("No sentences yet");
  });
});

describe("share links", () => {
  it("builds X, Telegram, and Reddit intents around the canonical URL", () => {
    const url = "http://localhost:3000/message/4291";
    const text = "I'm Message #004291 on The Wall.";
    expect(xShareUrl(text, url)).toContain("twitter.com/intent/tweet");
    expect(xShareUrl(text, url)).toContain(encodeURIComponent(url));
    expect(telegramShareUrl(url, text)).toContain("t.me/share/url");
    expect(redditShareUrl(url, "#004291 — THE WALL")).toContain("reddit.com/submit");
    expect(redditShareUrl(url, "#004291 — THE WALL")).not.toContain("utm_");
  });

  it("only oEmbeds public Wall URLs", () => {
    expect(parseShareableUrl("http://localhost:3000/message/4291")?.pathname).toBe("/message/4291");
    expect(parseShareableUrl("http://localhost:3000/wall")?.pathname).toBe("/wall");
    expect(parseShareableUrl("http://evil.example/message/4291")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/certificate/secret-token")).toBeNull();
  });
});

describe("creative compositions", () => {
  it("exposes 1200×630, square, and 9:16", () => {
    expect(CREATIVE_SIZES["1200x630"]).toEqual({ width: 1200, height: 630 });
    expect(CREATIVE_SIZES["1:1"]).toEqual({ width: 1080, height: 1080 });
    expect(CREATIVE_SIZES["9:16"]).toEqual({ width: 1080, height: 1920 });
    expect(resolveCreativeRatio("16:9")).toBe("1200x630");
    expect(resolveCreativeRatio("square")).toBe("1:1");
    expect(resolveCreativeRatio("portrait")).toBe("9:16");
  });

  it("puts live countdown and real totals on the countdown graphic", () => {
    const copy = composeCreative({ kind: "countdown", event: live });
    expect(copy.title).toContain("06:00:00");
    expect(copy.foot).toContain("18 sentences");
    expect(copy.foot).toContain("401");
  });

  it("milestones use the backend count and never invent rank", () => {
    const copy = composeCreative({ kind: "milestone", event: live });
    expect(copy.title).toContain("18");
    expect(copy.body).toContain("6 hours remain");
    const blank = composeCreative({ kind: "milestone", event: { ...live, totalMessages: 0 } });
    expect(blank.title).toMatch(/blank/i);
    expect(blank.title).not.toMatch(/\d{2,}/);
  });

  it("message and certificate cards use the real number and fire count", () => {
    const card = composeCreative({ kind: "message", event: live, message });
    expect(card.title).toBe("#004291");
    expect(card.body).toContain("I hope we were trying.");
    expect(card.foot).toContain("12");
    const cert = composeCreative({ kind: "certificate", event: live, message });
    expect(cert.kicker).toBe("CERTIFICATE");
    expect(cert.foot).toMatch(/pending finalization/i);
    const ranked = composeCreative({
      kind: "certificate",
      event: { ...live, phase: "archived" },
      message: { ...message, finalRank: 7 },
    });
    expect(ranked.foot).toContain("Final rank #7");
  });

  it("creative URLs stay tracking-free", () => {
    expect(creativeImageUrl({ kind: "message", number: 4291 })).toContain("/api/creatives");
    expect(creativeImageUrl({ kind: "message", number: 4291 })).toContain("number=4291");
    expect(creativeImageUrl({ kind: "message", number: 4291 })).not.toContain("utm");
  });
});

describe("Open Graph metadata", () => {
  it("sets Discord-friendly large-image tags from live data", () => {
    const meta = publicPageMetadata({ event: live, path: "/", kind: "countdown" });
    expect(meta.openGraph?.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 1200, height: 630, type: "image/png" }),
      ]),
    );
    expect(meta.twitter).toEqual(expect.objectContaining({ card: "summary_large_image" }));
    expect(String(meta.description)).toContain("18 sentences");
    expect(meta.alternates?.types?.["application/json+oembed"]).toContain("/api/oembed");
  });

  it("describes a message with remaining time, not fabricated engagement", () => {
    const meta = publicMessageMetadata({ event: live, message });
    expect(meta.openGraph?.title).toContain("#004291");
    expect(String(meta.description)).toContain("6 hours remain");
    expect(String(meta.description)).not.toMatch(/going viral|millions of views/i);
    expect(ogCopyForMessage({ event: live, message }).description).toContain("I hope we were trying.");
  });
});

describe("remaining language", () => {
  it("floors hours instead of rounding up", () => {
    expect(remainClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:01:00.000Z")).toBe("5 hours remain");
    expect(untilOpenClause("2026-08-13T18:00:00.000Z", "2026-08-13T17:00:00.000Z")).toBe(
      "The Wall opens in 1 hour",
    );
    expect(remainingLabel("2026-08-13T18:00:00.000Z", "2026-08-13T12:00:00.000Z")).toBe("06:00:00 REMAINING");
  });
});
