/**
 * Payment fraud controls for the $1 surface.
 * Production: run these checks on the server after webhook confirmation.
 */

import { cryptoConfig } from './cryptoPayment'
import { loadPrivateLedger } from './privateLedger'
import {
  evaluatePaymentAttemptVelocity,
  recordVelocity,
} from './deviceVelocity'

const FRAUD_KEY = 'the-wall:payment-fraud:v1'

type FraudState = {
  /** wallet -> timestamps of successful publishes */
  walletPublishes: Record<string, number[]>
  /** blocked wallets until */
  walletBlocks: Record<string, number>
}

const MAX_MESSAGES_PER_WALLET_PER_DAY = 5
const WALLET_BLOCK_MS = 60 * 60_000

function loadFraud(): FraudState {
  try {
    const raw = localStorage.getItem(FRAUD_KEY)
    if (!raw) return { walletPublishes: {}, walletBlocks: {} }
    const parsed = JSON.parse(raw) as FraudState
    return {
      walletPublishes: parsed.walletPublishes ?? {},
      walletBlocks: parsed.walletBlocks ?? {},
    }
  } catch {
    return { walletPublishes: {}, walletBlocks: {} }
  }
}

function saveFraud(state: FraudState): void {
  localStorage.setItem(FRAUD_KEY, JSON.stringify(state))
}

export function clearPaymentFraud(): void {
  localStorage.removeItem(FRAUD_KEY)
}

export type PaymentFraudCheck = {
  txHash: string
  payerWallet: string
  valueWei: string
  turnstileToken: string | null
  turnstileOk: boolean
}

export type FraudVerdict =
  | { ok: true }
  | { ok: false; reason: string }

export function beginPaymentAttempt(): FraudVerdict {
  const velocity = evaluatePaymentAttemptVelocity()
  if (!velocity.ok) return velocity
  recordVelocity('payment_attempt')
  return { ok: true }
}

/**
 * Full fraud gate before etching a message after chain confirmation.
 */
export function evaluatePaymentFraud(input: PaymentFraudCheck): FraudVerdict {
  if (!input.turnstileOk || !input.turnstileToken) {
    return { ok: false, reason: 'CAPTCHA / Turnstile verification required before publish.' }
  }

  const txHash = input.txHash.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
    return { ok: false, reason: 'Payment fraud: invalid transaction hash.' }
  }

  const wallet = input.payerWallet.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
    return { ok: false, reason: 'Payment fraud: invalid payer wallet.' }
  }

  let value: bigint
  try {
    value = BigInt(input.valueWei)
  } catch {
    return { ok: false, reason: 'Payment fraud: invalid payment value.' }
  }
  if (value < cryptoConfig.paymentWei) {
    return { ok: false, reason: 'Payment fraud: amount below required $1 equivalent.' }
  }

  const ledger = loadPrivateLedger()
  if (ledger.usedTxHashes.includes(txHash)) {
    return { ok: false, reason: 'Payment fraud: transaction already redeemed.' }
  }

  // Same wallet paying many times in a day (card/wallet farming)
  const now = Date.now()
  const fraud = loadFraud()
  const blockedUntil = fraud.walletBlocks[wallet] ?? 0
  if (now < blockedUntil) {
    return {
      ok: false,
      reason: 'Payment fraud: this wallet is temporarily blocked for unusual volume.',
    }
  }

  const day = 24 * 60 * 60_000
  const stamps = (fraud.walletPublishes[wallet] ?? []).filter((t) => now - t < day)
  if (stamps.length >= MAX_MESSAGES_PER_WALLET_PER_DAY) {
    fraud.walletBlocks[wallet] = now + WALLET_BLOCK_MS
    saveFraud(fraud)
    return {
      ok: false,
      reason: `Payment fraud: max ${MAX_MESSAGES_PER_WALLET_PER_DAY} messages per wallet per day.`,
    }
  }

  // Cluster: many distinct wallets but identical value + rapid cadence is handled by device velocity

  return { ok: true }
}

export function recordSuccessfulWalletPublish(payerWallet: string): void {
  const wallet = payerWallet.trim().toLowerCase()
  const fraud = loadFraud()
  const now = Date.now()
  const day = 24 * 60 * 60_000
  const stamps = (fraud.walletPublishes[wallet] ?? []).filter((t) => now - t < day)
  stamps.push(now)
  fraud.walletPublishes[wallet] = stamps
  saveFraud(fraud)
}
