import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { explorerLink } from "@/lib/wall";

export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId) {
    return Response.json({ error: "Missing payment id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("payments")
    .select("id, status, confirming_at, tx_hash, coin, confirmations")
    .eq("id", paymentId)
    .single();
  if (error || !data) {
    return Response.json({ error: "Payment not found." }, { status: 404 });
  }

  const delaySec = parseInt(process.env.SIMULATED_CONFIRM_SECONDS ?? "6", 10);
  const verifyLink = explorerLink(data.coin, data.tx_hash);

  if (data.status === "confirming" && data.confirming_at) {
    const elapsed = (Date.now() - new Date(data.confirming_at).getTime()) / 1000;
    const confirmations = Math.min(
      Math.floor(elapsed) + 1,
      delaySec,
    );

    if (confirmations !== data.confirmations) {
      await supabase
        .from("payments")
        .update({ confirmations })
        .eq("id", paymentId);
    }

    if (elapsed >= delaySec) {
      const { error: rpcError } = await supabase.rpc("confirm_payment", {
        pid: paymentId,
        tx: data.tx_hash ?? null,
      });
      if (rpcError) {
        return Response.json({ error: rpcError.message }, { status: 500 });
      }
      const { data: after } = await supabase
        .from("payments")
        .select("status, tx_hash, coin, confirmations")
        .eq("id", paymentId)
        .single();
      return Response.json({
        status: after?.status ?? "confirming",
        txHash: after?.tx_hash ?? data.tx_hash,
        confirmations: after?.confirmations ?? delaySec,
        verifyLink: explorerLink(after?.coin ?? data.coin, after?.tx_hash ?? data.tx_hash),
      });
    }

    return Response.json({
      status: "confirming",
      txHash: data.tx_hash,
      confirmations,
      verifyLink,
    });
  }

  return Response.json({
    status: data.status,
    txHash: data.tx_hash,
    confirmations: data.confirmations ?? 0,
    verifyLink,
  });
}
