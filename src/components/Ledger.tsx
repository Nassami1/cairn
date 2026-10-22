import type { Source } from '../types';
import { SourceCard } from './SourceCard';

interface LedgerProps {
  sources: Source[];
  running: boolean;
  warnings: string[];
  openSource: number | null;
  pulseSource: number | null;
  onToggle: (id: number) => void;
  outOfScope?: boolean;
}

export function Ledger({ sources, running, warnings, openSource, pulseSource, onToggle, outOfScope }: LedgerProps) {
  const domains = new Set(sources.map((source) => source.domain)).size;
  const families = new Set(sources.map((source) => source.family)).size;

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="ledger-head">
        <h2 id="ledger-title" className="mono-label">
          Evidence ledger
        </h2>
        <span className="ledger-stats">
          {outOfScope
            ? 'Reading list · not weighed'
            : `${sources.length} ${sources.length === 1 ? 'source' : 'sources'}${
                domains ? ` · ${domains} ${domains === 1 ? 'domain' : 'domains'}` : ''
              }${families ? ` · ${families} ${families === 1 ? 'family' : 'families'}` : ''}`}
        </span>
      </div>
      <p className="ledger-intro">
        {outOfScope
          ? 'These stance tags are readings, not votes. The verdict was withheld, so no source was weighed into a conclusion.'
          : 'Every entry is a page we actually read. The quote under each title is the passage that produced its stance.'}
      </p>

      <div className="ledger-list">
        {sources.map((source) => (
          <SourceCard
            key={source.url}
            source={source}
            expanded={openSource === source.id}
            active={pulseSource === source.id}
            onToggle={onToggle}
          />
        ))}

        {running && sources.length < 3 && (
          <>
            {[0, 1, 2].slice(sources.length).map((index) => (
              <div className="source-skeleton" key={index} aria-hidden="true">
                <span className="skeleton-index" />
                <span className="skeleton-lines">
                  <span style={{ width: '32%' }} />
                  <span style={{ width: '84%' }} />
                  <span style={{ width: '64%' }} />
                </span>
              </div>
            ))}
            <p className="ledger-reading">Reading pages and tagging passages…</p>
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="ledger-warnings">
          <span className="mono-label">Run notes</span>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
