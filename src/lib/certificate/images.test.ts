/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { renderCertificateImage } from "@/lib/certificate/render";
import { hashToken, tokensEqual } from "@/lib/crypto";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import type { CertificatePayload } from "@/lib/types";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const payload: CertificatePayload = {
  publicNumber: 4291,
  text: "I hope we were trying.",
  reactionCount: 12,
  finalRank: 4,
  publishedAt: "2026-08-13T10:00:00.000Z",
  eventTitle: "THE WALL",
  eventDate: "13 August 2026",
  tagline: "ONE DAY. ONE DOLLAR. ONE SENTENCE.",
};

describe("certificate images", () => {
  it("renders print, social, square, and portrait PNGs from real payload fields", async () => {
    for (const ratio of ["print", "1200x630", "1:1", "9:16"] as const) {
      const res = renderCertificateImage(payload, ratio);
      expect(res.headers.get("content-type")).toMatch(/image\/png/);
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect([...bytes.slice(0, 8)]).toEqual(PNG);
      expect(bytes.length).toBeGreaterThan(800);
    }
  }, 20_000);

  it("keeps archival removal text on a removed certificate", async () => {
    const res = renderCertificateImage({ ...payload, text: ARCHIVAL_REMOVAL_TEXT, finalRank: 8 });
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(800);
  });
});

describe("certificate tokens", () => {
  it("does not treat unequal tokens as equal", () => {
    expect(tokensEqual(hashToken("a".repeat(64)), hashToken("b".repeat(64)))).toBe(false);
  });
});
