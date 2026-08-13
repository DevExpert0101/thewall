/** Four emotions The Wall is designed to trigger. */

export const PSYCH_SIGNALS = [
  {
    id: 'curiosity',
    name: 'Curiosity',
    line: 'What are people writing?',
    reinforce: 'Open the live feed. Scroll strangers. Wonder who meant it.',
  },
  {
    id: 'belonging',
    name: 'Belonging',
    line: 'I want to be part of this.',
    reinforce: 'One dollar. One number. Your line joins the day forever.',
  },
  {
    id: 'competition',
    name: 'Competition',
    line: 'Can I reach #1?',
    reinforce: '🔥 moves the throne. Knock them off before the clock dies.',
  },
  {
    id: 'fomo',
    name: 'Fear of missing out',
    line: "If I don't do it now, it's gone forever.",
    reinforce: '24 hours. Then The Wall freezes. No edits. No second chance.',
  },
] as const

export type PsychSignalId = (typeof PSYCH_SIGNALS)[number]['id']

export const PSYCH_COPY = {
  heroLive: 'What are people writing?',
  heroLiveSub: 'You only have today — then The Wall freezes forever.',
  readCta: 'See what people are writing',
  belongCta: 'Be part of this — $1',
  belongStickyTitle: 'Still free to look. Ready to belong?',
  belongStickyFomo: 'One dollar. One message. One day. Forever.',
  raceLive: 'Can I reach #1?',
  raceFrozen: 'This #1 is locked forever.',
  wallLive: 'What are people writing right now?',
  wallLiveSub: 'Read freely. Belong for $1. You only have today.',
  createKicker: 'Belong before it freezes.',
  createHook: 'Your line joins everyone else’s — forever.',
  exploreLive:
    'You only have today · Curiosity free · Belonging $1 · Chase #1 before the clock dies',
  exploreFrozen:
    'Frozen · Nothing changes · Permanent time capsule · Certificates prove you were there',
  clockRule: 'Never let users forget the clock.',
  mantra: 'You only have today.',
} as const
