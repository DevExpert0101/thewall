"use client";

import { useEffect, useState } from "react";

type SimSnapshot = {
  closed?: boolean;
  phase?: string;
  endsAt?: string;
  serverNow?: string;
  totalMessages?: number;
  totalReactions?: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function clockLabel(endsAt: string | undefined, now: number) {
  if (!endsAt) return "—";
  const remaining = Math.max(0, Date.parse(endsAt) - now);
  const total = Math.floor(remaining / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function SimulationBar() {
  const [snap, setSnap] = useState<SimSnapshot>({});
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/simulate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SimSnapshot | null) => {
        if (!cancelled && data) {
          setSnap(data);
          if (data.serverNow) setNow(Date.parse(data.serverNow));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snap.serverNow) return;
    const originClient = Date.now();
    const originServer = Date.parse(snap.serverNow);
    const id = window.setInterval(() => {
      setNow(originServer + (Date.now() - originClient));
    }, 250);
    return () => window.clearInterval(id);
  }, [snap.serverNow]);

  async function run(action: "close" | "reopen" | "reset" | "hurry" | "mark" | "warm" | "all") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Simulation action failed.");
        return;
      }
      if (action === "close") {
        window.location.href = "/archive";
        return;
      }
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  const closed = Boolean(snap.closed) || snap.phase === "archived";

  return (
    <div className="border-b border-line bg-ink/55">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kicker text-bronze">
            Simulation · {closed ? "this Wall is closed" : "pay is local · no chain"}
            {snap.endsAt && !closed ? (
              <span className="ml-3 font-mono tracking-widest text-paper">
                {clockLabel(snap.endsAt, now)}
              </span>
            ) : null}
            {typeof snap.totalMessages === "number" ? (
              <span className="ml-3 text-ash">
                {snap.totalMessages} sentences · {snap.totalReactions ?? 0} fire
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {closed ? (
            <>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("reopen")}
              >
                Reopen this Wall
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("reset")}
              >
                Reset
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("all")}
              >
                Simulate all
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("hurry")}
              >
                Speed the clock
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("mark")}
              >
                Pay one sentence
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("warm")}
              >
                Give fire
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("close")}
              >
                Finish this Wall
              </button>
              <button
                type="button"
                className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
                disabled={busy}
                onClick={() => void run("reset")}
              >
                Reset
              </button>
            </>
          )}
        </div>
        {error ? (
          <p className="text-xs text-blood" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
