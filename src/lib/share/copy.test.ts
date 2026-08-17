import { describe, expect, it } from "vitest";
import { closesInClause, remainClause, remainingLabel, untilOpenClause } from "@/lib/event/remaining";
import { sharePayloadForMessage, sharePayloadForEvent, sharePayloadForMilestone, sharePayloadForWinner, ogCopyForMessage } from "@/lib/share/copy";
import { cardClockLine, composeCreative, resolveCreativeRatio, CREATIVE_SIZES } from "@/lib/share/compose";
import { parseMilestoneQuery } from "@/lib/milestones/engine";
import { creativeImageUrl, messageNumberFromSharePath, parseShareableUrl, redditShareUrl, telegramShareUrl, xShareUrl } from "@/lib/share/links";
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
    expect(closesInClause(live.endsAt, live.serverNow)).toBe("The Wall closes in 6 hours");
    const payload = sharePayloadForMessage({ event: live, message });
    expect(payload.text).toBe(
      [
        "“I hope we were trying.”",
        "Message #004291 on The Wall №001.",
        "The Wall closes in 6 hours.",
      ].join("\n"),
    );
    expect(payload.title).toBe("“I hope we were trying.”");
    expect(payload.text).not.toMatch(/find me|get your message seen|one dollar/i);
    expect(payload.path).toBe("/message/4291");
    expect(payload.url).toContain("/message/4291");
  });

  it("does not invent a live countdown after close", () => {
    const frozen = { ...live, phase: "archived" as const, totalMessages: 18 };
    const payload = sharePayloadForMessage({
      event: frozen,
      message: { ...message, finalRank: 4 },
    });
    expect(payload.text).toContain("“I hope we were trying.”");
    expect(payload.text).toContain("Message #004291 on The Wall №001.");
    expect(payload.text).toContain("Final rank #4.");
    expect(payload.text).not.toMatch(/hours remain|closes in/i);
  });

  it("uses the real sentence count on event posts", () => {
    const payload = sharePayloadForEvent(live, "/wall");
    expect(payload.text).toContain("18 people spoke");
    expect(payload.text).not.toMatch(/thousands|millions|viral/i);
    const empty = sharePayloadForEvent({ ...live, totalMessages: 0 });
    expect(empty.text).toContain("No one has spoken yet");
    expect(empty.text).toContain("THE WALL HAS JUST OPENED.");
    expect(empty.text).toContain("YOU COULD BE ONE OF THE FIRST 100 VOICES.");
    expect(payload.text).not.toMatch(/one dollar|tagline|advertise/i);
  });

  it("shares a winner as the sentence that won, not a product pitch", () => {
    const payload = sharePayloadForWinner({
      editionNumber: 1,
      publicNumber: 4291,
      text: "Call your mother.",
      reactionCount: 19284,
    });
    expect(payload.text).toContain("“Call your mother.”");
    expect(payload.text).toContain("Message #004291 on The Wall №001 won.");
    expect(payload.text).toContain("19,284 🔥");
    expect(payload.text).not.toMatch(/find me|one dollar|get your message seen/i);
  });
});

