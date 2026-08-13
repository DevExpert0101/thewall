/**
 * Public wall surface — only what the world may see.
 * Never attach email, name, IP, payment, wallet, or device fields here.
 */
export type WallMessage = {
  id: string
  text: string
  createdAt: number
  reactions: number
  number: number
}

export type WallState = {
  startedAt: number
  endsAt: number
  frozen: boolean
  messages: WallMessage[]
  nextNumber: number
  viewerCount: number
  /**
   * Locked trending order at freeze (message ids).
   * Ranking never changes after The Wall dies.
   */
  finalRankingIds?: string[]
  /** Operator kill-switch — browse/react may continue; new etches blocked */
  submissionsPaused?: boolean
}

/**
 * Private operational ledger (fraud, moderation, refunds, legal).
 * Not rendered on The Wall. Not part of the public artifact.
 */
export type PrivateTxRecord = {
  id: string
  messageId: string
  messageNumber: number
  txHash: string
  payerWallet: string
  valueWei: string
  chainId: number
  confirmedAt: number
  /** Opaque local session token — not an account, not shown publicly */
  internalSessionId: string
  status: 'confirmed'
}

export type PrivateLedger = {
  records: PrivateTxRecord[]
  usedTxHashes: string[]
}

/**
 * Device-local viewer prefs only. Never synced as a public profile.
 */
export type ViewerState = {
  viewerKey: string
  myMessageIds: string[]
  reactedIds: string[]
  countedAsViewer: boolean
}
