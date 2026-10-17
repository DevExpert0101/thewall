import { getPaymentStatus } from "@base-org/account";
import { PRICE_USDC, USDC_ADDRESSES } from "@/lib/constants";
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
    } catch {
      // The chain transfer is the proof. An SDK lookup error must not
      // reject a confirming $1 or skip the receipt.
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
