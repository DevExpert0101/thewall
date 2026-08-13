export type PreviousWallStatus = 'sealed' | 'live' | 'upcoming'

export type PreviousWallEdition = {
  id: string
  title: string
  dateLabel: string
  voices: number
  reactions: number
  status: PreviousWallStatus
  hook: string
  sample: string
  accent: string
}

/**
 * Past / rare editions — scarcity museum.
 * Current live wall is injected at runtime.
 */
export const SEALED_WALLS: PreviousWallEdition[] = [
  {
    id: 'nyd-2026',
    title: 'The Wall — New Year’s Day',
    dateLabel: 'JAN 1, 2026',
    voices: 412_883,
    reactions: 9_204_112,
    status: 'sealed',
    hook: 'Midnight confessions. Resolutions that couldn’t wait.',
    sample: 'If this survives the year, I meant every word.',
    accent: '#d97706',
  },
  {
    id: 'humanity-2025',
    title: 'The Wall — Humanity',
    dateLabel: 'OCT 12, 2025',
    voices: 501_204,
    reactions: 11_882_441,
    status: 'sealed',
    hook: 'One day for the species. No brands. No accounts.',
    sample: 'Dad, I miss you. The world is loud without you.',
    accent: '#0e7490',
  },
  {
    id: 'election-2024',
    title: 'The Wall — Election Day',
    dateLabel: 'NOV 5, 2024',
    voices: 628_910,
    reactions: 14_102_778,
    status: 'sealed',
    hook: 'Ballots offline. Truth online for twenty-four hours.',
    sample: 'I voted. Then I wrote what I was afraid to say out loud.',
    accent: '#b42318',
  },
]

export const UPCOMING_WALLS: PreviousWallEdition[] = [
  {
    id: 'wall-2027',
    title: 'The Wall — 2027',
    dateLabel: 'ONE YEAR LATER',
    voices: 0,
    reactions: 0,
    status: 'upcoming',
    hook: 'Not an app. An appointment with history.',
    sample: 'Save the date. Scarcity is the brand.',
    accent: '#0d7a5f',
  },
]

export function buildWallMuseum(opts: {
  liveTitle: string
  liveDateLabel: string
  liveVoices: number
  liveReactions: number
  frozen: boolean
}): PreviousWallEdition[] {
  const current: PreviousWallEdition = {
    id: 'current',
    title: opts.liveTitle,
    dateLabel: opts.liveDateLabel,
    voices: opts.liveVoices,
    reactions: opts.liveReactions,
    status: opts.frozen ? 'sealed' : 'live',
    hook: opts.frozen
      ? 'This edition froze. Nothing changes. The artifact lives.'
      : 'Happening now. You only have today.',
    sample: opts.frozen
      ? 'You were here — or you weren’t. The Wall remembers either way.'
      : 'What will you leave before the clock hits zero?',
    accent: '#e24100',
  }

  return [current, ...SEALED_WALLS, ...UPCOMING_WALLS]
}

export const AD_HOOKS = [
  {
    kicker: 'Curiosity',
    line: 'What are people writing — right now?',
  },
  {
    kicker: 'Belonging',
    line: 'For $1, your line joins the planet for a day.',
  },
  {
    kicker: 'Competition',
    line: 'Can you reach #1 before midnight?',
  },
  {
    kicker: 'FOMO',
    line: 'Miss today and you miss forever.',
  },
] as const

export const AD_TAGLINE_STACK = [
  'One dollar.',
  'One message.',
  'One day.',
  'Forever.',
] as const
