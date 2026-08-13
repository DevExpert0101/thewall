import { VIRAL_LOOPS } from '../lib/viralLoops'

export function ViralLoopsMap() {
  return (
    <section className="viral-map" aria-label="Four viral loops">
      <div className="viral-map-head">
        <p className="loop-rail-kicker">Growth engine</p>
        <h2>Four viral loops</h2>
        <p>Friends · Competition · Streamers · Certificates</p>
      </div>
      <ol className="viral-map-grid">
        {VIRAL_LOOPS.map((loop, i) => (
          <li key={loop.id} className="viral-map-card">
            <p className="viral-map-num">Loop {i + 1}</p>
            <h3>{loop.name}</h3>
            <p className="viral-map-spark">“{loop.spark}”</p>
            <p className="viral-map-chain">{loop.chain.join(' → ')}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
