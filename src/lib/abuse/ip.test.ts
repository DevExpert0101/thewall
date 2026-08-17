import { describe, expect, it } from "vitest";
import {
  clientIpHash,
  clientIpHashForLimit,
  hashIp,
  looksLikeIp,
  publicIpLeak,
  readClientIp,
  redactSensitiveText,
} from "@/lib/abuse/ip";
import { rateLimitKey } from "@/lib/abuse/keys";
import { jsonError } from "@/lib/http";
import { AppError, ERROR_CODES, publicErrorPayload } from "@/lib/errors";

function requestWithIp(ip: string) {
  return new Request("http://localhost/api/session", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

describe("client IP handling", () => {
  it("hashes the connecting address and never equals the raw IP", () => {
    const ip = "203.0.113.44";
    const hashed = hashIp(ip);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain(ip);
    expect(looksLikeIp(hashed)).toBe(false);
  });

  it("uses only the first forwarded hop for hashing", () => {
    const request = requestWithIp("198.51.100.9");
    expect(readClientIp(request)).toBe("198.51.100.9");
    const hashed = clientIpHash(request);
    expect(hashed).toBe(hashIp("198.51.100.9"));
    expect(hashed).not.toContain("198.51.100.9");
  });

  it("builds rate-limit keys from the hash, not the raw IP", () => {
    const ip = "192.0.2.10";
    const key = rateLimitKey("intent", "ip", hashIp(ip));
    expect(key.startsWith("intent:ip:")).toBe(true);
    expect(key).not.toContain(ip);
  });

  it("redacts IPv4 and IPv6 from public text", () => {
    expect(redactSensitiveText("blocked 203.0.113.1 from list")).toBe(
      "blocked [redacted] from list",
    );
    expect(redactSensitiveText("from 2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toContain(
      "[redacted]",
    );
  });

  it("redacts Wall Keys and legacy ownership tokens from logs", () => {
    expect(redactSensitiveText("claim 7K9P-X4MF-82QH-K3R2 failed")).toBe(
      "claim [redacted] failed",
    );
    expect(redactSensitiveText(`token ${"a".repeat(64)} leaked`)).toBe("token [redacted] leaked");
    expect(redactSensitiveText("claim 7K9P-X4MF-82QH-K3R2 failed")).not.toContain("7K9P");
  });

  it("does not put raw IPs in JSON error payloads", async () => {
    const error = new AppError(
      ERROR_CODES.TURNSTILE,
      "Verification failed for 203.0.113.8",
    );
    const payload = publicErrorPayload(error);
    expect(payload.error).not.toContain("203.0.113.8");
    expect(publicIpLeak(payload)).toBe(false);

    const response = jsonError(error);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("203.0.113.8");
  });

  it("rate-limits missing client IPs under a shared unattributed bucket", () => {
    const request = new Request("http://localhost/api/session");
    const hashed = clientIpHashForLimit(request);
    expect(hashed).toBe(hashIp("unattributed"));
    expect(hashed).toHaveLength(64);
    expect(clientIpHash(request)).toBeNull();
  });
});
