"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FireButton } from "@/components/fire-button";
import { SharePanel } from "@/components/share-panel";
import { sharePayloadForMessage } from "@/lib/share/copy";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import {
  editionNumberOf,
  editionPath,
  formatMessageMark,
  formatObjectIdentity,
  formatWallEdition,
} from "@/lib/utils";
import {
  clearSeenNumbers,
  formatExclude,
  readSeenNumbers,
  SHOW_ANOTHER_HUMAN,
  writeSeenNumbers,
} from "@/lib/wall/random";

type Props = {
  event: EventSnapshot;
  initial?: PublicMessage[];
  variant?: "page" | "overlay";
  onClose?: () => void;
};

type RandomResponse = {
  messages?: PublicMessage[];
  remaining?: number;
  total?: number;
  recovery?: string;
  error?: string;
};

export function RandomMode({ event, initial = [], variant = "page", onClose }: Props) {
  const [current, setCurrent] = useState<PublicMessage | null>(initial[0] ?? null);
  const [prefetch, setPrefetch] = useState<PublicMessage | null>(initial[1] ?? null);
  const [seen, setSeen] = useState<number[]>(() => {
    const opened = initial.map((message) => message.publicNumber);
    return opened.length ? opened : readSeenNumbers(event.id);
  });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(event.totalMessages);
  const [loading, setLoading] = useState(initial.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [flip, setFlip] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const edition = editionNumberOf(event);
  const backHref = event.phase === "archived" ? editionPath(edition) : "/wall";

  const remember = useCallback(
    (numbers: number[]) => {
      const next = [...new Set([...seen, ...numbers])].slice(-48);
      setSeen(next);
      writeSeenNumbers(event.id, next);
      return next;
    },
    [event.id, seen],
  );

  const request = useCallback(
    async (exclude: number[], count: number) => {
      const params = new URLSearchParams({
        count: String(count),
      });
      const list = formatExclude(exclude);
      if (list) params.set("exclude", list);
      if (event.editionNumber || event.phase === "archived") {
        params.set("edition", String(edition));
      }
      const res = await fetch(`/api/messages/random?${params.toString()}`);
      const data = (await res.json()) as RandomResponse;
      if (!res.ok) {
        throw new Error(data.recovery ?? data.error ?? "The capsule could not be opened.");
      }
      return data;
    },
    [edition, event.editionNumber, event.phase],
  );

  const fill = useCallback(
    async (exclude: number[]) => {
      setLoading(true);
      setError(null);
      try {
        const data = await request(exclude, prefetch || current ? 1 : 2);
        const page = data.messages ?? [];
        if (page.length === 0) {
          if (exclude.length > 0) {
            clearSeenNumbers(event.id);
            setSeen([]);
            const fresh = await request([], 2);
            const first = fresh.messages?.[0] ?? null;
            setCurrent(first);
            setPrefetch(fresh.messages?.[1] ?? null);
            setRemaining(fresh.remaining ?? null);
            setTotal(fresh.total ?? 0);
            if (first) remember([first.publicNumber]);
            setFlip((n) => n + 1);
            return;
          }
          setCurrent(null);
          setPrefetch(null);
          setRemaining(0);
          setTotal(data.total ?? 0);
          return;
        }
        if (!current) {
          setCurrent(page[0] ?? null);
          setPrefetch(page[1] ?? null);
          if (page[0]) remember([page[0].publicNumber]);
          setFlip((n) => n + 1);
        } else {
          setPrefetch(page[0] ?? null);
        }
        setRemaining(data.remaining ?? null);
        setTotal(data.total ?? total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "The capsule could not be opened.");
      } finally {
        setLoading(false);
      }
    },
    [current, event.id, prefetch, remember, request, total],
  );

  useEffect(() => {
    const start = () => {
      if (current) {
        if (!prefetch) void fill(remember([current.publicNumber]));
        return;
      }
      void fill(seen);
    };
    queueMicrotask(start);
    // first open / missing prefetch only
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount
  }, []);

  const another = useCallback(() => {
    if (loading && !prefetch) return;
    if (prefetch) {
      const next = prefetch;
      const nextSeen = remember([next.publicNumber]);
      setCurrent(next);
      setPrefetch(null);
      setFlip((n) => n + 1);
      void fill(nextSeen);
      return;
    }
    void fill(seen);
  }, [fill, loading, prefetch, remember, seen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && onClose) {
        onClose();
        return;
      }
      if (event.key === " " || event.key === "ArrowRight") {
        event.preventDefault();
        another();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [another, onClose]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) && dx < 0) {
      another();
    }
  }

  const writable = event.phase === "live";
  const payload = current
    ? sharePayloadForMessage({ event, message: current })
    : null;

  const body = (
    <div
      className="random-mode"
      data-variant={variant}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="random-mode-bar">
        {variant === "overlay" && onClose ? (
          <button type="button" className="btn-ghost kicker" onClick={onClose}>
            Close
          </button>
        ) : (
          <Link href={backHref} className="kicker hover:text-paper">
            ← {event.phase === "archived" ? "Archive" : "The Wall"}
          </Link>
        )}
        <p className="kicker text-bronze">{formatWallEdition(edition)}</p>
      </div>

      {error ? (
        <div className="empty-monument" role="alert">
          <p className="font-display text-3xl">The capsule stuck.</p>
          <p className="lede mx-auto mt-4 max-w-md">{error}</p>
          <button type="button" className="btn btn-line mt-8" onClick={() => void fill(seen)}>
            Try again
          </button>
        </div>
      ) : null}

      {!error && !current && !loading ? (
        <div className="empty-monument">
          <p className="font-display text-3xl sm:text-4xl">
            {total === 0 ? "Blank stone." : "The capsule is empty."}
          </p>
          <p className="lede mx-auto mt-4 max-w-md">
            {total === 0
              ? "No one has left a sentence on this Wall yet."
              : "Every number on this Wall has been opened in this session."}
          </p>
        </div>
      ) : null}

      {current ? (
        <article key={`${current.id}-${flip}`} className="random-capsule">
          <p className={writable ? "kicker text-ember" : "kicker text-bronze"}>
            {writable ? "A sentence from the time capsule" : "A sealed inscription"}
          </p>
          <p className="mt-5 font-mono text-sm tracking-[0.18em] text-bronze">
            {formatObjectIdentity(current.publicNumber, edition)}
          </p>
          <span className="title-rule mt-5 block" aria-hidden="true" />
          <p
            className={`mt-8 font-display text-[clamp(2rem,7vw,4.4rem)] leading-[1.08] ${
              current.isRemoved ? "text-ash italic" : "text-paper"
            }`}
          >
            {current.isRemoved ? current.text : `“${current.text}”`}
          </p>
          <p className="mt-8 font-mono text-xs tracking-[0.2em] text-ash">
            {formatMessageMark(current.publicNumber)}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <FireButton
              messageId={current.id}
              count={current.reactionCount}
              readOnly={!writable}
              disabled={!writable || current.isRemoved}
              onReacted={(_, count) => {
                setCurrent((message) =>
                  message ? { ...message, reactionCount: count } : message,
                );
              }}
            />
            {payload ? <SharePanel payload={payload} via="random" compact /> : null}
          </div>
        </article>
      ) : loading ? (
        <div className="random-capsule random-capsule-wait" aria-busy="true">
          <p className="kicker">Opening a sentence…</p>
        </div>
      ) : null}

      <div className="random-mode-actions">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={another}
          disabled={loading && !prefetch}
        >
          {SHOW_ANOTHER_HUMAN}
        </button>
        {remaining !== null && total > 0 ? (
          <p className="mt-3 text-center font-mono text-[0.65rem] tracking-[0.16em] text-ash">
            {Math.max(0, remaining)} still unopened in this walk
          </p>
        ) : null}
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="random-mode-overlay" role="dialog" aria-modal="true" aria-label="Random sentence">
        {body}
      </div>
    );
  }

  return body;
}
