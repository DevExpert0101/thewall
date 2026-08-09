import "server-only";
import { randomUUID } from "node:crypto";

// The device id is pinned to an httpOnly cookie so a visitor cannot read or
// rotate it from JS — clearing localStorage no longer resets their identity.
export const DEVICE_COOKIE = "wall-device";
export const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

const DEVICE_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export function validDeviceId(id: unknown): id is string {
  return typeof id === "string" && DEVICE_RE.test(id);
}

export function mintDeviceId(): string {
  return randomUUID();
}

// Resolve the authoritative device id for this request. The cookie wins;
// otherwise adopt the legacy localStorage reactor id (keeps a visitor's
// existing reactions counting) and finally mint a fresh id.
export function resolveDevice(
  cookie: string | undefined,
  legacy: unknown,
): { deviceId: string; created: boolean } {
  if (validDeviceId(cookie)) return { deviceId: cookie, created: false };
  if (validDeviceId(legacy)) return { deviceId: legacy, created: true };
  return { deviceId: mintDeviceId(), created: true };
}
