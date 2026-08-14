"use client";

import { useEffect, useState } from "react";

export function SimulationBar() {
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/simulate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { closed?: boolean } | null) => {
        if (!cancelled && data) setClosed(Boolean(data.closed));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function setWall(action: "close" | "reopen") {
    setBusy(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      window.location.href = action === "close" ? "/archive" : "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-line bg-ink/55">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <p className="kicker text-bronze">
          Simulation · {closed ? "this Wall is closed" : "pay is local · no chain"}
        </p>
        <button
          type="button"
          className="btn-ghost min-h-9 px-2 text-[0.65rem] tracking-[0.16em]"
          disabled={busy}
          onClick={() => void setWall(closed ? "reopen" : "close")}
        >
          {closed ? "Reopen this Wall" : "Finish this Wall"}
        </button>
      </div>
    </div>
  );
}
