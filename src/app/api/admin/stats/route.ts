import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getWall } from "@/lib/server";
import { isFrozen } from "@/lib/wall";
import { isAuthorized, unauthorized } from "@/lib/admin";

// The admin dashboard headline metrics. Revenue is $1 per paid message.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const wall = await getWall();
  if (!wall) {
    return Response.json({ error: "No wall found." }, { status: 500 });
  }

  const sealed = isFrozen(wall);
  const { data: stats, error } = await supabase.rpc("admin_stats", {
    wid: wall.id,
  });
  if (error || !stats) {
    return Response.json({ error: "Failed to read stats." }, { status: 500 });
  }

  const s = stats as {
    total_messages: number;
    live_messages: number;
    total_reactions: number;
    messages_5m: number;
    reactions_5m: number;
    active_users: number;
    total_devices: number;
  };

  const messages = s.total_messages;
  const timeRemainingMs = Math.max(
    0,
    new Date(wall.ends_at).getTime() - Date.now(),
  );

  return Response.json({
    wall: {
      title: wall.title,
      status: sealed ? "sealed" : wall.accepting === false ? "paused" : "live",
      accepting: wall.accepting !== false && !sealed,
      frozen: sealed,
      ends_at: wall.ends_at,
      created_at: wall.created_at,
      timeRemainingMs,
    },
    counts: {
      messages,
      liveMessages: s.live_messages,
      reactions: s.total_reactions,
      revenue: messages, // $1 per message
      activeUsers: s.active_users,
      totalDevices: s.total_devices,
    },
    rates: {
      messagesPerMin: s.messages_5m / 5,
      reactionsPerMin: s.reactions_5m / 5,
    },
  });
}
