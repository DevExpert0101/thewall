"use client";

import { useId } from "react";
import {
  MODERATION_REASON_CODES,
  MODERATION_REASON_LABELS,
  type ModerationReasonCode,
} from "@/lib/constants";
import { confirmTextMatches, expectedConfirmPhrase, type DangerousAdminAction } from "@/lib/admin/confirm";
import { formatPublicNumber } from "@/lib/utils";

export function AdminConfirmDialog({
  action,
  publicNumber,
  pending,
  error,
  reason,
  note,
  confirmText,
  onReason,
  onNote,
  onConfirmText,
  onCancel,
  onSubmit,
}: {
  action: DangerousAdminAction;
  publicNumber: number | null;
  pending: boolean;
  error: string | null;
  reason: ModerationReasonCode | "";
  note: string;
  confirmText: string;
  onReason: (value: ModerationReasonCode) => void;
  onNote: (value: string) => void;
  onConfirmText: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const titleId = useId();
  const phrase = expectedConfirmPhrase(action);
  const ready =
    Boolean(reason) &&
    confirmTextMatches({ confirmText, action, publicNumber }) &&
    !pending;
  const title =
    action === "remove"
      ? "Remove this sentence?"
      : action === "restore"
        ? "Restore this sentence?"
        : "Dismiss this report?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="inscribe w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onSubmit();
        }}
      >
        <h2 id={titleId} className="font-display text-2xl text-paper">
          {title}
        </h2>
        <p className="mt-2 text-sm text-mist">
          {publicNumber
            ? `${formatPublicNumber(publicNumber)} stays on the Wall.`
            : "This writes to the audit log."}{" "}
          After seal, a removal is a redaction. Give a reason and the confirmation
          phrase.
        </p>
        <label className="mt-5 block text-[11px] uppercase tracking-[0.16em] text-ash">
          Reason
          <select
            required
            value={reason}
            onChange={(e) => onReason(e.target.value as ModerationReasonCode)}
            className="field mt-2 w-full"
          >
            <option value="">Select a reason</option>
            {MODERATION_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {MODERATION_REASON_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-[11px] uppercase tracking-[0.16em] text-ash">
          Note (optional)
          <input
            value={note}
            onChange={(e) => onNote(e.target.value)}
            maxLength={400}
            className="field mt-2 w-full"
          />
        </label>
        <label className="mt-4 block text-[11px] uppercase tracking-[0.16em] text-ash">
          Type {phrase}
          {publicNumber ? ` or ${formatPublicNumber(publicNumber)}` : ""}
          <input
            value={confirmText}
            onChange={(e) => onConfirmText(e.target.value)}
            autoComplete="off"
            className="field mt-2 w-full font-mono"
            placeholder={phrase}
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-blood" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex gap-2">
          <button type="button" className="btn btn-line flex-1" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!ready}>
            {pending ? "Working…" : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
