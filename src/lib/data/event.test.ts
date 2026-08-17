import { afterEach, describe, expect, it, vi } from "vitest";
import { listSealedEditions } from "@/lib/data/editions";
import { loadEventSnapshot } from "@/lib/data/event";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production without Supabase", () => {
  it("renders the local Wall instead of 503ing the homepage", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const event = await loadEventSnapshot("the-wall");
    expect(event.id).toBe("local");
    expect(event.totalMessages).toBeGreaterThan(0);
    expect(await listSealedEditions()).toEqual([]);
  });
});
