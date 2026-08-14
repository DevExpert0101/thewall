import { describe, expect, it } from "vitest";
import { shouldCreateAnonymousUser } from "@/lib/abuse/session-policy";
import { supabaseCookieOptions } from "@/lib/supabase/cookies";
import { TURNSTILE_REQUIRED } from "@/lib/abuse/keys";

describe("anonymous session creation", () => {
  it("creates a Supabase user only when no session exists", () => {
    expect(shouldCreateAnonymousUser(null)).toBe(true);
    expect(shouldCreateAnonymousUser(undefined)).toBe(true);
    expect(shouldCreateAnonymousUser("11111111-1111-1111-1111-111111111111")).toBe(
      false,
    );
  });

  it("does not require Turnstile to browse or react", () => {
    expect(TURNSTILE_REQUIRED.preflight).toBe(false);
    expect(TURNSTILE_REQUIRED.intent).toBe(true);
    expect(TURNSTILE_REQUIRED.verify).toBe(false);
  });

  it("persists server sessions as httpOnly SameSite=Lax cookies", () => {
    const options = supabaseCookieOptions("server");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.secure).toBe(process.env.NODE_ENV === "production");
  });
});
