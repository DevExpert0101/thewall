import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getArtifactWall, getLiveMessages } from "@/lib/server";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Generate the final archive: the sealed wall's permanent record as a
// downloadable snapshot (wall + every live voice, ranked).
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const record = await getArtifactWall();
  if (!record) {
    return Response.json(
      { error: "No completed Wall yet. The archive unlocks when it freezes." },
      { status: 409 },
    );
  }

  const messages = await getLiveMessages(record.id);
  const ranked = messages.map((m, i) => ({
    id: m.id,
    message_number: m.message_number,
    content: m.content,
    reactions: m.reactions,
    created_at: m.created_at,
    rank: i + 1,
  }));

  return new Response(
    JSON.stringify(
      {
        archived_at: new Date().toISOString(),
        wall: {
          id: record.id,
          title: record.title,
          created_at: record.created_at,
          ends_at: record.ends_at,
        },
        total: ranked.length,
        messages: ranked,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wall-final-archive.json"',
      },
    },
  );
}
