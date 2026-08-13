import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from '../lib/format'
import {
  type FriendChallenge,
  listFriendChallenges,
} from '../lib/viralLoops'

type Props = {
  messages: WallMessage[]
  frozen: boolean
  onReact: (id: string) => void
  onShare: (message: WallMessage) => void
  reactedIds: string[]
}

export function FriendsLoopRail({
  messages,
  frozen,
  onReact,
  onShare,
  reactedIds,
}: Props) {
  const challenges = listFriendChallenges(messages, 4)
  if (challenges.length === 0) return null

  return (
    <section className="loop-rail" aria-label="Friends loop challenges">
      <div className="loop-rail-head">
        <p className="loop-rail-kicker">Belonging · Friends</p>
        <h3>I want to be part of this</h3>
        <p>Post a goal. Friends pile in. You’re on The Wall with them.</p>
      </div>
      <ul className="loop-rail-list">
        {challenges.map((c) => (
          <ChallengeCard
            key={c.message.id}
            challenge={c}
            frozen={frozen}
            reacted={reactedIds.includes(c.message.id)}
            onReact={onReact}
            onShare={onShare}
          />
        ))}
      </ul>
    </section>
  )
}

function ChallengeCard({
  challenge,
  frozen,
  reacted,
  onReact,
  onShare,
}: {
  challenge: FriendChallenge
  frozen: boolean
  reacted: boolean
  onReact: (id: string) => void
  onShare: (message: WallMessage) => void
}) {
  const { message, goal, progress, remaining, met } = challenge
  const pct = Math.round(progress * 100)

  return (
    <li className={`challenge-card ${met ? 'met' : ''}`}>
      <p className="challenge-serial">{formatMessageNumber(message.number)}</p>
      <p className="challenge-text">“{message.text}”</p>
      <div className="challenge-meter" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="challenge-meta">
        {formatFire(message.reactions)} / {goal.toLocaleString()} 🔥
        {met ? ' · Goal hit' : ` · ${formatFire(remaining)} to go`}
      </p>
      <div className="challenge-actions">
        {!frozen && (
          <button
            type="button"
            className={`fire-btn on-stage ${reacted ? 'on' : ''}`}
            disabled={reacted}
            onClick={() => onReact(message.id)}
          >
            <span aria-hidden="true">🔥</span>
            <span>{reacted ? 'Reacted' : 'Help'}</span>
          </button>
        )}
        <button type="button" className="btn ghost" onClick={() => onShare(message)}>
          Rally friends
        </button>
      </div>
    </li>
  )
}
