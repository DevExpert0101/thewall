import { describe, expect, it } from "vitest";
import { certificateFromPublic, publicCertificateImagePath, publicCertificatePath } from "@/lib/certificate/public";

describe("public certificate", () => {
  it("builds a shareable path that never includes a Wall Key", () => {
    expect(publicCertificatePath(4291)).toBe("/message/4291/certificate");
    expect(publicCertificateImagePath(4291, "print")).toBe(
      "/message/4291/certificate/image?ratio=print",
    );
    expect(publicCertificatePath(4291)).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
  });

  it("copies public facts only", () => {
    const payload = certificateFromPublic(
      {
        title: "THE WALL",
        startsAt: "2026-08-13T00:00:00.000Z",
        editionNumber: 1,
        totalMessages: 18,
        archiveHash: "abc",
        merkleRoot: "def",
        proofTx: null,
      },
      {
        publicNumber: 4291,
        text: "I hope we were trying.",
        reactionCount: 12,
        finalRank: 4,
        publishedAt: "2026-08-13T10:00:00.000Z",
      },
    );
    expect(payload.publicNumber).toBe(4291);
    expect(payload.reactionCount).toBe(12);
    expect(payload.finalRank).toBe(4);
    expect(payload.merkleRoot).toBe("def");
    expect(JSON.stringify(payload)).not.toMatch(/7K9P/);
  });
});
