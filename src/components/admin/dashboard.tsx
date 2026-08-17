"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminLaunchOps } from "@/components/admin/launch-ops";
import { AdminWallControls } from "@/components/admin/wall-controls";
import type { DangerousAdminAction } from "@/lib/admin/confirm";
import type {
  AdminAuditRow,
  AdminFeedbackRow,
  AdminMessageHit,
  AdminOverview,
  AdminPaymentHit,
  AdminReportRow,
} from "@/lib/admin/types";
import type { ModerationReasonCode } from "@/lib/constants";
import {
  editionPath,
  formatCount,
  formatEditionDate,
  formatEditionNumber,
  formatPublicNumber,
  formatUtcTime,
} from "@/lib/utils";

type Pending =
  | { kind: "remove" | "restore"; messageId: string; publicNumber: number }
  | { kind: "dismiss"; reportId: string; publicNumber: number | null };

const PHASE_LABEL: Record<string, string> = {
  upcoming: "Not yet open",
  live: "The day is open",
  finalizing: "Under review",
  archived: "Sealed",
};

const HEALTH_LABEL: Record<string, string> = {
  database: "Working copy",
  privilegedDb: "Service role",
  payments: "Treasury",
  turnstile: "Visitor gate",
  network: "Network",
  eventStatus: "Current phase",
  moderation: "Moderation",
};

