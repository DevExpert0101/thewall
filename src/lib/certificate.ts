import type { WallMessage } from '../types'
import { formatMessageNumber } from './format'
import { editionStamp, messageShareUrl } from './shareLinks'

/** Stable unique certificate ID — not a public account. */
export function certificateId(message: WallMessage, wallDate: Date): string {
  const day = editionStamp(wallDate).replace(/\s+/g, '')
  const serial = String(message.number).padStart(6, '0')
  const hash = shortHash(`${message.id}:${message.number}:${day}`)
  return `TW-${day}-${serial}-${hash}`
}

function shortHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6)
}

export function archiveMessageUrl(message: WallMessage): string {
  return messageShareUrl(message)
}

export function voiceOfWallLine(messageNumber: number, totalMessages: number): string {
  return `${messageNumber.toLocaleString()}th voice of ${totalMessages.toLocaleString()} voices`
}

export function rankLabel(rank: number, frozen: boolean): string {
  return frozen ? `FINAL RANK #${rank}` : `LIVE RANK #${rank}`
}

export function messageNumberLabel(n: number): string {
  return `MESSAGE ${formatMessageNumber(n)}`
}
