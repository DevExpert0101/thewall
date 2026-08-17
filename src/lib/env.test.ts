import { afterEach, describe, expect, it, vi } from "vitest";
import { envContract, getNetwork, getPublicEnv, isSimulation } from "@/lib/env";

describe("environment blanks", () => {
  it("treats empty and whitespace as missing", () => {
    expect(envContract.blankToUndefined("")).toBeUndefined();
    expect(envContract.blankToUndefined("  ")).toBeUndefined();
    expect(envContract.blankToUndefined("base")).toBe("base");
  });

  it("allows empty optional RPC URLs from .env.example", () => {
    const parsed = envContract.serverSchema.safeParse({
      BASE_RPC_URL: "",
      BASE_BUNDLER_URL: "",
      ARCHIVE_REPLICA_WEBHOOK_URL: "",
      ARCHIVE_PROOF_WEBHOOK_URL: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.BASE_RPC_URL).toBeUndefined();
    }
  });

  it("ignores an invalid treasury instead of failing the whole public env", () => {
    const parsed = envContract.publicSchema.safeParse({
      NEXT_PUBLIC_TREASURY_ADDRESS: "not-an-address",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_TREASURY_ADDRESS).toBeUndefined();
    }
  });

  it("accepts a host-only site URL", () => {
    const parsed = envContract.publicSchema.safeParse({
      NEXT_PUBLIC_SITE_URL: "thewall-pi.vercel.app",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_SITE_URL).toBe("https://thewall-pi.vercel.app");
    }
  });

  it("ignores an invalid public network instead of failing the whole public env", () => {
    const parsed = envContract.publicSchema.safeParse({
      NEXT_PUBLIC_BASE_NETWORK: "ethereum",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_BASE_NETWORK).toBe("base-sepolia");
    }
  });
});

describe("public env defaults", () => {
  it("defaults site URL and network without leaking server secrets", () => {
    const snapshot = {
      site: process.env.NEXT_PUBLIC_SITE_URL,
      network: process.env.NEXT_PUBLIC_BASE_NETWORK,
      serverNetwork: process.env.BASE_NETWORK,
    };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_BASE_NETWORK;
    delete process.env.BASE_NETWORK;
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_BASE_NETWORK).toBe("base-sepolia");
    expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(getNetwork()).toBe("base-sepolia");
    process.env.NEXT_PUBLIC_SITE_URL = snapshot.site;
    process.env.NEXT_PUBLIC_BASE_NETWORK = snapshot.network;
    process.env.BASE_NETWORK = snapshot.serverNetwork;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("simulation lock", () => {
  it("never mocks the Wall once Vercel production has Supabase", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "true");
    vi.stubEnv("SIMULATE_LIVE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(isSimulation()).toBe(false);
  });

  it("keeps the local Wall readable on Vercel when Supabase is not configured", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSimulation()).toBe(true);
  });
});
