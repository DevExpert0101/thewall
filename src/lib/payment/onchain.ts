import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  parseAbiItem,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { CHAIN_IDS, DEFAULT_RPC_URLS, USDC_ADDRESSES } from "@/lib/constants";
import type { OnchainPayment, PaymentNetwork } from "@/lib/payment/types";

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type OnchainTransfer = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
};

export function parseUsdcTransfersToTreasury(
  logs: readonly {
    address: `0x${string}`;
    topics: readonly Hex[] | Hex[];
    data: Hex;
  }[],
  token: `0x${string}`,
  treasury: `0x${string}`,
): OnchainTransfer[] {
  const tokenAddr = getAddress(token);
  const treasuryAddr = getAddress(treasury);
  const transfers: OnchainTransfer[] = [];

  for (const log of logs) {
    if (getAddress(log.address) !== tokenAddr) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== "Transfer") continue;
      const { from, to, value } = decoded.args;
      if (getAddress(to) === treasuryAddr && value > BigInt(0)) {
        transfers.push({ from, to, value });
      }
    } catch {
      continue;
    }
  }
  return transfers;
}

function summarizeTransfers(
  transfers: OnchainTransfer[],
  treasury: `0x${string}`,
  chainId: number,
  receiptFailed: boolean,
): OnchainPayment {
  if (receiptFailed) {
    return {
      found: true,
      pending: false,
      receiptFailed: true,
      chainId,
      sender: null,
      recipient: null,
      amountAtomic: null,
      minedAt: null,
    };
  }
  const total = transfers.reduce((sum, transfer) => sum + transfer.value, BigInt(0));
  if (total === BigInt(0) || !transfers[0]) {
    return {
      found: true,
      pending: false,
      receiptFailed: false,
      chainId,
      sender: null,
      recipient: getAddress(treasury),
      amountAtomic: BigInt(0),
      minedAt: null,
    };
  }
  return {
    found: true,
    pending: false,
    receiptFailed: false,
    chainId,
    sender: getAddress(transfers[0].from),
    recipient: getAddress(treasury),
    amountAtomic: total,
    minedAt: null,
  };
}

type BundlerReceipt = {
  success?: boolean;
  receipt?: TransactionReceipt;
  sender?: string;
};

function publicClient(network: PaymentNetwork) {
  const chain = network === "base" ? base : baseSepolia;
  const rpc = process.env.BASE_RPC_URL ?? DEFAULT_RPC_URLS[network];
  return createPublicClient({ chain, transport: http(rpc) });
}

async function loadUserOpReceipt(hash: Hex): Promise<BundlerReceipt | null> {
  const bundler = process.env.BASE_BUNDLER_URL;
  if (!bundler) return null;
  try {
    const response = await fetch(bundler, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getUserOperationReceipt",
        params: [hash],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: BundlerReceipt | null };
    return payload.result ?? null;
  } catch {
    return null;
  }
}

export async function loadOnchainUsdcPayment(input: {
  paymentId: Hex;
  network: PaymentNetwork;
  token: `0x${string}`;
  treasury: `0x${string}`;
}): Promise<OnchainPayment> {
  const chainId = CHAIN_IDS[input.network];
  const client = publicClient(input.network);
  const pending: OnchainPayment = {
    found: false,
    pending: true,
    receiptFailed: false,
    chainId,
    sender: null,
    recipient: null,
    amountAtomic: null,
    minedAt: null,
  };

  try {
    const receipt = await client.getTransactionReceipt({ hash: input.paymentId });
    const failed = receipt.status !== "success";
    const transfers = failed
      ? []
      : parseUsdcTransfersToTreasury(receipt.logs, input.token, input.treasury);
    return await withMinedAt(
      client,
      receipt.blockNumber,
      summarizeTransfers(transfers, input.treasury, chainId, failed),
    );
  } catch {
    // Base Pay ids are often userOp hashes, not transaction hashes.
  }

  const userOp = await loadUserOpReceipt(input.paymentId);
  if (!userOp) return pending;
  if (userOp.success === false) {
    return summarizeTransfers([], input.treasury, chainId, true);
  }
  if (!userOp.receipt) return pending;
  const failed = userOp.receipt.status !== "success";
  const transfers = failed
    ? []
    : parseUsdcTransfersToTreasury(userOp.receipt.logs, input.token, input.treasury);
  const summary = summarizeTransfers(transfers, input.treasury, chainId, failed);
  const mined = await withMinedAt(client, userOp.receipt.blockNumber, summary);
  if (!mined.sender && userOp.sender) {
    try {
      return { ...mined, sender: getAddress(userOp.sender) };
    } catch {
      return mined;
    }
  }
  return mined;
}

async function withMinedAt(
  client: ReturnType<typeof publicClient>,
  blockNumber: bigint | undefined,
  summary: OnchainPayment,
): Promise<OnchainPayment> {
  if (blockNumber == null) return { ...summary, minedAt: null };
  try {
    const block = await client.getBlock({ blockNumber });
    return { ...summary, minedAt: Number(block.timestamp) };
  } catch {
    return { ...summary, minedAt: null };
  }
}

export function usdcToken(network: PaymentNetwork): `0x${string}` {
  return USDC_ADDRESSES[network];
}
