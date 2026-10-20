/**
 * Optional general-web search. Absent a key, this provider is skipped entirely
 * and the product stays fully usable with the three keyless families.
 */

import { safeFetch } from '../lib/http.js';
import { canonicalizeUrl, domainFromUrl } from '../lib/domains.js';
import { normalizeText, relevanceScore } from '../lib/text.js';
import { config } from '../config.js';

async function braveSearch(query, { signal }) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');
  const response = await safeFetch(url.toString(), {
    signal,
    timeoutMs: config.limits.retrieveTimeoutMs,
    userAgent: config.userAgent,
    headers: { accept: 'application/json', 'x-subscription-token': config.braveKey },
  });
  const data = JSON.parse(response.text);
  return (data?.web?.results ?? []).map((result) => ({
    title: normalizeText(result.title),
    url: canonicalizeUrl(result.url),
    provider: 'Brave Search',
    snippet: normalizeText(result.description),
  }));
}

async function tavilySearch(query, { signal }) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: config.tavilyKey, query, max_results: 5, search_depth: 'basic' }),
  });
  if (!response.ok) throw new Error(`Tavily returned ${response.status}`);
  const data = await response.json();
  return (data?.results ?? []).map((result) => ({
    title: normalizeText(result.title),
    url: canonicalizeUrl(result.url),
    provider: 'Tavily',
    snippet: normalizeText(result.content).slice(0, 400),
  }));
}

export function webSearchEnabled() {
  return Boolean(config.braveKey || config.tavilyKey);
}

export async function searchWeb(analysis, { signal } = {}) {
  if (!webSearchEnabled()) return { candidates: [], warnings: [] };
  const query = analysis.queries[analysis.queries.length - 1] ?? analysis.claim;
  try {
    const raw = config.braveKey ? await braveSearch(query, { signal }) : await tavilySearch(query, { signal });
    const candidates = raw
      .map((result) => {
        const domain = domainFromUrl(result.url);
        if (!domain) return null;
        return {
          ...result,
          domain,
          family: 'web',
          score: relevanceScore(`${result.title} ${result.snippet}`, analysis) + 0.05,
          venue: domain,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    return { candidates, warnings: [] };
  } catch (error) {
    if (signal?.aborted) return { candidates: [], warnings: [] };
    return { candidates: [], warnings: ['Web search was unavailable.'] };
  }
}
