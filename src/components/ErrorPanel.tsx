export function ErrorPanel({
  message,
  code,
  onRetry,
  onReset,
}: {
  message: string;
  code?: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <main id="main" className="error-panel">
      <p className="eyebrow">The desk hit a snag</p>
      <h1>The run didn&apos;t finish.</h1>
      <p className="error-message" role="alert">
        {message}
      </p>
      {code === 'no_sources' && (
        <p className="error-hint">
          Retrieval depends on what is publicly readable right now. Try a more specific claim, or try again in a
          minute.
        </p>
      )}
      {code === 'rate_limited' && (
        <p className="error-hint">The desk limits each visitor to ten checks a minute so the sources stay reachable.</p>
      )}
      <div className="error-actions">
        <button type="button" className="button-primary" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="button-secondary" onClick={onReset}>
          Back to the desk
        </button>
      </div>
      <p className="error-note">No claim text was sent anywhere except the retrieval providers.</p>
    </main>
  );
}
