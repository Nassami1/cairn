/**
 * The verification pipeline.
 *
 * understand -> retrieve -> read & examine -> weigh -> compose -> optionally
 * refine prose. Each phase emits an event the browser renders as it happens;
 * the returned object is the same data the JSON endpoint serves.
 */

import { randomUUID } from 'node:crypto';
import { validateClaim } from './analyze.js';
import { retrieveCandidates } from './retrieve.js';
import { examineSource } from './examine.js';
import { weighEvidence } from './weigh.js';
import { composeVerdict } from './compose.js';
import { refineWithLLM } from './llm.js';
import { extractArticle } from './extract.js';
import { safeFetch } from '../lib/http.js';
import { config, llmEnabled } from '../config.js';

export class VerificationError extends Error {
  constructor(message, status = 400, code = 'invalid_claim') {
    super(message);
    this.name = 'VerificationError';
    this.status = status;
    this.code = code;
  }
}

const STAGES = [
  { id: 'understand', label: 'Reading the claim' },
  { id: 'retrieve', label: 'Finding independent sources' },
  { id: 'read', label: 'Reading what they say' },
  { id: 'compare', label: 'Comparing the evidence' },
  { id: 'write', label: 'Writing the verdict' },
];

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error, index };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function cleanDetail(text, fallback) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value ? value.slice(0, 120) : fallback;
}

async function materialize(candidate, { signal }) {
  if (candidate.text && candidate.text.length >= 400) return candidate;
  const response = await safeFetch(candidate.url, {
    signal,
    timeoutMs: 8_000,
    maxBytes: 1_200_000,
    userAgent: config.userAgent,
  });
  const article = extractArticle(response.text, candidate.url);
  if (!article) throw new Error('no readable article text');
  return {
    ...candidate,
    text: article.text,
    title: article.title || candidate.title,
    publishedAt: article.publishedAt ?? candidate.publishedAt,
    venue: article.siteName || candidate.venue,
  };
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean).map((warning) => String(warning).slice(0, 200)))];
}

