import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { publicMessageMetadata, publicPageMetadata } from "@/lib/share/metadata";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-23T00:00:00.000Z",
  endsAt: "2026-08-24T00:00:00.000Z",
  archivedAt: null,
  finalizedAt: null,
  phase: "live",
  serverNow: "2026-08-23T12:00:00.000Z",
  totalMessages: 3,
  totalReactions: 9,
  treasuryAddress: "0x1111111111111111111111111111111111111111",
  network: "base-sepolia",
  priceUsdc: "1.00",
};

const message: PublicMessage = {
  id: "00000000-0000-4000-8000-000000000021",
  eventId: "local",
  publicNumber: 21,
  text: "A public sentence.",
  isRemoved: false,
  reactionCount: 4,
  publishedAt: "2026-08-23T11:00:00.000Z",
  finalRank: null,
};

describe("suite 25 — SEO, cache, and secret surfaces", () => {
  it("keeps Wall Keys and payment secrets out of public metadata", () => {
    const home = publicPageMetadata({ event, path: "/" });
    const wall = publicPageMetadata({ event, path: "/wall" });
    const archive = publicPageMetadata({
      event: { ...event, phase: "archived", archivedAt: event.endsAt, finalizedAt: event.endsAt },
      path: "/archive",
    });
    const detail = publicMessageMetadata({ event, message });
    const blob = JSON.stringify({ home, wall, archive, detail });
    expect(blob).not.toMatch(/wallKey|claimSecret|SERVICE_ROLE|sk_live_|token_hash/i);
    expect(home.alternates?.canonical).toBeTruthy();
    expect(detail.openGraph?.url).toMatch(/\/message\/21$/);
    expect(home.openGraph?.images).toBeTruthy();
  });

  it("hides private routes from robots", () => {
    const doc = robots();
    const rules = JSON.stringify(doc.rules);
    expect(doc.sitemap).toMatch(/sitemap\.xml$/);
    expect(rules).toContain("/admin");
    expect(rules).toContain("/certificate");
    expect(rules).toContain("/claim");
    expect(rules).toContain("/api/");
  });

  it("does not let live cache headers decide write acceptance", () => {
    const state = readFileSync(path.join(process.cwd(), "src/lib/event/state.ts"), "utf8");
    const cache = readFileSync(path.join(process.cwd(), "src/lib/data/event.ts"), "utf8");
    expect(state).toMatch(/endsAt/);
    expect(state).not.toMatch(/cache-control|s-maxage/i);
    expect(cache).toMatch(/cacheForPhase|Cache-Control|s-maxage/);
  });
});
