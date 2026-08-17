import { redactOwnershipSecrets } from "@/lib/ownership/wall-key";

const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV4_IN_TEXT =
  /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g;
const IPV6_IN_TEXT = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;

export function looksLikeIp(value: string): boolean {
  const trimmed = value.trim();
  if (IPV4.test(trimmed)) return true;
  if (trimmed.includes(":") && /^[0-9a-f:]+$/i.test(trimmed) && trimmed.split(":").length >= 3) {
    return true;
  }
  return false;
}

function redactIps(value: string): string {
  return value.replace(IPV4_IN_TEXT, "[redacted]").replace(IPV6_IN_TEXT, "[redacted]");
}

export function redactSensitiveText(value: string): string {
  return redactOwnershipSecrets(redactIps(value));
}

export function publicIpLeak(value: unknown): boolean {
  if (typeof value === "string") {
    return looksLikeIp(value) || redactIps(value) !== value;
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
      if (key.toLowerCase().includes("ip") && typeof entry === "string" && entry.length > 0) {
        return true;
      }
      return publicIpLeak(entry);
    });
  }
  return false;
}
