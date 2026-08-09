import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getWall } from "@/lib/server";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Suspicious-activity signals, ranked by severity:
//   topReported  — the most-reported live messages (crowd signal)
//   stacking     — reactions stacking: high reaction velocity from very few
//                  distinct devices (from trend_scores recent window)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const wall = await getWall();
  if (!wall) {
    return Response.json({ error: "No wall found." }, { status: 500 });
  }

  const [{ data: reports }, { data: stacking }, { data: recent }] =
    await Promise.all([
      supabase
        .from("reports")
        .select("reason, message_id, messages(message_number, content, status, reactions)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.rpc("trend_scores", { wid: wall.id }),
      supabase
        .from("messages")
        .select("id, message_number, content, reactions, status")
        .eq("wall_id", wall.id)
        .eq("status", "live")
        .order("reactions", { ascending: false })
        .limit(200),
    ]);

  const reportCounts = new Map<
    string,
    { count: number; reasons: Set<string>; message: unknown }
  >();
  for (const r of (reports ?? []) as Array<{
    reason: string;
    message_id: string;
    messages: unknown;
  }>) {
    const entry = reportCounts.get(r.message_id) ?? {
      count: 0,
      reasons: new Set<string>(),
      message: r.messages,
    };
    entry.count++;
    entry.reasons.add(r.reason);
    reportCounts.set(r.message_id, entry);
  }

  const topReported = [...reportCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([messageId, e]) => ({
      messageId,
      count: e.count,
      reasons: [...e.reasons],
      message: e.message,
    }));

  const live = new Set(
    (recent ?? []).map((m: { id: string }) => m.id),
  );
  const scoreMap = new Map(
    ((stacking ?? []) as Array<{
      msg_id: string;
      recent_reactions: number;
      distinct_recent: number;
    }>).map((s) => [s.msg_id, s]),
  );

  // Stacking candidates: messages with recent reactions where the number of
  // distinct devices is a small fraction of the reaction count.
  const stackingList = [...scoreMap.entries()]
    .filter(([id, s]) => live.has(id) && s.recent_reactions >= 5)
    .map(([id, s]) => ({
      messageId: id,
      recentReactions: s.recent_reactions,
      distinctReactions: s.distinct_recent,
      ratio: s.distinct_recent / Math.max(s.recent_reactions, 1),
      message: (recent ?? []).find((m: { id: string }) => m.id === id) ?? null,
    }))
    .sort(
      (a, b) =>
        a.ratio - b.ratio || b.recentReactions - a.recentReactions,
    )
    .slice(0, 10);

  return Response.json({ topReported, stacking: stackingList });
}
