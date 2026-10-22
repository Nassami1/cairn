import { useCallback, useEffect, useRef, useState } from 'react';
import { Desk } from './components/Desk';
import { Dossier } from './components/Dossier';
import { ErrorPanel } from './components/ErrorPanel';
import { Footer } from './components/Footer';
import { Masthead } from './components/Masthead';
import { Toast } from './components/Toast';
import { VerifyError, fetchMeta, streamVerification, verifyJson } from './lib/api';
import { buildReceipt, copyText } from './lib/copy';
import type { Meta, Source, Stage, StageId, StageUpdate, VerificationResult } from './types';

type Phase = 'desk' | 'running' | 'dossier' | 'error';

const INITIAL_STAGES: Stage[] = [
  { id: 'understand', label: 'Reading the claim', status: 'waiting' },
  { id: 'retrieve', label: 'Finding independent sources', status: 'waiting' },
  { id: 'read', label: 'Reading what they say', status: 'waiting' },
  { id: 'compare', label: 'Comparing the evidence', status: 'waiting' },
  { id: 'write', label: 'Writing the verdict', status: 'waiting' },
];

function completionDetail(id: StageId, result: VerificationResult): string {
  switch (id) {
    case 'understand':
      return 'Claim parsed';
    case 'retrieve':
      return `${result.stats.candidates} candidates across ${result.stats.families.length} families`;
    case 'read':
      return `Read ${result.stats.read} of ${result.stats.candidates} pages`;
    case 'compare':
      return result.scope === 'causal-comparison'
        ? 'Causal comparison — verdict withheld'
        : `${result.verdict.counts.supports} support · ${result.verdict.counts.refutes} contradict · ${result.verdict.counts.neutral} neutral`;
    default:
      return result.scope === 'causal-comparison'
        ? 'Reading list, no verdict'
        : result.mode === 'llm'
          ? 'AI-assisted prose'
          : 'Assembled from the quotes';
  }
}