export function AdminDashboard({
  initial,
  email,
}: {
  initial: AdminOverview;
  email: string;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMessageHit[]>([]);
  const [paymentQuery, setPaymentQuery] = useState("");
  const [payment, setPayment] = useState<AdminPaymentHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState<ModerationReasonCode | "">("");
  const [note, setNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/stats");
    if (res.status === 401 || res.status === 403) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.recovery ?? data.error ?? "Could not refresh.");
      return;
    }
    setOverview(data);
  }

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

  async function lookupPayment(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/admin/payments?q=${encodeURIComponent(paymentQuery.trim())}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.recovery ?? data.error ?? "Payment lookup failed.");
      return;
    }
    setPayment(data.payment ?? null);
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

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const dialogAction: DangerousAdminAction | null = pending?.kind ?? null;
  const edition = overview.config.editionNumber;

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">
            Stewardship
            {overview.simulation ? " · Simulation" : ""}
          </p>
          <h1 className="permanence-title mt-4">Keep the monument legible.</h1>
          <span className="title-rule mt-5 block" aria-hidden="true" />
          <p className="lede mt-5 max-w-xl">
            Each Wall lives for 24 hours, then is sealed as The Wall №001. Moderate
            the live day before it is sealed. After seal, a removal is a redaction —
            the number stays.
          </p>
          <p className="mt-4 text-sm text-ash">Signed in as {email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/wall" className="btn-ghost kicker">
            The Wall
          </Link>
          <Link href="/archive" className="btn-ghost kicker">
            Archive
          </Link>
          <Link href="/records" className="btn-ghost kicker">
            Records
          </Link>
          <Link href="/" className="btn-ghost kicker">
            Public site
          </Link>
          <button type="button" className="btn btn-line" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <p className="text-sm text-blood" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="kicker">Current edition</h2>
        <p className="mt-3 font-mono text-sm tracking-[0.22em] text-bronze">
          {formatEditionNumber(edition)}
        </p>
        <p className="mt-2 font-display text-3xl text-paper">{overview.config.title}</p>
        <p className="mt-2 text-sm text-mist">
          {PHASE_LABEL[overview.config.phase] ?? overview.config.phase}
        </p>
        <p className="mt-2 text-sm text-mist">
          {formatEditionDate(overview.config.startsAt)} · {formatUtcTime(overview.config.startsAt)}{" "}
          → {formatUtcTime(overview.config.endsAt)}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat k="Voices" v={formatCount(overview.totals.messages)} />
          <Stat k="Fire" v={formatCount(overview.totals.reactions)} />
          <Stat k="USDC settled" v={overview.totals.usdc.toFixed(2)} />
        </div>
        {overview.simulation ? (
          <p className="mt-3 text-xs text-ash">
            Simulation does not settle payments. One dollar still means one sentence.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="kicker">Launch</h2>
        <p className="mt-2 text-sm text-mist">
          Share these for the first minutes. They do not grant special publish
          rights. They do not invent voices, 🔥, or viewers.
        </p>
        <p className="mt-3 font-mono text-xs tracking-[0.14em] text-bronze">
          Opens {formatUtcTime(overview.config.startsAt)} UTC
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/open" className="btn-ghost kicker hover:text-paper">
              Waiting room →
            </Link>
          </li>
          <li>
            <Link href="/invite" className="btn-ghost kicker hover:text-paper">
              Invite →
            </Link>
          </li>
          <li>
            <Link href="/watch/stream" className="btn-ghost kicker hover:text-paper">
              Stream mode →
            </Link>
          </li>
        </ul>
      </section>

      <AdminLaunchOps
        config={overview.config}
        ops={overview.ops}
        audit={overview.opsAudit}
        onError={setError}
        onSaved={refresh}
      />

      <AdminWallControls
        key={`${overview.config.editionNumber}-${overview.config.phase}-${overview.config.startsAt}`}
        config={overview.config}
        simulation={overview.simulation}
        onError={setError}
        onSaved={refresh}
      />

      <section>
        <h2 className="kicker">Review rankings</h2>
        <p className="mt-2 text-sm text-mist">
          {overview.config.phase === "finalizing"
            ? "Publishing has stopped. Remove illegal or immoral sentences, then press Finish this Wall to disclose the final results."
            : "Current order by 🔥. After the clock closes, review this list before disclosing the archive."}
        </p>
        <ul className="mt-4 space-y-3">
          {overview.reviewRanks.length === 0 ? (
            <li className="text-sm text-ash">No sentences on this Wall yet.</li>
          ) : null}
          {overview.reviewRanks.map((row, index) => (
            <li key={row.id} className="inscribe p-4 text-sm">
              <p className="font-mono text-ash">
                Rank #{index + 1} · {formatPublicNumber(row.publicNumber)} · {row.reactionCount} 🔥
                {row.removedAt ? " · removed" : ""}
              </p>
              <p className="mt-2 text-paper">{row.text}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() =>
                    setPending({
                      kind: "remove",
                      messageId: row.id,
                      publicNumber: row.publicNumber,
                    })
                  }
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() =>
                    setPending({
                      kind: "restore",
                      messageId: row.id,
                      publicNumber: row.publicNumber,
                    })
                  }
                >
                  Restore
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Archive library</h2>
        <p className="mt-2 text-sm text-mist">
          Sealed days only. Nothing is invented. The public record is the final
          moderated dataset.
        </p>
        {overview.editions.length === 0 ? (
          <p className="mt-4 text-sm text-ash">The library is empty until this Wall is sealed.</p>
        ) : (
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {overview.editions.map((row) => (
              <li key={row.editionNumber} className="inscribe p-5">
                <p className="kicker text-bronze">{formatEditionNumber(row.editionNumber)}</p>
                <p className="mt-2 font-display text-2xl text-paper">{row.title ?? formatEditionDate(row.startsAt)}</p>
                <p className="mt-2 font-mono text-xs tracking-[0.14em] text-mist">
                  {formatEditionDate(row.startsAt)}
                </p>
                <p className="mt-3 font-mono text-xs tracking-[0.14em] text-mist">
                  {formatCount(row.totalMessages)} voices · {formatCount(row.totalReactions)} 🔥
                </p>
                <p className="mt-3 break-all font-mono text-[0.65rem] text-ash">
                  {row.archiveHash ?? "Hash pending"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={editionPath(row.editionNumber)} className="btn-ghost inline-flex kicker hover:text-paper">
                    Open edition →
                  </Link>
                  <Link
                    href={`${editionPath(row.editionNumber)}/records`}
                    className="btn-ghost inline-flex kicker hover:text-paper"
                  >
                    Records →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="kicker">Message search</h2>
        <p className="mt-2 text-sm text-mist">
          Search this Wall by number or words. Removal keeps the number; the public
          line becomes archive policy text.
        </p>
        <form onSubmit={(e) => void search(e)} className="mt-3 flex gap-2">
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
        <ul className="mt-4 space-y-3">
          {results.map((row) => (
            <li key={row.id} className="inscribe p-4 text-sm">
              <p className="font-mono text-ash">
                {formatPublicNumber(row.publicNumber)} · {row.moderationStatus}
                {row.removedAt ? " · removed" : ""}
              </p>
              <p className="mt-2 text-paper">{row.text}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() =>
                    setPending({
                      kind: "remove",
                      messageId: row.id,
                      publicNumber: row.publicNumber,
                    })
                  }
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() =>
                    setPending({
                      kind: "restore",
                      messageId: row.id,
                      publicNumber: row.publicNumber,
                    })
                  }
                >
                  Restore
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Reports queue</h2>
        <p className="mt-2 text-sm text-mist">
          Open reports: {overview.openReports.length}. Flagged messages: {overview.flaggedMessages.length}.
          {overview.simulation ? " Simulation has no visitor reports until a real project is connected." : ""}
        </p>
        <ul className="mt-4 space-y-3">
          {overview.openReports.length === 0 ? (
            <li className="text-sm text-ash">No open reports.</li>
          ) : null}
          {overview.openReports.map((row: AdminReportRow) => (
            <li key={row.id} className="inscribe p-4 text-sm">
              <p className="font-mono text-ash">
                {row.publicNumber ? formatPublicNumber(row.publicNumber) : "Message"} · {row.category}
              </p>
              {row.detail ? <p className="mt-2 text-mist">{row.detail}</p> : null}
              <div className="mt-3 flex gap-2">
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

      <section>
        <h2 className="kicker">Visitor notes</h2>
        <p className="mt-2 text-sm text-mist">
          Letters to the stewards. Not published. Optional emails are for reply only.
        </p>
        <ul className="mt-4 space-y-3">
          {overview.feedback.length === 0 ? (
            <li className="text-sm text-ash">No notes yet.</li>
          ) : null}
          {overview.feedback.map((row: AdminFeedbackRow) => (
            <li key={row.id} className="inscribe p-4 text-sm">
              <p className="font-mono text-xs tracking-[0.14em] text-ash">
                {row.createdAt} · {row.category}
                {row.email ? ` · ${row.email}` : ""}
              </p>
              <p className="mt-2 text-paper">{row.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Moderation audit log</h2>
        <p className="mt-2 text-sm text-mist">Every removal and restore is kept. The public never sees this log.</p>
        <ul className="mt-4 space-y-2 text-sm text-mist">
          {overview.audit.length === 0 ? <li>No moderation actions yet.</li> : null}
          {overview.audit.map((row: AdminAuditRow) => (
            <li key={row.id} className="border-b border-line py-2 font-mono text-xs">
              {row.createdAt} · {row.action} ·{" "}
              {row.publicNumber ? formatPublicNumber(row.publicNumber) : row.messageId} · {row.reason} ·{" "}
              {row.administratorEmail}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Payment lookup</h2>
        <p className="mt-2 text-sm text-mist">
          One dollar publishes one sentence. Look up a settlement by transaction hash.
          Wallets stay truncated.
        </p>
        <form onSubmit={(e) => void lookupPayment(e)} className="mt-3 flex gap-2">
          <input
            value={paymentQuery}
            onChange={(e) => setPaymentQuery(e.target.value)}
            placeholder="0x transaction hash"
            className="field flex-1 font-mono"
          />
          <button className="btn btn-line" type="submit">
            Lookup
          </button>
        </form>
        {payment ? (
          <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
            <Row k="Tx" v={payment.transactionHash} />
            <Row k="Status" v={payment.status} />
            <Row k="Amount" v={`${payment.amount} ${payment.currency}`} />
            <Row k="Network" v={payment.network} />
            <Row k="Sender" v={payment.sender} />
            <Row k="Recipient" v={payment.recipient} />
            <Row k="Intent" v={payment.intentStatus ?? "—"} />
            <Row k="Message" v={payment.publicNumber ? formatPublicNumber(payment.publicNumber) : "unpublished"} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ash">Paste a transaction hash. Wallets are truncated.</p>
        )}
        <h3 className="mt-6 text-xs uppercase tracking-[0.16em] text-ash">Recent payment failures</h3>
        <ul className="mt-2 space-y-1 text-sm text-mist">
          {overview.recentFailures.length === 0 ? <li>None</li> : null}
          {overview.recentFailures.map((failure, i) => (
            <li key={`${failure.createdAt}-${i}`}>
              {failure.reasonCode} · {failure.createdAt}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Reaction integrity</h2>
        <p className="mt-2 text-sm text-mist">
          Suspicious 🔥 is visible here. Visitors are not silently dropped. A check
          appears only when a pattern looks automated.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-mist">
          {overview.reactionSignals.length === 0 ? (
            <li className="text-sm text-ash">No suspicious 🔥 patterns.</li>
          ) : null}
          {overview.reactionSignals.map((row, i) => (
            <li key={`${row.kind}-${row.subject}-${row.createdAt}-${i}`} className="font-mono text-xs">
              {row.kind} · {row.subject} · {row.count} · {row.note}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">Claim attempts</h2>
        <p className="mt-2 text-sm text-mist">
          Outcomes only. Wall Keys are never stored or shown.
        </p>
        <ul className="mt-3 space-y-1 font-mono text-sm text-mist">
          {overview.claimAttempts.length === 0 ? <li>None</li> : null}
          {overview.claimAttempts.map((row, i) => (
            <li key={`${row.createdAt}-${i}`}>
              #{String(row.publicNumber).padStart(6, "0")} · {row.outcome}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="kicker">System health</h2>
        <p className="mt-2 text-sm text-mist">
          Supabase is the working copy, not permanent storage. Hashes prove the
          sealed public file. Extra copies are published only when configured.
        </p>
        <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
          {Object.entries(overview.health).map(([k, v]) => (
            <Row key={k} k={HEALTH_LABEL[k] ?? k} v={String(v)} />
          ))}
        </dl>
        <p className="mt-3 text-xs text-ash">Secret values are never displayed — only configured or missing.</p>
      </section>

      {pending && dialogAction ? (
        <AdminConfirmDialog
          action={dialogAction}
          publicNumber={pending.kind === "dismiss" ? pending.publicNumber : pending.publicNumber}
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

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat-tablet">
      <p className="stat-value text-paper">{v}</p>
      <p className="kicker mt-3">{k}</p>
    </div>
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
