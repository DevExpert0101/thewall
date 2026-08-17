"use client";

import { AdminLaunchOps } from "@/components/admin/launch-ops";
import { AdminAlert, AdminPageHeader } from "@/components/admin/ui";
import { useAdminOverview } from "@/components/admin/use-overview";
import { AdminWallControls } from "@/components/admin/wall-controls";
import type { AdminOverview } from "@/lib/admin/types";

export function AdminWallDesk({ initial }: { initial: AdminOverview }) {
  const { overview, error, setError, refresh } = useAdminOverview(initial);

  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="This Wall" title="Configure the live day">
        Start, time, and name the stone here. Emergency switches pause writes
        without moving the deadline.
      </AdminPageHeader>
      <AdminAlert error={error} />
      <AdminWallControls
        key={`${overview.config.editionNumber}-${overview.config.phase}-${overview.config.startsAt}`}
        config={overview.config}
        simulation={overview.simulation}
        onError={setError}
        onSaved={refresh}
      />
      <AdminLaunchOps
        config={overview.config}
        ops={overview.ops}
        audit={overview.opsAudit}
        onError={setError}
        onSaved={refresh}
      />
    </div>
  );
}
