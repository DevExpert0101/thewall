"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { FailureRecovery } from "@/components/failure-recovery";
import { MessageComposer, composerCanContinue } from "@/components/message-composer";
import { PublishSuccess } from "@/components/publish-success";
import { TurnstileGate } from "@/components/turnstile-gate";
import { WallKeyPanel } from "@/components/wall-key-panel";
import { BRAND } from "@/lib/brand";
import { PAY_AT_CLOSE_POLICY } from "@/lib/payment/close-policy";
import { useSyncedNow } from "@/lib/event/clock";
import {
  CLOSED_LOCK_LINE,
  eventPresentation,
  remainingMsFrom,
  remainingNotice,
} from "@/lib/event/remaining";
import { rememberOwnedMark } from "@/lib/ownership/store";
import {
  PAY_CTA_DOLLARS,
  classifyCheckoutError,
  paymentLoadingLine,
  paymentStepBody,
  paymentStepTitle,
  visitorPaymentCopy,
} from "@/lib/payment/copy";
import type { PaymentNetwork } from "@/lib/payment/types";
import { ensureAnonymousSession } from "@/lib/session-client";
import { useSheetBox } from "@/lib/ui/sheet-viewport";
import { cn } from "@/lib/utils";

type Step =
  | "write"
  | "preview"
  | "challenge"
  | "ticket"
  | "confirm"
  | "creating"
  | "paying"
  | "pending"
  | "verifying"
  | "celebrate"
  | "error";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  endsAt: string;
  serverNow: string;
  editionNumber?: number;
};

const BUSY: Step[] = ["creating", "paying", "verifying"];
const SETTLE: Step[] = ["paying", "pending", "verifying", "celebrate"];
const CHECKOUT_STORAGE = "thewall:checkout";

type StoredCheckout = {
  intentId: string;
  paymentId: string;
  expiresAt: string;
  text: string;
  wallKey?: string;
};

