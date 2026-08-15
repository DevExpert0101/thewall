"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminConfigPreview } from "@/lib/admin/types";
import { editionPath, formatEditionNumber } from "@/lib/utils";

const DURATION_PRESETS = [
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 24 * 60, label: "24 hours" },
];

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function sameMinute(left: string, right: string) {
  return Math.floor(Date.parse(left) / 60_000) === Math.floor(Date.parse(right) / 60_000);
}

export function AdminWallControls({
  config,
  simulation,
  onError,
  onSaved,
}: {
  config: AdminConfigPreview;
  simulation: boolean;
  onError: (message: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(config.title);
  const [durationMinutes, setDurationMinutes] = useState(config.windowMinutes);
  const [remainingMinutes, setRemainingMinutes] = useState(Math.max(1, config.remainingMinutes || 1));
  const [startsLocal, setStartsLocal] = useState(toLocalInput(config.startsAt));
  const [endsLocal, setEndsLocal] = useState(toLocalInput(config.endsAt));
  const [confirmHistorical, setConfirmHistorical] = useState(false);
  const [working, setWorking] = useState(false);

  const sealed = config.phase === "archived";
  const expired = config.phase === "finalizing";
  const launched = Date.parse(config.startsAt) <= Date.now();

  async function submit(action: "save" | "start" | "finish" | "openNext" | "reset") {
    setWorking(true);
    onError(null);
    try {
      const body: Record<string, unknown> = {
        action,
        title: title.trim(),
        confirmHistoricalEdit: confirmHistorical,
      };
      if (action === "save" || action === "start" || action === "openNext") {
        body.durationMinutes = durationMinutes;
        const remainingChanged =
          action === "save" &&
          config.phase === "live" &&
          remainingMinutes !== Math.max(1, config.remainingMinutes || 1);
        const timesChanged =
          !sameMinute(fromLocalInput(startsLocal), config.startsAt) ||
          !sameMinute(fromLocalInput(endsLocal), config.endsAt);
        if (remainingChanged) {
          body.remainingMinutes = remainingMinutes;
        } else if (timesChanged) {
          body.startsAt = fromLocalInput(startsLocal);
          body.endsAt = fromLocalInput(endsLocal);
        }
      }
      const res = await fetch("/api/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.recovery ?? data.error ?? "Could not update this Wall.");
        return;
      }
      const next = data.event as AdminConfigPreview | undefined;
      if (next) {
        setTitle(next.title);
        setDurationMinutes(next.windowMinutes);
        setRemainingMinutes(Math.max(1, next.remainingMinutes || 1));
        setStartsLocal(toLocalInput(next.startsAt));
        setEndsLocal(toLocalInput(next.endsAt));
        setConfirmHistorical(false);
      }
      await onSaved();
    } finally {
      setWorking(false);
    }
  }

  async function runSimulation(action: "hurry" | "mark" | "warm" | "all") {
    setWorking(true);
    onError(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.recovery ?? data.error ?? "Simulation action failed.");
        return;
      }
      await onSaved();
    } finally {
      setWorking(false);
    }
  }

  return (
    <section>
      <h2 className="kicker">This Wall</h2>
      <p className="mt-2 text-sm text-mist">
        {simulation
          ? "Start the day, set how long it lasts, and name the stone. Sealed editions stay in the library."
          : "Configure the live day here. A sealed edition does not reopen — open the next Wall instead."}
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("save");
        }}
      >
        <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            className="field mt-2 w-full"
          />
        </label>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ash">Length of this day</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                className="btn btn-line"
                onClick={() => setDurationMinutes(preset.minutes)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-[11px] uppercase tracking-[0.2em] text-ash">
            Minutes
            <input
              type="number"
              min={1}
              max={20160}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
              className="field mt-2 w-full"
            />
          </label>
        </div>

        {config.phase === "live" ? (
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
            Minutes remaining
            <input
              type="number"
              min={1}
              max={20160}
              value={remainingMinutes}
              onChange={(e) => setRemainingMinutes(Number(e.target.value) || 1)}
              className="field mt-2 w-full"
            />
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
            Opens
            <input
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              className="field mt-2 w-full"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
            Closes
            <input
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              className="field mt-2 w-full"
            />
          </label>
        </div>

        {launched && !sealed ? (
          <label className="flex items-start gap-3 text-sm text-mist">
            <input
              type="checkbox"
              checked={confirmHistorical}
              onChange={(e) => setConfirmHistorical(e.target.checked)}
              className="mt-1"
            />
            I confirm changing the clock after this Wall has opened.
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={working || sealed}>
            {working ? "Saving…" : "Save this Wall"}
          </button>
          {config.phase === "upcoming" || sealed || expired ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit(sealed || expired ? "openNext" : "start")}
            >
              Start this Wall
            </button>
          ) : null}
          {config.phase === "live" || expired ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit("finish")}
            >
              Finish this Wall
            </button>
          ) : null}
          {simulation ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit("reset")}
            >
              Reset live day
            </button>
          ) : null}
        </div>
      </form>

      {simulation ? (
        <div className="mt-8">
          <h3 className="kicker">Simulation tools</h3>
          <p className="mt-2 text-sm text-ash">Local only. No chain. No real USDC.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-line" disabled={working || sealed} onClick={() => void runSimulation("all")}>
              Simulate all
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed} onClick={() => void runSimulation("hurry")}>
              Speed the clock
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed} onClick={() => void runSimulation("mark")}>
              Pay one sentence
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed} onClick={() => void runSimulation("warm")}>
              Give fire
            </button>
          </div>
        </div>
      ) : null}

      <dl className="mt-8 grid gap-2 font-mono text-sm sm:grid-cols-2">
        <Row k="Edition" v={formatEditionNumber(config.editionNumber)} />
        <Row k="Network" v={config.network} />
        <Row k="Price" v={`${config.priceUsdc} USDC`} />
        <Row k="Archive hash" v={config.archiveHash ?? "Pending seal"} />
        <Row k="Merkle root" v={config.merkleRoot ?? "Pending seal"} />
        <Row k="Permanent copy" v={config.archiveUri ?? "Not published yet"} />
        <Row k="On-chain proof" v={config.proofTx ?? "Not recorded yet"} />
      </dl>
      {sealed ? (
        <Link href={editionPath(config.editionNumber)} className="btn-ghost mt-4 inline-flex kicker hover:text-paper">
          Open this edition →
        </Link>
      ) : (
        <Link href="/wall" className="btn-ghost mt-4 inline-flex kicker hover:text-paper">
          Open the live wall →
        </Link>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2">
      <dt className="text-ash">{k}</dt>
      <dd className="truncate text-right text-paper">{v}</dd>
    </div>
  );
}
