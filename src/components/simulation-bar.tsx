"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SimSnapshot = {
  closed?: boolean;
  phase?: string;
  endsAt?: string;
  serverNow?: string;
  totalMessages?: number;
  totalReactions?: number;
  editionNumber?: number;
  editionCount?: number;
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

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/simulate", { credentials: "same-origin" })
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

  const closed = Boolean(snap.closed) || snap.phase === "archived";

  return (
    <div className="border-b border-line bg-ink/55">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
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
          {typeof snap.editionCount === "number" && snap.editionCount > 0 ? (
            <span className="ml-3 text-ash">
              {snap.editionCount} sealed {snap.editionCount === 1 ? "edition" : "editions"}
            </span>
          ) : null}
        </p>
        <Link href="/admin" className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]">
          Configure in stewardship
        </Link>
      </div>
    </div>
  );
}
