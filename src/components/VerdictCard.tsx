import type { RefObject } from 'react';
import type { VerificationResult } from '../types';
import { BAND_LABELS, VERDICT_LABELS, formatCheckedAt } from '../lib/format';
import { CitationText } from './CitationText';
import { ConfidenceCairn } from './CairnMark';

interface VerdictCardProps {
  result: VerificationResult;
  onCite: (id: number) => void;
  onCopy: () => void;
  copied: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function VerdictCard({ result, onCite, onCopy, copied, headingRef }: VerdictCardProps) {
  const { verdict } = result;
  const label = VERDICT_LABELS[verdict.label];
  const { confidence } = verdict;
  const outOfScope = result.scope === 'causal-comparison';

  return (
    <article className={`verdict verdict--${verdict.label}`}>
      <div className="verdict-top">
        <span className="mono-label">Verdict</span>
        <span className="verdict-serial">
          {result.id.slice(0, 8).toUpperCase()} · {formatCheckedAt(result.createdAt)}
        </span>
      </div>

      <div className="verdict-head">
        <h2 className="verdict-word" ref={headingRef} tabIndex={-1}>
          {label}
        </h2>
        <span className="verdict-stamp" aria-hidden="true">
          {outOfScope
            ? 'Scope guard'
            : verdict.confidence.band === 'high'
              ? 'High confidence'
              : verdict.confidence.band === 'medium'
                ? 'Medium confidence'
                : 'Low confidence'}
        </span>
      </div>

      <p className="verdict-headline">{verdict.headline}</p>
      <p className="verdict-summary">
        <CitationText text={verdict.summary} onCite={onCite} />
      </p>

      <div
        className="confidence"
        aria-label={
          outOfScope
            ? 'Not scored: this claim asserts a causal comparison'
            : `Confidence ${confidence.score} out of 100, ${BAND_LABELS[confidence.band]}`
        }
      >
        <ConfidenceCairn score={outOfScope ? 0 : confidence.score} className="confidence-cairn" />
        <div className="confidence-figure">
          <span className="confidence-number">{outOfScope ? '—' : confidence.score}</span>
          {!outOfScope && <span className="confidence-max">/100</span>}
          <span className={`confidence-band ${outOfScope ? 'confidence-band--unscored' : `confidence-band--${confidence.band}`}`}>
            {outOfScope ? 'Not scored' : `${BAND_LABELS[confidence.band]} confidence`}
          </span>
        </div>
        <p className="confidence-rationale">{confidence.rationale}</p>
      </div>

      <div className="verdict-actions">
        <button type="button" className="button-secondary" onClick={onCopy}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <rect x="8" y="8" width="11" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16 8V5H5v12h3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          {copied ? 'Receipt copied' : 'Copy the receipt'}
        </button>
        <span className="verdict-mode">
          {result.scope === 'causal-comparison'
            ? 'Scope guard · no verdict'
            : result.mode === 'llm'
              ? 'AI-assisted prose · server-checked citations'
              : 'Assembled from the quotes'}
        </span>
      </div>
    </article>
  );
}
