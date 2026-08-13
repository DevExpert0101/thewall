import { useEffect, useState } from 'react'
import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from '../lib/format'
import { pickStreamerLines } from '../lib/viralLoops'

type Props = {
  messages: WallMessage[]
  onShare: (message: WallMessage) => void
}

export function StreamerDeck({ messages, onShare }: Props) {
  const lines = pickStreamerLines(messages, 16)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [messages.length])

  if (lines.length === 0) return null

  const current = lines[index % lines.length]

  function next() {
    setIndex((i) => (i + 1) % lines.length)
  }

  function prev() {
    setIndex((i) => (i - 1 + lines.length) % lines.length)
  }

  return (
    <section className="streamer-deck" aria-label="Streamer read deck">
      <div className="streamer-deck-head">
        <p className="loop-rail-kicker">Curiosity · Streamers</p>
        <h3>What are people writing?</h3>
        <p>Big type for live reads. Chat wonders — then submits.</p>
      </div>

      <div className="streamer-stage" key={current.id}>
        <p className="streamer-serial">{formatMessageNumber(current.number)}</p>
        <blockquote className="streamer-quote">“{current.text}”</blockquote>
        <p className="streamer-meta">
          Anonymous · 🔥 {formatFire(current.reactions)} · Card {index + 1}/{lines.length}
        </p>
      </div>

      <div className="streamer-actions">
        <button type="button" className="btn ghost" onClick={prev}>
          Previous
        </button>
        <button type="button" className="btn primary" onClick={next}>
          Next line
        </button>
        <button type="button" className="btn ghost" onClick={() => onShare(current)}>
          Share this line
        </button>
      </div>
    </section>
  )
}
