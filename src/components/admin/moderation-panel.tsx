"use client";

import { useState } from "react";
import { AdminConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminAlert, AdminEmpty, AdminPageHeader } from "@/components/admin/ui";
import { useAdminOverview } from "@/components/admin/use-overview";
import type { DangerousAdminAction } from "@/lib/admin/confirm";
import type { AdminMessageHit, AdminOverview, AdminReportRow } from "@/lib/admin/types";
import type { ModerationReasonCode } from "@/lib/constants";
import { formatPublicNumber } from "@/lib/utils";

type Pending =
  | { kind: "remove" | "restore"; messageId: string; publicNumber: number }
  | { kind: "dismiss"; reportId: string; publicNumber: number | null };

export function AdminModerationPanel({ initial }: { initial: AdminOverview }) {
  const { overview, error, setError, refresh } = useAdminOverview(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMessageHit[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState<ModerationReasonCode | "">("");
  const [note, setNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.recovery ?? data.error ?? "Search failed.");
      return;
    }
    setResults(data.results ?? []);
  }

  async function submitPending() {
    if (!pending || !reason) return;
    setWorking(true);
    setError(null);
    try {
      if (pending.kind === "dismiss") {
        const res = await fetch("/api/admin/reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: pending.reportId,
            reason,
            note: note || undefined,
            confirm: true,
            confirmText,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.recovery ?? data.error ?? "Could not dismiss.");
          return;
        }
      } else {
        const res = await fetch("/api/admin/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: pending.messageId,
            action: pending.kind,
            reason,
            note: note || undefined,
            confirm: true,
            confirmText,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.recovery ?? data.error ?? "Could not moderate.");
          return;
        }
      }
      setPending(null);
      setReason("");
      setNote("");
      setConfirmText("");
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  const dialogAction: DangerousAdminAction | null = pending?.kind ?? null;

  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="Moderation" title="Keep the stone clean">
        Search this Wall, review the current 🔥 order, and clear the report
        queue. Removal keeps the number.
      </AdminPageHeader>
      <AdminAlert error={error} />

      <section className="admin-panel">
        <h2 className="kicker">Reports queue</h2>
        <p className="admin-copy">
          Open reports: {overview.openReports.length}. Flagged messages:{" "}
          {overview.flaggedMessages.length}.
          {overview.simulation ? " Simulation has no visitor reports until a real project is connected." : ""}
        </p>
        <ul className="admin-list">
          {overview.openReports.length === 0 ? <AdminEmpty>No open reports.</AdminEmpty> : null}
          {overview.openReports.map((row: AdminReportRow) => (
            <li key={row.id} className="admin-item">
              <p className="admin-item-meta">
                {row.publicNumber ? formatPublicNumber(row.publicNumber) : "Message"} · {row.category}
              </p>
              {row.detail ? <p className="mt-2 text-mist">{row.detail}</p> : null}
              <div className="admin-item-actions">
                {row.publicNumber ? (
                  <button
                    type="button"
                    className="btn btn-line"
                    onClick={() =>
                      setPending({
                        kind: "remove",
                        messageId: row.messageId,
                        publicNumber: row.publicNumber as number,
                      })
                    }
                  >
                    Remove message
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() =>
                    setPending({
                      kind: "dismiss",
                      reportId: row.id,
                      publicNumber: row.publicNumber,
                    })
                  }
                >
                  Dismiss report
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Message search</h2>
        <p className="admin-copy">
          Search this Wall by number or words. Removal keeps the number; the public
          line becomes archive policy text.
        </p>
        <form onSubmit={(e) => void search(e)} className="admin-inline-form">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="#000004 or fifty years"
            className="field flex-1"
          />
          <button className="btn btn-line" type="submit">
            Search
          </button>
        </form>
        <ul className="admin-list">
          {results.map((row) => (
            <MessageActions key={row.id} row={row} onPending={setPending} />
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Review rankings</h2>
        <p className="admin-copy">
          {overview.config.phase === "finalizing"
            ? "Publishing has stopped. Remove illegal or immoral sentences, then press Finish this Wall to disclose the final results."
            : "Current order by 🔥. After the clock closes, review this list before disclosing the archive."}
        </p>
        <ul className="admin-list">
          {overview.reviewRanks.length === 0 ? <AdminEmpty>No sentences on this Wall yet.</AdminEmpty> : null}
          {overview.reviewRanks.map((row, index) => (
            <MessageActions
              key={row.id}
              row={row}
              rank={index + 1}
              onPending={setPending}
            />
          ))}
        </ul>
      </section>

      {pending && dialogAction ? (
        <AdminConfirmDialog
          action={dialogAction}
          publicNumber={pending.publicNumber}
          pending={working}
          error={error}
          reason={reason}
          note={note}
          confirmText={confirmText}
          onReason={setReason}
          onNote={setNote}
          onConfirmText={setConfirmText}
          onCancel={() => {
            setPending(null);
            setConfirmText("");
            setReason("");
            setNote("");
          }}
          onSubmit={() => void submitPending()}
        />
      ) : null}
    </div>
  );
}

function MessageActions({
  row,
  rank,
  onPending,
}: {
  row: AdminMessageHit;
  rank?: number;
  onPending: (pending: Pending) => void;
}) {
  return (
    <li className="admin-item">
      <p className="admin-item-meta">
        {rank ? `Rank #${rank} · ` : ""}
        {formatPublicNumber(row.publicNumber)}
        {"reactionCount" in row ? ` · ${row.reactionCount} 🔥` : ""}
        {row.moderationStatus ? ` · ${row.moderationStatus}` : ""}
        {row.removedAt ? " · removed" : ""}
      </p>
      <p className="mt-2 text-paper">{row.text}</p>
      <div className="admin-item-actions">
        <button
          type="button"
          className="btn btn-line"
          onClick={() =>
            onPending({ kind: "remove", messageId: row.id, publicNumber: row.publicNumber })
          }
        >
          Remove
        </button>
        <button
          type="button"
          className="btn btn-line"
          onClick={() =>
            onPending({ kind: "restore", messageId: row.id, publicNumber: row.publicNumber })
          }
        >
          Restore
        </button>
      </div>
    </li>
  );
}
