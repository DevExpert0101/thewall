import { describe, expect, it } from "vitest";
import {
  buildAdminHealth,
  looksLikeSecret,
  payloadContainsSecret,
  presentSecret,
  stripSensitiveAdminFields,
  truncateWallet,
} from "@/lib/admin/sanitize";

describe("admin payload hygiene", () => {
  it("never serializes secret material — only configured or missing", () => {
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig";
    expect(looksLikeSecret(key)).toBe(true);
    expect(presentSecret(key)).toBe("configured");
    const health = buildAdminHealth({
      supabase: true,
      serviceRole: key,
      payments: "0x0000000000000000000000000000000000000001",
      turnstileSecret: "1x0000000000000000000000000000000AA",
      turnstileSiteKey: "1x00000000000000000000AA",
      network: "base-sepolia",
      eventStatus: "live",
    });
    expect(JSON.stringify(health)).not.toContain(key);
    expect(JSON.stringify(health)).not.toContain("eyJ");
    expect(health.privilegedDb).toBe("configured");
    expect(payloadContainsSecret(health)).toBe(false);
  });

  it("strips ownership and reporter identifiers from admin rows", () => {
    const clean = stripSensitiveAdminFields({
      id: "m1",
      text: "hello",
      token_hash: "aaa",
      anonymous_user_id: "u1",
      reporter_user_id: "u2",
      message_hash: "bbb",
    });
    expect(clean).toEqual({ id: "m1", text: "hello" });
    expect(payloadContainsSecret({ token_hash: "abc", text: "hi" })).toBe(true);
  });

  it("truncates wallets for payment lookup", () => {
    expect(truncateWallet("0x00000000000000000000000000000000000000bb")).toBe("0x0000…00bb");
  });
});
