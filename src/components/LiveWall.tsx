"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/browser";
import type { MessageRow, WallRow } from "@/lib/wall";
import {
  formatCount,
  formatMessageNumber,
  timeAgo,
  trendScore,
  wallEventDate,
} from "@/lib/wall";
import { getDeviceId, solveProof } from "@/lib/wall-client";
import Countdown from "./Countdown";
import Finale from "./Finale";
import VoiceAvatar from "./VoiceAvatar";
import Race from "./Race";
import ReportButton from "./ReportButton";

// TRENDING: velocity-based — what is hot right now, not who posted first.
// The clock is passed in so that once the wall dies the reference freezes at
// ends_at: the final ranking is permanent, never decaying with real time.
const TREND_SORT = (now: number) => (a: MessageRow, b: MessageRow) =>
  trendScore(b, now) - trendScore(a, now) || a.message_number - b.message_number;

// LIVE: the newest voices first — the Wall as it happens.
const LIVE_SORT = (a: MessageRow, b: MessageRow) =>
  b.message_number - a.message_number;

type FeedMode = "live" | "trending" | "random";

const FEED_MODES: Array<{ id: FeedMode; label: string }> = [
  { id: "live", label: "● Live" },
  { id: "trending", label: "🔥 Trending" },
  { id: "random", label: "⚡ Random" },
];

// Deterministic shuffle: same seed, same order — so RANDOM is stable across
// renders and only changes when the user asks for another shuffle.
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

const PAGE_SIZE = 60;

interface LiveWallProps {
  wall: Pick<
    WallRow,
    "id" | "created_at" | "ends_at" | "frozen" | "title"
  >;
  initialMessages: MessageRow[];
  initialFrozen: boolean;
  /** Deep link target (?v=<message_number>) — scroll to and highlight it. */
  focusNumber?: number;
}

function useAnimatedCount(value: number, ms = 500) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function emberBurst(target: HTMLElement) {
  const host = target.parentElement;
  if (!host) return;
  const rect = target.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "pointer-events-none absolute rounded-full";
    const size = 3 + Math.random() * 4;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.background = Math.random() > 0.5 ? "#ffb066" : "#ff7a1a";
    s.style.boxShadow = "0 0 10px #ff7a1a";
    s.style.left = `${cx}px`;
    s.style.top = `${cy}px`;
    host.appendChild(s);
    const ang = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 52;
    s.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        {
          transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(0)`,
          opacity: 0,
        },
      ],
      { duration: 550 + Math.random() * 350, easing: "cubic-bezier(.2,.7,.4,1)" },
    ).onfinish = () => s.remove();
  }
}

interface CardProps {
  message: MessageRow;
  trending: boolean;
  frozen: boolean;
  reacting: boolean;
  reacted: boolean;
  mine: boolean;
  now: number;
  onReact: (id: string) => void;
}

function areEqual(prev: CardProps, next: CardProps) {
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.reactions !== next.message.reactions) return false;
  if (prev.message.status !== next.message.status) return false;
  if (prev.trending !== next.trending) return false;
  if (prev.frozen !== next.frozen) return false;
  if (prev.reacting !== next.reacting) return false;
  if (prev.reacted !== next.reacted) return false;
  if (prev.mine !== next.mine) return false;
  return Math.floor(prev.now / 60000) === Math.floor(next.now / 60000);
}

const MessageCard = memo(function MessageCardImpl({
  message,
  trending,
  frozen,
  reacting,
  reacted,
  mine,
  now,
  onReact,
}: CardProps) {
  const count = useAnimatedCount(message.reactions);

  return (
    <article
      data-id={message.id}
      className={`message-flicker group relative mb-5 break-inside-avoid rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300 ${
        mine
          ? "border-gold/60 bg-gradient-to-b from-gold/[0.12] to-card shadow-[inset_0_1px_0_rgba(255,210,138,0.22)] hover:border-gold"
          : trending
            ? "border-ember/50 bg-gradient-to-b from-ember/[0.12] to-card glow-pulse shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
            : "border-edge bg-card/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-ember/40 hover:glow-ember"
      }`}
    >
      {mine && (
        <div className="absolute -top-3 left-4 rounded-full border border-gold/60 bg-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-lg">
          ✦ Yours
        </div>
      )}
      {trending && (
        <div className="ribbon absolute -top-3 right-4 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-lg">
          🔥 Trending
        </div>
      )}

      <div className="flex items-center gap-3">
        <VoiceAvatar id={message.id} content={message.content} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-wide text-cream">
            Voice <span className="font-mono">#{formatMessageNumber(message.message_number)}</span>
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted">
            @anonymous · {timeAgo(message.created_at, now)}
          </p>
        </div>
      </div>

      <p
        className={`mt-3.5 break-words text-lg leading-snug sm:text-xl ${
          trending ? "font-display italic text-gold" : "text-cream/90"
        }`}
      >
        {message.content}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-edge/60 pt-3">
        <button
          onClick={(e) => {
            onReact(message.id);
            emberBurst(e.currentTarget);
          }}
          disabled={frozen || reacting || reacted}
          aria-label={`React to message ${message.message_number}`}
          aria-pressed={reacted}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${
            reacted
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-edge bg-background/60 text-foreground hover:border-ember hover:bg-ember/15 hover:text-gold"
          }`}
        >
          <span className={frozen || reacted ? "" : "flame-float"}>🔥</span>
          <span className="font-mono tabular-nums text-gold">
            {formatCount(count)}
          </span>
          {reacted && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
              · you
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <Link
            href={`/card/${message.id}`}
            className="group/share flex items-center gap-1.5 rounded-full border border-edge/70 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
          >
            Share
            <span className="transition-transform duration-200 group-hover/share:-translate-y-0.5 group-hover/share:translate-x-0.5">
              ↗
            </span>
          </Link>
          <ReportButton
            messageId={message.id}
            messageNumber={message.message_number}
            content={message.content}
          />
        </div>
      </div>
    </article>
  );
}, areEqual);

