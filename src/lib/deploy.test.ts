import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyPayments, classifyTurnstile } from "@/lib/health";
import { TURNSTILE_DUMMY } from "@/lib/abuse/turnstile";
import { buildErrorReport } from "@/lib/observability/report";
import { contentSecurityPolicy } from "@/lib/security/csp";
import robots from "@/app/robots";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { getNetwork } from "@/lib/env";

describe("health classifiers", () => {
  it("treats dummy Turnstile and the zero treasury as missing", () => {
    expect(classifyTurnstile(TURNSTILE_DUMMY.sitePass, TURNSTILE_DUMMY.secretPass)).toBe(
      "missing",
    );
    expect(classifyPayments("0x0000000000000000000000000000000000000000")).toBe("missing");
    expect(classifyPayments("0x1111111111111111111111111111111111111111")).toBe("ok");
  });
});

describe("error reports", () => {
  it("redacts IPs and does not include stack traces", () => {
    const report = buildErrorReport(new Error("failed for 203.0.113.9"), {
      path: "/wall",
      method: "GET",
    });
    expect(report.message).not.toContain("203.0.113.9");
    expect(JSON.stringify(report)).not.toMatch(/at /);
  });
});

describe("instrumentation", () => {
  it("fails closed at boot when Vercel production env is incomplete", () => {
    const src = readFileSync("src/instrumentation.ts", "utf8");
    expect(src).toContain("assertProductionEnv");
    expect(src).toContain("phase-production-build");
  });

  it("guards paid routes with the hosted production contract", () => {
    for (const file of [
      "src/app/api/publish/intent/route.ts",
      "src/app/api/publish/verify/route.ts",
      "src/app/api/react/route.ts",
    ]) {
      expect(readFileSync(file, "utf8")).toContain("assertPaidSurfaceConfigured");
    }
  });
});

describe("edge proxy matcher", () => {
  it("skips public read APIs and generated images so pulse traffic is not an Edge invoke", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toContain("api/");
    expect(src).toContain("opengraph-image");
    expect(src).toContain("twitter-image");
    expect(src).toContain("x-nonce");
  });
});

describe("twitter image route config", () => {
  it("declares runtime and revalidate in the twitter-image file so Next can see them", () => {
    const files = [
      "src/app/twitter-image.tsx",
      "src/app/open/twitter-image.tsx",
      "src/app/open/opengraph-image.tsx",
      "src/app/wall/twitter-image.tsx",
      "src/app/archive/twitter-image.tsx",
      "src/app/message/[number]/twitter-image.tsx",
      "src/app/monument/twitter-image.tsx",
      "src/app/monument/[number]/twitter-image.tsx",
      "src/app/archive/[edition]/[number]/twitter-image.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("export const runtime");
      expect(src).toContain("export const revalidate");
      expect(src).not.toMatch(/export \{[^}]*\bruntime\b/);
      expect(src).not.toMatch(/export \{[^}]*\brevalidate\b/);
    }
  });
});

describe("deploy surface", () => {
  it("allows Turnstile, Supabase, Base, Coinbase, and WalletConnect in CSP", () => {
    const header = contentSecurityPolicy("nonce", false);
    expect(header).toContain("challenges.cloudflare.com");
    expect(header).toContain("*.supabase.co");
    expect(header).toContain("*.coinbase.com");
    expect(header).toContain("*.walletconnect.com");
    expect(header).toContain("mainnet.base.org");
  });

  it("points robots at the sitemap and hides admin plus certificates", () => {
    const doc = robots();
    expect(doc.sitemap).toMatch(/sitemap\.xml$/);
    expect(doc.host).toBeTruthy();
    const rules = Array.isArray(doc.rules) ? doc.rules : [doc.rules];
    expect(JSON.stringify(rules)).toContain("/admin");
    expect(JSON.stringify(rules)).toContain("/certificate");
    expect(JSON.stringify(rules)).toContain("/claim");
  });
});

describe("network toggle", () => {
  it("rejects mismatched public and server networks", () => {
    const snapshot = {
      server: process.env.BASE_NETWORK,
      pub: process.env.NEXT_PUBLIC_BASE_NETWORK,
    };
    process.env.BASE_NETWORK = "base";
    process.env.NEXT_PUBLIC_BASE_NETWORK = "base-sepolia";
    try {
      expect(() => getNetwork()).toThrow(AppError);
      try {
        getNetwork();
      } catch (error) {
        expect((error as AppError).code).toBe(ERROR_CODES.CONFIG);
      }
    } finally {
      process.env.BASE_NETWORK = snapshot.server;
      process.env.NEXT_PUBLIC_BASE_NETWORK = snapshot.pub;
    }
  });
});
