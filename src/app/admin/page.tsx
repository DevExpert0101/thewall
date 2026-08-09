"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Countdown from "@/components/Countdown";
import { formatMessageNumber, timeAgo } from "@/lib/wall";

const TOKEN_KEY = "wall-admin-token";
const REFRESH_MS = 30_000;

type WallStatus = "live" | "paused" | "sealed";

type Stats = {
  wall: {
    title: string;
    status: WallStatus;
    accepting: boolean;
    frozen: boolean;
    ends_at: string;
    created_at: string;
    timeRemainingMs: number;
  };
  counts: {
    messages: number;
    liveMessages: number;
    reactions: number;
    revenue: number;
    activeUsers: number;
    totalDevices: number;
  };
  rates: { messagesPerMin: number; reactionsPerMin: number };
};

type Report = {
  id: string;
  message_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  messages: {
    id: string;
    message_number: number;
    content: string;
    status: string;
    removed_at: string | null;
  } | null;
};

type RemovedMessage = {
  id: string;
  message_number: number;
  content: string;
  reactions: number;
  removed_at: string | null;
  removed_reason: string | null;
};

type SearchMessage = {
  id: string;
  message_number: number;
  content: string;
  reactions: number;
  status: string;
  moderation_status: string;
  created_at: string;
  removed_at: string | null;
  removed_reason: string | null;
};

type PaymentRow = {
  id: string;
  status: string;
  coin: string;
  amount: string;
  confirmations: number;
  created_at: string;
  confirmed_at: string | null;
  messages: { message_number: number; content: string } | null;
};

type Suspicious = {
  topReported: Array<{
    messageId: string;
    count: number;
    reasons: string[];
    message: { message_number: number; content: string; status: string } | null;
  }>;
  stacking: Array<{
    messageId: string;
    recentReactions: number;
    distinctReactions: number;
    ratio: number;
    message: { message_number: number; content: string; reactions: number } | null;
  }>;
};

