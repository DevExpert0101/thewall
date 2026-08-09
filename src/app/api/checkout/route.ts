import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getWall } from "@/lib/server";
import { isOpen } from "@/lib/wall";
import { runModeration, moderationMessage } from "@/lib/moderation";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const AMOUNT_USD = 1;

export async function POST(req: NextRequest) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 5, 60_000)) {
    return tooManyRequests();
  }

  const body = await req.json().catch(() => null);
  const content =
    typeof body?.content === "string" ? body.content.trim() : "";

  if (content.length < 1 || content.length > 140) {
    return Response.json(
      { error: "Messages must be between 1 and 140 characters." },
      { status: 400 },
    );
  }

  const moderation = await runModeration(content);
  if (!moderation.approved) {
    return Response.json(
      { error: moderationMessage(moderation.reasons), reasons: moderation.reasons },
      { status: 400 },
    );
  }

  const wall = await getWall();
  if (!wall) {
    return Response.json({ error: "No wall found." }, { status: 500 });
  }
  if (!isOpen(wall)) {
    return Response.json(
      {
        error: wall.accepting === false
          ? "Submissions are paused. The Wall will be back soon."
          : "The Wall has frozen. No new messages can be added.",
      },
      { status: 403 },
    );
  }

  const coin = process.env.COIN ?? "BTC";
  const price = parseFloat(process.env.COIN_PRICE_USD ?? "60000");
  const amount = (AMOUNT_USD / Math.max(price, 1)).toFixed(8);
  const address =
    process.env.DEMO_ADDRESS ??
    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

  const { data: message, error: mErr } = await supabase
    .from("messages")
    .insert({ wall_id: wall.id, content, moderation_status: "approved" })
    .select("id, message_number, content")
    .single();
  if (mErr || !message) {
    return Response.json(
      { error: "Failed to start your message." },
      { status: 500 },
    );
  }

  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .insert({
      message_id: message.id,
      address,
      amount,
      coin,
    })
    .select("id, address, amount, coin")
    .single();
  if (pErr || !payment) {
    await supabase.from("messages").delete().eq("id", message.id);
    return Response.json({ error: "Failed to start payment." }, { status: 500 });
  }

  return Response.json({
    paymentId: payment.id,
    messageId: message.id,
    messageNumber: message.message_number,
    content,
    address: payment.address,
    amount: payment.amount,
    coin: payment.coin,
    qr: `${payment.coin.toLowerCase()}:${payment.address}?amount=${payment.amount}`,
  });
}
