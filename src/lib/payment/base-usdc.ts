import { getPaymentStatus } from "@base-org/account";
import { PRICE_USDC, USDC_ADDRESSES } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getNetwork, getTreasuryAddress } from "@/lib/env";
import { assertExpectedNetwork, evaluatePaymentProof, normalizePaymentId } from "@/lib/payment/evaluate";
import { loadOnchainUsdcPayment } from "@/lib/payment/onchain";
import type {
  CryptoPaymentProvider,
  PaymentNetwork,
  SdkPaymentStatus,
  VerifiedPayment,
} from "@/lib/payment/types";

export class BaseUSDCProvider implements CryptoPaymentProvider {
  readonly id = "base-usdc";
  readonly currency = "USDC" as const;
  readonly amount = PRICE_USDC;
  readonly network: PaymentNetwork;

  constructor(network: PaymentNetwork = getNetwork()) {
    this.network = network;
  }

  recipient(): `0x${string}` {
    return getTreasuryAddress();
  }

  async verify(input: {
    paymentId: string;
    expectedAmount: string;
    expectedRecipient: `0x${string}`;
    expectedNetwork: PaymentNetwork;
    intentCreatedAt?: string;
  }): Promise<VerifiedPayment> {
    assertExpectedNetwork(input.expectedNetwork, this.network);
    const paymentId = normalizePaymentId(input.paymentId);
    const testnet = input.expectedNetwork === "base-sepolia";

    let sdk: SdkPaymentStatus = { status: "not_found" };
    try {
      const status = await getPaymentStatus({
        id: paymentId,
        testnet,
        expectedPayment: {
          amount: input.expectedAmount,
          recipient: input.expectedRecipient,
        },
        bundlerUrl: process.env.BASE_BUNDLER_URL,
        telemetry: false,
      });
      sdk = {
        status: status.status,
        sender: status.sender,
        recipient: status.recipient,
        amount: status.amount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("insufficient")) {
        throw new AppError(ERROR_CODES.INSUFFICIENT_USDC, "Insufficient USDC.");
      }
      if (message.includes("recipient") || message.includes("to address")) {
        throw new AppError(ERROR_CODES.WRONG_RECIPIENT, "Payment recipient mismatch.");
      }
      if (message.includes("amount")) {
        throw new AppError(ERROR_CODES.WRONG_AMOUNT, "Payment amount mismatch.");
      }
      sdk = { status: "not_found" };
    }

    const onchain = await loadOnchainUsdcPayment({
      paymentId,
      network: input.expectedNetwork,
      token: USDC_ADDRESSES[input.expectedNetwork],
      treasury: input.expectedRecipient,
    });

    return evaluatePaymentProof({
      paymentId,
      expectedAmount: input.expectedAmount,
      expectedRecipient: input.expectedRecipient,
      expectedNetwork: input.expectedNetwork,
      sdk,
      onchain,
      intentCreatedAt: input.intentCreatedAt,
    });
  }
}

export function getPaymentProvider(): CryptoPaymentProvider {
  return new BaseUSDCProvider();
}
