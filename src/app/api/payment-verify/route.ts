import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { explorerLink } from "@/lib/wall";

export async function GET(req: NextRequest) {
  const txHash = (req.nextUrl.searchParams.get("txHash") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(txHash)) {
    return Response.json(
      { error: "A transaction hash must be 64 hexadecimal characters." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, status, confirmations, tx_hash, coin, amount, address, confirmed_at, messages(id, content, message_number)",
    )
    .eq("tx_hash", txHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "No payment found with that transaction hash." },
      { status: 404 },
    );
  }

  const message = Array.isArray(data.messages) ? data.messages[0] : data.messages;

  return Response.json({
    verified: data.status === "confirmed",
    status: data.status,
    confirmations: data.confirmations,
    txHash: data.tx_hash,
    coin: data.coin,
    amount: data.amount,
    address: data.address,
    confirmedAt: data.confirmed_at,
    verifyLink: explorerLink(data.coin, data.tx_hash),
    message: message
      ? {
          id: message.id,
          number: message.message_number,
          content: message.content,
        }
      : null,
  });
}
