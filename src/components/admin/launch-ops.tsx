"use client";

import { useState } from "react";
import type { AdminOpsAuditRow } from "@/lib/ops/controls";
import type { AdminConfigPreview, AdminOpsSnapshot } from "@/lib/admin/types";

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 font-mono text-sm">
      <dt className="text-ash">{k}</dt>
      <dd className="truncate text-right text-paper">{v}</dd>
    </div>
  );
}

function shown(value: number | null | undefined, empty = "not collected"): string {
  return value == null ? empty : String(value);
}

export function AdminLaunchOps({
  config,
  ops,
  audit,
  onError,
  onSaved,
}: {
  config: AdminConfigPreview;
  ops: AdminOpsSnapshot;
  audit: AdminOpsAuditRow[];
  onError: (message: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [publishEnabled, setPublishEnabled] = useState(ops.controls.publishEnabled);
  const [reactEnabled, setReactEnabled] = useState(ops.controls.reactEnabled);
  const [strictBot, setStrictBot] = useState(ops.controls.strictBot);
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  async function applyEmergency() {
    setWorking(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ops",
          publishEnabled,
          reactEnabled,
          strictBot,
          confirm: true,
          confirmText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.recovery ?? data.error ?? "Could not update emergency controls.");
        return;
      }
      const next = data.event as AdminConfigPreview | undefined;
      if (next) {
        setPublishEnabled(next.publishEnabled);
        setReactEnabled(next.reactEnabled);
        setStrictBot(next.strictBot);
      }
      setConfirmText("");
      await onSaved();
    } finally {
      setWorking(false);
    }
  }

  return (
    <section>
      <h2 className="kicker">Launch day</h2>
      <p className="mt-2 text-sm text-mist">
        Live counts from the working copy. Unique viewers are never invented.
        Emergency switches do not change the event deadline.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="kicker">Event</h3>
          <dl className="mt-3">
            <Metric k="State" v={ops.event.state} />
            <Metric k="Starts" v={ops.event.startsAt} />
            <Metric k="Ends" v={ops.event.endsAt} />
            <Metric k="Remaining" v={ops.event.remainingLabel} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">Traffic</h3>
          <p className="mt-2 text-xs text-ash">{ops.traffic.note}</p>
          <dl className="mt-3">
            <Metric k="Active viewers" v={shown(ops.traffic.activeViewers, "not available")} />
            <Metric k="Page views / 15m" v={shown(ops.traffic.pageViewsLast15m)} />
            <Metric k="Requests / 15m" v={shown(ops.traffic.requestsLast15m)} />
            <Metric k="Error rate" v={shown(ops.traffic.errorRate)} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">Messages</h3>
          <dl className="mt-3">
            <Metric k="Total" v={String(ops.messages.total)} />
            <Metric k="Rate / minute" v={shown(ops.messages.perMinute)} />
            <Metric k="Moderation failures" v={String(ops.messages.moderationFailures)} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">Payments</h3>
          <dl className="mt-3">
            <Metric k="Intents" v={String(ops.payments.intents)} />
            <Metric k="Successful" v={String(ops.payments.successful)} />
            <Metric k="Failed" v={String(ops.payments.failed)} />
            <Metric k="Pending" v={String(ops.payments.pending)} />
            <Metric k="Duplicate / replay" v={String(ops.payments.duplicateReplay)} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">Reactions</h3>
          <dl className="mt-3">
            <Metric k="Total" v={String(ops.reactions.total)} />
            <Metric k="Rate / minute" v={shown(ops.reactions.perMinute)} />
            <Metric k="Suspicious spikes" v={String(ops.reactions.suspiciousSpikes)} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">System</h3>
          <dl className="mt-3">
            <Metric k="Supabase" v={ops.system.supabase} />
            <Metric k="Payment verification" v={ops.system.payments} />
            <Metric k="Realtime" v={ops.system.realtime} />
            <Metric k="Archive preparation" v={ops.system.archivePrep} />
          </dl>
        </div>
        <div>
          <h3 className="kicker">Moderation</h3>
          <dl className="mt-3">
            <Metric k="Reports" v={String(ops.moderation.reports)} />
            <Metric k="Pending reviews" v={String(ops.moderation.pendingReviews)} />
            <Metric k="Removals" v={String(ops.moderation.removals)} />
          </dl>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="kicker">Emergency</h3>
        <p className="mt-2 text-sm text-mist">
          Pause publishing or 🔥 without moving {config.endsAt}. Type OPS to apply.
          Stricter anti-bot asks for a challenge on compose and 🔥. The default 🔥
          gate stays off until you enable this.
        </p>
        <div className="mt-4 space-y-3 text-sm text-mist">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={publishEnabled}
              onChange={(e) => setPublishEnabled(e.target.checked)}
              className="mt-1"
            />
            Publishing enabled
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={reactEnabled}
              onChange={(e) => setReactEnabled(e.target.checked)}
              className="mt-1"
            />
            Reactions enabled
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={strictBot}
              onChange={(e) => setStrictBot(e.target.checked)}
              className="mt-1"
            />
            Stricter anti-bot protection
          </label>
        </div>
        <label className="mt-4 block text-[11px] uppercase tracking-[0.2em] text-ash">
          Type OPS
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="field mt-2 w-full max-w-sm font-mono"
            placeholder="OPS"
          />
        </label>
        <button
          type="button"
          className="btn btn-line mt-4"
          disabled={working || confirmText.trim().toUpperCase() !== "OPS"}
          onClick={() => void applyEmergency()}
        >
          {working ? "Applying…" : "Apply emergency controls"}
        </button>
      </div>

      <div className="mt-10">
        <h3 className="kicker">Operations audit</h3>
        <p className="mt-2 text-sm text-mist">
          Every stewardship action is recorded. The public never sees this log.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-mist">
          {audit.length === 0 ? <li>No operations yet.</li> : null}
          {audit.map((row) => (
            <li key={row.id} className="border-b border-line py-2 font-mono text-xs">
              {row.createdAt} · {row.action} · {row.actorEmail}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
