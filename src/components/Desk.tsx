import { useEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Meta } from '../types';
import { CairnMark } from './CairnMark';

const EXAMPLES = [
  'The Great Wall of China is visible from space with the naked eye.',
  'The Eiffel Tower is taller in summer than in winter.',
  'Humans only use 10 percent of their brains.',
];

interface DeskProps {
  claim: string;
  onClaimChange: (value: string) => void;
  onRun: () => void;
  onExample: (claim: string) => void;
  running: boolean;
  error: string | null;
  meta: Meta | null;
  focusNonce: number;
}

export function Desk({ claim, onClaimChange, onRun, onExample, running, error, meta, focusNonce }: DeskProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = meta?.maxClaimLength ?? 400;
  const trimmed = claim.trim();
  const canSubmit = trimmed.length >= 8 && trimmed.length <= maxLength && !running;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 172)}px`;
  }, [claim]);

  useEffect(() => {
    if (focusNonce > 0) textareaRef.current?.focus();
  }, [focusNonce]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onRun();
    }
  };

  return (
    <main id="main" className="desk">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow reveal" style={{ '--delay': '0ms' } as CSSProperties}>
          A claim verification desk · Est. 2026
        </p>
        <h1 id="hero-title" className="hero-title reveal" style={{ '--delay': '80ms' } as CSSProperties}>
          A claim is only as <em>sturdy</em> as what holds it up.
        </h1>
        <p className="hero-sub reveal" style={{ '--delay': '160ms' } as CSSProperties}>
          Cairn reads the sources behind a claim — reference works, reporting, research — then shows you exactly
          where they agree, where they don&apos;t, and how much weight the answer can bear.
        </p>
      </section>

      <div className="desk-grid">
        <section className="composer-wrap reveal" style={{ '--delay': '240ms' } as CSSProperties}>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onRun();
            }}
          >
            <div className="composer-head">
              <label htmlFor="claim-input" className="mono-label">
                The claim
              </label>
              <span className="composer-index">01 / Input</span>
            </div>

            <textarea
              id="claim-input"
              ref={textareaRef}
              className="claim-input"
              value={claim}
              rows={3}
              maxLength={maxLength + 40}
              spellCheck
              placeholder="Paste a claim you've been asked to check…"
              onChange={(event) => onClaimChange(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'claim-error' : 'claim-hint'}
            />

            <div className="composer-foot">
              <p id="claim-hint" className="composer-hint">
                One statement, not a question. <kbd>Enter</kbd> to weigh.
              </p>
              <div className="composer-actions">
                <span className={`char-count ${trimmed.length > maxLength ? 'char-count--over' : ''}`}>
                  {trimmed.length}/{maxLength}
                </span>
                <button type="submit" className="button-primary" disabled={!canSubmit}>
                  <span>{running ? 'Weighing…' : 'Weigh this claim'}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
                    <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <p id="claim-error" className="field-error" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="examples">
            <span className="examples-label">Or try one</span>
            <div className="example-list">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="example-chip"
                  onClick={() => onExample(example)}
                  disabled={running}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="field-notes reveal" style={{ '--delay': '320ms' } as CSSProperties} aria-label="How Cairn reads evidence">
          <div className="field-notes-head">
            <span className="mono-label">Field notes</span>
            <CairnMark className="field-mark" />
          </div>
          <ol className="notes-list">
            <li>
              <span className="note-num">01</span>
              <div>
                <h2>A cairn marks a path</h2>
                <p>One stone is a guess. A stack is a route someone else can follow. So it goes with evidence.</p>
              </div>
            </li>
            <li>
              <span className="note-num">02</span>
              <div>
                <h2>Three families, not three tabs</h2>
                <p>Reference works, current reporting, and research literature are read independently. Agreement across families counts for more than repetition inside one.</p>
              </div>
            </li>
            <li>
              <span className="note-num">03</span>
              <div>
                <h2>Confidence is a reading</h2>
                <p>Not certainty. It describes how much the sources agree, how independent they are, how directly they speak, and how good they are.</p>
              </div>
            </li>
          </ol>
          <p className="field-quote">
            “A dossier reports what readable sources say. It does not pronounce the truth.”
          </p>
        </aside>
      </div>

      <section className="how" aria-labelledby="how-title">
        <div className="how-head">
          <h2 id="how-title" className="mono-label">
            How the desk works
          </h2>
          <span className="how-rule" aria-hidden="true" />
          <span className="how-note">No API key required</span>
        </div>
        <div className="how-grid">
          <article className="how-step">
            <span className="how-num">01</span>
            <h3>Find</h3>
            <p>Search three independent families and keep the pages that can actually be read — not the headlines that cannot.</p>
          </article>
          <article className="how-step">
            <span className="how-num">02</span>
            <h3>Read</h3>
            <p>Strip each page to its argument, score its passages against the claim, and quote the sentence that decided it.</p>
          </article>
          <article className="how-step">
            <span className="how-num">03</span>
            <h3>Weigh</h3>
            <p>Balance support against contradiction, then derive one confidence score from four named, visible factors.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
