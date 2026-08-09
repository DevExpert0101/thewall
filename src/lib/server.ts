import "server-only";
import { supabase } from "./supabase";
import type { MessageRow, WallRow } from "./wall";

const WALL_FIELDS = "id, title, created_at, ends_at, frozen, accepting";
const MESSAGE_FIELDS =
  "id, wall_id, message_number, content, reactions, status, created_at";

export async function getWall(): Promise<WallRow | null> {
  const { data, error } = await supabase
    .from("walls")
    .select(WALL_FIELDS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as WallRow;
}

export async function getWallById(id: string): Promise<WallRow | null> {
  const { data, error } = await supabase
    .from("walls")
    .select(WALL_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as WallRow;
}

// The most recent wall that has completed: frozen, or whose clock ran out.
// This is the permanent record for the last finished event.
export async function getArtifactWall(): Promise<WallRow | null> {
  const now = Date.now();
  const { data, error } = await supabase
    .from("walls")
    .select(WALL_FIELDS)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return null;
  const record = (data as WallRow[]).find(
    (w) => w.frozen || new Date(w.ends_at).getTime() <= now,
  );
  return record ?? null;
}

export interface WallSummary {
  id: string;
  title: string;
  created_at: string;
  ends_at: string;
  frozen: boolean;
  total_messages: number;
  total_reactions: number;
}

// Every wall, newest first, with message/reaction rollups — the archive index.
export async function getWallSummaries(): Promise<WallSummary[]> {
  const { data, error } = await supabase.rpc("wall_summaries", {
    limit_count: 200,
  });
  if (error || !data) return [];
  return data as WallSummary[];
}

export async function getLiveMessages(
  wallId?: string,
): Promise<MessageRow[]> {
  const wall = wallId ?? (await getWall())?.id;
  if (!wall) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("status", "live")
    .eq("wall_id", wall)
    .order("reactions", { ascending: false })
    .order("message_number", { ascending: true })
    .limit(1000);
  if (error || !data) return [];

  // Attach recent-reaction velocity inputs so the client can rank TRENDING.
  const { data: scores } = await supabase.rpc("trend_scores", { wid: wall });
  const scoreMap = new Map<
    string,
    { recent_reactions: number; distinct_recent: number }
  >(
    ((scores ?? []) as Array<{
      msg_id: string;
      recent_reactions: number;
      distinct_recent: number;
    }>).map((s) => [s.msg_id, s]),
  );

  return (data as MessageRow[]).map((m) => {
    const s = scoreMap.get(m.id);
    return s
      ? {
          ...m,
          recentReactions: s.recent_reactions,
          distinctReactions: s.distinct_recent,
        }
      : m;
  });
}
