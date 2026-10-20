import type { ConfidenceFactor } from '../types';

export function Factors({ factors }: { factors: ConfidenceFactor[] }) {
  return (
    <section className="factors" aria-labelledby="factors-title">
      <div className="factors-head">
        <h2 id="factors-title" className="mono-label">
          How we weighed it
        </h2>
        <span className="factors-rule" aria-hidden="true" />
        <span className="factors-note">Fixed weights, visible workings</span>
      </div>

      <p className="factors-rationale">
        The score is the weighted sum of these four readings, capped when the evidence is thin. The weights are
        fixed and published. Nothing here is model-invented.
      </p>

      <ul className="factor-list">
        {factors.map((factor) => (
          <li key={factor.key} className="factor">
            <span className="factor-label">{factor.label}</span>
            <span className="factor-bar" aria-hidden="true">
              <span className="factor-fill" style={{ width: `${Math.round(factor.score * 100)}%` }} />
            </span>
            <span className="factor-value">{Math.round(factor.score * 100)}</span>
            <span className="factor-note">
              {factor.note} <span className="factor-weight">· weight {Math.round(factor.weight * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
