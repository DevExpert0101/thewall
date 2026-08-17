import { BRAND } from "@/lib/brand";
import { ERROR_CODES } from "@/lib/errors";

export const PAY_CTA_DOLLARS = "Pay $1";
export const PAY_CTA_USDC = "Pay 1 USDC";

export type PaymentMoneyStatus = "not_taken" | "confirming" | "published" | "already_used";

export type PaymentVisitorCopy = {
  title: string;
  recovery: string;
  money: string;
};

const NOT_TAKEN = "No money was taken.";
const CONFIRMING =
  "If $1 left your payment app, it is not lost. Confirm this payment — do not pay again.";
const ALREADY_USED = "This payment already published a sentence. Do not pay again.";

const BY_CODE: Partial<Record<string, PaymentVisitorCopy>> = {
  [ERROR_CODES.PAYMENT_CANCELED]: {
    title: "Payment canceled",
    recovery: "You closed the payment. The sentence is not on The Wall.",
    money: NOT_TAKEN,
  },
  [ERROR_CODES.INSUFFICIENT_USDC]: {
    title: "Not enough to pay $1",
    recovery: "Add $1 in the payment window, then try Pay $1 again. You do not need to create an account.",
    money: NOT_TAKEN,
  },
  [ERROR_CODES.PAYMENT_FAILED]: {
    title: "Payment did not finish",
    recovery: "The sentence is not on The Wall. Try Pay $1 again when you are ready.",
    money: NOT_TAKEN,
  },
  [ERROR_CODES.PAYMENT_INCOMPLETE]: {
    title: "Payment incomplete",
    recovery: "Nothing was published. You can try Pay $1 again.",
    money: NOT_TAKEN,
  },
  [ERROR_CODES.PAYMENT_PENDING]: {
    title: "Your $1 is still confirming",
    recovery: "Keep this page open, or come back and tap Confirm payment. Confirmation can take a minute.",
    money: CONFIRMING,
  },
  [ERROR_CODES.WRONG_NETWORK]: {
    title: "Payment opened in the wrong place",
    recovery: "The sentence is not on The Wall yet. Tap Confirm payment if you already paid. Do not send a second payment.",
    money: CONFIRMING,
  },
  [ERROR_CODES.WRONG_AMOUNT]: {
    title: "The payment amount did not match $1",
    recovery: "Do not pay again. Tap Confirm payment, or contact support with your payment receipt.",
    money: CONFIRMING,
  },
  [ERROR_CODES.WRONG_RECIPIENT]: {
    title: "This payment did not reach The Wall",
    recovery: "Do not pay again. Tap Confirm payment, or contact support with your payment receipt.",
    money: CONFIRMING,
  },
  [ERROR_CODES.TX_ALREADY_USED]: {
    title: "This payment was already used",
    recovery: "Look for your sentence on The Wall. A second payment would publish a second sentence.",
    money: ALREADY_USED,
  },
  [ERROR_CODES.INTENT_FULFILLED]: {
    title: "This payment already published a sentence",
    recovery: "Look for your number on The Wall. Do not pay again.",
    money: ALREADY_USED,
  },
  [ERROR_CODES.HASH_MISMATCH]: {
    title: "This checkout no longer matches the sentence",
    recovery: "Do not pay again. Confirm this payment first. Start a new sentence only after this one is resolved.",
    money: CONFIRMING,
  },
  [ERROR_CODES.INTENT_EXPIRED]: {
    title: "This checkout expired",
    recovery: "If you already paid, tap Confirm payment. If you did not pay, start again — a new checkout will not take a second $1 unless you pay again.",
    money: CONFIRMING,
  },
  [ERROR_CODES.INTENT_NOT_FOUND]: {
    title: "This checkout could not be found",
    recovery: "If you already paid, tap Confirm payment. Do not send a second payment.",
    money: CONFIRMING,
  },
  [ERROR_CODES.PAID_AFTER_CLOSE]: {
    title: "The Wall closed before this sentence could be carved",
    recovery:
      "Your payment was received. The sentence was not published. Do not pay again. A refund is not promised. Keep your receipt and contact support if you need a record of the transfer.",
    money: "Money was taken. No second payment will publish this sentence.",
  },
  [ERROR_CODES.UNAVAILABLE]: {
    title: "The Wall is temporarily unreachable",
    recovery: "You can keep reading. If you already paid, tap Confirm payment — do not pay again.",
    money: CONFIRMING,
  },
  [ERROR_CODES.ARCHIVE_SEAL_FAILED]: {
    title: "The archive is not verified yet",
    recovery: "Ranks may already be public. Retry the seal. Do not treat this Wall as verified until the fingerprint is recorded.",
    money: NOT_TAKEN,
  },
};

