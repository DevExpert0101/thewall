import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/crypto";
import { getPublicEnv } from "@/lib/env";
import {
  LOCAL_ADMIN_COOKIE,
  LOCAL_ADMIN_EMAIL_DEFAULT,
  LOCAL_ADMIN_PASSWORD_DEFAULT,
  localAdminCredentialsMatch,
} from "@/lib/admin/local";
import { parseShareableUrl } from "@/lib/share/links";
import { serializeJsonLd } from "@/lib/security/csp";
import {
  adminEventSchema,
  composeSchema,
  reactSchema,
  verifyPaymentSchema,
  certificateQuerySchema,
} from "@/lib/validation";
import { publicMessageForPhase } from "@/lib/event/state";
import { payloadContainsSecret, stripSensitiveAdminFields } from "@/lib/admin/sanitize";
import type { PublicMessage } from "@/lib/types";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("suite 29 — OWASP staging controls", () => {
  it("strips mass-assignment and payment/rank tamper fields from public writes", () => {
    expect(
      composeSchema.parse({
        message: "Hello from staging.",
        turnstileToken: "1x00000000000000000000AA",
        finalRank: 1,
        reactionCount: 9999,
        paymentSuccessful: true,
        phase: "live",
        publicNumber: 1,
      }),
    ).toEqual({
      message: "Hello from staging.",
      turnstileToken: "1x00000000000000000000AA",
    });
    expect(
      reactSchema.parse({
        messageId: UUID,
        reactionCount: 500,
        userId: "attacker",
        now: "2099-01-01T00:00:00.000Z",
      }),
    ).toEqual({ messageId: UUID });
    expect(
      verifyPaymentSchema.parse({
        intentId: UUID,
        transactionHash: `0x${"ab".repeat(32)}`,
        paymentSuccessful: true,
        status: "completed",
        finalRank: 1,
      }),
    ).toEqual({
      intentId: UUID,
      transactionHash: `0x${"ab".repeat(32)}`,
    });
  });

  it("does not let __proto__ become an admin action", () => {
    const polluted = JSON.parse('{"__proto__":{"action":"reset"},"title":"x"}');
    const parsed = adminEventSchema.parse(polluted);
    expect(parsed.action).toBe("save");
    expect(parsed.title).toBe("x");
    expect(Object.prototype).not.toHaveProperty("action");
  });

  it("rejects off-site and admin URLs in oEmbed", () => {
    expect(parseShareableUrl("https://evil.example/message/1")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/api/admin/event")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/certificate/wk_secret")).toBeNull();
    expect(parseShareableUrl("http://localhost:3000/message/4")?.pathname).toBe("/message/4");
  });

  it("keeps stored XSS as text in JSON-LD and hides ranks until seal", () => {
    const html = serializeJsonLd({ name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    const message: PublicMessage = {
      id: UUID,
      eventId: "local",
      publicNumber: 4,
      text: "<img src=x onerror=alert(1)>",
      isRemoved: false,
      reactionCount: 9,
      publishedAt: "2026-08-16T12:00:00.000Z",
      finalRank: 1,
    };
    expect(publicMessageForPhase(message, "live").finalRank).toBeNull();
    expect(publicMessageForPhase(message, "finalizing").finalRank).toBeNull();
    expect(publicMessageForPhase(message, "archived").finalRank).toBe(1);
  });

  it("does not put secrets on the public env or admin strip list leftovers", () => {
    const pub = JSON.stringify(getPublicEnv());
    expect(pub).not.toMatch(/SERVICE_ROLE|sk_live_|TURNSTILE_SECRET|ADMIN_LOCAL_PASSWORD/i);
    expect(certificateQuerySchema.safeParse({ token: "abc" }).success).toBe(false);
    expect(
      payloadContainsSecret({
        token_hash: "aabb",
        anonymous_user_id: UUID,
      }),
    ).toBe(true);
    expect(stripSensitiveAdminFields({ token_hash: "aabb", publicNumber: 4 })).toEqual({
      publicNumber: 4,
    });
  });

  it("documents the staging local-admin cookie as a signed session, not an email hash", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/admin/local.ts"), "utf8");
    expect(src).toContain("signLocalAdminCookie");
    expect(src).not.toContain("jar.set(LOCAL_ADMIN_COOKIE, sha256Hex(localAdminEmail())");
    expect(LOCAL_ADMIN_COOKIE).toBe("thewall-admin-local");
    expect(localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, LOCAL_ADMIN_PASSWORD_DEFAULT)).toBe(
      true,
    );
    expect(sha256Hex(LOCAL_ADMIN_EMAIL_DEFAULT)).toHaveLength(64);
  });
});
