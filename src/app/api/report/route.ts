import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REASONS = [
  "harassment",
  "personal_information",
  "illegal_content",
  "hate",
  "adult_content",
  "spam",
  "other",
] as const;

type ReportReason = (typeof REASONS)[number];

const DETAILS_MAX = 1000;
const IP_MAX_REPORTS_PER_MINUTE = 10;
const IP_WINDOW_MS = 60_000;

const ipWindow = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateOk(ip: string, now: number): boolean {
  const window = ipWindow.get(ip) ?? [];
  const cutoff = now - IP_WINDOW_MS;
  let i = 0;
  while (i < window.length && window[i] <= cutoff) i++;
  window.splice(0, i);
  if (window.length >= IP_MAX_REPORTS_PER_MINUTE) return false;
  window.push(now);
  ipWindow.set(ip, window);
  return true;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const messageId = body?.messageId;
  const reason = body?.reason;
  const details =
    typeof body?.details === "string" ? body.details.trim().slice(0, DETAILS_MAX) : "";

  if (typeof messageId !== "string" || !UUID_RE.test(messageId)) {
    return Response.json({ error: "Missing message id." }, { status: 400 });
  }
  if (typeof reason !== "string" || !(REASONS as readonly string[]).includes(reason)) {
    return Response.json({ error: "Missing or invalid reason." }, { status: 400 });
  }

  const now = Date.now();
  if (!rateOk(clientIp(req), now)) {
    return Response.json(
      { error: "Too many reports — slow down." },
      { status: 429 },
    );
  }

  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("id", messageId)
    .eq("status", "live")
    .maybeSingle();
  if (!message) {
    return Response.json({ error: "Message not found." }, { status: 404 });
  }

  // One open report per message per reporter: repeat reports are idempotent.
  const reporterHash = createHash("sha256")
    .update(`${clientIp(req)}:${messageId}`)
    .digest("hex");
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("message_id", messageId)
    .eq("reporter_hash", reporterHash)
    .eq("status", "open")
    .maybeSingle();
  if (!existing) {
    await supabase.from("reports").insert({
      message_id: messageId,
      reason: reason as ReportReason,
      details: details || null,
      reporter_hash: reporterHash,
    });
  }

  return Response.json({ ok: true });
}
