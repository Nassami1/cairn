/**
 * Provider fan-out and candidate selection.
 *
 * Families are queried in parallel and merged round-robin so a chatty provider
 * cannot crowd out an independent one. That diversity is what the confidence
 * model later pays for.
 */

import { searchWikipedia } from '../providers/wikipedia.js';
import { searchNews } from '../providers/news.js';
import { searchResearch } from '../providers/openalex.js';
import { searchWeb, webSearchEnabled } from '../providers/websearch.js';
import { registrableDomain, sourceQuality } from '../lib/domains.js';
import { relevanceScore, normalizeText, tokenize, expandToken } from '../lib/text.js';
import { config } from '../config.js';

const FAMILY_ORDER = ['reference', 'news', 'research', 'web'];

function dedupe(candidates) {
  const byUrl = new Set();
  const byTitle = new Set();
  const output = [];
  for (const candidate of candidates) {
    if (!candidate?.url) continue;
    const titleKey = normalizeText(candidate.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (byUrl.has(candidate.url)) continue;
    if (titleKey && byTitle.has(titleKey)) continue;
    byUrl.add(candidate.url);
    if (titleKey) byTitle.add(titleKey);
    output.push(candidate);
  }
  return output;
}

/** Round-robin by family, best-scored first within each family. */
function interleave(byFamily, limit) {
  const queues = new Map();
  for (const family of FAMILY_ORDER) {
    const items = (byFamily.get(family) ?? []).slice().sort((a, b) => b.score - a.score);
    if (items.length) queues.set(family, items);
  }
  const picked = [];
  while (picked.length < limit) {
    let added = false;
    for (const family of FAMILY_ORDER) {
      const queue = queues.get(family);
      if (!queue?.length) continue;
      picked.push(queue.shift());
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
  }
  return picked;
}

function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function retrieveCandidates(analysis, { signal } = {}) {
  const budget = 14_000;
  const providers = [
    { family: 'reference', run: () => searchWikipedia(analysis, { signal: withTimeout(signal, budget) }) },
    { family: 'news', run: () => searchNews(analysis, { signal: withTimeout(signal, budget) }) },
    { family: 'research', run: () => searchResearch(analysis, { signal: withTimeout(signal, budget) }) },
  ];
  if (webSearchEnabled()) {
    providers.push({ family: 'web', run: () => searchWeb(analysis, { signal: withTimeout(signal, budget) }) });
  }

  const settled = await Promise.allSettled(providers.map((provider) => provider.run()));
  const warnings = [];
  const byFamily = new Map();
  const providerCounts = {};

  settled.forEach((result, index) => {
    const { family } = providers[index];
    if (result.status === 'fulfilled') {
      const { candidates = [], warnings: providerWarnings = [] } = result.value ?? {};
      warnings.push(...providerWarnings);
      providerCounts[family] = candidates.length;
      if (candidates.length) byFamily.set(family, candidates);
    } else {
      providerCounts[family] = 0;
      if (!signal?.aborted) warnings.push(`${family} search failed`);
    }
  });

  if (signal?.aborted) return { candidates: [], warnings, providerCounts };

  const raw = dedupe([...byFamily.values()].flat());

  // A source that never names the claim's subject is noise, not evidence. This
  // matters most for research abstracts, where words like "wall" and "space"
  // appear in unrelated fields.
  const entityTokens = analysis.entityTokens ?? [];
  const anchorNeedles = new Set([...(analysis.anchorSet ?? [])]);
  for (const anchor of [...anchorNeedles]) {
    const expanded = expandToken(anchor);
    if (expanded) for (const synonym of expanded) anchorNeedles.add(synonym);
  }
  const containsAnchor = (haystack, anchor) =>
    /^\d+$/.test(anchor) ? new RegExp(`\\b${anchor}\\b`).test(haystack) : haystack.includes(anchor);

  const topical = raw.filter((candidate) => {
    if (/\(disambiguation\)$/i.test(candidate.title)) return false;
    const haystack = `${candidate.title} ${candidate.snippet ?? ''} ${(candidate.text ?? '').slice(0, 3000)}`.toLowerCase();

    // Research abstracts are the noisiest family: require the subject in the title.
    if (candidate.family === 'research' && entityTokens.length) {
      const titleTokens = new Set(tokenize(candidate.title));
      if (!entityTokens.some((token) => titleTokens.has(token))) return false;
    }

    if (anchorNeedles.size && ![...anchorNeedles].some((anchor) => containsAnchor(haystack, anchor))) {
      return false;
    }

    if (entityTokens.length < 2) return true;
    const present = entityTokens.filter((token) => haystack.includes(token)).length;
    return present / entityTokens.length >= 0.7;
  });

  const merged = topical.map((candidate) => {
    const domain = registrableDomain(candidate.domain);
    const rank = (candidate.score ?? 0) * 0.55 +
      relevanceScore(`${candidate.title} ${candidate.snippet ?? ''}`, analysis) * 0.3 +
      (candidate.family === 'reference' ? 0.12 : candidate.family === 'research' ? 0.08 : 0.05);
    return {
      ...candidate,
      domain: candidate.domain || domain,
      quality: candidate.quality ?? sourceQuality({ domain, family: candidate.family, citedBy: candidate.citedBy }),
      rank,
    };
  });

  const grouped = new Map();
  for (const candidate of merged) {
    if (!grouped.has(candidate.family)) grouped.set(candidate.family, []);
    grouped.get(candidate.family).push(candidate);
  }

  const selected = interleave(grouped, config.limits.maxCandidates).map((candidate) => ({
    ...candidate,
    score: Math.round((candidate.rank ?? candidate.score ?? 0) * 1000) / 1000,
  }));

  if (selected.length && new Set(selected.map((c) => c.family)).size === 1) {
    warnings.push('Only one source family answered — independence is limited');
  }

  return {
    candidates: selected,
    warnings,
    providerCounts,
  };
}
