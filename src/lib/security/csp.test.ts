import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, serializeJsonLd } from "@/lib/security/csp";

describe("content security policy", () => {
  it("issues a nonce policy that forbids plugins and does not embed secrets", () => {
    const nonce = "test-nonce-value";
    const header = contentSecurityPolicy(nonce, false);
    expect(header).toContain("object-src 'none'");
    expect(header).toContain(`'nonce-${nonce}'`);
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).toContain("challenges.cloudflare.com");
    expect(header).not.toMatch(/SERVICE_ROLE|TURNSTILE_SECRET|eyJ/);
    expect(header).not.toContain("unsafe-eval");
    expect(header).toContain("style-src 'self' 'unsafe-inline'");
    expect(header).not.toMatch(/style-src [^;]*nonce/);
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy("n", true)).toContain("unsafe-eval");
    expect(contentSecurityPolicy("n", true)).toContain("unsafe-inline");
    expect(contentSecurityPolicy("n", true)).not.toContain("strict-dynamic");
  });
});

describe("JSON-LD serialization", () => {
  it("escapes script breakouts in serialized JSON", () => {
    const html = serializeJsonLd({
      name: "THE WALL",
      description: "</script><script>alert(1)</script>",
    });
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script\\u003e");
  });
});
