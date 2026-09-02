import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { publicIpLeak } from "@/lib/abuse/redact";
import { TURNSTILE_REQUIRED } from "@/lib/abuse/keys";
import {
  REACTION_VELOCITY,
  challengeReactionOrThrow,
  evaluateReactionIntegrity,
  listReactionSignals,
  observeReactionSuccess,
  publicReactionSubject,
  resetReactionIntegrity,
} from "@/lib/reactions/integrity";

const MESSAGE = "00000000-0000-4000-8000-000000000004";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function observe(input: {
  ipHash?: string;
  userId?: string;
  messageId?: string;
  newSession?: boolean;
  userAgent?: string;
  at?: number;
}) {
  observeReactionSuccess({
    ipHash: input.ipHash ?? "abc123def4567890",
    userId: input.userId ?? "user-1",
    messageId: input.messageId ?? MESSAGE,
    newSession: input.newSession ?? false,
    userAgent: input.userAgent ?? BROWSER,
    at: input.at,
  });
}

function decide(input: {
  ipHash?: string;
  userId?: string;
  messageId?: string;
  newSession?: boolean;
  userAgent?: string | null;
} = {}) {
  return evaluateReactionIntegrity({
    ipHash: input.ipHash ?? "abc123def4567890",
    userId: input.userId ?? "user-1",
    messageId: input.messageId ?? MESSAGE,
    newSession: input.newSession ?? false,
    userAgent: input.userAgent === undefined ? BROWSER : input.userAgent,
  });
}

afterEach(() => {
  resetReactionIntegrity();
});

describe("reaction integrity", () => {
  it("does not require Turnstile for a normal first 🔥", () => {
    expect(TURNSTILE_REQUIRED.react).toBe(false);
    const decision = decide();
    expect(decision.allow).toBe(true);
    expect(decision.challenge).toBe(false);
  });

  it("lets the first burst through, then escalates without dropping the write", () => {
    for (let i = 0; i < REACTION_VELOCITY.ipBurst.count; i += 1) {
      observe({ userId: `burst-${i}` });
    }
    const firstTwenty = decide({ userId: "burst-last" });
    expect(firstTwenty.allow).toBe(true);
    expect(firstTwenty.challenge).toBe(true);
    expect(firstTwenty.signals.some((row) => row.kind === "ip_burst")).toBe(true);

    expect(() =>
      challengeReactionOrThrow(
        {
          ipHash: "abc123def4567890",
          userId: "burst-last",
          messageId: MESSAGE,
          newSession: false,
          userAgent: BROWSER,
        },
        undefined,
      ),
    ).toThrow(AppError);

    try {
      challengeReactionOrThrow(
        {
          ipHash: "abc123def4567890",
          userId: "burst-last",
          messageId: MESSAGE,
          newSession: false,
          userAgent: BROWSER,
        },
        undefined,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.TURNSTILE);
    }

    const withToken = challengeReactionOrThrow(
      {
        ipHash: "abc123def4567890",
        userId: "burst-last",
        messageId: MESSAGE,
        newSession: false,
        userAgent: BROWSER,
      },
      "ok-token-ok-token-long",
    );
    expect(withToken.allow).toBe(true);
    expect(withToken.challenge).toBe(true);
  });

  it("escalates session farming after eight new sessions from one address", () => {
    for (let i = 0; i < REACTION_VELOCITY.sessionFarm.newUsers; i += 1) {
      observe({ userId: `farm-${i}`, newSession: true });
    }
    const ninth = decide({ userId: "farm-8", newSession: true });
    expect(ninth.allow).toBe(true);
    expect(ninth.challenge).toBe(true);
    expect(ninth.signals.some((row) => row.kind === "session_farm")).toBe(true);
  });

  it("asks scripted clients for a check and never shadow-bans", () => {
    const decision = decide({ userAgent: "curl/8.7.1" });
    expect(decision.allow).toBe(true);
    expect(decision.challenge).toBe(true);
    expect(decision.signals.some((row) => row.kind === "scripted_client")).toBe(true);
  });

  it("exposes hashed subjects only — no raw IPs or Wall Keys", () => {
    for (let i = 0; i < REACTION_VELOCITY.ipBurst.count; i += 1) {
      observe({ userId: `vis-${i}` });
    }
    try {
      challengeReactionOrThrow(
        {
          ipHash: "abc123def4567890",
          userId: "vis-last",
          messageId: MESSAGE,
          newSession: false,
          userAgent: "python-requests/2.32.0",
        },
        undefined,
      );
    } catch {
      // expected
    }
    const rows = listReactionSignals();
    expect(rows.length).toBeGreaterThan(0);
    expect(publicIpLeak(rows)).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/192\.168\.|10\.\d+\.|wall[_-]?key|wk_/i);
    expect(publicReactionSubject("addr", "abc123def4567890")).toBe("addr:abc123def456");
  });
});
