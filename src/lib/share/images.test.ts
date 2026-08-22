/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { GET as creatives } from "@/app/api/creatives/route";
import { GET as oembed } from "@/app/api/oembed/route";
import { composeCreative } from "@/lib/share/compose";
import { renderCreativeImage } from "@/lib/share/render-creative";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const event: EventSnapshot = {
  id: "local",
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
  eventId: "local",
  publicNumber: 4,
  text: "If you are reading this in fifty years, we hoped.",
  isRemoved: false,
  reactionCount: 67,
  publishedAt: "2026-08-13T10:00:00.000Z",
  finalRank: null,
};

async function assertPng(res: Response, minBytes = 800) {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/image\/png/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect(bytes.length).toBeGreaterThan(minBytes);
  expect([...bytes.slice(0, 8)]).toEqual(PNG);
}

describe("generated images", () => {
  it("renders countdown, milestone, message, and certificate at all three sizes", async () => {
    const ratios = ["1200x630", "1:1", "9:16"] as const;
    const kinds = [
      composeCreative({ kind: "countdown", event }),
      composeCreative({ kind: "milestone", event }),
      composeCreative({ kind: "message", event, message }),
      composeCreative({ kind: "certificate", event, message }),
    ];
    for (const copy of kinds) {
      for (const ratio of ratios) {
        await assertPng(renderCreativeImage(copy, ratio));
      }
    }
    const archived = composeCreative({
      kind: "message",
      event: { ...event, phase: "archived" },
      message,
    });
    expect(archived.clock).toBe("SEALED — WALL №001");
    await assertPng(renderCreativeImage(archived, "1200x630"));
    await assertPng(renderCreativeImage(archived, "1:1"));
    await assertPng(renderCreativeImage(archived, "9:16"));
  });

  it("serves live creatives from the API without fabricated counts", async () => {
    const res = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=countdown&ratio=1200x630"),
    );
    await assertPng(res);
    const square = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=milestone&ratio=1:1"),
    );
    await assertPng(square);
    const portrait = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=message&ratio=9:16&number=4"),
    );
    await assertPng(portrait);
    const archived = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=message&ratio=1200x630&number=4&edition=1"),
    );
    await assertPng(archived);
  });

  it("rejects unknown ratios and missing message numbers", async () => {
    const bad = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=countdown&ratio=4:3"),
    );
    expect(bad.status).toBe(400);
    const missing = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=message&ratio=1200x630"),
    );
    expect(missing.status).toBe(400);
  });

  it("serves a reached mark card and refuses an unreached one", async () => {
    const first = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=milestone&mark=1&ratio=1200x630"),
    );
    await assertPng(first);
    const unreached = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=milestone&mark=10000&ratio=1200x630"),
    );
    expect(unreached.status).toBe(404);
    const unknown = await creatives(
      new Request("http://localhost:3000/api/creatives?kind=milestone&mark=7&ratio=1200x630"),
    );
    expect(unknown.status).toBe(400);
  });
});

describe("oEmbed", () => {
  it("returns a Discord/Reddit link card for a public URL", async () => {
    const res = await oembed(
      new Request("http://localhost:3000/api/oembed?url=http://localhost:3000/message/4"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      type: string;
      title: string;
      thumbnail_width: number;
      thumbnail_height: number;
      thumbnail_url: string;
      url: string;
    };
    expect(body.type).toBe("link");
    expect(body.thumbnail_width).toBe(1200);
    expect(body.thumbnail_height).toBe(630);
    expect(body.thumbnail_url).toContain("kind=message");
    expect(body.thumbnail_url).toContain("number=4");
    expect(body.url).toContain("/message/4");
    expect(body.title).toContain("#000004");
  });

  it("refuses certificate and off-site URLs", async () => {
    const cert = await oembed(
      new Request(
        "http://localhost:3000/api/oembed?url=http://localhost:3000/certificate/private-token",
      ),
    );
    expect(cert.status).toBe(404);
    const foreign = await oembed(
      new Request("http://localhost:3000/api/oembed?url=https://example.com/wall"),
    );
    expect(foreign.status).toBe(404);
  });
});