describe("share links", () => {
  it("builds X, Telegram, and Reddit intents around the canonical URL", () => {
    const url = "http://localhost:3000/message/4291";
    const text = "“I hope we were trying.”";
    expect(xShareUrl(text, url)).toContain("twitter.com/intent/tweet");
    expect(xShareUrl(text, url)).toContain(encodeURIComponent(url));
    expect(telegramShareUrl(url, text)).toContain("t.me/share/url");
    expect(redditShareUrl(url, "THE WALL №001 / MESSAGE #004291")).toContain("reddit.com/submit");
    expect(redditShareUrl(url, "THE WALL №001 / MESSAGE #004291")).not.toContain("utm_");
  });

  it("only oEmbeds public Wall URLs", () => {
    expect(parseShareableUrl("http://localhost:3000/message/4291")?.pathname).toBe("/message/4291");
    expect(parseShareableUrl("http://localhost:3000/archive/001/4291")?.pathname).toBe("/archive/001/4291");
    expect(parseShareableUrl("http://localhost:3000/records")?.pathname).toBe("/records");
    expect(parseShareableUrl("http://localhost:3000/wall")?.pathname).toBe("/wall");
    expect(parseShareableUrl("http://localhost:3000/open")?.pathname).toBe("/open");
    expect(parseShareableUrl("http://localhost:3000/watch")?.pathname).toBe("/watch");
    expect(parseShareableUrl("http://localhost:3000/how-it-works")?.pathname).toBe("/how-it-works");
    expect(parseShareableUrl("http://evil.example/message/4291")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/certificate/secret-token")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/message/4291/certificate")?.pathname).toBe(
      "/message/4291/certificate",
    );
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
    expect(copy.foot).toContain("18 people");
    expect(copy.foot).toContain("401");
  });

  it("milestones use the backend count and never invent rank", () => {
    const copy = composeCreative({ kind: "milestone", event: live });
    expect(copy.title).toContain("18");
    expect(copy.body).toContain("6 hours remain");
    const blank = composeCreative({ kind: "milestone", event: { ...live, totalMessages: 0 } });
    expect(blank.title).toMatch(/blank/i);
    expect(blank.title).not.toMatch(/\d{2,}/);
    const first = composeCreative({
      kind: "milestone",
      event: live,
      milestone: parseMilestoneQuery({ mark: "1" })!,
    });
    expect(first.title).toBe("MESSAGE #000001");
    expect(first.body).toBe("THE FIRST SENTENCE.");
    expect(() =>
      composeCreative({
        kind: "milestone",
        event: live,
        milestone: parseMilestoneQuery({ mark: "10000" })!,
      }),
    ).toThrow(/not reached/i);
    const spoken = sharePayloadForMilestone({
      event: { ...live, totalMessages: 10_000 },
      milestone: parseMilestoneQuery({ mark: "10000" })!,
    });
    expect(spoken.text).toContain("MESSAGE #010000");
    expect(spoken.text).toContain("10,000 PEOPLE HAVE SPOKEN.");
    expect(spoken.path).toBe("/message/10000");
  });

  it("message and certificate cards use the real number and fire count", () => {
    const card = composeCreative({ kind: "message", event: live, message });
    expect(card.kicker).toBe("THE WALL №001");
    expect(card.brand).toBe("THE WALL");
    expect(card.edition).toBe("№001");
    expect(card.title).toBe("MESSAGE #004291");
    expect(card.body).toContain("I hope we were trying.");
    expect(card.foot).toContain("12");
    expect(card.reactions).toContain("12");
    expect(card.status).toBe("LIVE");
    expect(card.clock).toBe("06:00:00 REMAINING");
    expect(cardClockLine(live)).toBe("06:00:00 REMAINING");
    expect(JSON.stringify(card)).not.toMatch(/wallet|0x|wall key|user[_ ]?id|transaction|intent/i);
    const archived = composeCreative({
      kind: "message",
      event: { ...live, phase: "archived" },
      message,
    });
    expect(archived.status).toBe("SEALED");
    expect(archived.clock).toBe("SEALED — WALL №001");
    expect(archived.clock).not.toMatch(/remaining/i);
    expect(cardClockLine({ ...live, phase: "finalizing" })).toBe("CLOSED — WALL №001");
    const cert = composeCreative({ kind: "certificate", event: live, message });
    expect(cert.kicker).toBe("THE WALL №001");
    expect(cert.title).toBe("MESSAGE #004291");
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
    expect(messageNumberFromSharePath("/message/4291")).toBe(4291);
    expect(messageNumberFromSharePath("/archive/001/4291")).toBe(4291);
    expect(messageNumberFromSharePath("/wall")).toBeNull();
    expect(messageNumberFromSharePath("/certificate/secret")).toBeNull();
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
    expect(String(meta.description)).toContain("18 people spoke");
    expect(meta.alternates?.types?.["application/json+oembed"]).toContain("/api/oembed");
  });

  it("describes a message with remaining time, not fabricated engagement", () => {
    const meta = publicMessageMetadata({ event: live, message });
    expect(meta.openGraph?.title).toContain("#004291");
    expect(String(meta.description)).toContain("The Wall closes in 6 hours");
    expect(String(meta.description)).not.toMatch(/find me|get your message seen|one dollar/i);
    expect(String(meta.description)).not.toMatch(/going viral|millions of views/i);
    expect(ogCopyForMessage({ event: live, message }).description).toContain("I hope we were trying.");
  });
});

describe("remaining language", () => {
  it("floors hours instead of rounding up", () => {
    expect(remainClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:01:00.000Z")).toBe("5 hours remain");
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:01:00.000Z")).toBe(
      "The Wall closes in 5 hours",
    );
    expect(untilOpenClause("2026-08-13T18:00:00.000Z", "2026-08-13T17:00:00.000Z")).toBe(
      "The Wall opens in 1 hour",
    );
    expect(remainingLabel("2026-08-13T18:00:00.000Z", "2026-08-13T12:00:00.000Z")).toBe("06:00:00 REMAINING");
  });
});
