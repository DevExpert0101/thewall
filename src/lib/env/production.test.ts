import { describe, expect, it } from "vitest";
import { TURNSTILE_DUMMY } from "@/lib/abuse/turnstile";
import {
  assertProductionEnv,
  evaluateProductionEnv,
  isDummyTurnstile,
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
});
