import type { Metadata } from "next";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { getWallById } from "@/lib/server";
import { formatMessageNumber } from "@/lib/wall";

// Shared OpenGraph metadata for a single message. Used by /card/[id] and
// /message/[id] so a shared voice looks excellent everywhere it is pasted.
export async function messageMetadata(id: string): Promise<Metadata> {
  const { data: message } = await supabase
    .from("messages")
    .select("wall_id, content, message_number")
    .eq("id", id)
    .maybeSingle();
  if (!message) return { title: "The Wall — message not found" };

  const wall = await getWallById(message.wall_id);
  const number = formatMessageNumber(message.message_number);
  const title = `Message #${number} — The Wall`;
  const description = `"${message.content.slice(0, 120)}" · ${
    wall?.title ?? "The Wall"
  }`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const ogImage = `${base}/api/og/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${base}/message/${id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
