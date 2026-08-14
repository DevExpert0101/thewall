import { getAddress, type Hex } from "viem";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { CHAIN_IDS, PRICE_USDC } from "@/lib/constants";
import { assertExactUsdcAmount } from "@/lib/payment/amount";
import { assertTxBoundToCheckout } from "@/lib/payment/fulfillment";
import type {
  OnchainPayment,
  PaymentNetwork,
  SdkPaymentStatus,
  VerifiedPayment,
} from "@/lib/payment/types";

function asAddress(value: string | null | undefined): `0x${string}` | null {
  if (!value) return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

/**
 * Independent proof: on-chain USDC transfer is required.
 * SDK status may wait for a userOp, but it is never enough to publish.
 */
export function evaluatePaymentProof(input: {
  paymentId: string;
  expectedAmount: string;
  expectedRecipient: `0x${string}`;
  expectedNetwork: PaymentNetwork;
  sdk: SdkPaymentStatus;
  onchain: OnchainPayment;
  intentCreatedAt?: string;
}): VerifiedPayment {
  const expectedRecipient = getAddress(input.expectedRecipient);
  const expectedChainId = CHAIN_IDS[input.expectedNetwork];

  if (input.sdk.status === "failed") {
    throw new AppError(ERROR_CODES.PAYMENT_FAILED, "Payment failed.");
  }

  if (input.onchain.receiptFailed) {
    throw new AppError(ERROR_CODES.PAYMENT_FAILED, "Payment failed on-chain.");
  }

  if (!input.onchain.found || input.onchain.pending || input.onchain.amountAtomic === null) {
    if (input.sdk.status === "failed") {
      throw new AppError(ERROR_CODES.PAYMENT_FAILED, "Payment failed.");
    }
    throw new AppError(ERROR_CODES.PAYMENT_PENDING, "Payment is still confirming.", 202);
  }

  if (input.onchain.chainId !== null && input.onchain.chainId !== expectedChainId) {
    throw new AppError(ERROR_CODES.WRONG_NETWORK, "Transaction is on the wrong network.");
  }

  const onchainRecipient = asAddress(input.onchain.recipient);
  if (!onchainRecipient || onchainRecipient !== expectedRecipient) {
    throw new AppError(ERROR_CODES.WRONG_RECIPIENT, "Payment recipient mismatch.");
  }

  assertExactUsdcAmount(input.onchain.amountAtomic);

  const onchainSender = asAddress(input.onchain.sender);
  if (!onchainSender) {
    throw new AppError(ERROR_CODES.PAYMENT_INCOMPLETE, "Payment sender missing.");
  }

  const sdkSender = asAddress(input.sdk.sender);
  if (sdkSender && sdkSender !== onchainSender) {
    throw new AppError(ERROR_CODES.PAYMENT_INCOMPLETE, "Payment sender mismatch.");
  }

  const sdkRecipient = asAddress(input.sdk.recipient);
  if (sdkRecipient && sdkRecipient !== expectedRecipient) {
    throw new AppError(ERROR_CODES.WRONG_RECIPIENT, "Payment recipient mismatch.");
  }

  if (!input.intentCreatedAt) {
    throw new AppError(ERROR_CODES.PAYMENT_INCOMPLETE, "Payment cannot be bound to checkout.");
  }
  assertTxBoundToCheckout(input.onchain.minedAt, input.intentCreatedAt);

  return {
    id: input.paymentId.toLowerCase(),
    status: "completed",
    sender: onchainSender.toLowerCase(),
    recipient: expectedRecipient.toLowerCase(),
    amount: PRICE_USDC,
    network: input.expectedNetwork,
  };
}

export function assertExpectedNetwork(
  actual: PaymentNetwork,
  expected: PaymentNetwork,
): void {
  if (actual !== expected) {
    throw new AppError(ERROR_CODES.WRONG_NETWORK, "Unexpected payment network.");
  }
}

export function normalizePaymentId(paymentId: string): Hex {
  const normalized = paymentId.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
    throw new AppError(ERROR_CODES.PAYMENT_INCOMPLETE, "Invalid transaction id.");
  }
  return normalized as Hex;
}
