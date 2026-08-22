"use client";

import Link from "next/link";
import { AdminAlert, AdminPageHeader, AdminStat } from "@/components/admin/ui";
import { useAdminOverview } from "@/components/admin/use-overview";
import { ADMIN_PHASE_LABEL } from "@/lib/admin/labels";
import type { AdminOverview } from "@/lib/admin/types";
import { formatCount, formatEditionDate, formatEditionNumber, formatUtcTime } from "@/lib/utils";

export function AdminDashboard({
  initial,
}: {
  initial: AdminOverview;
  email?: string;
}) {
  const { overview, error } = useAdminOverview(initial);
  const edition = overview.config.editionNumber;
  const healthOk = !Object.values(overview.health).some((value) =>
    /missing|error|down|fail/i.test(String(value)),
  );

  return (
    <div className="admin-stack">
      <AdminPageHeader
        kicker={overview.simulation ? "Stewardship · Simulation" : "Stewardship"}
        title="Today's Wall"
      >
        Moderate the live day before it is sealed. After seal, a removal is a
        redaction — the number stays.
      </AdminPageHeader>
      <AdminAlert error={error} />

      <section className="admin-hero-card">
        <p className="kicker text-bronze">{formatEditionNumber(edition)}</p>
        <h2 className="admin-hero-title">{overview.config.title}</h2>
        <p className="admin-hero-meta">
          {ADMIN_PHASE_LABEL[overview.config.phase] ?? overview.config.phase}
        </p>
        <p className="admin-hero-meta">
          {formatEditionDate(overview.config.startsAt)} · {formatUtcTime(overview.config.startsAt)} →{" "}
          {formatUtcTime(overview.config.endsAt)} UTC
        </p>
        <div className="admin-stat-row">
          <AdminStat k="Voices" v={formatCount(overview.totals.messages)} />
          <AdminStat k="Fire" v={formatCount(overview.totals.reactions)} />
          <AdminStat k="USDC settled" v={overview.totals.usdc.toFixed(2)} />
        </div>
        {overview.simulation ? (
          <p className="admin-footnote">
            Simulation does not settle payments. One dollar still means one sentence.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="kicker">Queues</h2>
        <div className="admin-queue-grid">
          <QueueCard
            href="/admin/moderation"
            label="Open reports"
            value={formatCount(overview.openReports.length)}
            hint={
              overview.flaggedMessages.length
                ? `${overview.flaggedMessages.length} flagged`
                : "Review and dismiss"
            }
          />
          <QueueCard
            href="/admin/inbox"
            label="Visitor notes"
            value={formatCount(overview.feedback.length)}
            hint="Private letters to stewards"
          />
          <QueueCard
            href="/admin/archive"
            label="Sealed editions"
            value={formatCount(overview.editions.length)}
            hint="Public record only"
          />
          <QueueCard
            href="/admin/payments"
            label="Payment failures"
            value={formatCount(overview.recentFailures.length)}
            hint="Lookup by transaction hash"
          />
          <QueueCard
            href="/admin/system"
            label="System"
            value={healthOk ? "Ready" : "Check"}
            hint={overview.reactionSignals.length ? `${overview.reactionSignals.length} 🔥 signals` : "Health and audit"}
          />
          <QueueCard
            href="/admin/wall"
            label="This Wall"
            value={ADMIN_PHASE_LABEL[overview.config.phase] ?? overview.config.phase}
            hint="Clock, title, emergency"
          />
        </div>
      </section>

      <section>
        <h2 className="kicker">Launch</h2>
        <p className="admin-copy">
          Share these for the first minutes. They do not grant special publish
          rights. They do not invent voices, 🔥, or viewers.
        </p>
        <p className="admin-hero-meta">Opens {formatUtcTime(overview.config.startsAt)} UTC</p>
        <div className="admin-link-row">
          <Link href="/open" className="admin-chip">
            Waiting room
          </Link>
          <Link href="/invite" className="admin-chip">
            Invite
          </Link>
          <Link href="/watch/stream" className="admin-chip">
            Stream mode
          </Link>
          <Link href="/archive" className="admin-chip">
            Archive
          </Link>
          <Link href="/records" className="admin-chip">
            Records
          </Link>
        </div>
      </section>
    </div>
  );
}

function QueueCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="admin-queue">
      <p className="admin-queue-value">{value}</p>
      <p className="kicker mt-3">{label}</p>
      <p className="admin-queue-hint">{hint}</p>
    </Link>
  );
}
