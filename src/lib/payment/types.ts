export type PaymentNetwork = "base" | "base-sepolia";

export type PaymentIntentSnapshot = {
  id: string;
  eventId: string;
  amount: string;
  currency: "USDC";
  network: PaymentNetwork;
  recipientWallet: string;
  expiresAt: string;
  messageHash: string;
};

export type CheckoutRequest = {
  amount: string;
  recipient: `0x${string}`;
  testnet: boolean;
  network: PaymentNetwork;
};

export type VerifiedPayment = {
  id: string;
  status: "completed";
  sender: string;
  recipient: string;
  amount: string;
  network: PaymentNetwork;
};

export type OnchainPayment = {
  found: boolean;
  pending: boolean;
  receiptFailed: boolean;
  chainId: number | null;
  sender: `0x${string}` | null;
  recipient: `0x${string}` | null;
  amountAtomic: bigint | null;
  minedAt: number | null;
};

export type SdkPaymentStatus = {
  status: "pending" | "completed" | "failed" | "not_found" | string;
  sender?: string;
  recipient?: string;
  amount?: string;
};

/**
 * Server-side verifier. Checkout lives in the browser.
 * Implementations must not treat a client `success` flag as proof.
 */
export interface CryptoPaymentProvider {
  readonly id: string;
  readonly currency: "USDC";
  readonly network: PaymentNetwork;
  readonly amount: string;
  recipient(): `0x${string}`;
  verify(input: {
    paymentId: string;
    expectedAmount: string;
    expectedRecipient: `0x${string}`;
    expectedNetwork: PaymentNetwork;
    intentCreatedAt?: string;
  }): Promise<VerifiedPayment>;
}
