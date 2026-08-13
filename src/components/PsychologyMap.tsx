import { PSYCH_SIGNALS } from '../lib/psychology'

type Props = {
  frozen?: boolean
}

export function PsychologyMap({ frozen = false }: Props) {
  return (
    <section className="psych-map" aria-label="Psychological design">
      <div className="psych-map-head">
        <p className="loop-rail-kicker">Psychological design</p>
        <h2>{frozen ? 'Why it still hits' : 'Four emotions. One Wall.'}</h2>
        <p>
          {frozen
            ? 'Curiosity remains. Belonging is proven. Competition is locked. FOMO is finished.'
            : 'Every surface should pull one of these — then hand you to the next.'}
        </p>
      </div>
      <ol className="psych-map-grid">
        {PSYCH_SIGNALS.map((signal) => (
          <li key={signal.id} className={`psych-card psych-${signal.id}`}>
            <p className="psych-name">{signal.name}</p>
            <p className="psych-line">“{signal.line}”</p>
            <p className="psych-reinforce">{signal.reinforce}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
