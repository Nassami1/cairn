import type { Source, StageUpdate, VerificationResult } from '../types';

export class VerifyError extends Error {
  code: string;
  retryAfter?: number;

  constructor(message: string, code = 'unknown', retryAfter?: number) {
    super(message);
    this.name = 'VerifyError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

interface StreamHandlers {
  onStage: (stage: StageUpdate) => void;
  onSource: (source: Source) => void;
  onResult: (result: VerificationResult) => void;
  onWarning?: (message: string) => void;
  onProgress?: (read: number, attempted: number) => void;
}

function parseBlock(block: string): { event: string; data: unknown } | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) };
  } catch {
    return null;
  }
}

/**
 * POST + text/event-stream. EventSource cannot send a body, so this parses the
 * stream by hand and keeps the abort signal authoritative.
 */
export async function streamVerification(
  claim: string,
  handlers: StreamHandlers,
  signal: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/verify?stream=1', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ claim }),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new VerifyError('Could not reach the evidence desk. Is the server running?', 'network');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new VerifyError(
      payload?.error ?? `The desk answered with HTTP ${response.status}.`,
      payload?.code ?? 'http_error',
      payload?.retryAfter
    );
  }
  if (!response.body) {
    throw new VerifyError('This browser could not read the live stream.', 'no_stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawResult = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseBlock(block);
        if (parsed) {
          const { event, data } = parsed;
          if (event === 'stage') handlers.onStage(data as StageUpdate);
          else if (event === 'source') handlers.onSource(data as Source);
          else if (event === 'result') {
            sawResult = true;
            handlers.onResult(data as VerificationResult);
          } else if (event === 'warning') handlers.onWarning?.((data as { message: string }).message);
          else if (event === 'progress') {
            const progress = data as { read: number; attempted: number };
            handlers.onProgress?.(progress.read, progress.attempted);
          } else if (event === 'error') {
            const payload = data as { message?: string; code?: string; retryAfter?: number };
            throw new VerifyError(payload.message ?? 'The run failed.', payload.code ?? 'stream_error', payload.retryAfter);
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawResult) throw new VerifyError('The stream ended before a verdict arrived.', 'incomplete');
}

export async function verifyJson(claim: string, signal: AbortSignal): Promise<VerificationResult> {
  const response = await fetch('/api/verify', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ claim }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new VerifyError(
      payload?.error ?? `The desk answered with HTTP ${response.status}.`,
      payload?.code ?? 'http_error',
      payload?.retryAfter
    );
  }
  return (await response.json()) as VerificationResult;
}

export async function fetchMeta(signal?: AbortSignal): Promise<import('../types').Meta | null> {
  try {
    const response = await fetch('/api/verify/meta', { signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as import('../types').Meta;
  } catch {
    return null;
  }
}
