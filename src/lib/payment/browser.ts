"use client";

import { pay } from "@base-org/account";
import { getAddress } from "viem";
import { PRICE_USDC } from "@/lib/constants";
import { getPublicTreasuryAddress } from "@/lib/env";
import { usdcAtomicEquals } from "@/lib/payment/amount-parse";
import type { CheckoutRequest, PaymentNetwork } from "@/lib/payment/types";

export function checkoutFromIntent(intent: {
  amount: string;
  recipient: string;
  network: PaymentNetwork;
}): CheckoutRequest {
  if (!usdcAtomicEquals(intent.amount)) {
    throw new Error("Price must be 1.00 USDC.");
  }
  const recipient = getAddress(intent.recipient) as `0x${string}`;
  const treasury = getPublicTreasuryAddress();
  if (recipient !== getAddress(treasury)) {
    throw new Error("Checkout recipient mismatch.");
  }
  return {
    amount: PRICE_USDC,
    recipient,
    testnet: intent.network === "base-sepolia",
    network: intent.network,
  };
}

/**
 * Opens Base Pay. The returned id is a handle for server verification.
 * `success: true` on the client result is ignored and must never be sent as proof.
 */
export async function initiateBasePayment(intent: {
  amount: string;
  recipient: string;
  network: PaymentNetwork;
}): Promise<{ id: string }> {
  const checkout = checkoutFromIntent(intent);
  const result = await pay({
    amount: checkout.amount,
    to: checkout.recipient,
    testnet: checkout.testnet,
    telemetry: false,
  });
  if (!result?.id || typeof result.id !== "string") {
    throw new Error("Wallet did not return a transaction id.");
  }
  return { id: result.id };
}

export { PRICE_USDC };
