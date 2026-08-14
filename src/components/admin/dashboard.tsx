"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "@/components/admin/confirm-dialog";
import type { DangerousAdminAction } from "@/lib/admin/confirm";
import type {
  AdminAuditRow,
  AdminMessageHit,
  AdminOverview,
  AdminPaymentHit,
  AdminReportRow,
} from "@/lib/admin/types";
import type { ModerationReasonCode } from "@/lib/constants";
import { formatPublicNumber } from "@/lib/utils";

type Pending =
  | { kind: "remove" | "restore"; messageId: string; publicNumber: number }
  | { kind: "dismiss"; reportId: string; publicNumber: number | null };

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

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Operations</p>
          <h1 className="mt-2 font-display text-4xl">{overview.config.title}</h1>
          <p className="mt-2 text-sm text-ash">Signed in as {email}</p>
        </div>
        <div className="flex gap-3">
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
        <h2 className="kicker">Event overview</h2>
        <p className="mt-3 text-sm text-mist">
          Calculated state: <strong className="text-paper">{overview.config.phase}</strong>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat k="Messages" v={String(overview.totals.messages)} />
          <Stat k="Reactions" v={String(overview.totals.reactions)} />
          <Stat k="USDC" v={overview.totals.usdc.toFixed(2)} />
        </div>
      </section>

      <section>
        <h2 className="kicker">Event configuration</h2>
        <p className="mt-2 text-sm text-ash">Preview only. Timestamps are not edited from this console.</p>
        <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
          <Row k="Slug" v={overview.config.slug} />
          <Row k="Network" v={overview.config.network} />
          <Row k="Starts" v={overview.config.startsAt} />
          <Row k="Ends" v={overview.config.endsAt} />
          <Row k="Treasury" v={overview.config.treasuryAddress ?? "unset"} />
          <Row k="Price" v={`${overview.config.priceUsdc} USDC`} />
        </dl>
      </section>

      <section>
        <h2 className="kicker">Message search</h2>
        <form onSubmit={(e) => void search(e)} className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Number, text, tx hash, or id"
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
        <h2 className="kicker">Moderation audit log</h2>
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
        <h2 className="kicker">System health</h2>
        <dl className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
          {Object.entries(overview.health).map(([k, v]) => (
            <Row key={k} k={k} v={String(v)} />
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
    <div className="border border-line p-4">
      <p className="text-2xl text-paper">{v}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ash">{k}</p>
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
