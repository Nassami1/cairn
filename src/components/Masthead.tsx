import type { Meta } from '../types';

export function Masthead({ meta }: { meta: Meta | null }) {
  const mode = meta?.mode === 'llm' ? 'AI-assisted synthesis' : 'Keyless evidence engine';
  return (
    <header className="masthead">
      <div className="brand">
        <span className="brand-mark">
          <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 39h36l-4.5-8h-27z" />
            <path d="M13.5 31h21l-3.5-7.5h-14z" />
            <path d="M19 23.5h10L26.5 16h-5z" />
          </svg>
        </span>
        <span className="brand-text">
          <span className="brand-name">Cairn</span>
          <span className="brand-sub">Evidence desk</span>
        </span>
      </div>

      <div className="masthead-right">
        <span className="mode-badge" title="The engine used for this session">
          <span className={`mode-dot ${meta?.mode === 'llm' ? 'mode-dot--ai' : ''}`} aria-hidden="true" />
          {mode}
        </span>
        <span className="masthead-meta">
          {meta ? `${meta.families.length} families · No key required` : 'Three families · No key required'}
        </span>
      </div>
    </header>
  );
}
