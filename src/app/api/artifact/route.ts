import { getArtifactWall, getLiveMessages } from "@/lib/server";

export async function GET() {
  const record = await getArtifactWall();
  if (!record) {
    return Response.json(
      { error: "No completed Wall yet. The artifact unlocks when it freezes." },
      { status: 403 },
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

  return Response.json({
    wall: {
      title: record.title,
      created_at: record.created_at,
      ends_at: record.ends_at,
    },
    total: ranked.length,
    messages: ranked,
  });
}
