const SPECK_COUNT = 15;

/** Decorative torch embers. Positions live in CSS so CSP cannot collapse them. */
export function EmberField() {
  return (
    <div className="ember-field" aria-hidden="true">
      {Array.from({ length: SPECK_COUNT }, (_, i) => (
        <span key={i} className="ember-speck" />
      ))}
    </div>
  );
}
