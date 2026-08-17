"use client";

import Link from "next/link";
import { AdminEmpty, AdminPageHeader } from "@/components/admin/ui";
import type { AdminOverview } from "@/lib/admin/types";
import { editionPath, formatCount, formatEditionDate, formatEditionNumber } from "@/lib/utils";

export function AdminArchivePanel({ initial }: { initial: AdminOverview }) {
  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="Archive library" title="Sealed days only">
        Nothing is invented. The public record is the final moderated dataset.
      </AdminPageHeader>
      {initial.editions.length === 0 ? (
        <AdminEmpty>The library is empty until this Wall is sealed.</AdminEmpty>
      ) : (
        <ul className="admin-edition-grid">
          {initial.editions.map((row) => (
            <li key={row.editionNumber} className="admin-item">
              <p className="kicker text-bronze">{formatEditionNumber(row.editionNumber)}</p>
              <p className="mt-2 font-display text-2xl text-paper">
                {row.title ?? formatEditionDate(row.startsAt)}
              </p>
              <p className="admin-item-meta mt-2">{formatEditionDate(row.startsAt)}</p>
              <p className="admin-item-meta mt-3">
                {formatCount(row.totalMessages)} voices · {formatCount(row.totalReactions)} 🔥
              </p>
              <p className="mt-3 break-all font-mono text-[0.65rem] text-ash">
                {row.archiveHash ?? "Hash pending"}
              </p>
              <div className="admin-item-actions">
                <Link href={editionPath(row.editionNumber)} className="btn-ghost kicker hover:text-paper">
                  Open edition →
                </Link>
                <Link
                  href={`${editionPath(row.editionNumber)}/records`}
                  className="btn-ghost kicker hover:text-paper"
                >
                  Records →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
