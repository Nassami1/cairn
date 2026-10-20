import type { Source } from '../types';
import { FAMILY_LABELS, STANCE_LABELS, formatDate, sourceName } from '../lib/format';

interface SourceCardProps {
  source: Source;
  expanded: boolean;
  active: boolean;
  onToggle: (id: number) => void;
}

export function SourceCard({ source, expanded, active, onToggle }: SourceCardProps) {
  return (
    <article
      id={`source-${source.id}`}
      className={`source source--${source.stance} ${active ? 'source--active' : ''} ${expanded ? 'source--open' : ''}`}
    >
      <div className="source-index">{String(source.id).padStart(2, '0')}</div>

      <div className="source-body">
        <div className="source-meta">
          <span className={`tag tag--family tag--${source.family}`}>{FAMILY_LABELS[source.family]}</span>
          <span className={`tag tag--stance tag--${source.stance}`}>{STANCE_LABELS[source.stance]}</span>
          <span className="source-domain">{sourceName(source)}</span>
          {source.publishedAt && <span className="source-date">{formatDate(source.publishedAt)}</span>}
        </div>

        <h3 className="source-title">
          <a href={source.url} target="_blank" rel="noreferrer noopener">
            {source.title}
          </a>
        </h3>

        {source.quote ? (
          <blockquote className="source-quote">
            <span className="quote-mark" aria-hidden="true">
              “
            </span>
            {source.quote}
            <span className="quote-mark quote-mark--close" aria-hidden="true">
              ”
            </span>
          </blockquote>
        ) : (
          <p className="source-quote source-quote--empty">No quotable passage survived extraction.</p>
        )}

        <p className="source-why">
          <span className="source-why-label">Why this stance</span>
          {source.note}
        </p>

        <div className="source-actions">
          <button type="button" className="text-button" onClick={() => onToggle(source.id)} aria-expanded={expanded}>
            {expanded ? 'Close the passage' : 'Read the passage'}
            <span className={`chevron ${expanded ? 'chevron--up' : ''}`} aria-hidden="true" />
          </button>
          <a className="source-link" href={source.url} target="_blank" rel="noreferrer noopener">
            Open original <span aria-hidden="true">↗</span>
          </a>
        </div>

        {expanded && (
          <div className="source-detail">
            {source.passages.slice(1).map((passage, index) => (
              <p key={index} className="source-passage">
                {passage}
              </p>
            ))}
            <dl className="source-facts">
              <div>
                <dt>Retrieved via</dt>
                <dd>{source.provider}</dd>
              </div>
              <div>
                <dt>Family</dt>
                <dd>{FAMILY_LABELS[source.family]}</dd>
              </div>
              <div>
                <dt>Relevance</dt>
                <dd>{Math.round(source.relevance * 100)}%</dd>
              </div>
              <div>
                <dt>Passage strength</dt>
                <dd>{Math.round(source.stanceStrength * 100)}%</dd>
              </div>
            </dl>
            <p className="source-domain-line">
              {source.domain} · {source.url}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
