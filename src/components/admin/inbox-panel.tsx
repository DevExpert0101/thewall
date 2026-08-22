"use client";

import { AdminEmpty, AdminPageHeader } from "@/components/admin/ui";
import type { AdminFeedbackRow, AdminOverview } from "@/lib/admin/types";

export function AdminInboxPanel({ initial }: { initial: AdminOverview }) {
  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="Inbox" title="Visitor notes">
        Letters to the stewards. Not published. Optional emails are for reply only.
      </AdminPageHeader>
      <ul className="admin-list">
        {initial.feedback.length === 0 ? <AdminEmpty>No notes yet.</AdminEmpty> : null}
        {initial.feedback.map((row: AdminFeedbackRow) => (
          <li key={row.id} className="admin-item">
            <p className="admin-item-meta">
              {row.createdAt} · {row.category}
              {row.email ? ` · ${row.email}` : ""}
            </p>
            <p className="mt-2 text-paper">{row.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
