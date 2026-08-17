import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import { listSealedEditions } from "@/lib/data/editions";
import { loadEventSnapshot } from "@/lib/data/event";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production prerender without Supabase", () => {
  it("does not 503 during next build, and stays empty", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const event = await loadEventSnapshot("the-wall");
    expect(event.id).toBe("unconfigured");
    expect(event.totalMessages).toBe(0);
    expect(event.phase).toBe("upcoming");
    expect(await listSealedEditions()).toEqual([]);
  });

  it("still refuses the live site when production is unconfigured", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(loadEventSnapshot("the-wall")).rejects.toMatchObject({
      code: ERROR_CODES.CONFIG,
    });
    expect(await listSealedEditions()).toEqual([]);
  });
});
