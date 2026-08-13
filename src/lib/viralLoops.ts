import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from './format'
import { isRemovedMessage } from './moderation'
import { messageShareUrl } from './shareLinks'

/** The four formal growth loops of The Wall. */
export const VIRAL_LOOPS = [
  {
    id: 'friends',
    name: 'Friends',
    spark: 'If this gets 10,000 🔥 I’ll ask her out.',
    chain: ['Post challenge', 'Friends visit', 'Friends react', 'Friends share', 'New users arrive'],
  },
  {
    id: 'competition',
    name: 'Competition',
    spark: 'Someone hits #1. Others want the throne.',
    chain: ['Reach #1', 'Others chase', 'More messages', 'More reactions', 'More sharing'],
  },
  {
    id: 'streamers',
    name: 'Streamers',
    spark: 'Live read of chaos, confession, and heartbreak.',
    chain: ['Streamer opens The Wall', 'Reads wild lines', 'Chat erupts', 'Viewers submit', 'Audience converts'],
  },
  {
    id: 'certificates',
    name: 'Certificates',
    spark: 'I was #18,392 on The Wall.',
    chain: ['Wall freezes', 'Certificate shared', 'Social proof', 'FOMO for next event', 'Return wave'],
  },
] as const

export type ViralLoopId = (typeof VIRAL_LOOPS)[number]['id']

export const FRIEND_TEMPLATES = [
  'If this gets 10,000 🔥 I’ll ask her out.',
  'If this hits 5,000 🔥 I’m quitting tomorrow.',
  '10k 🔥 and I tell my parents the truth.',
] as const

export const COMPETITION_TEMPLATES = [
  'Knocking #1 off The Wall. Watch this.',
  'This belongs at the top. Prove me wrong.',
] as const

export const STREAMER_TEMPLATES = [
  'Streamer: if you read this out loud I owe chat a story.',
  'For whoever is doomscrolling this on stream — hi chat.',
] as const

const CHALLENGE_RE =
  /(?:if this (?:gets?|hits?)\s*)([\d,]+)\s*(k)?\s*(?:🔥|fires?)/i

export type FriendChallenge = {
  message: WallMessage
  goal: number
  progress: number
  remaining: number
  met: boolean
}

export function parseFriendChallenge(message: WallMessage): FriendChallenge | null {
  const match = message.text.match(CHALLENGE_RE)
  if (!match) return null
  const base = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(base) || base < 1) return null
  const goal = match[2] ? base * 1000 : base
  if (goal < 10) return null
  const progress = Math.min(1, message.reactions / goal)
  return {
    message,
    goal,
    progress,
    remaining: Math.max(0, goal - message.reactions),
    met: message.reactions >= goal,
  }
}

/** Pick the strongest share caption for whichever loop this message feeds. */
export function loopAwareCaption(
  message: WallMessage,
  opts: { rank?: number; frozen?: boolean } = {},
): string {
  const challenge = parseFriendChallenge(message)
  if (challenge) return friendShareCaption(challenge)
  if (opts.rank === 1) return competitionShareCaption(message, 1)
  if (opts.frozen && opts.rank && opts.rank > 0) {
    return certificateLoopCaption(message, opts.rank, true)
  }
  return `"${message.text}" — ${formatMessageNumber(message.number)} on THE WALL. I was here.`
}

export function listFriendChallenges(messages: WallMessage[], limit = 5): FriendChallenge[] {
  return messages
    .filter((m) => !isRemovedMessage(m))
    .map(parseFriendChallenge)
    .filter((c): c is FriendChallenge => Boolean(c))
    .sort((a, b) => b.progress - a.progress || b.message.reactions - a.message.reactions)
    .slice(0, limit)
}

const DRAMA_RE =
  /\b(quit|girlfriend|boyfriend|dad|mom|miss you|love|sorry|secret|don't know|sitting next|finally|truth|crush)\b/i

/** Score messages that play well when read aloud on stream. */
export function streamerScore(m: WallMessage): number {
  let score = Math.sqrt(m.reactions + 1) * 2
  if (DRAMA_RE.test(m.text)) score += 8
  const len = m.text.length
  if (len >= 40 && len <= 120) score += 4
  if (/\?|—|…/.test(m.text)) score += 1
  return score
}

export function pickStreamerLines(messages: WallMessage[], limit = 12): WallMessage[] {
  return [...messages]
    .filter((m) => !isRemovedMessage(m))
    .sort((a, b) => streamerScore(b) - streamerScore(a))
    .slice(0, limit)
}

export function friendShareCaption(challenge: FriendChallenge): string {
  const left = challenge.met
    ? 'Goal hit.'
    : `${formatFire(challenge.remaining)} 🔥 to go.`
  return `"${challenge.message.text}" ${left} Help on THE WALL → ${messageShareUrl(challenge.message)}`
}

export function competitionShareCaption(message: WallMessage, rank: number): string {
  return rank === 1
    ? `"${message.text}" is #1 on THE WALL. Think you can knock it off? ${messageShareUrl(message)}`
    : `"${message.text}" is climbing. Boost it on THE WALL → ${messageShareUrl(message)}`
}

export function certificateLoopCaption(
  message: WallMessage,
  rank: number,
  frozen: boolean,
): string {
  const serial = formatMessageNumber(message.number)
  if (frozen) {
    return `I was ${serial} on The Wall — final rank #${rank}. Social proof for the next event. YOU WERE HERE.`
  }
  return `I'm ${serial} on The Wall (live rank #${rank}). When it freezes, this is forever.`
}

export function nextEventTeaser(editionStamp: string): string {
  return `The Wall — ${editionStamp} is sealed. Your number is proof you were there. Bring friends to the next one.`
}
