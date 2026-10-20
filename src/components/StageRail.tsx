import type { Stage } from '../types';

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export function StageRail({ stages }: { stages: Stage[] }) {
  return (
    <ol className="stage-rail" aria-label="Verification progress" aria-live="polite">
      {stages.map((stage, index) => (
        <li key={stage.id} className={`stage stage--${stage.status}`}>
          <span className="stage-marker" aria-hidden="true">
            {stage.status === 'done' ? <Tick /> : <span className="stage-index">{String(index + 1).padStart(2, '0')}</span>}
          </span>
          <span className="stage-copy">
            <span className="stage-label">{stage.label}</span>
            <span className="stage-detail">
              {stage.detail ?? (stage.status === 'running' ? 'working…' : stage.status === 'waiting' ? 'waiting' : '')}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
