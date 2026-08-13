import type { WallMessage } from '../types'

/** Public tombstone — number stays; content is gone. */
export const REMOVED_PLACEHOLDER = '[Removed by moderation]'

export function isRemovedMessage(message: Pick<WallMessage, 'text'>): boolean {
  return message.text === REMOVED_PLACEHOLDER
}

export type ModerationStageId =
  | 'length'
  | 'spam'
  | 'pii'
  | 'url'
  | 'adult'
  | 'threat'
  | 'ai'

export type ModerationStageResult = {
  id: ModerationStageId
  label: string
  ok: boolean
  detail: string
}

export type ModerationVerdict = {
  ok: boolean
  stages: ModerationStageResult[]
  failedStage: ModerationStageId | null
  reason: string | null
}

export type ReportReason =
  | 'harassment'
  | 'illegal'
  | 'hate'
  | 'adult'
  | 'spam'
  | 'other'

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'illegal', label: 'Illegal content' },
  { id: 'hate', label: 'Hate' },
  { id: 'adult', label: 'Adult' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Other' },
]

export const MODERATION_PIPELINE_LABELS: Record<ModerationStageId, string> = {
  length: 'Length validation',
  spam: 'Spam detection',
  pii: 'PII detection',
  url: 'URL detection',
  adult: 'Adult content',
  threat: 'Threat / harassment detection',
  ai: 'AI moderation',
}

const MAX_LEN = 140
const MIN_LEN = 1

const URL_RE =
  /(?:https?:\/\/|www\.|t\.me\/|discord\.gg\/|bit\.ly\/|tinyurl\.com\/|[\w-]+\.(?:com|net|org|io|gg|me|co|xyz|link|click)\b)/i

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/
const HANDLE_ADDR_RE =
  /\b(?:my (?:name|number|email|address) is|dm me at|text me at|call me at)\b/i

const ADULT_RE =
  /\b(?:onlyfans|porn|nsfw|nude|nudes|xxx|sex tape|blowjob|handjob|cumshot|explicit sex)\b/i

