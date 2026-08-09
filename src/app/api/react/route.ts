import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { DEVICE_COOKIE, DEVICE_MAX_AGE, resolveDevice } from "@/lib/device";
import { POW_ZERO_BYTES } from "@/lib/pow";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE_RE = /^\d{1,10}$/;

// ---- Suspicious-activity detection (per-IP, in-memory) --------------------
// Resets on process restart, which is fine for this prototype. Layers:
//  - sliding window of reactions per IP per minute
//  - too many distinct device ids seen from a single IP (id-rotation bots)
const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_MINUTE = 60;
const IP_MAX_DISTINCT_DEVICES = 5;

const ipWindow = new Map<string, number[]>();
const ipDevices = new Map<string, Map<string, number>>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function prune(entries: number[], now: number, span: number) {
  const cutoff = now - span;
  let i = 0;
  while (i < entries.length && entries[i] <= cutoff) i++;
  if (i > 0) entries.splice(0, i);
}

function ipRateOk(ip: string, deviceId: string, now: number) {
  const window = ipWindow.get(ip) ?? [];
  prune(window, now, IP_WINDOW_MS);
  if (window.length >= IP_MAX_PER_MINUTE) return false;

  const devices = ipDevices.get(ip) ?? new Map<string, number>();
  for (const [id, last] of devices) {
    if (now - last > IP_WINDOW_MS) devices.delete(id);
  }
  if (!devices.has(deviceId) && devices.size >= IP_MAX_DISTINCT_DEVICES) {
    return false;
  }

  window.push(now);
  devices.set(deviceId, now);
  ipWindow.set(ip, window);
  ipDevices.set(ip, devices);
  return true;
}

function validProof(deviceId: string, messageId: string, proof: unknown) {
  if (typeof proof !== "string" && typeof proof !== "number") return false;
  const nonce = String(proof);
  if (!NONCE_RE.test(nonce)) return false;
  const digest = createHash("sha256")
    .update(`${deviceId}:${messageId}:${nonce}`)
    .digest();
  for (let i = 0; i < POW_ZERO_BYTES; i++) {
    if (digest[i] !== 0) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const messageId = body?.messageId;
  const proof = body?.proof;

  if (typeof messageId !== "string" || !UUID_RE.test(messageId)) {
    return Response.json({ error: "Missing message id." }, { status: 400 });
  }

  const store = await cookies();
  const { deviceId, created } = resolveDevice(
    store.get(DEVICE_COOKIE)?.value,
    body?.reactorId,
  );
  if (created) {
    store.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  if (!validProof(deviceId, messageId, proof)) {
    return Response.json({ error: "Proof of work failed." }, { status: 400 });
  }

  const now = Date.now();
  if (!ipRateOk(clientIp(req), deviceId, now)) {
    return Response.json(
      { error: "Slow down — you're clicking too fast." },
      { status: 429 },
    );
  }

  const { data: status, error } = await supabase.rpc("react", {
    mid: messageId,
    rid: deviceId,
  });
  if (error) {
    return Response.json({ error: "Failed to react." }, { status: 500 });
  }

  const { data: message } = await supabase
    .from("messages")
    .select("reactions")
    .eq("id", messageId)
    .single();
  const reactions = message?.reactions ?? 0;

  switch (status) {
    case "ok":
      return Response.json({ added: true, reactions });
    case "already":
      return Response.json({ added: false, reactions });
    case "rate_limited":
      return Response.json(
        { error: "Slow down — one too many in a row.", reactions },
        { status: 429 },
      );
    case "closed":
      return Response.json(
        { error: "The Wall is closed for reactions." },
        { status: 409 },
      );
    default:
      return Response.json({ error: "Failed to react." }, { status: 500 });
  }
}
