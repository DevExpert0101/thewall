import { describe, expect, it } from "vitest";
import { classifyTestTarget, remoteTestBaseUrl } from "@/lib/testing/guard";

const baseUrl = remoteTestBaseUrl();

describe.skipIf(!baseUrl)("remote smoke (local or staging only)", () => {
  it("serves About and public APIs without private fields", async () => {
    expect(classifyTestTarget()).not.toBeUndefined();
    const origin = baseUrl as string;
    const about = await fetch(`${origin}/about`);
    expect(about.ok).toBe(true);
    const html = await about.text();
    expect(html).not.toMatch(/SERVICE_ROLE|sk_live_|eyJ[a-zA-Z0-9_-]{20,}\./);

    const event = await fetch(`${origin}/api/event`);
    expect(event.ok).toBe(true);
    const snapshot = await event.json();
    expect(snapshot).not.toHaveProperty("claimSecretHash");
    expect(JSON.stringify(snapshot)).not.toMatch(/wallKey|SERVICE_ROLE|token_hash/i);

    const monument = await fetch(`${origin}/api/monument`);
    expect(monument.ok).toBe(true);
    const catalog = await monument.json();
    expect(catalog).toHaveProperty("entries");
    expect(JSON.stringify(catalog)).not.toMatch(/claimSecretHash|wallKey|SERVICE_ROLE/i);
  });
});
