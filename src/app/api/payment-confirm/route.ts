import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomTxHash, explorerLink } from "@/lib/wall";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!rateLimit(`pay-confirm:${clientIp(req)}`, 10, 60_000)) {
    return tooManyRequests();
  }

  const body = await req.json().catch(() => null);
  const paymentId = body?.paymentId;
  const rawTx = body?.txHash;

  if (typeof paymentId !== "string" || !paymentId) {
    return Response.json({ error: "Missing payment id." }, { status: 400 });
  }

  const txHash =
    typeof rawTx === "string" && rawTx.trim().length > 0
      ? rawTx.trim()
      : randomTxHash();

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "confirming",
      confirming_at: new Date().toISOString(),
      tx_hash: txHash,
      confirmations: 0,
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("coin")
    .single();

  if (error || !data) {
    return Response.json({ error: "Payment not found." }, { status: 404 });
  }

  return Response.json({
    status: "confirming",
    txHash,
    verifyLink: explorerLink(data.coin, txHash),
  });
}
