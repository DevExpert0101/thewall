import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseEther,
  formatEther,
  type Hash,
  type Hex,
} from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'

export type PaymentPhase =
  | 'idle'
  | 'connecting'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirming'
  | 'verified'
  | 'failed'

export type VerifiedPayment = {
  txHash: Hash
  from: Hex
  to: Hex
  valueWei: bigint
  blockNumber: bigint
  confirmations: number
}

const CHAINS = {
  1: mainnet,
  11155111: sepolia,
  8453: base,
  84532: baseSepolia,
} as const

type SupportedChainId = keyof typeof CHAINS

function readChainId(): SupportedChainId {
  const raw = Number(import.meta.env.VITE_CHAIN_ID ?? 84532)
  if (raw in CHAINS) return raw as SupportedChainId
  return 84532
}

function readTreasury(): Hex {
  const addr = (import.meta.env.VITE_TREASURY_ADDRESS ??
    '0x000000000000000000000000000000000000dEaD') as Hex
  return addr
}

/** Default ~demo amount on testnets; override with VITE_PAYMENT_ETH */
function readPaymentWei(): bigint {
  const eth = import.meta.env.VITE_PAYMENT_ETH ?? '0.0001'
  return parseEther(String(eth))
}

export const cryptoConfig = {
  chainId: readChainId(),
  get chain() {
    return CHAINS[this.chainId]
  },
  treasuryAddress: readTreasury(),
  paymentWei: readPaymentWei(),
  requiredConfirmations: Number(import.meta.env.VITE_TX_CONFIRMATIONS ?? 1),
  explorerTx(txHash: string): string {
    const baseUrl = this.chain.blockExplorers?.default.url ?? 'https://basescan.org'
    return `${baseUrl}/tx/${txHash}`
  },
  get paymentLabel(): string {
    return `${formatEther(this.paymentWei)} ${this.chain.nativeCurrency.symbol}`
  },
}

function getEthereum(): EthereumProvider {
  const eth = window.ethereum
  if (!eth) {
    throw new Error('No crypto wallet found. Install MetaMask or another browser wallet.')
  }
  return eth
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export function hasWallet(): boolean {
  return Boolean(window.ethereum)
}

export async function connectWallet(): Promise<Hex> {
  const ethereum = getEthereum()
  const accounts = (await ethereum.request({
    method: 'eth_requestAccounts',
  })) as Hex[]
  if (!accounts[0]) throw new Error('Wallet connection rejected.')
  await ensureChain(ethereum)
  return accounts[0]
}

async function ensureChain(ethereum: EthereumProvider): Promise<void> {
  const chain = cryptoConfig.chain
  const hexId = `0x${chain.id.toString(16)}`
  const current = (await ethereum.request({ method: 'eth_chainId' })) as string
  if (current.toLowerCase() === hexId.toLowerCase()) return

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    })
  } catch (err) {
    const code = (err as { code?: number })?.code
    if (code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: chain.blockExplorers
              ? [chain.blockExplorers.default.url]
              : undefined,
          },
        ],
      })
      return
    }
    throw new Error(`Switch your wallet to ${chain.name} to pay.`)
  }
}

function publicClient() {
  return createPublicClient({
    chain: cryptoConfig.chain,
    transport: http(),
  })
}

function walletClient() {
  return createWalletClient({
    chain: cryptoConfig.chain,
    transport: custom(getEthereum()),
  })
}

export type PayProgress = {
  phase: PaymentPhase
  txHash?: Hash
  confirmations?: number
  error?: string
}

/**
 * Send native-token payment to treasury, wait for receipt,
 * verify success + recipient + minimum value, then require N confirmations.
 */
export async function payWithCrypto(
  onProgress: (p: PayProgress) => void,
): Promise<VerifiedPayment> {
  onProgress({ phase: 'connecting' })
  const account = await connectWallet()
  const wallet = walletClient()
  const public_ = publicClient()

  onProgress({ phase: 'awaiting_signature' })
  let txHash: Hash
  try {
    txHash = await wallet.sendTransaction({
      account,
      to: cryptoConfig.treasuryAddress,
      value: cryptoConfig.paymentWei,
      chain: cryptoConfig.chain,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Transaction rejected.'
    onProgress({ phase: 'failed', error: msg })
    throw err
  }

  onProgress({ phase: 'submitted', txHash, confirmations: 0 })

  const receipt = await public_.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  })

  if (receipt.status !== 'success') {
    const error = 'Transaction reverted on-chain. Message was not published.'
    onProgress({ phase: 'failed', txHash, error })
    throw new Error(error)
  }

  const tx = await public_.getTransaction({ hash: txHash })
  const to = (tx.to ?? '0x').toLowerCase()
  const treasury = cryptoConfig.treasuryAddress.toLowerCase()
  if (to !== treasury) {
    const error = 'Payment sent to the wrong address.'
    onProgress({ phase: 'failed', txHash, error })
    throw new Error(error)
  }
  if (tx.value < cryptoConfig.paymentWei) {
    const error = 'Payment amount too low.'
    onProgress({ phase: 'failed', txHash, error })
    throw new Error(error)
  }

  const needed = Math.max(1, cryptoConfig.requiredConfirmations)
  let confirmations = 1
  onProgress({ phase: 'confirming', txHash, confirmations })

  while (confirmations < needed) {
    const latest = await public_.getBlockNumber()
    confirmations = Number(latest - receipt.blockNumber) + 1
    onProgress({ phase: 'confirming', txHash, confirmations: Math.min(confirmations, needed) })
    if (confirmations >= needed) break
    await new Promise((r) => setTimeout(r, 2000))
  }

  // Final re-check receipt still successful
  const finalReceipt = await public_.getTransactionReceipt({ hash: txHash })
  if (finalReceipt.status !== 'success') {
    const error = 'Transaction failed confirmation check.'
    onProgress({ phase: 'failed', txHash, error })
    throw new Error(error)
  }

  const verified: VerifiedPayment = {
    txHash,
    from: account,
    to: cryptoConfig.treasuryAddress,
    valueWei: tx.value,
    blockNumber: finalReceipt.blockNumber,
    confirmations: needed,
  }
  onProgress({ phase: 'verified', txHash, confirmations: needed })
  return verified
}

/**
 * Dev / demo path: same confirmation UX without a wallet.
 * Disabled unless VITE_ALLOW_DEMO_CRYPTO=true
 */
export async function simulatePayWithCrypto(
  onProgress: (p: PayProgress) => void,
): Promise<VerifiedPayment> {
  if (import.meta.env.VITE_ALLOW_DEMO_CRYPTO !== 'true') {
    throw new Error('Demo crypto is disabled. Set VITE_ALLOW_DEMO_CRYPTO=true to enable.')
  }

  onProgress({ phase: 'connecting' })
  await sleep(400)
  onProgress({ phase: 'awaiting_signature' })
  await sleep(600)
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}` as Hash
  onProgress({ phase: 'submitted', txHash, confirmations: 0 })
  await sleep(700)
  onProgress({ phase: 'confirming', txHash, confirmations: 1 })
  await sleep(500)
  onProgress({ phase: 'verified', txHash, confirmations: 1 })

  return {
    txHash,
    from: '0x1111111111111111111111111111111111111111',
    to: cryptoConfig.treasuryAddress,
    valueWei: cryptoConfig.paymentWei,
    blockNumber: 1n,
    confirmations: 1,
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}
