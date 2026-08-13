import type { PrivateLedger, PrivateTxRecord } from '../types'
import { cryptoConfig } from './cryptoPayment'

const LEDGER_KEY = 'the-wall:private-ledger:v1'

function emptyLedger(): PrivateLedger {
  return { records: [], usedTxHashes: [] }
}

export function loadPrivateLedger(): PrivateLedger {
  const raw = localStorage.getItem(LEDGER_KEY)
  if (!raw) return emptyLedger()
  try {
    const parsed = JSON.parse(raw) as PrivateLedger
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      usedTxHashes: Array.isArray(parsed.usedTxHashes) ? parsed.usedTxHashes : [],
    }
  } catch {
    return emptyLedger()
  }
}

function savePrivateLedger(ledger: PrivateLedger): void {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
}

export function isTxHashUsed(txHash: string): boolean {
  return loadPrivateLedger().usedTxHashes.includes(txHash.trim().toLowerCase())
}

export function appendPrivateTxRecord(input: {
  messageId: string
  messageNumber: number
  txHash: string
  payerWallet: string
  valueWei: string
  internalSessionId: string
}): PrivateTxRecord {
  const ledger = loadPrivateLedger()
  const txHash = input.txHash.trim().toLowerCase()
  if (ledger.usedTxHashes.includes(txHash)) {
    throw new Error('This payment transaction was already used.')
  }

  const record: PrivateTxRecord = {
    id: `priv_${Date.now().toString(36)}`,
    messageId: input.messageId,
    messageNumber: input.messageNumber,
    txHash,
    payerWallet: input.payerWallet.toLowerCase(),
    valueWei: input.valueWei,
    chainId: cryptoConfig.chainId,
    confirmedAt: Date.now(),
    internalSessionId: input.internalSessionId,
    status: 'confirmed',
  }

  const next: PrivateLedger = {
    records: [record, ...ledger.records],
    usedTxHashes: [...ledger.usedTxHashes, txHash],
  }
  savePrivateLedger(next)
  return record
}

/** Operator-only helper — never call from public UI rendering paths. */
export function getPrivateRecordForMessage(messageId: string): PrivateTxRecord | undefined {
  return loadPrivateLedger().records.find((r) => r.messageId === messageId)
}

export function clearPrivateLedger(): void {
  localStorage.removeItem(LEDGER_KEY)
}
