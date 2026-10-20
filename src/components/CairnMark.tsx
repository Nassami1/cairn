export function CairnMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 39h36l-4.5-8h-27z" />
      <path d="M13.5 31h21l-3.5-7.5h-14z" />
      <path d="M19 23.5h10L26.5 16h-5z" />
    </svg>
  );
}

export function ConfidenceCairn({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const filled = [score >= 18, score >= 45, score >= 70];
  return (
    <svg className={className} viewBox="0 0 76 92" aria-hidden="true">
      <g>
        <path
          d="M4 86h68l-7-23H11z"
          className={filled[0] ? 'stone stone--filled' : 'stone'}
        />
        <path
          d="M18 60h43l-6-21H23z"
          className={filled[1] ? 'stone stone--filled' : 'stone'}
        />
        <path
          d="M28 36h21l-4.5-19h-12z"
          className={filled[2] ? 'stone stone--filled' : 'stone'}
        />
      </g>
    </svg>
  );
}
