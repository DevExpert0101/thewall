import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import CertificateCanvas from "@/components/CertificateCanvas";
import ShareButtons from "@/components/ShareButtons";
import Countdown from "@/components/Countdown";
import BackNav from "@/components/BackNav";
import { supabase } from "@/lib/supabase";
import { getWallById } from "@/lib/server";
import { isFrozen, formatMessageNumber, ordinal, wallEventDate } from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: message } = await supabase
    .from("messages")
    .select("id, wall_id, message_number, content, reactions, status")
    .eq("id", id)
    .maybeSingle();

  if (!message || message.status !== "live") notFound();

  const wall = await getWallById(message.wall_id);
  if (!wall) notFound();

  const { count: total } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .eq("wall_id", wall.id);

  // Performance rank: how many voices have more reactions (ties broken by
  // earlier entry). Dynamic until the Wall freezes.
  const { count: above } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .eq("wall_id", wall.id)
    .or(
      `and(reactions.gt.${message.reactions}),and(reactions.eq.${message.reactions},message_number.lt.${message.message_number})`,
    );
  const rank = (above ?? 0) + 1;
  const frozen = isFrozen(wall);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const qrUrl = `${proto}://${host}/artifact/${message.id}`;
  const shareUrl = `${proto}://${host}/certificate/${message.id}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-14">
      <BackNav />
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          Proof of presence
        </p>
        <h1 className="font-display text-5xl">Your certificate</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted">
          Voice #{formatMessageNumber(message.message_number)} — the{" "}
          {ordinal(message.message_number)} voice of {total?.toLocaleString("en-US") ?? 0}{" "}
          on {wall.title}. {frozen ? "The Wall is frozen — your rank is final." : "The Wall is still live — your rank keeps moving until it freezes."}
        </p>
        {!frozen && (
          <div className="mt-2">
            <Countdown endsAt={wall.ends_at} createdAt={wall.created_at} variant="compact" />
          </div>
        )}
      </header>

      <CertificateCanvas
        content={message.content}
        messageNumber={message.message_number}
        reactions={message.reactions}
        rank={rank}
        frozen={frozen}
        eventDate={wallEventDate(wall)}
        total={total ?? 0}
        certificateId={message.id.slice(0, 12)}
        qrUrl={qrUrl}
      />

      <ShareButtons
        url={shareUrl}
        title="Certificate · The Wall"
        text={`I'm voice #${formatMessageNumber(message.message_number)} — rank #${rank.toLocaleString("en-US")} on The Wall. Proof of presence, forever.`}
      />

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href={`/artifact/${message.id}`}
          className="rounded-full bg-gradient-to-r from-flame to-ember px-6 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
        >
          View archived message
        </Link>
        <Link
          href={`/card/${message.id}`}
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Share card
        </Link>
        <Link
          href="/"
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Back to The Wall
        </Link>
      </div>
    </main>
  );
}