function readStoredCheckout(): StoredCheckout | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCheckout;
    if (!parsed.intentId || !parsed.paymentId || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(CHECKOUT_STORAGE);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistCheckout(value: StoredCheckout) {
  try {
    sessionStorage.setItem(CHECKOUT_STORAGE, JSON.stringify(value));
  } catch {
    // private recovery is best-effort
  }
}

function clearStoredCheckout() {
  try {
    sessionStorage.removeItem(CHECKOUT_STORAGE);
  } catch {
    // ignore
  }
}

type DialogError = { title: string; recovery: string; money?: string; code?: string };

function asDialogError(code: string | undefined, fallback?: { title?: string; recovery?: string }): DialogError {
  return { ...visitorPaymentCopy(code, fallback), code };
}

export function PublishDialog({ open, onOpenChange, enabled, endsAt, serverNow, editionNumber }: Props) {
  const [text, setText] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("write");
  const [error, setError] = useState<DialogError | null>(null);
  const [result, setResult] = useState<{
    publicNumber: number;
    ownershipToken: string;
    text: string;
  } | null>(null);
  const [wallKey, setWallKey] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{
    intentId: string;
    expiresAt: string;
    amount: string;
    recipient: string;
    network: PaymentNetwork;
    simulated?: boolean;
    simulatedPaymentId?: string;
  } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [checkout, setCheckout] = useState<{
    intentId: string;
    paymentId: string;
    expiresAt: string;
  } | null>(null);
  const verifyRetryRef = useRef<number | null>(null);
  const verifyAttemptsRef = useRef(0);
  const wallKeyRef = useRef<string | null>(null);
  wallKeyRef.current = wallKey;
  const bodyRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const sheetBox = useSheetBox(open);

  const busy = BUSY.includes(step);
  const now = useSyncedNow(serverNow);
  const remaining = remainingMsFrom(endsAt, now);
  const accepting = enabled && remaining > 0;
  const notice = remainingNotice(eventPresentation(accepting ? "live" : "finalizing", remaining), remaining);
  const closedOut = open && !accepting && !SETTLE.includes(step) && !(step === "error" && checkout);
  const shownStep = closedOut ? "error" : step;
  const shownError = closedOut
    ? { title: BRAND.closedMark, recovery: CLOSED_LOCK_LINE }
    : error;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let restoreId: number | undefined;
    const stored = readStoredCheckout();
    if (stored) {
      restoreId = window.setTimeout(() => {
        if (cancelled) return;
        setCheckout({
          intentId: stored.intentId,
          paymentId: stored.paymentId,
          expiresAt: stored.expiresAt,
        });
        if (stored.text) setPreviewText(stored.text);
        if (stored.wallKey) {
          setWallKey(stored.wallKey);
          wallKeyRef.current = stored.wallKey;
        }
        setStep("pending");
        setError(
          asDialogError("PAYMENT_PENDING", {
            title: "A $1 payment may already be in progress",
            recovery: "Confirming this payment — do not pay again.",
          }),
        );
        void verifyOnServer(stored.intentId, stored.paymentId, stored.wallKey);
      }, 0);
    } else {
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "compose_started" }),
      });
    }
    void ensureAnonymousSession().then((session) => {
      if (cancelled) return;
      if (!session.configured) {
        if (session.simulation) {
          setSimulated(true);
          setToken("simulation-local");
          setSessionReady(true);
          return;
        }
        setSessionReady(false);
        setError({
          title: "Publishing is unavailable",
          recovery: "You can keep reading the wall. Try again later to leave a sentence.",
        });
        return;
      }
      if (session.error) {
        setSessionReady(false);
        setError({
          title: session.error,
          recovery:
            session.recovery ??
            "You can keep reading the wall. Try opening this dialog again.",
        });
        return;
      }
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
      if (restoreId !== undefined) window.clearTimeout(restoreId);
      if (verifyRetryRef.current !== null) window.clearTimeout(verifyRetryRef.current);
    };
  }, [open]);

  function resetComposer() {
    setStep("write");
    setError(null);
    setToken(null);
    setPreviewText("");
    setResult(null);
    setWallKey(null);
    setKeySaved(false);
    setPrepared(null);
    setCheckout(null);
    clearStoredCheckout();
  }

  function clearVerifyRetry() {
    if (verifyRetryRef.current !== null) {
      window.clearTimeout(verifyRetryRef.current);
      verifyRetryRef.current = null;
    }
  }

  function scheduleVerifyRetry(intentId: string, paymentId: string) {
    clearVerifyRetry();
    if (verifyAttemptsRef.current >= 12) return;
    verifyAttemptsRef.current += 1;
    verifyRetryRef.current = window.setTimeout(() => {
      void verifyOnServer(intentId, paymentId);
    }, 4000);
  }

  async function verifyOnServer(intentId: string, paymentId: string, ownershipKey?: string) {
    setStep("verifying");
    setError(null);
    try {
      const verifyRes = await fetch("/api/publish/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId,
          transactionHash: paymentId,
        }),
      });
      const verified = await verifyRes.json();
      if (verifyRes.ok && typeof verified.publicNumber === "number") {
        clearVerifyRetry();
        verifyAttemptsRef.current = 0;
        const key = ownershipKey ?? wallKeyRef.current ?? "";
        setResult({
          publicNumber: verified.publicNumber,
          ownershipToken: key,
          text: previewText || text.trim(),
        });
        if (key) {
          rememberOwnedMark({
            message: verified.publicNumber,
            claimKey: key,
            text: previewText || text.trim(),
            publishedAt: verified.publishedAt,
          });
        }
        setStep("celebrate");
        clearStoredCheckout();
        return;
      }
      if (verified.code === "PAYMENT_PENDING") {
        setStep("pending");
        setError(asDialogError(verified.code, { title: verified.error, recovery: verified.recovery }));
        scheduleVerifyRetry(intentId, paymentId);
        return;
      }
      clearVerifyRetry();
      setStep("error");
      setError(asDialogError(verified.code, { title: verified.error, recovery: verified.recovery }));
    } catch {
      clearVerifyRetry();
      setStep("error");
      setError(asDialogError("UNAVAILABLE"));
    }
  }

  async function goPreview() {
    if (!accepting || !composerCanContinue(text)) return;
    setError(null);
    setPreviewText(text.trim());
    setStep("preview");
  }

  async function goChallenge() {
    if (!accepting) return;
    setError(null);
    const res = await fetch("/api/publish/preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: previewText || text,
        ...(token ? { turnstileToken: token } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStep("write");
      setError({
        title: data.error ?? "This sentence cannot be published",
        recovery: data.recovery ?? "Please revise it. You have not been charged.",
      });
      return;
    }
    setPreviewText(data.text ?? previewText);
    if (simulated) {
      void issueTicket("simulation-local");
      return;
    }
    if (token) {
      void issueTicket();
      return;
    }
    setStep("challenge");
  }

  async function issueTicket(overrideToken?: string) {
    const challenge = overrideToken ?? token;
    if (!accepting || !challenge || !composerCanContinue(previewText || text)) return;
    if (prepared && wallKey) {
      setStep("ticket");
      return;
    }
    setError(null);
    setStep("creating");
    try {
      const intentRes = await fetch("/api/publish/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: previewText || text, turnstileToken: challenge }),
      });
      const intent = await intentRes.json();
      if (!intentRes.ok) {
        const code = intent.code as string | undefined;
        setStep(code === "MODERATION_REJECTED" || code === "VALIDATION" ? "write" : "challenge");
        setError({
          title: intent.error ?? "Could not create your Wall Key",
          recovery: intent.recovery ?? "Revise and try again. You have not been charged.",
        });
        return;
      }
      const network = intent.network === "base" ? "base" : "base-sepolia";
      setPrepared({
        intentId: intent.intentId,
        expiresAt: intent.expiresAt,
        amount: intent.amount,
        recipient: intent.recipient,
        network,
        simulated: Boolean(intent.simulated),
        simulatedPaymentId:
          typeof intent.simulatedPaymentId === "string" ? intent.simulatedPaymentId : undefined,
      });
      setWallKey(intent.wallKey);
      setStep("ticket");
    } catch {
      setStep("challenge");
      setError({
        title: "Network failure",
        recovery: "Check your connection and try again. You have not been charged.",
      });
    }
  }

  async function publish() {
    if (!accepting || !prepared || !wallKey || !composerCanContinue(previewText || text)) return;
    setError(null);
    verifyAttemptsRef.current = 0;
    clearVerifyRetry();
    try {
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "payment_initiated" }),
      });

      setStep("paying");
      let paymentId: string;
      try {
        if (prepared.simulated && prepared.simulatedPaymentId) {
          paymentId = prepared.simulatedPaymentId;
        } else {
          const { initiateBasePayment } = await import("@/lib/payment/browser");
          const paid = await initiateBasePayment({
            amount: prepared.amount,
            recipient: prepared.recipient,
            network: prepared.network,
          });
          paymentId = paid.id;
        }
      } catch (err) {
        setStep("confirm");
        setError(asDialogError(classifyCheckoutError(err)));
        return;
      }

      const nextCheckout = {
        intentId: prepared.intentId,
        paymentId,
        expiresAt: prepared.expiresAt,
      };
      setCheckout(nextCheckout);
      persistCheckout({
        ...nextCheckout,
        text: previewText || text.trim(),
        wallKey,
      });
      await verifyOnServer(prepared.intentId, paymentId);
    } catch {
      setStep("error");
      setError(
        asDialogError(undefined, {
          title: "The Wall could not confirm the payment yet",
          recovery: "If you already paid, tap Confirm payment. Do not pay again.",
        }),
      );
    }
  }

  const paidAfterClose = error?.code === "PAID_AFTER_CLOSE";
  const canRetryVerify =
    Boolean(checkout?.paymentId) && (step === "pending" || step === "error") && !paidAfterClose;
  const docked = !closedOut && step !== "celebrate";
  const loadingLine = paymentLoadingLine(step, !prepared);

  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (!shownError) return;
    alertRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [shownError]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (busy) return;
          if (step === "pending" || (step === "error" && checkout?.paymentId)) {
            // keep checkout so verification can be retried
          } else if (step === "celebrate") {
            resetComposer();
          } else {
            setStep("write");
            setError(null);
          }
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50" />
        <Dialog.Content
          className={cn(
            "dialog-sheet fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] border-t p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(34rem,calc(100vw-2rem))] sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border sm:p-8",
            docked ? "dialog-sheet-flow" : "overflow-y-auto",
          )}
          style={
            sheetBox
              ? { top: sheetBox.top, height: sheetBox.height, maxHeight: sheetBox.height, bottom: "auto" }
              : undefined
          }
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div ref={bodyRef} className={docked ? "dialog-body" : undefined}>
          {shownStep !== "celebrate" ? (
            <>
              <p className="kicker">
                {notice ? <span className="text-flame">{notice} </span> : null}
                Write. Preview. Your Wall Key. Pay $1.
              </p>
              <Dialog.Title className="mt-4 pr-14 font-display text-[clamp(1.85rem,5vw,2.35rem)] leading-[0.95] text-paper">
                {closedOut ? BRAND.closed : paymentStepTitle(step)}
              </Dialog.Title>
              <Dialog.Description className="lede mt-3 text-[0.95rem]">
                {closedOut ? CLOSED_LOCK_LINE : paymentStepBody(step)}
              </Dialog.Description>
            </>
          ) : (
            <>
              <Dialog.Title className="sr-only">You are on The Wall</Dialog.Title>
              <Dialog.Description className="sr-only">
                Your sentence is now part of The Wall.
              </Dialog.Description>
            </>
          )}

          {step === "celebrate" && result ? (
            <PublishSuccess
              publicNumber={result.publicNumber}
              text={result.text}
              endsAt={endsAt}
              serverNow={serverNow}
              ownershipToken={result.ownershipToken}
              editionNumber={editionNumber}
            />
          ) : null}

          {accepting && (step === "write" || (step === "error" && !checkout && !previewText)) ? (
            <div className="mt-6">
              <MessageComposer
                value={text}
                onChange={(value) => {
                  setText(value);
                  setToken(null);
                }}
                onContinue={() => void goPreview()}
                disabled={busy}
                autoFocus={open && step === "write"}
              />
            </div>
          ) : null}

          {!closedOut && step === "preview" ? (
            <blockquote className="inscribe mt-8 p-5 sm:p-6">
              <p className="font-display text-2xl leading-snug text-paper sm:text-3xl">“{previewText}”</p>
            </blockquote>
          ) : null}

          {!closedOut && (step === "preview" || step === "challenge") && !simulated ? (
            <div className="mt-6">
              <TurnstileGate onToken={setToken} />
            </div>
          ) : null}

          {!closedOut && step === "ticket" && wallKey ? (
            <div className="mt-6">
              <WallKeyPanel wallKey={wallKey} text={previewText} />
            </div>
          ) : null}

          {!closedOut &&
          (step === "ticket" ||
            step === "confirm" ||
            step === "creating" ||
            step === "paying" ||
            step === "verifying" ||
            step === "pending" ||
            (step === "error" && Boolean(checkout))) ? (
            <blockquote className="pay-plaque mt-6 p-5">
              <p className="kicker text-bronze">To be inscribed</p>
              <p className="mt-3 font-display text-xl leading-snug text-paper sm:text-2xl">“{previewText}”</p>
              <p className="mt-5 font-mono text-sm tracking-[0.18em] text-bronze">
                $1
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ash">
                One dollar, once. No account. Payment is not your name.
              </p>
              {prepared?.simulated ? (
                <p className="mt-3 text-xs leading-relaxed text-bronze">
                  Practice mode — no money is taken.
                </p>
              ) : null}
            </blockquote>
          ) : null}

          {shownError && shownStep !== "celebrate" ? (
            <div ref={alertRef}>
              <FailureRecovery
                title={shownError.title}
                body={shownError.recovery}
                money={shownError.money}
                policy={shownError.code === "PAID_AFTER_CLOSE" ? PAY_AT_CLOSE_POLICY.visitorLine : undefined}
              />
            </div>
          ) : null}

          {!closedOut && loadingLine ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-mist" role="status" aria-live="polite">
              <span className="live-dot" aria-hidden="true" />
              {loadingLine}
            </p>
          ) : null}
          </div>

          {docked ? (
            <div className="dialog-dock">
              {loadingLine ? (
                <p className="dialog-dock-status" aria-hidden="true">
                  <span className="live-dot" aria-hidden="true" />
                  {loadingLine}
                </p>
              ) : null}
              {canRetryVerify && checkout ? (
                <button
                  type="button"
                  onClick={() => void verifyOnServer(checkout.intentId, checkout.paymentId)}
                  className="btn btn-line w-full"
                >
                  Confirm payment
                </button>
              ) : null}

              {step === "write" || (step === "error" && !checkout) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === "error") {
                      setStep("write");
                      setError(null);
                      return;
                    }
                    void goPreview();
                  }}
                  disabled={!accepting || !sessionReady || !composerCanContinue(text) || busy}
                  className="btn btn-primary w-full"
                >
                  {step === "error" ? "Revise sentence" : "Preview"}
                </button>
              ) : null}

              {step === "preview" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void goChallenge()}
                    disabled={!sessionReady}
                    className="btn btn-primary w-full"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("write");
                      setError(null);
                    }}
                    className="btn-ghost min-h-11"
                  >
                    Edit sentence
                  </button>
                </>
              ) : null}

              {step === "challenge" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void issueTicket()}
                    disabled={!token || busy}
                    className="btn btn-primary w-full"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("preview");
                      setToken(null);
                    }}
                    className="btn-ghost min-h-11"
                  >
                    Back to preview
                  </button>
                </>
              ) : null}

              {step === "ticket" ? (
                <>
                  <label className="flex items-start gap-3 text-left text-sm leading-relaxed text-mist">
                    <input
                      type="checkbox"
                      checked={keySaved}
                      onChange={(event) => setKeySaved(event.target.checked)}
                      className="mt-1 size-4 shrink-0 accent-[var(--ember)]"
                    />
                    I saved my Wall Key
                  </label>
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={!accepting || !sessionReady || !prepared || !wallKey || !keySaved || busy}
                    className="btn btn-ember w-full"
                  >
                    {PAY_CTA_DOLLARS}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(simulated || token ? "preview" : "challenge")}
                    className="btn-ghost min-h-11"
                  >
                    Back
                  </button>
                </>
              ) : null}

              {step === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={!accepting || !sessionReady || !prepared || !wallKey || busy}
                    className="btn btn-ember w-full"
                  >
                    {PAY_CTA_DOLLARS}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("ticket")}
                    className="btn-ghost min-h-11"
                  >
                    Back to Wall Key
                  </button>
                </>
              ) : null}

              {step === "error" && !checkout ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep("write");
                    setError(null);
                    setToken(null);
                  }}
                  className="btn-ghost min-h-11"
                >
                  Start over — no money was taken
                </button>
              ) : null}
            </div>
          ) : null}

          {busy ? null : (
            <Dialog.Close className="btn-ghost absolute right-3 top-3 min-h-11 min-w-11 tracking-[0.12em] sm:right-4 sm:top-4">
              Close
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
