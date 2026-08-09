"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewWallButton() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  const start = async () => {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wall/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start a new wall.");
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={start}
        disabled={busy}
        className={`rounded-full border px-7 py-3 text-sm font-semibold transition glow-ember ${
          armed
            ? "border-red-500/60 bg-red-500/15 text-red-300"
            : "border-ember/50 bg-ember/10 text-gold hover:bg-ember/20"
        } disabled:opacity-50`}
      >
        {busy
          ? "Igniting a new wall…"
          : armed
            ? "Tap again to confirm — the old wall is sealed forever"
            : "Start a new WALL"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
