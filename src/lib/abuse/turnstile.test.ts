import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import { TURNSTILE_DUMMY, verifyTurnstileToken } from "@/lib/abuse/turnstile";

describe("Turnstile server verification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed when the secret is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstileToken("token-token-token")).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
    });
  });

  it("rejects a missing or short token without calling Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_DUMMY.secretPass);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyTurnstileToken("")).rejects.toMatchObject({
      code: ERROR_CODES.TURNSTILE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a successful siteverify response", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_DUMMY.secretPass);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    await expect(
      verifyTurnstileToken(
        "ok-token-ok-token",
        new Request("http://localhost/api/publish/intent", {
          headers: { "x-forwarded-for": "203.0.113.20" },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("maps a failed or blocked siteverify to TURNSTILE without leaking error codes", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_DUMMY.secretFail);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response", "remoteip 203.0.113.20"],
        }),
      }),
    );
    try {
      await verifyTurnstileToken("bad-token-bad-token");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: ERROR_CODES.TURNSTILE });
      expect(String(error)).not.toContain("203.0.113.20");
      expect(String(error)).not.toContain("invalid-input-response");
    }
  });

  it("treats a network timeout as a failed check", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_DUMMY.secretPass);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(verifyTurnstileToken("ok-token-ok-token")).rejects.toMatchObject({
      code: ERROR_CODES.TURNSTILE,
      status: 502,
    });
  });
});
