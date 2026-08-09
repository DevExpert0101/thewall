import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { getWallById } from "@/lib/server";
import { formatMessageNumber, wallEventDate } from "@/lib/wall";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Social preview card for a single message: dark, monumental, the voice
// front and center. Referenced by openGraph.images on message pages.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data: message } = await supabase
    .from("messages")
    .select("wall_id, content, message_number, reactions")
    .eq("id", id)
    .maybeSingle();
  if (!message) return new Response("Not found", { status: 404 });

  const wall = await getWallById(message.wall_id);
  const eventDate = wall
    ? new Date(wallEventDate(wall))
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
        .toUpperCase()
    : "";
  const text = message.content.slice(0, 140);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: "#0c0704",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 26,
              letterSpacing: 12,
              color: "#8a7a63",
              textTransform: "uppercase",
            }}
          >
            The Wall — {eventDate}
          </div>
          <div
            style={{
              marginTop: 44,
              fontSize: 54,
              fontStyle: "italic",
              color: "#ffd28a",
              maxWidth: 1000,
              lineHeight: 1.25,
              display: "flex",
            }}
          >
            “{text}”
          </div>
          <div
            style={{
              marginTop: 44,
              fontSize: 30,
              color: "#f5ead2",
              display: "flex",
            }}
          >
            Voice #{formatMessageNumber(message.message_number)} · one dollar ·
            one message · forever
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 28,
              color: "#ff9a4d",
              display: "flex",
            }}
          >
            🔥 {message.reactions}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
