import { afterEach, describe, expect, it, vi } from "vitest";
import { publishArchiveCopies } from "@/lib/archive/copies";
import { buildArchiveManifest } from "@/lib/archive/manifest";
import { buildCanonicalArchive } from "@/lib/archive/canonical";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-08T00:00:00.000Z",
  endsAt: "2026-08-09T00:00:00.000Z",
  archivedAt: "2026-08-09T00:00:00.000Z",
  finalizedAt: "2026-08-09T00:00:00.000Z",
  phase: "archived",
  serverNow: "2026-08-09T01:00:00.000Z",
  totalMessages: 1,
  totalReactions: 1,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
  editionNumber: 1,
};

const message: PublicMessage = {
  id: "m1",
  eventId: "local",
  publicNumber: 1,
  text: "A public sentence.",
  isRemoved: false,
  reactionCount: 1,
  publishedAt: "2026-08-08T12:00:00.000Z",
  finalRank: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("archive copies", () => {
  it("does not call a replica unless one is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const archive = buildCanonicalArchive({ event, messages: [message] });
    const published = await publishArchiveCopies({
      archive,
      manifest: buildArchiveManifest({ archive }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(published.copies.some((copy) => copy.kind === "site")).toBe(true);
  });

  it("records a public replica URI when the webhook returns one", async () => {
    vi.stubEnv("ARCHIVE_REPLICA_WEBHOOK_URL", "https://replica.example/intake");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ uri: "https://arweave.net/abc" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    const archive = buildCanonicalArchive({ event, messages: [message] });
    const published = await publishArchiveCopies({
      archive,
      manifest: buildArchiveManifest({ archive }),
    });
    expect(published.archiveUri).toBe("https://arweave.net/abc");
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).not.toMatch(
      /wallet|claimKey|ownershipHash|ipAddress|userId/i,
    );
  });
});
