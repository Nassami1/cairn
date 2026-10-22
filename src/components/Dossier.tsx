import type { RefObject } from 'react';
import type { Source, Stage, VerificationResult } from '../types';
import { Factors } from './Factors';
import { Ledger } from './Ledger';
import { StageRail } from './StageRail';
import { VerdictCard } from './VerdictCard';

interface DossierProps {
  claim: string;
  stages: Stage[];
  sources: Source[];
  result: VerificationResult | null;
  running: boolean;
  warnings: string[];
  openSource: number | null;
  pulseSource: number | null;
  onToggleSource: (id: number) => void;
  onCite: (id: number) => void;
  onCopy: () => void;
  copied: boolean;
  onNewClaim: () => void;
  onAbort: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function Dossier({
  claim,
  stages,
  sources,
  result,
  running,
  warnings,
  openSource,
  pulseSource,
  onToggleSource,
  onCite,
  onCopy,
  copied,
  onNewClaim,
  onAbort,
  headingRef,
}: DossierProps) {
  return (
    <main id="main" className="dossier">
      <div className="claim-bar">
        <div className="claim-bar-main">
          <span className="mono-label">Claim under review</span>
          <p>{claim}</p>
        </div>
        <div className="claim-bar-side">
          {result && (
            <span className="claim-bar-time">
              {result.cached
                ? 'Cached answer · no new requests'
                : `${(result.durationMs / 1000).toFixed(1)}s · ${result.stats.read} of ${result.stats.candidates} pages read`}
            </span>
          )}
          {running ? (
            <button type="button" className="text-button text-button--quiet" onClick={onAbort}>
              Stop
            </button>
          ) : (
            <button type="button" className="text-button" onClick={onNewClaim}>
              New claim
            </button>
          )}
        </div>
      </div>

      <StageRail stages={stages} />

      <div className={`dossier-grid ${result ? 'dossier-grid--ready' : ''}`}>
        <div className="dossier-main">
          {result ? (
            <VerdictCard
              result={result}
              onCite={onCite}
              onCopy={onCopy}
              copied={copied}
              headingRef={headingRef}
            />
          ) : (
            <div className="verdict-pending" aria-hidden="true">
              <span className="pending-label">Verdict</span>
              <span className="pending-word" />
              <span className="pending-line" style={{ width: '82%' }} />
              <span className="pending-line" style={{ width: '64%' }} />
              <span className="pending-line" style={{ width: '71%' }} />
            </div>
          )}

          {result && result.scope !== 'causal-comparison' && <Factors factors={result.verdict.confidence.factors} />}
        </div>

        <Ledger
          sources={sources}
          running={running}
          warnings={running ? warnings : []}
          outOfScope={result?.scope === 'causal-comparison'}
          openSource={openSource}
          pulseSource={pulseSource}
          onToggle={onToggleSource}
        />
      </div>

      {result && (
        <>
          <section className="caveats" aria-labelledby="caveats-title">
            <div className="caveats-head">
              <h2 id="caveats-title" className="mono-label">
                What this dossier does not cover
              </h2>
              <span className="caveats-rule" aria-hidden="true" />
            </div>
            <ul>
              {result.verdict.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </section>

          {result.warnings.length > 0 && (
            <section className="run-notes" aria-label="Run notes">
              <span className="mono-label">Notes from this run</span>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
