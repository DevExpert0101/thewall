import { describe, expect, it } from "vitest";
import {
  realtimeChannelName,
  realtimeEventFilter,
  WALL_READER_SUBSCRIBES_TO_POSTGRES,
} from "@/lib/wall/realtime";
import { hasSupabaseAuthCookie } from "@/lib/supabase/cookies";
import { capFeed } from "@/lib/wall/feed";
import { SEARCH_MIN_CHARS, SEARCH_RESULT_LIMIT, WALL_MAX_RENDERED, WALL_PAGE_SIZE } from "@/lib/wall/constants";
import { messagesQuerySchema, pulseQuerySchema } from "@/lib/validation";
import { BEAT_CACHE_CONTROL, cacheForPhase, pulseCacheControl, PULSE_CACHE_CONTROL } from "@/lib/data/event";
import type { PublicMessage } from "@/lib/types";

function msg(n: number): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n}`,
    isRemoved: false,
    reactionCount: 0,
    publishedAt: "2026-08-13T12:00:00.000Z",
    finalRank: null,
  };
}

describe("realtime subscription scope", () => {
  it("does not subscribe wall readers to postgres changes", () => {
    expect(WALL_READER_SUBSCRIBES_TO_POSTGRES).toBe(false);
    const eventId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    expect(realtimeEventFilter(eventId)).toBe(`event_id=eq.${eventId}`);
    expect(realtimeChannelName(eventId)).toBe(`wall-messages:${eventId}`);
  });
});

describe("anonymous read traffic", () => {
  it("does not treat cookie-less visitors as signed-in", () => {
    expect(hasSupabaseAuthCookie([])).toBe(false);
    expect(hasSupabaseAuthCookie([{ name: "theme" }])).toBe(false);
    expect(hasSupabaseAuthCookie([{ name: "sb-xxxx-auth-token" }])).toBe(true);
  });
});

describe("pulse query bounds", () => {
  it("drops non-uuid ids and caps the list", () => {
    const parsed = pulseQuerySchema.parse({
      ids: `${"not-a-uuid,".repeat(60)}00000000-0000-4000-8000-000000000001`,
      eventId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(parsed.ids).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });
});

describe("feed cap", () => {
  it("keeps appended pages under the render budget", () => {
    const page = Array.from({ length: WALL_MAX_RENDERED + 20 }, (_, i) => msg(i + 1));
    expect(capFeed(page).length).toBe(WALL_MAX_RENDERED);
  });
});

describe("viral read bounds", () => {
  it("defaults the messages API to one wall page", () => {
    expect(messagesQuerySchema.parse({}).limit).toBe(WALL_PAGE_SIZE);
    expect(SEARCH_MIN_CHARS).toBe(3);
    expect(SEARCH_RESULT_LIMIT).toBeLessThanOrEqual(24);
  });

  it("lets the shared CDN cache live event polls", () => {
    expect(cacheForPhase("live")).toContain("s-maxage=");
    expect(cacheForPhase("live")).not.toContain("no-store");
    expect(PULSE_CACHE_CONTROL).toContain("private");
    expect(pulseCacheControl(false)).toBe(BEAT_CACHE_CONTROL);
    expect(pulseCacheControl(true)).toBe(PULSE_CACHE_CONTROL);
    expect(BEAT_CACHE_CONTROL).toContain("public");
    expect(BEAT_CACHE_CONTROL).not.toContain("no-store");
  });
});