function clientValidation(value: string): string | null {
  const claim = value.trim();
  if (!claim) return 'Paste a claim first.';
  if (claim.length < 8) return 'That is too short to weigh — at least 8 characters, please.';
  if (claim.length > 400) return 'Keep the claim under 400 characters. One claim at a time works best.';
  if (/\?\s*$/.test(claim)) return 'Cairn weighs statements. Try “X is Y” instead of “Is X Y?”';
  return null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('desk');
  const [claim, setClaim] = useState('');
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [sources, setSources] = useState<Source[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [liveWarnings, setLiveWarnings] = useState<string[]>([]);
  const [openSource, setOpenSource] = useState<number | null>(null);
  const [pulseSource, setPulseSource] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const claimRef = useRef(claim);
  claimRef.current = claim;

  useEffect(() => {
    const controller = new AbortController();
    fetchMeta(controller.signal).then(setMeta);
    return () => controller.abort();
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const applyResult = useCallback((next: VerificationResult) => {
    setResult(next);
    setSources(next.sources);
    setPhase('dossier');
    setStages((prev) =>
      prev.map((stage) => ({
        ...stage,
        status: 'done',
        detail: stage.detail ?? completionDetail(stage.id, next),
      }))
    );
    setLiveWarnings(next.warnings);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 120);
  }, []);

  const run = useCallback(
    async (rawClaim: string) => {
      const invalid = clientValidation(rawClaim);
      if (invalid) {
        setFieldError(invalid);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFieldError(null);
      setError(null);
      setClaim(rawClaim.trim());
      setPhase('running');
      setResult(null);
      setSources([]);
      setLiveWarnings([]);
      setOpenSource(null);
      setStages(INITIAL_STAGES.map((stage) => ({ ...stage, status: 'waiting', detail: undefined })));

      const onStage = (update: StageUpdate) => {
        setStages((prev) =>
          prev.map((stage) =>
            stage.id === update.id
              ? { ...stage, ...update, detail: update.detail ?? stage.detail }
              : stage
          )
        );
      };

      const onSource = (source: Source) => {
        setSources((prev) => {
          const next = prev.filter((item) => item.id !== source.id);
          next.push(source);
          return next.sort((a, b) => a.id - b.id);
        });
      };

      try {
        await streamVerification(
          rawClaim.trim(),
          {
            onStage,
            onSource,
            onWarning: (message) => setLiveWarnings((prev) => [...new Set([...prev, message])]),
            onResult: applyResult,
          },
          controller.signal
        );
      } catch (caught) {
        if ((caught as Error).name === 'AbortError' || controller.signal.aborted) {
          setPhase('desk');
          return;
        }

        const verifyError = caught instanceof VerifyError ? caught : new VerifyError('The run failed.');
        const canFallback = ['network', 'no_stream', 'incomplete'].includes(verifyError.code);

        if (canFallback) {
          try {
            const fallback = await verifyJson(rawClaim.trim(), controller.signal);
            applyResult(fallback);
            return;
          } catch (fallbackError) {
            if ((fallbackError as Error).name === 'AbortError') {
              setPhase('desk');
              return;
            }
            const finalError = fallbackError instanceof VerifyError ? fallbackError : verifyError;
            setError({ message: finalError.message, code: finalError.code });
            setPhase('error');
            return;
          }
        }

        setError({ message: verifyError.message, code: verifyError.code });
        setPhase('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [applyResult]
  );

  const handleExample = (example: string) => {
    setClaim(example);
    void run(example);
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('desk');
    setToast('Stopped. The claim is still in the box.');
  };

  const handleNewClaim = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('desk');
    setResult(null);
    setSources([]);
    setError(null);
    setFieldError(null);
    setOpenSource(null);
    setClaim('');
    setFocusNonce((value) => value + 1);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const handleCite = (id: number) => {
    setOpenSource(id);
    setPulseSource(id);
    window.setTimeout(() => {
      const target = document.getElementById(`source-${id}`);
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }, 30);
    window.setTimeout(() => setPulseSource(null), 1700);
  };

  const handleToggleSource = (id: number) => {
    setOpenSource((prev) => (prev === id ? null : id));
  };

  const handleCopy = async () => {
    if (!result) return;
    const ok = await copyText(buildReceipt(result));
    setCopied(ok);
    setToast(ok ? 'Receipt copied — claim, verdict, and sources.' : 'Copy failed. Select the text and copy manually.');
    window.setTimeout(() => setCopied(false), 2600);
  };

  return (
    <div className={`app app--${phase}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="grain" aria-hidden="true" />
      <div className="shell">
        <Masthead meta={meta} />

        {phase === 'desk' && (
          <Desk
            claim={claim}
            onClaimChange={(value) => {
              setClaim(value);
              if (fieldError) setFieldError(null);
            }}
            onRun={() => void run(claim)}
            onExample={handleExample}
            running={false}
            error={fieldError}
            meta={meta}
            focusNonce={focusNonce}
          />
        )}

        {(phase === 'running' || (phase === 'dossier' && result)) && (
          <Dossier
            claim={claim}
            stages={stages}
            sources={sources}
            result={result}
            running={phase === 'running'}
            warnings={result ? result.warnings : liveWarnings}
            openSource={openSource}
            pulseSource={pulseSource}
            onToggleSource={handleToggleSource}
            onCite={handleCite}
            onCopy={() => void handleCopy()}
            copied={copied}
            onNewClaim={handleNewClaim}
            onAbort={handleAbort}
            headingRef={headingRef}
          />
        )}

        {phase === 'error' && (
          <ErrorPanel
            message={error?.message ?? 'The run failed.'}
            code={error?.code}
            onRetry={() => void run(claimRef.current)}
            onReset={handleNewClaim}
          />
        )}

        <Footer />
      </div>

      {toast && <Toast key={toast} message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
