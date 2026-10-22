import express from 'express';
import { verifyClaim, VerificationError } from '../engine/verify.js';
import { validateClaim } from '../engine/analyze.js';
import { config, llmEnabled, providerMode } from '../config.js';
import { TtlCache, createRateLimiter, createSemaphore } from '../lib/cache.js';

const router = express.Router();
const cache = new TtlCache(config.cache);
const limiter = createRateLimiter(config.rate);
const semaphore = createSemaphore(6);

function sendEvent(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function cacheKey(claim) {
  return claim.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stageSnapshot(result) {
  return [
    { id: 'understand', label: 'Reading the claim', status: 'done', detail: 'Parsed from the cache' },
    { id: 'retrieve', label: 'Finding independent sources', status: 'done', detail: `${result.stats.candidates} candidates` },
    { id: 'read', label: 'Reading what they say', status: 'done', detail: `${result.stats.read} of ${result.stats.candidates} pages read` },
    {
      id: 'compare',
      label: 'Comparing the evidence',
      status: 'done',
      detail:
        result.scope === 'causal-comparison'
          ? 'Causal comparison — verdict withheld'
          : `${result.verdict.counts.supports} support · ${result.verdict.counts.refutes} contradict · ${result.verdict.counts.neutral} neutral`,
    },
    {
      id: 'write',
      label: 'Writing the verdict',
      status: 'done',
      detail: result.scope === 'causal-comparison' ? 'Causal comparison — reading list' : 'Cached — no new requests',
    },
  ];
}

async function handleJson(req, res) {
  const claim = req.body?.claim;
  const validation = validateClaim(claim, { min: config.limits.claimMin, max: config.limits.claimMax });
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message, code: validation.code });
  }

  const key = cacheKey(validation.analysis.normalized);
  const hit = cache.get(key);
  if (hit) return res.json({ ...hit, cached: true, durationMs: 0 });

  const limit = limiter(req.ip);
  if (!limit.allowed) {
    return res.status(429).json({
      error: `The desk is taking a short breath. Try again in ${limit.retryAfter} seconds.`,
      code: 'rate_limited',
      retryAfter: limit.retryAfter,
    });
  }

  const release = await semaphore.acquire();
  try {
    const result = await verifyClaim(claim);
    cache.set(key, result);
    return res.json(result);
  } catch (error) {
    if (error instanceof VerificationError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[cairn] verification failed', error);
    return res.status(502).json({ error: 'The evidence run failed. Try again.', code: 'pipeline_failed' });
  } finally {
    release();
  }
}

async function handleStream(req, res) {
  const claim = req.body?.claim;
  const validation = validateClaim(claim, { min: config.limits.claimMin, max: config.limits.claimMax });

  res.status(200);
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();
  if (res.socket) {
    res.socket.setNoDelay(true);
    res.socket.setTimeout(0);
  }

  if (!validation.ok) {
    sendEvent(res, 'error', { message: validation.message, code: validation.code });
    res.end();
    return;
  }

  const key = cacheKey(validation.analysis.normalized);
  const hit = cache.get(key);
  if (hit) {
    for (const stage of stageSnapshot(hit)) sendEvent(res, 'stage', stage);
    sendEvent(res, 'result', { ...hit, cached: true, durationMs: 0 });
    sendEvent(res, 'done', { durationMs: 0, cached: true });
    res.end();
    return;
  }

  const limit = limiter(req.ip);
  if (!limit.allowed) {
    sendEvent(res, 'error', {
      message: `The desk is taking a short breath. Try again in ${limit.retryAfter} seconds.`,
      code: 'rate_limited',
      retryAfter: limit.retryAfter,
    });
    res.end();
    return;
  }

  const controller = new AbortController();
  const release = await semaphore.acquire();
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 15_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await verifyClaim(claim, {
      signal: controller.signal,
      onEvent: (type, data) => sendEvent(res, type, data),
    });
    if (!result || controller.signal.aborted) return;
    cache.set(key, result);
    sendEvent(res, 'done', { durationMs: result.durationMs, cached: false });
    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;
    clearInterval(heartbeat);
    if (error instanceof VerificationError) {
      sendEvent(res, 'error', { message: error.message, code: error.code, status: error.status });
    } else {
      console.error('[cairn] stream failed', error);
      sendEvent(res, 'error', { message: 'The evidence run failed. Try again.', code: 'pipeline_failed' });
    }
    res.end();
  } finally {
    clearInterval(heartbeat);
    release();
  }
}

router.post('/', (req, res) => {
  const wantsStream = req.query.stream === '1' || (req.headers.accept ?? '').includes('text/event-stream');
  if (wantsStream) return handleStream(req, res);
  return handleJson(req, res);
});

router.get('/meta', (_req, res) => {
  const { mode, families, webSearch } = providerMode();
  res.json({
    mode,
    llm: llmEnabled(),
    webSearch,
    families,
    version: '0.1.0',
    maxClaimLength: config.limits.claimMax,
    cacheTtlMinutes: Math.round(config.cache.ttlMs / 60000),
  });
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()), cacheEntries: cache.size });
});

export default router;
