import Link from "next/link";
import { notFound } from "next/navigation";
import BackNav from "@/components/BackNav";
import ArtifactArchive, { type ArtifactEntry } from "@/components/ArtifactArchive";
import FindYourMessage from "@/components/FindYourMessage";
import { getWallById, getLiveMessages } from "@/lib/server";
import {
  isFrozen,
  formatDuration,
  formatCount,
  wallEventDate,
  formatLongDate,
} from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function ArchiveWallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wall = await getWallById(id);
  if (!wall) notFound();

  const messages = await getLiveMessages(wall.id);
  const entries: ArtifactEntry[] = messages.map((m, i) => ({
    id: m.id,
    message_number: m.message_number,
    content: m.content,
    reactions: m.reactions,
    created_at: m.created_at,
    recentReactions: m.recentReactions ?? 0,
    distinctReactions: m.distinctReactions ?? 0,
    rank: i + 1,
  }));
  const totalReactions = messages.reduce((s, m) => s + m.reactions, 0);
  const durationLabel = formatDuration(wall.created_at, wall.ends_at);
  const eventDate = formatLongDate(wallEventDate(wall));
  const frozen = isFrozen(wall);

  if (!frozen) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-4 py-20 text-center">
        <BackNav />
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The permanent record
        </p>
        <h1 className="font-display text-5xl">{wall.title}</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          The Wall is still alive. Its record unlocks the moment it freezes.
        </p>
        <Link
          href="/"
          className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
        >
          Back to the live wall
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-14">
      <BackNav />

      <header className="flex flex-col items-center gap-5 text-center print:hidden">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The permanent record
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">{wall.title}</h1>
        <p className="font-display text-4xl text-gold time-glow sm:text-5xl">
          THE WALL IS CLOSED.
        </p>
        <p className="text-sm text-muted">The Wall will never change again.</p>
        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          <span>{eventDate}</span>
          <span className="text-edge">·</span>
          <span>{formatCount(entries.length)} messages</span>
          <span className="text-edge">·</span>
          <span>{formatCount(totalReactions)} reactions</span>
          <span className="text-edge">·</span>
          <span>{durationLabel}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <FindYourMessage
            label="Find your message"
            className="rounded-full border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
          />
          <Link
            href="/archive"
            className="rounded-full border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
          >
            All walls
          </Link>
        </div>
      </header>

      {entries.length > 0 ? (
        <ArtifactArchive
          wallTitle={wall.title}
          eventDate={eventDate}
          total={entries.length}
          totalReactions={totalReactions}
          durationLabel={durationLabel}
          endsAt={wall.ends_at}
          entries={entries}
        />
      ) : (
        <p className="py-24 text-center font-display text-3xl text-muted print:hidden">
          This Wall froze with no voices. History remembers silence.
        </p>
      )}
    </main>
  );
}
