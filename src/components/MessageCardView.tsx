import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import SharePanel from "@/components/SharePanel";
import ReportButton from "@/components/ReportButton";
import Countdown from "@/components/Countdown";
import BackNav from "@/components/BackNav";
import { supabase } from "@/lib/supabase";
import { getWallById } from "@/lib/server";
import { wallEventDate, isFrozen } from "@/lib/wall";

// A single voice, presented as a shareable card. Shared by /card/[id] and
// /message/[id] so both URLs render (and preview) identically.
export default async function MessageCardView({ id }: { id: string }) {
  const { data: message } = await supabase
    .from("messages")
    .select("id, wall_id, message_number, content, reactions, status")
    .eq("id", id)
    .maybeSingle();

  if (!message || message.status !== "live") notFound();

  const wall = await getWallById(message.wall_id);
  if (!wall) notFound();

  const frozen = isFrozen(wall);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${proto}://${host}/?v=${message.message_number}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-14">
      <BackNav />
      <header className="mb-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          A voice on the wall
        </p>
        {!frozen && (
          <div className="mt-3">
            <Countdown
              endsAt={wall.ends_at}
              createdAt={wall.created_at}
              variant="compact"
            />
          </div>
        )}
      </header>
      <SharePanel
        content={message.content}
        messageNumber={message.message_number}
        reactions={message.reactions}
        wallDate={wallEventDate(wall)}
        cardId={message.id.slice(0, 8)}
        url={shareUrl}
      />
      <div className="flex flex-wrap justify-center gap-3">
        <ReportButton
          messageId={message.id}
          messageNumber={message.message_number}
          content={message.content}
          variant="link"
        />
        <a
          href={`/certificate/${message.id}`}
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Get the full certificate
        </a>
        <Link
          href={`/?v=${message.message_number}`}
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          View on The Wall
        </Link>
      </div>
    </main>
  );
}