export async function verifyClaim(rawClaim, { signal, onEvent = () => {} } = {}) {
  const startedAt = Date.now();
  const fail = (message, status = 400, code = 'invalid_claim') => {
    throw new VerificationError(message, status, code);
  };

  const emit = (type, data) => {
    try {
      onEvent(type, data);
    } catch {
      // A broken client connection must never break the run.
    }
  };

  const validation = validateClaim(rawClaim, { min: config.limits.claimMin, max: config.limits.claimMax });
  if (!validation.ok) fail(validation.message, 400, validation.code);
  const { analysis } = validation;

  for (const stage of STAGES) emit('stage', { ...stage, status: 'waiting' });

  emit('stage', { id: 'understand', status: 'running' });
  emit('claim', { claim: analysis.claim });
  emit('stage', {
    id: 'understand',
    status: 'done',
    detail: `${analysis.keywords.length} checkable terms · ${analysis.entities.length} named ${
      analysis.entities.length === 1 ? 'entity' : 'entities'
    }`,
  });

  if (signal?.aborted) return null;

  emit('stage', { id: 'retrieve', status: 'running' });
  const retrieval = await retrieveCandidates(analysis, { signal });
  const warnings = [...retrieval.warnings];

  if (signal?.aborted) return null;

  const familiesFound = [...new Set(retrieval.candidates.map((candidate) => candidate.family))];
  emit('stage', {
    id: 'retrieve',
    status: 'done',
    detail:
      retrieval.candidates.length === 0
        ? 'No candidates answered'
        : `${retrieval.candidates.length} candidates across ${familiesFound.length} ${
            familiesFound.length === 1 ? 'family' : 'families'
          }`,
  });
  for (const warning of retrieval.warnings) emit('warning', { message: warning });

  emit('stage', { id: 'read', status: 'running' });
  const candidates = retrieval.candidates.map((candidate, index) => ({ ...candidate, id: index + 1 }));

  let readCount = 0;
  const examined = await mapLimit(candidates, config.limits.readConcurrency, async (candidate) => {
    if (signal?.aborted) throw new Error('cancelled');
    const materialized = await materialize(candidate, { signal });
    const source = examineSource(materialized, analysis);
    source.id = candidate.id;
    readCount += 1;
    emit('source', source);
    emit('progress', { read: readCount, attempted: candidates.length });
    return source;
  });

  if (signal?.aborted) return null;

  const readable = examined
    .filter((source) => source && !source.error)
    .sort((a, b) => a.id - b.id);

  if (!readable.length) {
    warnings.push(
      candidates.length
        ? `We found ${candidates.length} candidate pages but could not read any of them.`
        : 'No source answered for this claim.'
    );
  } else if (readable.length < candidates.length) {
    warnings.push(
      `${candidates.length - readable.length} ${candidates.length - readable.length === 1 ? 'page' : 'pages'} could not be read and ${candidates.length - readable.length === 1 ? 'was' : 'were'} left out.`
    );
  }

  // Renumber after drops so the ledger and citations stay contiguous.
  const sources = readable.map((source, index) => ({ ...source, id: index + 1 }));
  const domains = new Set(sources.map((source) => source.domain)).size;
  const families = [...new Set(sources.map((source) => source.family))];

  emit('stage', {
    id: 'read',
    status: 'done',
    detail: `Read ${sources.length} of ${candidates.length} pages`,
  });

  if (!sources.length) {
    for (const stage of STAGES.slice(3)) {
      emit('stage', { id: stage.id, status: 'done', detail: 'Skipped — nothing readable' });
    }
    throw new VerificationError('No readable sources were found for this claim. Try a more specific claim.', 422, 'no_sources');
  }

  emit('stage', { id: 'compare', status: 'running' });
  const weighed = weighEvidence(analysis, sources);
  const composed = composeVerdict(analysis, weighed);
  const rankedSources = weighed.sources.slice().sort((a, b) => a.id - b.id);
  emit('stage', {
    id: 'compare',
    status: 'done',
    detail: weighed.outOfScope
      ? 'Causal comparison — verdict withheld'
      : `${weighed.counts.supports} support · ${weighed.counts.refutes} contradict · ${weighed.counts.neutral} neutral`,
  });

  const allWarnings = uniqueWarnings([...warnings, ...weighed.warnings]);

  emit('stage', { id: 'write', status: 'running' });
  let mode = 'local';
  if (llmEnabled() && !weighed.outOfScope) {
    try {
      const refined = await refineWithLLM({ analysis, verdict: composed, sources: rankedSources }, { signal });
      if (refined) {
        composed.headline = refined.headline;
        composed.summary = refined.summary;
        for (const source of rankedSources) {
          if (refined.notes.has(source.id)) source.note = refined.notes.get(source.id);
        }
        mode = 'llm';
      }
    } catch (error) {
      if (!signal?.aborted) allWarnings.push(`AI synthesis was unavailable; showing the evidence engine's wording.`);
    }
  }
  emit('stage', {
    id: 'write',
    status: 'done',
    detail: weighed.outOfScope
      ? 'Causal comparison — reading list, no verdict'
      : mode === 'llm'
        ? 'AI-assisted prose, server-checked citations'
        : 'Assembled from the quotes',
  });

  const result = {
    id: randomUUID(),
    claim: analysis.claim,
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    mode,
    verdict: {
      label: composed.label,
      headline: composed.headline,
      summary: composed.summary,
      confidence: composed.confidence,
      counts: composed.counts,
      caveats: composed.caveats,
    },
    sources: rankedSources,
    stats: {
      candidates: candidates.length,
      read: sources.length,
      dropped: candidates.length - sources.length,
      domains,
      families,
      providers: retrieval.providerCounts,
    },
    warnings: allWarnings,
    cached: false,
    scope: weighed.outOfScope ? 'causal-comparison' : 'weighed',
    engine: 'evidence-v1',
  };

  emit('result', result);
  return result;
}
