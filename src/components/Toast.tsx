import { useEffect } from 'react';

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3600);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-mark" aria-hidden="true" />
      {message}
    </div>
  );
}