export default function LiveWall({
  wall,
  initialMessages,
  initialFrozen,
  focusNumber,
}: LiveWallProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [frozen, setFrozen] = useState(initialFrozen);
  const [finale, setFinale] = useState(false);
  const router = useRouter();
  const [reacting, setReacting] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [newVoices, setNewVoices] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const knownIds = useRef<Set<string>>(
    new Set(initialMessages.map((m) => m.id)),
  );

  const totalReactions = useMemo(
    () => messages.reduce((s, m) => s + m.reactions, 0),
    [messages],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
  }, []);

  const [myIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const list = JSON.parse(localStorage.getItem("wall-messages") ?? "[]");
      return new Set(
        (Array.isArray(list) ? list : [])
          .map((m) => m?.id)
          .filter((id): id is string => typeof id === "string"),
      );
    } catch {
      return new Set();
    }
  });
  const minePresent = useMemo(
    () => messages.filter((m) => myIds.has(m.id)),
    [messages, myIds],
  );
  const mineIndex = useRef(0);

  const findMine = () => {
    if (minePresent.length === 0) return;
    const target = minePresent[mineIndex.current % minePresent.length];
    mineIndex.current += 1;
    if (q) setQuery("");
    const idx = ordered.findIndex((m) => m.id === target.id);
    if (idx >= 0) setShown((s) => Math.max(s, idx + 1));
    const el = document.querySelector<HTMLElement>(`[data-id="${target.id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate(
      [
        { boxShadow: "0 0 0 0 rgba(255,210,138,0)" },
        {
          boxShadow:
            "0 0 0 6px rgba(255,210,138,0.55), 0 0 48px 14px rgba(255,122,26,0.35)",
        },
        { boxShadow: "0 0 0 0 rgba(255,210,138,0)" },
      ],
      { duration: 1600, easing: "ease-in-out" },
    );
  };

  const refresh = useCallback(async () => {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data = await res.json();
    const msgs = data.messages as MessageRow[];
    if (Array.isArray(data.reacted)) setReacted(new Set(data.reacted));
    knownIds.current = new Set(msgs.map((m) => m.id));
    setMessages((prev) => {
      if (prev.length !== msgs.length) return msgs;
      const map = new Map(msgs.map((m) => [m.id, m]));
      for (const m of prev) {
        const fresh = map.get(m.id);
        if (!fresh || fresh.reactions !== m.reactions || fresh.status !== m.status) {
          return msgs;
        }
      }
      return prev;
    });
  }, []);

  // Initial fetch on mount — also loads which messages this device reacted to.
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("wall-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.wall_id !== wall.id || row.status !== "live") return;
          if (!knownIds.current.has(row.id)) {
            knownIds.current.add(row.id);
            setNewVoices((n) => n + 1);
          }
          setMessages((ms) =>
            ms.some((m) => m.id === row.id)
              ? ms
              : [...ms, row].sort(TREND_SORT(Date.now())),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.wall_id !== wall.id) return;
          if (!knownIds.current.has(row.id) && row.status === "live") {
            knownIds.current.add(row.id);
            setNewVoices((n) => n + 1);
          }
          setMessages((ms) => {
            const existing = ms.find((m) => m.id === row.id);
            if (existing) {
              // Keep the velocity inputs from the last /api/messages fetch —
              // realtime UPDATE payloads only carry table columns.
              return ms
                .map((m) =>
                  m.id === row.id
                    ? {
                        ...row,
                        recentReactions: m.recentReactions,
                        distinctReactions: m.distinctReactions,
                      }
                    : m,
                )
                .sort(TREND_SORT(Date.now()));
            }
            if (row.status === "live") return [...ms, row].sort(TREND_SORT(Date.now()));
            return ms;
          });
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    const safety = setInterval(refresh, 60000);
    return () => {
      clearInterval(safety);
      supabaseBrowser.removeChannel(channel);
    };
  }, [wall.id, refresh]);

  const handleExpire = useCallback(() => {
    setFrozen(true);
    // The takeover plays once, only for a wall that froze in this session —
    // an already-frozen visitor gets the finale inline instead.
    if (!initialFrozen) setFinale(true);
    refresh();
  }, [initialFrozen, refresh]);

  const handleReact = useCallback(
    async (id: string) => {
      if (frozen || reacting.has(id) || reacted.has(id)) return;
      setReacting((prev) => new Set(prev).add(id));
      const snap = messages.find((m) => m.id === id);
      const previous = snap?.reactions;
      const prevRecent = snap?.recentReactions ?? 0;
      const prevDistinct = snap?.distinctReactions ?? 0;
      // Optimistic: bump the count AND the velocity inputs so the Race and
      // TRENDING re-rank immediately (the server reconciles on response).
      setMessages((ms) =>
        ms.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: m.reactions + 1,
                recentReactions: (m.recentReactions ?? 0) + 1,
                distinctReactions: (m.distinctReactions ?? 0) + 1,
              }
            : m,
        ),
      );
      const revertVelocity = (ms: MessageRow[], reactions: number | undefined) =>
        ms.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: reactions ?? previous ?? m.reactions,
                recentReactions: prevRecent,
                distinctReactions: prevDistinct,
              }
            : m,
        );
      try {
        const deviceId = await getDeviceId();
        const proof = await solveProof(deviceId, id);
        const res = await fetch("/api/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: id, proof }),
        });
        const data = await res.json();
        if (res.status === 429) {
          flashNotice("Whoa — one at a time. 🔥");
          setMessages((ms) => revertVelocity(ms, data.reactions));
          return;
        }
        if (data.added) {
          setMessages((ms) =>
            ms.map((m) =>
              m.id === id
                ? { ...m, reactions: data.reactions ?? m.reactions }
                : m,
            ),
          );
          setReacted((prev) => new Set(prev).add(id));
        } else if (data.added === false) {
          // Already reacted — nothing was counted, so undo the velocity bump.
          setMessages((ms) => revertVelocity(ms, data.reactions));
          setReacted((prev) => new Set(prev).add(id));
          flashNotice("You already flamed this one. 🔥");
        }
      } catch {
        setMessages((ms) => revertVelocity(ms, previous));
      } finally {
        setReacting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [frozen, reacting, reacted, messages, flashNotice],
  );

  const clearNewVoices = useCallback(() => {
    setNewVoices(0);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = new Map<string, DOMRect>();
    const moves: { el: HTMLElement; dx: number; dy: number }[] = [];
    for (const el of Array.from(container.children) as HTMLElement[]) {
      const id = el.dataset.id;
      if (!id) continue;
      const rect = el.getBoundingClientRect();
      next.set(id, rect);
      const prev = prevRects.current.get(id);
      if (prev) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        if (dx !== 0 || dy !== 0) moves.push({ el, dx, dy });
      }
    }
    for (const { el, dx, dy } of moves) {
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
    prevRects.current = next;
  }, [messages]);

  // Once frozen, stop the clock: the trend ranking is computed against the
  // wall's end so it can never drift again (the server does the same in
  // trend_scores()). While live, keep ranking on real time.
  const trendNow = frozen ? new Date(wall.ends_at).getTime() : now;
  const byTrending = [...messages].sort(TREND_SORT(trendNow));
  const topIds = new Set(byTrending.slice(0, 3).map((m) => m.id));
  const [mode, setMode] = useState<FeedMode>("live");
  const [randomSeed, setRandomSeed] = useState(0);
  const ordered =
    mode === "live"
      ? [...messages].sort(LIVE_SORT)
      : mode === "random"
        ? seededShuffle(messages, randomSeed)
        : byTrending;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? ordered.filter((m) => m.content.toLowerCase().includes(q))
    : [...ordered];
  const [shown, setShown] = useState(PAGE_SIZE);
  const list = matches.slice(0, shown);

  // Deep link (?v=<number>): on first paint, reveal the target if it sits past
  // the initial page window, then scroll to it and glow like Find my message.
  const focusDone = useRef(focusNumber == null);
  useEffect(() => {
    if (focusDone.current) return;
    focusDone.current = true;
    const target = messages.find((m) => m.message_number === focusNumber);
    if (!target) return;
    const targetId = target.id;
    const idx = ordered.findIndex((m) => m.id === targetId);
    const t1 = setTimeout(() => {
      if (idx >= 0) setShown((s) => Math.max(s, idx + 1));
    }, 80);
    const t2 = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-id="${targetId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate(
        [
          { boxShadow: "0 0 0 0 rgba(255,210,138,0)" },
          {
            boxShadow:
              "0 0 0 6px rgba(255,210,138,0.55), 0 0 48px 14px rgba(255,122,26,0.35)",
          },
          { boxShadow: "0 0 0 0 rgba(255,210,138,0)" },
        ],
        { duration: 1600, easing: "ease-in-out" },
      );
    }, 560);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // Runs once on mount with the initial feed; the focused message is always
    // part of the initial server payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goRandom = () => {
    setRandomSeed(Math.floor(Math.random() * 0xffffffff));
    setMode("random");
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Sticky status bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-edge/70 bg-background/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected && !frozen ? "bg-red-500 flame-float" : "bg-muted"
                }`}
              />
              {frozen ? "Frozen — final record" : "Live"}
            </span>
            <span className="hidden text-edge-strong sm:inline">·</span>
            <span className="hidden font-mono sm:inline">
              {formatCount(byTrending.length)} voices
            </span>
            <span className="hidden text-edge-strong md:inline">·</span>
            <span className="hidden font-mono text-gold md:inline">
              {formatCount(totalReactions)} 🔥
            </span>
          </div>
          <Countdown
            endsAt={wall.ends_at}
            createdAt={wall.created_at}
            onExpire={handleExpire}
          />
          <div className="flex items-center gap-2">
            {minePresent.length > 0 && (
              <button
                onClick={findMine}
                className="rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-sm text-gold transition hover:bg-gold/20 glow-ember"
              >
                ✦ Find my message
                {minePresent.length > 1 && (
                  <span className="ml-1 font-mono text-xs">
                    {minePresent.length}
                  </span>
                )}
              </button>
            )}
            {!frozen && (
              <Link
                href="/submit"
                className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 glow-ember"
              >
                Etch your message — $1
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Trending ticker */}
      {byTrending.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-edge bg-surface/80">
          <div className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-surface px-3 text-[10px] font-bold uppercase tracking-[0.25em] text-ember">
            🔥 Top
          </div>
          <div className="whitespace-nowrap py-2.5 pl-16 text-sm">
            <div className="inline-block animate-ticker">
              {[...byTrending.slice(0, 12), ...byTrending.slice(0, 12)].map((m, i) => (
                <span key={`${m.id}-${i}`} className="mx-6 text-muted">
                  <span className="font-mono text-ember">#{formatMessageNumber(m.message_number)}</span>
                  <span className="mx-2 text-edge-strong">·</span>
                  {m.content}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 The Race */}
      <Race
        leader={byTrending[0] ?? null}
        runnerUp={byTrending[1] ?? null}
        frozen={frozen}
        reacting={reacting}
        reacted={reacted}
        onReact={handleReact}
        onFocusWall={() =>
          containerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      />

      {/* Finale — the moment the wall closes */}
      {frozen && (
        <Finale
          eventDate={wallEventDate(wall)}
          voices={messages.length}
          reactions={totalReactions}
          live={finale}
          certHref={
            minePresent.length > 0
              ? `/certificate/${minePresent[0].id}`
              : "/artifact"
          }
          hasMine={minePresent.length > 0}
          onFindMine={() => {
            if (minePresent.length > 0) {
              findMine();
            } else {
              router.push("/artifact");
            }
          }}
          onExplore={() => {
            setFinale(false);
            containerRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        />
      )}

      {/* Feed mode switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="View modes"
          className="flex rounded-full border border-edge bg-background/60 p-1"
        >
          {FEED_MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => (m.id === "random" ? goRandom() : setMode(m.id))}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition sm:px-5 ${
                mode === m.id
                  ? "bg-gradient-to-r from-flame to-ember text-black glow-ember"
                  : "text-muted hover:text-gold"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === "random" && (
          <button
            onClick={goRandom}
            className="rounded-full border border-edge px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted transition hover:border-gold/50 hover:text-gold"
          >
            ↻ Shuffle again
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="relative w-full max-w-md">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the Wall — explore for free…"
            aria-label="Search messages"
            className="w-full rounded-full border border-edge bg-background/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-ember focus:outline-none"
          />
        </div>
        {q && (
          <p className="text-xs uppercase tracking-widest text-muted">
            {formatCount(matches.length)}{" "}
            {matches.length === 1 ? "match" : "matches"} ·{" "}
            <button
              onClick={() => setQuery("")}
              className="underline decoration-edge-strong underline-offset-2 hover:text-gold"
            >
              clear
            </button>
          </p>
        )}
      </div>

      {/* The wall */}
      <div
        ref={containerRef}
        className="columns-1 gap-5 sm:columns-2 lg:columns-3"
      >
        {list.map((m) => (
          <MessageCard
            key={m.id}
            message={m}
            trending={topIds.has(m.id) && !frozen}
            frozen={frozen}
            reacting={reacting.has(m.id)}
            reacted={reacted.has(m.id)}
            mine={myIds.has(m.id)}
            now={now}
            onReact={handleReact}
          />
        ))}
      </div>

      {shown < matches.length && (
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            onClick={() => setShown((s) => s + PAGE_SIZE)}
            className="rounded-full border border-edge px-8 py-3 text-sm font-semibold text-muted transition hover:border-ember hover:text-gold"
          >
            Load {Math.min(PAGE_SIZE, matches.length - shown)} more voices
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Showing {formatCount(shown)} of {formatCount(matches.length)}
          </p>
        </div>
      )}

      {messages.length > 0 && matches.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="font-display text-3xl text-muted">
            No voices match &ldquo;{query.trim()}&rdquo;.
          </p>
          <p className="max-w-sm text-sm text-muted">
            Try another word — or etch this phrase onto the Wall yourself.
          </p>
          {!frozen && (
            <Link
              href="/submit"
              className="mt-2 rounded-full bg-gradient-to-r from-flame to-ember px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
            >
              Etch your message — $1
            </Link>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="font-display text-3xl text-muted">
            The Wall is waiting.
          </p>
          <p className="max-w-sm text-sm text-muted">
            No voices yet. Be the first — etch something the world will
            remember.
          </p>
          {!frozen && (
            <Link
              href="/submit"
              className="mt-2 rounded-full bg-gradient-to-r from-flame to-ember px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
            >
              Etch the first message
            </Link>
          )}
        </div>
      )}

      {/* New voices pill */}
      {newVoices > 0 && (
        <button
          onClick={clearNewVoices}
          className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ember/50 bg-background/90 px-5 py-2.5 text-sm font-semibold text-gold shadow-[0_0_30px_rgba(255,122,26,0.35)] backdrop-blur-md transition hover:bg-ember/10"
        >
          <span className="flame-float">🔥</span>
          {formatCount(newVoices)} new voice{newVoices === 1 ? "" : "s"} on the
          wall
        </button>
      )}

      {/* Slow-down notice */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full border border-ember/50 bg-background/95 px-5 py-2.5 text-sm font-semibold text-gold shadow-[0_0_30px_rgba(255,122,26,0.35)] backdrop-blur-md">
          {notice}
        </div>
      )}
    </div>
  );
}
