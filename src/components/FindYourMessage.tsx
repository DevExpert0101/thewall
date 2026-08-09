"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMessageNumber } from "@/lib/wall";

interface SavedMessage {
  id: string;
  number: number;
  content: string;
  savedAt: string;
}

interface FindYourMessageProps {
  label?: string;
  className?: string;
}

// Voices are anonymous: there is no account and no login. The one thing this
// browser remembers is the ids of messages confirmed here, so that's what we
// can look up — plus a paste-a-link fallback for anyone with the share URL.
export default function FindYourMessage({
  label = "Find your message",
  className,
}: FindYourMessageProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedMessage[]>([]);
  const [query, setQuery] = useState("");
  const [badQuery, setBadQuery] = useState(false);

  const openPanel = () => {
    try {
      setSaved(JSON.parse(localStorage.getItem("wall-messages") ?? "[]"));
    } catch {
      setSaved([]);
    }
    setOpen(true);
  };

  const go = () => {
    const match = query.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (match) {
      router.push(`/card/${match[0].toLowerCase()}`);
      return;
    }
    setBadQuery(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className={className}
        aria-haspopup="dialog"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Find your message"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted">
                Your voices on the wall
              </p>
              <h2 className="mt-1 font-display text-2xl text-cream">
                Find your message
              </h2>
            </header>

            {saved.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {saved.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-edge/70 bg-surface/50 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs uppercase tracking-widest text-gold">
                        Voice #{formatMessageNumber(m.number)}
                      </p>
                      <p className="mt-1 truncate font-display text-sm italic text-cream/80">
                        “{m.content}”
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Link
                        href={`/card/${m.id}`}
                        className="rounded-full border border-edge px-3.5 py-1.5 text-xs text-muted transition hover:border-ember hover:text-gold"
                      >
                        Card
                      </Link>
                      <Link
                        href={`/certificate/${m.id}`}
                        className="rounded-full bg-gradient-to-r from-flame to-ember px-3.5 py-1.5 text-xs font-semibold text-black transition hover:brightness-110"
                      >
                        Certificate
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted">
                  No voices from this browser. The Wall is anonymous — there is
                  no account. If you etched from another device, paste your
                  share link here:
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    go();
                  }}
                  className="flex flex-col gap-2"
                >
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setBadQuery(false);
                    }}
                    placeholder="Paste your link — /card/xxxx-xxxx…"
                    className="w-full rounded-xl border border-edge bg-surface/70 px-4 py-3 font-mono text-sm text-cream placeholder:text-muted/50 outline-none transition focus:border-ember/60"
                  />
                  {badQuery && (
                    <p className="text-xs text-red-400">
                      That doesn&apos;t look like a valid link. Try the full
                      share URL from your confirmation.
                    </p>
                  )}
                  <button
                    type="submit"
                    className="rounded-full bg-gradient-to-r from-flame to-ember py-3 text-sm font-semibold text-black transition hover:brightness-110"
                  >
                    Open my message
                  </button>
                </form>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-full border border-edge py-2.5 text-sm text-muted transition hover:border-ember hover:text-gold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
