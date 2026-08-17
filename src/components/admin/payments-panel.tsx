"use client";

import { useState } from "react";
import { AdminAlert, AdminEmpty, AdminPageHeader, AdminRow } from "@/components/admin/ui";
import type { AdminOverview, AdminPaymentHit } from "@/lib/admin/types";
import { formatPublicNumber } from "@/lib/utils";

export function AdminPaymentsPanel({ initial }: { initial: AdminOverview }) {
  const [paymentQuery, setPaymentQuery] = useState("");
  const [payment, setPayment] = useState<AdminPaymentHit | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookupPayment(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/admin/payments?q=${encodeURIComponent(paymentQuery.trim())}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.recovery ?? data.error ?? "Payment lookup failed.");
      return;
    }
    setError(null);
    setPayment(data.payment ?? null);
  }

  return (
    <div className="admin-stack">
      <AdminPageHeader kicker="Payments" title="One dollar, one sentence">
        Look up a settlement by transaction hash. Wallets stay truncated.
      </AdminPageHeader>
      <AdminAlert error={error} />

      <section className="admin-panel">
        <form onSubmit={(e) => void lookupPayment(e)} className="admin-inline-form">
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
          <dl className="admin-dl">
            <AdminRow k="Tx" v={payment.transactionHash} />
            <AdminRow k="Status" v={payment.status} />
            <AdminRow k="Amount" v={`${payment.amount} ${payment.currency}`} />
            <AdminRow k="Network" v={payment.network} />
            <AdminRow k="Sender" v={payment.sender} />
            <AdminRow k="Recipient" v={payment.recipient} />
            <AdminRow k="Intent" v={payment.intentStatus ?? "—"} />
            <AdminRow k="Message" v={payment.publicNumber ? formatPublicNumber(payment.publicNumber) : "unpublished"} />
          </dl>
        ) : (
          <AdminEmpty>Paste a transaction hash. Wallets are truncated.</AdminEmpty>
        )}
      </section>

      <section className="admin-panel">
        <h2 className="kicker">Recent payment failures</h2>
        <ul className="admin-list">
          {initial.recentFailures.length === 0 ? <AdminEmpty>None</AdminEmpty> : null}
          {initial.recentFailures.map((failure, i) => (
            <li key={`${failure.createdAt}-${i}`} className="admin-item-meta">
              {failure.reasonCode} · {failure.createdAt}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
