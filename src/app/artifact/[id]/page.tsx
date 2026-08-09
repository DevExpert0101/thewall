import Link from "next/link";
import { notFound } from "next/navigation";
import BackNav from "@/components/BackNav";
import { supabase } from "@/lib/supabase";
import { getWallById } from "@/lib/server";
import { isFrozen, formatCount, formatMessageNumber, ordinal } from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function ArchivedMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: message } = await supabase
    .from("messages")
    .select("id, wall_id, message_number, content, reactions, status, created_at")
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-14">
      <BackNav />
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The permanent record
        </p>
        <h1 className="font-display text-5xl">{wall.title}</h1>
        <p className="rounded-full border border-ember/50 bg-ember/10 px-5 py-2 font-mono text-xs tracking-widest text-ember glow-ember">
          ⛔ PERMANENT RECORD — {total?.toLocaleString("en-US") ?? 0} MESSAGES
        </p>
      </header>

      <article className="relative overflow-hidden rounded-2xl border border-edge bg-surface/70 p-7 text-center">
        <div className="pointer-events-none absolute -right-6 -top-6 text-[6rem] leading-none opacity-10 select-none">
          🔥
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Message #{formatMessageNumber(message.message_number)}
        </p>
        <p className="mt-5 break-words font-display text-2xl italic leading-snug text-cream sm:text-3xl">
          &ldquo;{message.content}&rdquo;
        </p>
        <p className="mt-6 font-mono text-3xl text-gold time-glow">
          {frozen ? "FINAL RANK" : "RANK"} <span className="text-ember">#{rank}</span>
        </p>
        <p className="mt-2 font-mono text-2xl text-gold">
          🔥 {formatCount(message.reactions)}
        </p>
        <p className="mt-3 text-xs uppercase tracking-widest text-muted">
          {ordinal(message.message_number)} voice of{" "}
          {total?.toLocaleString("en-US") ?? 0} voices
        </p>
        <p className="mt-8 text-[10px] uppercase tracking-[0.25em] text-muted">
          This message is permanent and cannot be edited or deleted.
        </p>
      </article>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href={`/certificate/${message.id}`}
          className="rounded-full bg-gradient-to-r from-flame to-ember px-6 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
        >
          Your certificate
        </Link>
        <Link
          href={`/card/${message.id}`}
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Share card
        </Link>
        <Link
          href="/artifact"
          className="rounded-full border border-edge px-5 py-2 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Full artifact
        </Link>
      </div>
    </main>
  );
}
