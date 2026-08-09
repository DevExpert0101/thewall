import { POW_ZERO_BYTES } from "./pow";

let cachedDeviceId: string | null = null;

// Get the server-issued anonymous device id. The server pins it to an
// httpOnly cookie (so the client can't rotate it); we cache the returned
// value locally to compute proof-of-work and to avoid a handshake per click.
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = localStorage.getItem("wall-device");
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  // Adopt the legacy reactor id if present so old reactions keep counting.
  const legacy = localStorage.getItem("wall-reactor-id") ?? "";
  const res = await fetch("/api/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reactorId: legacy }),
  });
  if (!res.ok) throw new Error("Could not register device");
  const { deviceId } = (await res.json()) as { deviceId: string };
  localStorage.setItem("wall-device", deviceId);
  cachedDeviceId = deviceId;
  return deviceId;
}

// Client-side proof-of-work: find the nonce such that the first POW_ZERO_BYTES
// bytes of sha256(deviceId:messageId:nonce) are zero. A few dozen ms of
// compute — invisible to humans, a real cost for scripted bots.
export async function solveProof(
  deviceId: string,
  messageId: string,
): Promise<number> {
  const enc = new TextEncoder();
  const base = `${deviceId}:${messageId}:`;
  let nonce = 0;
  for (;;) {
    const d = await crypto.subtle.digest("SHA-256", enc.encode(base + nonce));
    const bytes = new Uint8Array(d);
    let ok = true;
    for (let i = 0; i < POW_ZERO_BYTES; i++) {
      if (bytes[i] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) return nonce;
    nonce++;
  }
}
