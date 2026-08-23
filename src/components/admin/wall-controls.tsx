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

function addMinutesToLocal(value: string, minutes: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toLocalInput(new Date(date.getTime() + minutes * 60_000).toISOString());
}

function minutesBetweenLocal(start: string, end: string) {
  const delta = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(delta) || delta <= 0) return 1;
  return Math.max(1, Math.round(delta / 60_000));
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
  const [themeQuestion, setThemeQuestion] = useState(config.themeQuestion ?? "");
  const [themeDescription, setThemeDescription] = useState(config.themeDescription ?? "");
  const [durationMinutes, setDurationMinutes] = useState(config.windowMinutes);
  const [remainingMinutes, setRemainingMinutes] = useState(
    Math.max(config.phase === "live" ? 1 : 0, config.remainingMinutes),
  );
  const [startsLocal, setStartsLocal] = useState(toLocalInput(config.startsAt));
  const [endsLocal, setEndsLocal] = useState(toLocalInput(config.endsAt));
  const [confirmHistorical, setConfirmHistorical] = useState(false);
  const [clockText, setClockText] = useState("");
  const [discloseText, setDiscloseText] = useState("");
  const [askingDisclose, setAskingDisclose] = useState(false);
  const [working, setWorking] = useState(false);

  const sealed = config.phase === "archived";
  const expired = config.phase === "finalizing";
  const archiveUnverified = sealed && (!config.archiveHash || !config.merkleRoot);
  const launched = config.phase !== "upcoming";

  async function submit(
    action: "save" | "start" | "finish" | "openNext" | "reset",
    extra: Record<string, unknown> = {},
  ) {
    setWorking(true);
    onError(null);
    try {
      const durationChanged = durationMinutes !== config.windowMinutes;
      const remainingChanged =
        action === "save" &&
        config.phase === "live" &&
        remainingMinutes !== Math.max(1, config.remainingMinutes);
      const timesChanged =
        !sameMinute(fromLocalInput(startsLocal), config.startsAt) ||
        !sameMinute(fromLocalInput(endsLocal), config.endsAt);
      const clockDirty = durationChanged || remainingChanged || timesChanged;
      const body: Record<string, unknown> = {
        action,
        title: title.trim(),
        themeQuestion: themeQuestion.trim(),
        themeDescription: themeDescription.trim(),
        confirmHistoricalEdit: confirmHistorical,
        confirmText: clockDirty ? clockText.trim() : extra.confirmText,
        ...extra,
      };
      if (action === "save" || action === "start" || action === "openNext") {
        if (action === "start" || action === "openNext" || durationChanged) {
          body.durationMinutes = durationMinutes;
        }
        if (action === "save" && remainingChanged) {
          body.remainingMinutes = remainingMinutes;
        } else if (action === "save" && timesChanged) {
          body.startsAt = fromLocalInput(startsLocal);
          if (!durationChanged) {
            body.endsAt = fromLocalInput(endsLocal);
          }
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
        setThemeQuestion(next.themeQuestion ?? "");
        setThemeDescription(next.themeDescription ?? "");
        setDurationMinutes(next.windowMinutes);
        setRemainingMinutes(Math.max(next.phase === "live" ? 1 : 0, next.remainingMinutes));
        setStartsLocal(toLocalInput(next.startsAt));
        setEndsLocal(toLocalInput(next.endsAt));
        setConfirmHistorical(false);
        setClockText("");
        setAskingDisclose(false);
        setDiscloseText("");
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
    <section className="admin-panel">
      <h2 className="kicker">This Wall</h2>
      <p className="mt-2 text-sm text-mist">
        {expired
          ? "The clock has closed. Review the rankings and remove illegal or immoral sentences. A removal here drops that sentence from Victor selection. Then finish this Wall to disclose the final results."
          : simulation
            ? "Start the day, set how long it lasts, and name the stone. Sealed editions stay in the library."
            : "Configure the live day here. A sealed Wall does not reopen — open the next Wall instead."}
      </p>

      <form
        className="admin-wall-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("save");
        }}
      >
        <div className="space-y-4">
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

        <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
          Central question
          <input
            value={themeQuestion}
            onChange={(e) => setThemeQuestion(e.target.value)}
            maxLength={280}
            className="field mt-2 w-full"
            placeholder="What should humanity never forget?"
          />
        </label>

        <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
          Theme note
          <textarea
            value={themeDescription}
            onChange={(e) => setThemeDescription(e.target.value)}
            maxLength={800}
            rows={3}
            className="field mt-2 w-full"
          />
        </label>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ash">Length of this day</p>
          <p className="mt-2 text-sm text-mist">
            Pick a length. Close time follows it. Start uses this length, not a leftover clock.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                className={durationMinutes === preset.minutes ? "btn btn-primary" : "btn btn-line"}
                aria-pressed={durationMinutes === preset.minutes}
                onClick={() => {
                  setDurationMinutes(preset.minutes);
                  setEndsLocal(addMinutesToLocal(startsLocal, preset.minutes));
                }}
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
              onChange={(e) => {
                const next = Number(e.target.value) || 1;
                setDurationMinutes(next);
                setEndsLocal(addMinutesToLocal(startsLocal, next));
              }}
              className="field mt-2 w-full"
            />
          </label>

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
              onChange={(e) => {
                const next = e.target.value;
                setStartsLocal(next);
                setEndsLocal(addMinutesToLocal(next, durationMinutes));
              }}
              className="field mt-2 w-full"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
            Closes
            <input
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => {
                const next = e.target.value;
                setEndsLocal(next);
                setDurationMinutes(minutesBetweenLocal(startsLocal, next));
              }}
              className="field mt-2 w-full"
            />
          </label>
        </div>

        {launched && !sealed ? (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Title-only saves do not move the deadline. Changing remaining time,
              length, or open/close requires typing CLOCK.
            </p>
            <label className="flex items-start gap-3 text-sm text-mist">
              <input
                type="checkbox"
                checked={confirmHistorical}
                onChange={(e) => setConfirmHistorical(e.target.checked)}
                className="mt-1"
              />
              I confirm changing the clock after this Wall has opened.
            </label>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ash">
              Type CLOCK to change the deadline
              <input
                value={clockText}
                onChange={(e) => setClockText(e.target.value)}
                autoComplete="off"
                className="field mt-2 w-full font-mono"
                placeholder="CLOCK"
              />
            </label>
          </div>
        ) : null}
        </div>

        <div className="admin-wall-actions">
          <button type="submit" className="btn btn-primary" disabled={working || sealed}>
            {working ? "Saving…" : "Save this Wall"}
          </button>
          {config.phase === "upcoming" || sealed ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit(sealed ? "openNext" : "start")}
            >
              Start this Wall
            </button>
          ) : null}
          {config.phase === "live" ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit("finish")}
            >
              Close for review
            </button>
          ) : null}
          {expired ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => setAskingDisclose(true)}
            >
              Finish this Wall
            </button>
          ) : null}
          {archiveUnverified ? (
            <button
              type="button"
              className="btn btn-line"
              disabled={working}
              onClick={() => void submit("finish")}
            >
              Retry archive seal
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
        {askingDisclose && expired ? (
          <div className="admin-wall-disclose inscribe mt-4 p-4" role="group" aria-label="Disclose final results">
            <p className="text-sm text-mist">
              Type FINISH to disclose the final results. Rankings become public. This cannot be undone.
            </p>
            <label className="mt-3 block text-[11px] uppercase tracking-[0.2em] text-ash">
              Type FINISH
              <input
                value={discloseText}
                onChange={(e) => setDiscloseText(e.target.value)}
                autoComplete="off"
                className="field mt-2 w-full font-mono"
                placeholder="FINISH"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-line"
                disabled={working}
                onClick={() => {
                  setAskingDisclose(false);
                  setDiscloseText("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={working || discloseText.trim().toUpperCase() !== "FINISH"}
                onClick={() => void submit("finish", { confirm: true, confirmText: discloseText.trim() })}
              >
                Disclose results
              </button>
            </div>
          </div>
        ) : null}
      </form>

      {simulation ? (
        <div className="mt-8">
          <h3 className="kicker">Simulation tools</h3>
          <p className="mt-2 text-sm text-ash">Local only. No chain. No real USDC.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-line" disabled={working || sealed || expired} onClick={() => void runSimulation("all")}>
              Simulate all
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed || expired} onClick={() => void runSimulation("hurry")}>
              Speed the clock
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed || expired} onClick={() => void runSimulation("mark")}>
              Pay one sentence
            </button>
            <button type="button" className="btn btn-line" disabled={working || sealed || expired} onClick={() => void runSimulation("warm")}>
              Give fire
            </button>
          </div>
        </div>
      ) : null}

      <dl className="mt-8 grid gap-2 font-mono text-sm sm:grid-cols-2">
        <Row k="Wall" v={formatEditionNumber(config.editionNumber)} />
        <Row k="Network" v={config.network} />
        <Row k="Price" v={`${config.priceUsdc} USDC`} />
        <Row k="Archive hash" v={config.archiveHash ?? "Pending seal"} />
        <Row k="Merkle root" v={config.merkleRoot ?? "Pending seal"} />
        <Row k="Independent copy" v={config.archiveUri ?? "Not published yet"} />
        <Row k="Independent notice" v={config.proofTx ?? "Not recorded yet"} />
      </dl>
      {sealed ? (
        <div className="mt-4 flex flex-wrap gap-4">
          <p className="w-full text-sm text-mist">
            The homepage still shows this sealed Wall until you start the next one.
          </p>
          <Link href={editionPath(config.editionNumber)} className="btn-ghost inline-flex kicker hover:text-paper">
            Open this Wall →
          </Link>
          <Link href={`${editionPath(config.editionNumber)}/verify`} className="btn-ghost inline-flex kicker hover:text-paper">
            Verify this Wall →
          </Link>
        </div>
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