export function classifyCheckoutError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("denied") ||
    message.includes("cancel") ||
    message.includes("aborted") ||
    message.includes("closed")
  ) {
    return ERROR_CODES.PAYMENT_CANCELED;
  }
  if (message.includes("insufficient") || message.includes("not enough") || message.includes("exceeds balance")) {
    return ERROR_CODES.INSUFFICIENT_USDC;
  }
  if (
    message.includes("wrong network") ||
    message.includes("unsupported chain") ||
    message.includes("switch chain") ||
    message.includes("chain mismatch")
  ) {
    return ERROR_CODES.WRONG_NETWORK;
  }
  return ERROR_CODES.PAYMENT_FAILED;
}

export function visitorPaymentCopy(
  code: string | undefined,
  fallback?: { title?: string; recovery?: string },
): PaymentVisitorCopy {
  const known = code ? BY_CODE[code] : undefined;
  if (known) return known;
  return {
    title: fallback?.title ?? "Something stopped",
    recovery: fallback?.recovery ?? "The sentence is not on The Wall yet. If you paid, confirm this payment — do not pay again.",
    money: fallback?.recovery?.toLowerCase().includes("not been charged") ||
    fallback?.recovery?.toLowerCase().includes("no money")
      ? NOT_TAKEN
      : CONFIRMING,
  };
}

export function paymentStepTitle(step: string): string {
  if (step === "write") return BRAND.leaveYourMark;
  if (step === "preview") return "This is the sentence";
  if (step === "challenge") return "A quick check";
  if (step === "ticket") return "Save your Wall Key";
  if (step === "confirm") return "Pay $1 to publish";
  if (step === "creating") return "Preparing checkout";
  if (step === "paying") return "Complete the $1 payment";
  if (step === "verifying") return "Confirming your $1";
  if (step === "pending") return "Your $1 is still arriving";
  if (step === "celebrate") return "You are on The Wall";
  if (step === "canceled") return "Payment canceled";
  return "Something stopped";
}

export function paymentStepBody(step: string): string {
  if (step === "write") return "140 characters. No name. No edit after it is on the wall.";
  if (step === "preview") return "This is exactly how the wall will show it. No profile. No second draft after payment.";
  if (step === "challenge") return "A quick check so one person cannot flood the wall.";
  if (step === "ticket") return "This private key proves the sentence is yours. Keep it somewhere safe. We cannot recover it.";
  if (step === "confirm") return "Pay $1 once. No account. No email. The payment is not your identity.";
  if (step === "creating") return "Preparing your Wall Key and $1 checkout. No money is taken yet.";
  if (step === "paying") return "A payment window should be open. Approve $1 once. If you close it, nothing is published.";
  if (step === "verifying") return "Payment received. The Wall is confirming your $1 before your number is set. Do not pay again.";
  if (step === "pending") return "Confirmation is taking longer than usual. Your sentence is not on the Wall yet.";
  if (step === "canceled") return "You closed the payment. The sentence is not on The Wall. You can resume from here.";
  return "Do not close this window if you already paid.";
}

export function paymentLoadingLine(step: string, issuingKey: boolean): string | null {
  if (step === "creating") {
    return issuingKey ? "Preparing your Wall Key. No money is taken yet." : "Preparing the $1 checkout. No money is taken yet.";
  }
  if (step === "paying") return "Waiting for you to approve $1. Closing the window cancels — no money is taken.";
  if (step === "verifying") return "Confirming your $1. This can take a few seconds. Do not pay again.";
  if (step === "pending") return "Still confirming. You can wait here or tap Confirm payment. Do not pay again.";
  return null;
}
