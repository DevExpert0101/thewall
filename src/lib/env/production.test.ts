import { describe, expect, it } from "vitest";
import { TURNSTILE_DUMMY } from "@/lib/abuse/turnstile";
import {
  assertPaidSurfaceConfigured,
  assertProductionEnv,
  evaluateProductionEnv,
  isDummyTurnstile,
  isHostedDeploy,
  isNextProductionBuild,
  isVercelProduction,
} from "@/lib/env/production";
import { AppError } from "@/lib/errors";

const valid = {
  vercelEnv: "production",
  siteUrl: "https://thewall.example",
  supabaseUrl: "https://abc.supabase.co",
  anonKey: "anon-key-value",
  serviceRole: "service-role-key-value-20",
  turnstileSite: "live-site-key",
  turnstileSecret: "live-secret-key",
  publicNetwork: "base",
  serverNetwork: "base",
  publicTreasury: "0x1111111111111111111111111111111111111111",
  serverTreasury: "0x1111111111111111111111111111111111111111",
  simulateLive: "false",
  adminEmails: "ops@example.com",
};

describe("production environment contract", () => {
  it("accepts a complete live configuration", () => {
    expect(evaluateProductionEnv(valid)).toEqual([]);
    expect(isVercelProduction("production")).toBe(true);
    expect(isVercelProduction("preview")).toBe(false);
    expect(isNextProductionBuild("phase-production-build")).toBe(true);
    expect(isNextProductionBuild("phase-production-server")).toBe(false);
  });

  it("rejects localhost, dummy Turnstile, simulation, and the zero treasury", () => {
    const problems = evaluateProductionEnv({
      ...valid,
      siteUrl: "http://localhost:3000",
      turnstileSite: TURNSTILE_DUMMY.sitePass,
      turnstileSecret: TURNSTILE_DUMMY.secretPass,
      publicTreasury: "0x0000000000000000000000000000000000000000",
      simulateLive: "true",
      simulateArchive: "true",
      adminEmails: "",
    });
    expect(problems.length).toBeGreaterThan(3);
    expect(isDummyTurnstile(TURNSTILE_DUMMY.sitePass, TURNSTILE_DUMMY.secretPass)).toBe(true);
  });

  it("rejects a network mismatch", () => {
    const problems = evaluateProductionEnv({
      ...valid,
      publicNetwork: "base-sepolia",
      serverNetwork: "base",
    });
    expect(problems.some((item) => item.includes("must match"))).toBe(true);
  });

  it("does not throw when Vercel env is not production", () => {
    expect(() => assertProductionEnv({ ...process.env, VERCEL_ENV: "preview" })).not.toThrow();
  });

  it("throws in Vercel production when the contract fails", () => {
    expect(() =>
      assertProductionEnv({
        ...process.env,
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toThrow(AppError);
  });

  it("does not treat local next dev as a hosted deploy", () => {
    expect(
      isHostedDeploy({
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toBe(false);
    expect(
      isHostedDeploy({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toBe(false);
  });

  it("treats Vercel preview and a public production URL as hosted", () => {
    expect(isHostedDeploy({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(true);
    expect(
      isHostedDeploy({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://thewall.example",
      }),
    ).toBe(true);
  });

  it("blocks a $1 on a hosted deploy with a zero treasury", () => {
    expect(() =>
      assertPaidSurfaceConfigured({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_SITE_URL: "https://thewall.example",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value-20",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "live-site-key",
        TURNSTILE_SECRET_KEY: "live-secret-key",
        NEXT_PUBLIC_BASE_NETWORK: "base-sepolia",
        BASE_NETWORK: "base-sepolia",
        NEXT_PUBLIC_TREASURY_ADDRESS: "0x0000000000000000000000000000000000000000",
        NEXT_PUBLIC_SIMULATE_LIVE: "false",
        ADMIN_EMAILS: "ops@example.com",
      }),
    ).toThrow(AppError);
    expect(() =>
      assertPaidSurfaceConfigured({
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        NEXT_PUBLIC_TREASURY_ADDRESS: "0x0000000000000000000000000000000000000000",
        NEXT_PUBLIC_SIMULATE_LIVE: "true",
      }),
    ).not.toThrow();
  });
});