const REASON_LABELS: Record<string, string> = {
  harassment: "Harassment",
  personal_information: "Personal information",
  illegal_content: "Illegal content",
  hate: "Hate",
  adult_content: "Adult content",
  spam: "Spam",
  other: "Other",
};

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) ?? ""}`,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// ---- small building blocks --------------------------------------------------

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "gold" | "ember" | "muted";
}) {
  const color =
    accent === "gold"
      ? "text-gold"
      : accent === "ember"
        ? "text-ember"
        : "text-cream";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-edge bg-card/40 p-4">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
        {label}
      </span>
      <span className={`font-mono text-2xl font-semibold leading-none tabular-nums ${color}`}>
        {value}
      </span>
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </div>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-edge bg-card/20 p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl italic text-gold">{title}</h2>
        {badge && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function RemoveButton({
  messageId,
  onDone,
  busy,
}: {
  messageId: string;
  onDone: () => void;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!reason.trim() || removing) return;
    setRemoving(true);
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        messageId,
        action: "remove",
        reason: reason.trim(),
      }),
    });
    setRemoving(false);
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.location.reload();
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Failed.");
      return;
    }
    setConfirming(false);
    setReason("");
    onDone();
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="shrink-0 rounded-full bg-red-500/90 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && remove()}
        placeholder="Reason (required, audited)"
        maxLength={500}
        autoFocus
        className="w-64 rounded-lg border border-edge bg-surface/60 px-3 py-1.5 text-xs text-cream placeholder:text-muted/60 focus:border-red-400 focus:outline-none"
      />
      {error && <p className="text-[10px] text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={remove}
          disabled={!reason.trim() || removing}
          className="rounded-full bg-red-500/90 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {removing ? "Removing…" : "Confirm"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setReason("");
          }}
          className="rounded-full border border-edge px-3.5 py-1.5 text-xs text-muted transition hover:text-cream"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<WallStatus, { label: string; cls: string }> = {
  live: { label: "● LIVE", cls: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" },
  paused: { label: "◐ PAUSED", cls: "border-amber-400/60 bg-amber-400/10 text-amber-300" },
  sealed: { label: "■ SEALED", cls: "border-muted/60 bg-surface text-muted" },
};

// ---- dashboard --------------------------------------------------------------

export default function AdminPage() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem(TOKEN_KEY) ?? ""),
  );
  const [unlocked, setUnlocked] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(TOKEN_KEY) !== null,
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [removed, setRemoved] = useState<RemovedMessage[]>([]);
  const [suspicious, setSuspicious] = useState<Suspicious>({
    topReported: [],
    stacking: [],
  });
  const [payments, setPayments] = useState<{
    counts: Array<{ status: string; count: number }>;
    recent: PaymentRow[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats", { headers: authHeaders() });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setUnlocked(false);
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as Stats;
      setStats(data);
    }
  }, []);

  const loadPanels = useCallback(async () => {
    const [r, m, s, p] = await Promise.all([
      fetch("/api/admin/reports", { headers: authHeaders() }),
      fetch("/api/admin/messages", { headers: authHeaders() }),
      fetch("/api/admin/suspicious", { headers: authHeaders() }),
      fetch("/api/admin/payments", { headers: authHeaders() }),
    ]);
    if ([r, m, s, p].some((x) => x.status === 401)) {
      sessionStorage.removeItem(TOKEN_KEY);
      setUnlocked(false);
      return;
    }
    if (![r, m, s, p].every((x) => x.ok)) {
      setError("Failed to load some panels.");
      return;
    }
    setReports(((await r.json()) as { reports: Report[] }).reports);
    setRemoved(((await m.json()) as { messages: RemovedMessage[] }).messages);
    setSuspicious((await s.json()) as Suspicious);
    setPayments((await p.json()) as typeof payments);
    setError(null);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadStats(), loadPanels()]);
  }, [loadStats, loadPanels]);

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    (async () => {
      await Promise.all([loadStats(), loadPanels()]);
      if (!alive) return;
      setError(null);
    })();
    return () => {
      alive = false;
    };
  }, [unlocked, loadStats, loadPanels]);

  // Live headline numbers; panels refresh after actions.
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => {
      void loadStats();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [unlocked, loadStats]);

  const unlock = () => {
    if (!token.trim()) return;
    sessionStorage.setItem(TOKEN_KEY, token.trim());
    setUnlocked(true);
  };

  const postAction = async (
    path: string,
    body: unknown,
  ): Promise<boolean> => {
    const res = await fetch(path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.location.reload();
      return false;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Action failed.");
      return false;
    }
    return true;
  };

  const togglePause = async () => {
    if (!stats) return;
    setBusy(true);
    const action = stats.wall.accepting ? "pause" : "resume";
    const ok = await postAction("/api/admin/wall", { action });
    setBusy(false);
    if (ok) {
      setConfirmFreeze(false);
      await loadAll();
    }
  };

  const freeze = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await postAction("/api/admin/wall", { action: "freeze" });
    setBusy(false);
    if (ok) {
      setConfirmFreeze(false);
      await loadAll();
    }
  };

  const dismissReport = async (reportId: string) => {
    setBusy(true);
    const ok = await postAction("/api/admin/reports", { reportId, action: "dismiss" });
    setBusy(false);
    if (ok) await loadPanels();
  };

  const restore = async (messageId: string) => {
    setBusy(true);
    const ok = await postAction("/api/admin/messages", { messageId, action: "restore" });
    setBusy(false);
    if (ok) await loadAll();
  };

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    });
    setSearching(false);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (res.ok) {
      setResults(((await res.json()) as { messages: SearchMessage[] }).messages);
    }
  };

  const openReports = reports.filter((r) => r.status === "open");

  if (!unlocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-14">
        <header className="text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
            Restricted
          </p>
          <h1 className="font-display text-5xl sm:text-6xl">THE WALL ADMIN</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Live event control and moderation console.
          </p>
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="Moderator token"
            autoFocus
            className="rounded-full border border-edge bg-surface/60 px-5 py-3 text-center font-mono text-sm text-cream placeholder:text-muted/60 focus:border-ember focus:outline-none"
          />
          <button
            onClick={unlock}
            className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
          >
            Unlock console
          </button>
        </div>
      </main>
    );
  }

  const badge = STATUS_BADGE[stats?.wall.status ?? "live"];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      {/* Masthead */}
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          Restricted · {stats?.wall.title ?? "The Wall"}
        </p>
        <div className="flex items-center gap-4">
          <h1 className="font-display text-4xl sm:text-5xl">THE WALL ADMIN</h1>
          <span
            className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold tracking-widest ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        {stats && (
          <Countdown
            endsAt={stats.wall.ends_at}
            createdAt={stats.wall.created_at}
            variant="compact"
          />
        )}
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Headline metrics */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Messages" value={fmt(stats.counts.messages)} />
          <StatCard label="Reactions" value={fmt(stats.counts.reactions)} />
          <StatCard
            label="Revenue"
            value={`$${fmt(stats.counts.revenue)}`}
            hint="$1 per message"
            accent="ember"
          />
          <StatCard label="Active users" value={fmt(stats.counts.activeUsers)} hint="last 30 min" />
          <StatCard
            label="Messages/min"
            value={stats.rates.messagesPerMin.toFixed(1)}
            hint="5-min average"
          />
          <StatCard
            label="Reactions/min"
            value={stats.rates.reactionsPerMin.toFixed(1)}
            hint="5-min average"
          />
        </div>
      )}

      {/* Event controls */}
      <Panel title="Event controls">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={togglePause}
            disabled={busy || stats?.wall.status === "sealed"}
            className="rounded-full border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs font-semibold text-amber-300 transition hover:brightness-110 disabled:opacity-50"
          >
            {stats?.wall.accepting ? "Pause submissions" : "Resume submissions"}
          </button>
          {stats?.wall.status === "sealed" ? (
            <span className="text-xs text-muted">The Wall is sealed. No further changes to submissions.</span>
          ) : confirmFreeze ? (
            <>
              <span className="text-xs text-red-300">
                Freeze the Wall now? This is final.
              </span>
              <button
                onClick={freeze}
                disabled={busy}
                className="rounded-full bg-red-500/90 px-5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                {busy ? "Freezing…" : "Yes, end the event"}
              </button>
              <button
                onClick={() => setConfirmFreeze(false)}
                className="rounded-full border border-edge px-5 py-2 text-xs text-muted transition hover:text-cream"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmFreeze(true)}
              disabled={busy}
              className="rounded-full border border-red-400/60 px-5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
            >
              End event manually
            </button>
          )}
        </div>
      </Panel>

      {/* Search */}
      <Panel title="Search messages">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search content across live, pending and removed…"
            className="flex-1 rounded-lg border border-edge bg-surface/60 px-4 py-2.5 text-sm text-cream placeholder:text-muted/60 focus:border-ember focus:outline-none"
          />
          <button
            onClick={search}
            disabled={searching || !query.trim()}
            className="rounded-lg bg-gradient-to-r from-flame to-ember px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs">
                    <span className="text-ember">
                      #{formatMessageNumber(m.message_number)}
                    </span>
                    <span className="ml-2 text-muted">
                      {m.status}
                      {m.status === "removed" && m.removed_reason
                        ? ` · ${m.removed_reason}`
                        : ""}
                    </span>
                    <span className="ml-2 text-gold">🔥 {m.reactions}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm text-cream/85">
                    “{m.content}”
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.status !== "removed" && (
                    <RemoveButton
                      messageId={m.id}
                      busy={busy}
                      onDone={() => void loadAll()}
                    />
                  )}
                  <Link
                    href={`/card/${m.id}`}
                    target="_blank"
                    className="rounded-full border border-edge px-3 py-1.5 text-xs text-muted transition hover:text-gold"
                  >
                    View ↗
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {searching && (
          <p className="text-xs text-muted">Searching…</p>
        )}
      </Panel>

      {/* Review reports */}
      <Panel title="Review reports" badge={`${openReports.length} open`}>
        {openReports.length === 0 && (
          <p className="rounded-xl border border-edge bg-card/40 px-5 py-4 text-sm text-muted">
            Nothing to review. The Wall is clean.
          </p>
        )}
        {openReports.map((r) => (
          <article
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-edge bg-card/40 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ember">
                  #{formatMessageNumber(r.messages?.message_number ?? 0)}
                  {r.messages?.status === "removed" && (
                    <span className="ml-2 text-red-300">removed</span>
                  )}
                </p>
                <p className="mt-1 line-clamp-3 break-words font-display text-lg italic text-cream">
                  “{r.messages?.content ?? "message gone"}”
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-ember/50 bg-ember/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ember">
                {REASON_LABELS[r.reason] ?? r.reason}
              </span>
            </div>
            <p className="text-xs text-muted">
              Reported {timeAgo(r.created_at)}
              {r.details ? ` · ${r.details}` : ""}
            </p>
            <div className="flex items-center justify-between gap-2">
              <RemoveButton
                messageId={r.message_id}
                busy={busy}
                onDone={() => void loadPanels()}
              />
              <button
                onClick={() => dismissReport(r.id)}
                disabled={busy}
                className="rounded-full border border-edge px-3.5 py-1.5 text-xs text-muted transition hover:text-cream disabled:opacity-50"
              >
                Dismiss report
              </button>
            </div>
          </article>
        ))}
      </Panel>

      {/* Suspicious activity */}
      <Panel title="Suspicious activity">
        {suspicious.topReported.length === 0 &&
          suspicious.stacking.length === 0 && (
            <p className="rounded-xl border border-edge bg-card/40 px-5 py-4 text-sm text-muted">
              No suspicious signals right now.
            </p>
          )}
        {suspicious.topReported.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
              Most reported voices
            </p>
            {suspicious.topReported.map((s) => (
              <div
                key={s.messageId}
                className="flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-red-300">
                    #{formatMessageNumber(s.message?.message_number ?? 0)} · {s.count}{" "}
                    report{s.count === 1 ? "" : "s"} ·{" "}
                    {s.reasons.map((x) => REASON_LABELS[x] ?? x).join(", ")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm text-cream/85">
                    “{s.message?.content ?? "message gone"}”
                  </p>
                </div>
                {s.message?.status !== "removed" && (
                  <RemoveButton
                    messageId={s.messageId}
                    busy={busy}
                    onDone={() => void loadAll()}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {suspicious.stacking.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
              Reaction stacking (few devices, many 🔥)
            </p>
            {suspicious.stacking.map((s) => (
              <div
                key={s.messageId}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-amber-300">
                    #{formatMessageNumber(s.message?.message_number ?? 0)} ·{" "}
                    {s.recentReactions} 🔥 from {s.distinctReactions} devices in
                    30m
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm text-cream/85">
                    “{s.message?.content ?? ""}”
                  </p>
                </div>
                <RemoveButton
                  messageId={s.messageId}
                  busy={busy}
                  onDone={() => void loadAll()}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Payment status */}
      <Panel title="Payment status">
        {payments && (
          <div className="flex flex-wrap gap-3">
            {["pending", "confirming", "confirmed"].map((s) => {
              const c = payments.counts.find((x) => x.status === s);
              return (
                <div
                  key={s}
                  className="rounded-xl border border-edge bg-card/40 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    {s}
                  </p>
                  <p className="font-mono text-xl text-cream">
                    {fmt(c?.count ?? 0)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {payments && payments.recent.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
              Recent
            </p>
            {payments.recent.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-edge/50 py-2 text-xs"
              >
                <span className="truncate font-mono text-cream/80">
                  #{formatMessageNumber(p.messages?.message_number ?? 0)} ·{" "}
                  {p.messages?.content.slice(0, 48) ?? "—"}
                </span>
                <span className="shrink-0 text-muted">
                  {p.coin} {p.amount} · {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Traffic */}
      <Panel title="Traffic">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active users" value={fmt(stats?.counts.activeUsers ?? 0)} accent="gold" />
          <StatCard label="All-time devices" value={fmt(stats?.counts.totalDevices ?? 0)} />
          <StatCard label="Messages/min" value={(stats?.rates.messagesPerMin ?? 0).toFixed(1)} />
          <StatCard label="Reactions/min" value={(stats?.rates.reactionsPerMin ?? 0).toFixed(1)} />
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Traffic is derived from anonymous reaction activity (one device = one
          id, pinned server-side). No accounts, no tracking pixels.
        </p>
      </Panel>

      {/* Removed record */}
      <Panel title="Removed from the record" badge={`${removed.length} on record`}>
        {removed.length === 0 && (
          <p className="rounded-xl border border-edge bg-card/40 px-5 py-4 text-sm text-muted">
            No removals on record.
          </p>
        )}
        {removed.map((m) => (
          <article
            key={m.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-400/20 bg-card/40 p-5"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-red-300">
                #{formatMessageNumber(m.message_number)} · removed{" "}
                {m.removed_at ? timeAgo(m.removed_at) : ""}
              </p>
              <p className="mt-1 line-clamp-3 break-words font-display text-lg italic text-cream/70 line-through decoration-red-400/50">
                “{m.content}”
              </p>
              <p className="mt-1 text-xs text-muted">
                Reason: {m.removed_reason ?? "unspecified"}
              </p>
            </div>
            <button
              onClick={() => restore(m.id)}
              disabled={busy}
              className="shrink-0 rounded-full border border-edge px-4 py-1.5 text-xs text-muted transition hover:border-emerald-400/60 hover:text-emerald-300 disabled:opacity-50"
            >
              Restore
            </button>
          </article>
        ))}
      </Panel>

      {/* Export */}
      <Panel title="Data">
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/admin/export"
            onClick={(e) => {
              e.preventDefault();
              window.open("/api/admin/export", "_blank");
            }}
            className="rounded-full border border-edge px-5 py-2 text-xs font-semibold text-muted transition hover:border-ember hover:text-gold"
          >
            Export database (JSON)
          </a>
          <a
            href="/api/admin/export?format=csv"
            onClick={(e) => {
              e.preventDefault();
              window.open("/api/admin/export?format=csv", "_blank");
            }}
            className="rounded-full border border-edge px-5 py-2 text-xs font-semibold text-muted transition hover:border-ember hover:text-gold"
          >
            Export messages (CSV)
          </a>
          <a
            href="/api/admin/archive"
            onClick={(e) => {
              e.preventDefault();
              window.open("/api/admin/archive", "_blank");
            }}
            className="rounded-full border border-edge px-5 py-2 text-xs font-semibold text-muted transition hover:border-ember hover:text-gold"
          >
            Generate final archive
          </a>
          <Link
            href="/artifact"
            target="_blank"
            className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2 text-xs font-semibold text-black transition hover:brightness-110 glow-ember"
          >
            View the permanent record ↗
          </Link>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          The final archive only exists once a Wall has frozen. Exports include
          removed messages and report history for the audit trail.
        </p>
      </Panel>
    </main>
  );
}
