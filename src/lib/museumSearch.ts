import type { WallMessage } from '../types'
import { sortByTrending } from './trending'

export type MuseumSort =
  | 'most_reacted'
  | 'random'
  | 'message_number'
  | 'trending'
  | 'newest'
  | 'oldest'

export const MUSEUM_SORT_LABELS: Record<MuseumSort, string> = {
  most_reacted: 'Most reacted',
  random: 'Random',
  message_number: 'Message number',
  trending: 'Trending',
  newest: 'Newest',
  oldest: 'Oldest',
}

export function searchWallMessages(
  messages: WallMessage[],
  query: string,
): WallMessage[] {
  const raw = query.trim()
  if (!raw) return [...messages]
  const q = raw.toLowerCase().replace(/^#/, '')
  const stripped = q.replace(/^0+/, '') || q
  return messages.filter((m) => {
    const serial = String(m.number).padStart(6, '0')
    return (
      m.text.toLowerCase().includes(raw.toLowerCase()) ||
      String(m.number).includes(q) ||
      serial.includes(q) ||
      serial.includes(stripped)
    )
  })
}

export function sortMuseumMessages(
  messages: WallMessage[],
  sort: MuseumSort,
  opts: {
    /** Locked final trending order (ids) — never recalculated after freeze */
    finalRankingIds?: string[]
    scoreAt: number
  },
): WallMessage[] {
  const list = [...messages]
  switch (sort) {
    case 'most_reacted':
      return list.sort((a, b) => b.reactions - a.reactions || b.number - a.number)
    case 'message_number':
      return list.sort((a, b) => a.number - b.number)
    case 'newest':
      return list.sort((a, b) => b.number - a.number)
    case 'oldest':
      return list.sort((a, b) => a.number - b.number)
    case 'trending': {
      if (opts.finalRankingIds?.length) {
        const order = new Map(opts.finalRankingIds.map((id, i) => [id, i]))
        return list.sort(
          (a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9),
        )
      }
      return sortByTrending(list, opts.scoreAt)
    }
    case 'random': {
      // Stable-enough shuffle for a click — Fisher–Yates
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
      return list
    }
    default:
      return list
  }
}
