"use client";

import { AdminEmpty, AdminPageHeader, AdminRow } from "@/components/admin/ui";
import { ADMIN_HEALTH_LABEL } from "@/lib/admin/labels";
import type { AdminOverview } from "@/lib/admin/types";
import { formatPublicNumber } from "@/lib/utils";

export function AdminSystemPanel({ initial }: { initial: AdminOverview }) {
  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="System" title="Health and integrity">
        Supabase is the working copy, not permanent storage. Hashes prove the
        sealed public file. Secret values are never displayed.
      </AdminPageHeader>

      <section className="admin-panel">
        <h2 className="kicker">System health</h2>
        <dl className="admin-dl">
          {Object.entries(initial.health).map(([k, v]) => (
            <AdminRow key={k} k={ADMIN_HEALTH_LABEL[k] ?? k} v={String(v)} />
          ))}
        </dl>
        <p className="admin-footnote">Secret values are never displayed — only configured or missing.</p>
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Reaction integrity</h2>
        <p className="admin-copy">
          Suspicious 🔥 is visible here. Visitors are not silently dropped. A check
          appears only when a pattern looks automated.
        </p>
        <ul className="admin-list">
          {initial.reactionSignals.length === 0 ? (
            <AdminEmpty>No suspicious 🔥 patterns.</AdminEmpty>
          ) : null}
          {initial.reactionSignals.map((row, i) => (
            <li key={`${row.kind}-${row.subject}-${row.createdAt}-${i}`} className="admin-item-meta">
              {row.kind} · {row.subject} · {row.count} · {row.note}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Claim attempts</h2>
        <p className="admin-copy">Outcomes only. Wall Keys are never stored or shown.</p>
        <ul className="admin-list">
          {initial.claimAttempts.length === 0 ? <AdminEmpty>None</AdminEmpty> : null}
          {initial.claimAttempts.map((row, i) => (
            <li key={`${row.createdAt}-${i}`} className="admin-item-meta">
              {formatPublicNumber(row.publicNumber)} · {row.outcome}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Moderation audit log</h2>
        <p className="admin-copy">Every removal and restore is kept. The public never sees this log.</p>
        <ul className="admin-list">
          {initial.audit.length === 0 ? <AdminEmpty>No moderation actions yet.</AdminEmpty> : null}
          {initial.audit.map((row) => (
            <li key={row.id} className="admin-item-meta">
              {row.createdAt} · {row.action} ·{" "}
              {row.publicNumber ? formatPublicNumber(row.publicNumber) : row.messageId} · {row.reason} ·{" "}
              {row.administratorEmail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