const THREAT_RE =
  /\b(?:i(?:'|’)ll kill|going to kill|kill you|murder you|rape you|dox(?:x)?(?: you)?|swat you|bomb (?:your|the)|shoot (?:up|you)|gas the)\b/i

const HARASS_RE =
  /\b(?:kys|kill yourself|you should die|hope you die|rape threat)\b/i

const HATE_RE =
  /\b(?:racial slur placeholder|nazi|heil hitler|white power|gas the jews)\b/i

const SPAM_PHRASE_RE =
  /\b(?:free crypto|airdrop|double your|whatsapp me|click here now|make \$\d|investment opportunity|telegram @)\b/i

function stage(
  id: ModerationStageId,
  ok: boolean,
  detail: string,
): ModerationStageResult {
  return { id, label: MODERATION_PIPELINE_LABELS[id], ok, detail }
}

function checkLength(text: string): ModerationStageResult {
  const len = text.length
  if (len < MIN_LEN) {
    return stage('length', false, 'Message is empty.')
  }
  if (len > MAX_LEN) {
    return stage('length', false, `Messages are limited to ${MAX_LEN} characters.`)
  }
  return stage('length', true, `${len}/${MAX_LEN} characters.`)
}

function checkSpam(text: string): ModerationStageResult {
  const compact = text.replace(/\s+/g, '')
  if (/(.)\1{7,}/u.test(compact)) {
    return stage('spam', false, 'Repeated character spam detected.')
  }
  const letters = text.replace(/[^a-z]/gi, '')
  if (letters.length >= 12 && letters === letters.toUpperCase() && /[A-Z]/.test(letters)) {
    return stage('spam', false, 'All-caps spam pattern detected.')
  }
  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length
  if (emojiCount >= 12) {
    return stage('spam', false, 'Emoji flood detected.')
  }
  if (SPAM_PHRASE_RE.test(text)) {
    return stage('spam', false, 'Promotional / spam phrasing detected.')
  }
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length >= 6) {
    const uniq = new Set(words)
    if (uniq.size / words.length < 0.35) {
      return stage('spam', false, 'Repetitive word spam detected.')
    }
  }
  return stage('spam', true, 'No spam signals.')
}

function checkPii(text: string): ModerationStageResult {
  if (EMAIL_RE.test(text)) {
    return stage('pii', false, 'Email addresses are not allowed on The Wall.')
  }
  if (PHONE_RE.test(text)) {
    return stage('pii', false, 'Phone numbers are not allowed on The Wall.')
  }
  if (SSN_RE.test(text)) {
    return stage('pii', false, 'Government ID patterns are not allowed.')
  }
  if (/(?:\d[ -]+){12,}\d/.test(text) && CC_RE.test(text)) {
    return stage('pii', false, 'Payment card numbers are not allowed.')
  }
  if (HANDLE_ADDR_RE.test(text)) {
    return stage('pii', false, 'Direct contact / identity prompts are not allowed.')
  }
  return stage('pii', true, 'No PII patterns found.')
}

function checkUrl(text: string): ModerationStageResult {
  if (URL_RE.test(text)) {
    return stage('url', false, 'Links and domains are not allowed on The Wall.')
  }
  return stage('url', true, 'No URLs found.')
}

function checkAdult(text: string): ModerationStageResult {
  if (ADULT_RE.test(text)) {
    return stage('adult', false, 'Adult / sexual content is not allowed.')
  }
  return stage('adult', true, 'No adult-content signals.')
}

function checkThreat(text: string): ModerationStageResult {
  if (THREAT_RE.test(text) || HARASS_RE.test(text) || HATE_RE.test(text)) {
    return stage('threat', false, 'Threat, harassment, or hate language detected.')
  }
  return stage('threat', true, 'No threat / harassment signals.')
}

/**
 * Local AI-style ensemble (prototype).
 * Scores toxicity-adjacent signals; fails closed on high risk.
 * Production would call a hosted moderation model here.
 */
function checkAi(text: string): ModerationStageResult {
  let risk = 0
  const lower = text.toLowerCase()

  if (/\b(?:hate|kill|rape|dox|nazi|terror)\b/i.test(lower)) risk += 0.35
  if (ADULT_RE.test(text)) risk += 0.4
  if (THREAT_RE.test(text) || HARASS_RE.test(text)) risk += 0.55
  if (URL_RE.test(text) || EMAIL_RE.test(text)) risk += 0.25
  if (SPAM_PHRASE_RE.test(text)) risk += 0.3
  if (/[!$]{3,}/.test(text)) risk += 0.15
  // Obfuscation: k.i.l.l / k-i-l-l
  if (/\bk[\W_]*i[\W_]*l[\W_]*l\b/i.test(text)) risk += 0.45
  if (/\br[\W_]*a[\W_]*p[\W_]*e\b/i.test(text)) risk += 0.5

  if (risk >= 0.55) {
    return stage(
      'ai',
      false,
      `AI moderation rejected this message (risk ${(risk * 100).toFixed(0)}%).`,
    )
  }
  return stage('ai', true, `AI moderation cleared (risk ${(risk * 100).toFixed(0)}%).`)
}

const STAGE_FNS: Array<(text: string) => ModerationStageResult> = [
  checkLength,
  checkSpam,
  checkPii,
  checkUrl,
  checkAdult,
  checkThreat,
  checkAi,
]

/** Run the full pre-publish pipeline. Stops recording failures but still runs all stages for UI. */
export function moderateMessage(raw: string): ModerationVerdict {
  const text = raw.trim()
  const stages = STAGE_FNS.map((fn) => fn(text))
  const failed = stages.find((s) => !s.ok) ?? null
  return {
    ok: !failed,
    stages,
    failedStage: failed?.id ?? null,
    reason: failed
      ? `${failed.label}: ${failed.detail}`
      : null,
  }
}

/** Async wrapper — simulates AI latency; swap for real model call later. */
export async function moderateMessageAsync(
  raw: string,
  onStage?: (stage: ModerationStageResult, index: number) => void,
): Promise<ModerationVerdict> {
  const text = raw.trim()
  const stages: ModerationStageResult[] = []

  for (let i = 0; i < STAGE_FNS.length; i++) {
    await wait(i === STAGE_FNS.length - 1 ? 220 : 70 + i * 25)
    const result = STAGE_FNS[i](text)
    stages.push(result)
    onStage?.(result, i)
    // Fail closed immediately after a blocking stage (pipeline order)
    if (!result.ok) {
      // Still “run” remaining labels as skipped for UI clarity
      for (let j = i + 1; j < STAGE_FNS.length; j++) {
        const skipped = stage(
          ['length', 'spam', 'pii', 'url', 'adult', 'threat', 'ai'][j] as ModerationStageId,
          false,
          'Skipped — earlier stage failed.',
        )
        // Don't mark skipped as the failure reason; keep first failure
        stages.push({ ...skipped, ok: true, detail: 'Not reached.' })
        onStage?.(stages[stages.length - 1], j)
      }
      return {
        ok: false,
        stages,
        failedStage: result.id,
        reason: `${result.label}: ${result.detail}`,
      }
    }
  }

  return { ok: true, stages, failedStage: null, reason: null }
}

function wait(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms))
}
