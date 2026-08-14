"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { MessageComposer, composerCanContinue } from "@/components/message-composer";
import { PublishSuccess } from "@/components/publish-success";
import { TurnstileGate } from "@/components/turnstile-gate";
import { WallKeyPanel } from "@/components/wall-key-panel";
import { PRICE_USDC } from "@/lib/constants";
import { rememberOwnedMark } from "@/lib/ownership/store";
import type { PaymentNetwork } from "@/lib/payment/types";
import { ensureAnonymousSession } from "@/lib/session-client";

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
};

const BUSY: Step[] = ["creating", "paying", "verifying"];
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

function titleFor(step: Step): string {
  if (step === "write") return "Leave your mark";
  if (step === "preview") return "This is the sentence";
  if (step === "challenge") return "Confirm you are human";
  if (step === "ticket") return "Save your Wall Key";
  if (step === "confirm") return "One dollar. One sentence.";
  if (step === "creating") return "Preparing checkout";
  if (step === "paying") return "Waiting for payment";
  if (step === "verifying") return "The Wall is checking the chain";
  if (step === "pending") return "The payment is still arriving";
  if (step === "celebrate") return "You are on The Wall";
  return "Something stopped";
}

export function PublishDialog({ open, onOpenChange, enabled, endsAt, serverNow }: Props) {
  const [text, setText] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("write");
  const [error, setError] = useState<{ title: string; recovery: string } | null>(null);
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
  const [checkout, setCheckout] = useState<{
    intentId: string;
    paymentId: string;
    expiresAt: string;
  } | null>(null);

  const busy = BUSY.includes(step);

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
        if (stored.wallKey) setWallKey(stored.wallKey);
        setStep("pending");
        setError({
          title: "A payment may already be in progress",
          recovery: "Retry verification — do not send another payment.",
        });
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
    };
  }, [open]);

  function resetComposer() {
    setStep("write");
    setError(null);
    setToken(null);
    setPreviewText("");
    setResult(null);
    setWallKey(null);
    setPrepared(null);
    setCheckout(null);
    clearStoredCheckout();
  }

  async function verifyOnServer(intentId: string, paymentId: string) {
    setStep("verifying");
    setError(null);
    const verifyRes = await fetch("/api/publish/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intentId,
        transactionHash: paymentId,
      }),
    });
    const verified = await verifyRes.json();
    if (verifyRes.ok) {
      const key = wallKey ?? "";
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
      setError({
        title: verified.error ?? "Payment is still confirming",
        recovery: verified.recovery ?? "Keep this window open. Retry verification — do not pay again.",
      });
      return;
    }
    setStep("error");
    setError({
      title: verified.error ?? "Verification failed",
      recovery: verified.recovery ?? "If USDC left your wallet, wait and retry verification — do not pay twice.",
    });
  }

  async function goPreview() {
    if (!composerCanContinue(text)) return;
    setError(null);
    setPreviewText(text.trim());
    setStep("preview");
  }

  async function goChallenge() {
    setError(null);
    const res = await fetch("/api/publish/preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: previewText || text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStep("write");
      setError({
        title: data.error ?? "This sentence cannot be published",
        recovery: data.recovery ?? "Revise the text. You have not been charged.",
      });
      return;
    }
    setPreviewText(data.text ?? previewText);
    setStep("challenge");
  }

  async function issueTicket() {
    if (!enabled || !token || !composerCanContinue(previewText || text)) return;
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
        body: JSON.stringify({ message: previewText || text, turnstileToken: token }),
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
    if (!enabled || !prepared || !wallKey || !composerCanContinue(previewText || text)) return;
    setError(null);
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
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        setStep("confirm");
        if (message.includes("user rejected") || message.includes("denied") || message.includes("cancel")) {
          setError({
            title: "Payment canceled",
            recovery: "No message was published. Your Wall Key is still valid for this checkout.",
          });
          return;
        }
        if (message.includes("insufficient")) {
          setError({
            title: "Insufficient USDC",
            recovery: "Add 1.00 USDC on Base, then try again. Do not connect a wallet as an account.",
          });
          return;
        }
        setError({
          title: "Payment failed",
          recovery: "Payment did not complete. You have not been charged for a message.",
        });
        return;
      }

      setCheckout({
        intentId: prepared.intentId,
        paymentId,
        expiresAt: prepared.expiresAt,
      });
      persistCheckout({
        intentId: prepared.intentId,
        paymentId,
        expiresAt: prepared.expiresAt,
        text: previewText || text.trim(),
        wallKey,
      });
      await verifyOnServer(prepared.intentId, paymentId);
    } catch {
      setStep(checkout ? "error" : "confirm");
      setError({
        title: "Network failure",
        recovery: "Check your connection and try again. You have not been charged unless payment already completed.",
      });
    }
  }

  const canRetryVerify = Boolean(checkout?.paymentId) && (step === "pending" || step === "error");

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
          className="dialog-sheet fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto border-t p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(34rem,calc(100vw-2rem))] sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border sm:p-8"
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {step !== "celebrate" ? (
            <>
              <p className="kicker">
                Write → Preview → Key → Pay
              </p>
              <Dialog.Title className="mt-4 font-display text-[clamp(1.85rem,5vw,2.35rem)] leading-[0.95] text-paper">
                {titleFor(step)}
              </Dialog.Title>
              <Dialog.Description className="lede mt-3 text-[0.95rem]">
                {step === "write"
                  ? "140 characters. No name. No edit after it is on the wall."
                  : step === "preview"
                    ? "This is exactly how the wall will show it. No profile. No second draft after payment."
                    : step === "challenge"
                      ? "A quick check so the wall stays a monument, not a bot farm."
                      : step === "ticket"
                        ? "This is your coat-check ticket. Payment is not identity. Whoever holds this key owns the sentence."
                      : step === "confirm"
                        ? `${PRICE_USDC} USDC on Base. Pay only — no account, no email, no wallet sign-in.`
                        : "Do not close this window."}
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
              simulation={Boolean(prepared?.simulated)}
            />
          ) : null}

          {step === "write" || (step === "error" && !checkout && !previewText) ? (
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

          {step === "preview" ? (
            <blockquote className="inscribe mt-8 p-5 sm:p-6">
              <p className="font-display text-2xl leading-snug text-paper sm:text-3xl">“{previewText}”</p>
            </blockquote>
          ) : null}

          {step === "challenge" ? (
            <div className="mt-6">
              <TurnstileGate onToken={setToken} />
            </div>
          ) : null}

          {step === "ticket" && wallKey ? (
            <div className="mt-6">
              <WallKeyPanel wallKey={wallKey} text={previewText} />
            </div>
          ) : null}

          {step === "confirm" || step === "creating" || step === "paying" || step === "verifying" ? (
            <blockquote className="pay-plaque mt-6 p-5">
              <p className="kicker text-bronze">To be inscribed</p>
              <p className="mt-3 font-display text-xl leading-snug text-paper sm:text-2xl">“{previewText}”</p>
              <p className="mt-5 font-mono text-sm tracking-[0.18em] text-bronze">
                {PRICE_USDC} USDC · Base
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ash">
                Payment publishes the sentence. Your Wall Key is ownership. The paying wallet is not your identity.
              </p>
              {prepared?.simulated ? (
                <p className="mt-3 text-xs leading-relaxed text-bronze">
                  Simulation — no USDC leaves a wallet.
                </p>
              ) : null}
            </blockquote>
          ) : null}

          {error && step !== "celebrate" ? (
            <div className="mt-4 border border-blood/40 bg-blood/10 p-3" role="alert">
              <p className="text-sm text-paper">{error.title}</p>
              <p className="mt-1 text-sm text-mist">{error.recovery}</p>
            </div>
          ) : null}

          {step === "creating" ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-mist">
              <span className="live-dot" aria-hidden="true" />
              {prepared ? `Preparing a ${PRICE_USDC} USDC checkout…` : "Issuing your Wall Key…"}
            </p>
          ) : null}
          {step === "paying" ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-mist">
              <span className="live-dot" aria-hidden="true" />
              Waiting for payment. Do not close this window.
            </p>
          ) : null}
          {step === "verifying" ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-mist">
              <span className="live-dot" aria-hidden="true" />
              Verifying the transaction on Base. Publishing waits for this.
            </p>
          ) : null}
          {step === "pending" ? (
            <p className="mt-5 text-sm text-mist">
              The payment is still confirming. Retry verification — do not send another payment.
            </p>
          ) : null}

          {step === "celebrate" ? null : (
            <div className="mt-6 flex flex-col gap-2">
              {canRetryVerify && checkout ? (
                <button
                  type="button"
                  onClick={() => void verifyOnServer(checkout.intentId, checkout.paymentId)}
                  className="btn btn-line w-full"
                >
                  Retry verification
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
                  disabled={!enabled || !sessionReady || !composerCanContinue(text) || busy}
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
                    className="btn-ghost"
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
                    className="btn-ghost"
                  >
                    Back to preview
                  </button>
                </>
              ) : null}

              {step === "ticket" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep("confirm")}
                    disabled={!wallKey}
                    className="btn btn-primary w-full"
                  >
                    I saved my Wall Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("challenge")}
                    className="btn-ghost"
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
                    disabled={!enabled || !sessionReady || !prepared || !wallKey || busy}
                    className="btn btn-ember w-full"
                  >
                    Pay {PRICE_USDC} USDC
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("ticket")}
                    className="btn-ghost"
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
                  className="btn-ghost"
                >
                  Start over — you have not been charged
                </button>
              ) : null}
            </div>
          )}

          {busy ? null : (
            <Dialog.Close className="btn-ghost absolute right-3 top-3 min-w-11 tracking-[0.12em] sm:right-4 sm:top-4">
              Close
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
