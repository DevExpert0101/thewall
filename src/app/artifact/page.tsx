import Link from "next/link";
import {
  getArtifactWall,
  getLiveMessages,
  getWall,
} from "@/lib/server";
import { formatDuration, isFrozen, formatCount, wallEventDate } from "@/lib/wall";
import ArtifactArchive, { type ArtifactEntry } from "@/components/ArtifactArchive";
import Countdown from "@/components/Countdown";
import BackNav from "@/components/BackNav";
import NewWallButton from "@/components/NewWallButton";
import FindYourMessage from "@/components/FindYourMessage";

export const dynamic = "force-dynamic";

export default async function ArtifactPage() {
  const current = await getWall();
  const record = await getArtifactWall();
  const messages = record ? await getLiveMessages(record.id) : [];
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
  const stillAlive =
    !record && current ? !isFrozen(current) : false;

  const title = record?.title ?? current?.title ?? "The Wall";
  const eventDate = record
    ? wallEventDate(record)
    : current
      ? wallEventDate(current)
      : "";
  const durationLabel = record
    ? formatDuration(record.created_at, record.ends_at)
    : current
      ? formatDuration(current.created_at, current.ends_at)
      : "24 hours";
  const totalReactions = messages.reduce((sum, m) => sum + m.reactions, 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-14">
      <BackNav />

      <header className="flex flex-col items-center gap-5 text-center print:hidden">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          The permanent record
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">{title}</h1>

        {stillAlive && current && (
          <div className="flex flex-col items-center gap-4">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              The Wall is still alive. The permanent record unlocks the moment
              it freezes.
            </p>
            <Countdown endsAt={current.ends_at} createdAt={current.created_at} />
          </div>
        )}

        {record && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-display text-4xl text-gold time-glow sm:text-5xl">
              THE WALL IS CLOSED.
            </p>
            <p className="text-sm text-muted">The Wall will never change again.</p>
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
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
              <FindYourMessage
                label="Download certificate"
                className="rounded-full border border-edge px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
              />
              <NewWallButton />
            </div>
          </div>
        )}
      </header>

      {record && entries.length > 0 && (
        <ArtifactArchive
          wallTitle={title}
          eventDate={eventDate}
          total={entries.length}
          totalReactions={totalReactions}
          durationLabel={durationLabel}
          endsAt={record.ends_at}
          entries={entries}
        />
      )}

      {record && entries.length === 0 && (
        <p className="py-24 text-center font-display text-3xl text-muted print:hidden">
          The Wall froze with no voices. History remembers silence.
        </p>
      )}

      {!record && !stillAlive && (
        <p className="py-24 text-center font-display text-3xl text-muted print:hidden">
          No completed Wall yet. History is being written right now.
        </p>
      )}

      <footer className="flex flex-wrap justify-center gap-3 print:hidden">
        <Link
          href="/archive"
          className="rounded-full border border-edge px-6 py-2.5 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          All walls
        </Link>
        <Link
          href="/"
          className="rounded-full border border-edge px-6 py-2.5 text-sm text-muted transition hover:border-ember hover:text-gold"
        >
          Back to The Wall
        </Link>
      </footer>
    </main>
  );
}
