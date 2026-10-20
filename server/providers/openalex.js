/**
 * Research provider, via OpenAlex.
 *
 * OpenAlex gives us titles, venues, citation counts and (often) abstracts with
 * no key. The abstract arrives as an inverted index; reconstructing it keeps the
 * source text citable without fetching the publisher.
 */

import { safeFetch } from '../lib/http.js';
import { domainFromUrl, canonicalizeUrl } from '../lib/domains.js';
import { normalizeText, relevanceScore } from '../lib/text.js';
import { config } from '../config.js';

const API = 'https://api.openalex.org/works';

export function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const slots = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0 && position < 5000) slots[position] = word;
    }
  }
  return slots.filter(Boolean).join(' ');
}

export async function searchResearch(analysis, { signal } = {}) {
  const warnings = [];
  const query = analysis.queries[analysis.queries.length - 1] ?? analysis.claim;
  const url = new URL(API);
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', '5');
  url.searchParams.set('filter', 'has_abstract:true');
  if (config.contactEmail) url.searchParams.set('mailto', config.contactEmail);

  let payload;
  try {
    const response = await safeFetch(url.toString(), {
      signal,
      timeoutMs: config.limits.retrieveTimeoutMs,
      userAgent: config.userAgent,
      headers: { accept: 'application/json' },
    });
    payload = JSON.parse(response.text);
  } catch (error) {
    if (signal?.aborted) return { candidates: [], warnings };
    return { candidates: [], warnings: ['Research search was unavailable, so this dossier used the other families.'] };
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (!results.length) {
    return { candidates: [], warnings: ['Research search returned no abstracts'] };
  }

  const candidates = results
    .map((work) => {
      const abstract = normalizeText(reconstructAbstract(work.abstract_inverted_index));
      if (abstract.length < 250) return null;
      const venue = work.primary_location?.source?.display_name ?? '';
      const landing = work.primary_location?.landing_page_url ?? '';
      const doi = (work.doi ?? '').replace(/^https?:\/\/doi\.org\//i, '');
      const sourceUrl = landing || (doi ? `https://doi.org/${doi}` : work.id);
      const domain = domainFromUrl(sourceUrl) || 'openalex.org';
      const year = work.publication_year ? String(work.publication_year) : undefined;
      return {
        title: normalizeText(work.title ?? 'Untitled research work'),
        url: canonicalizeUrl(sourceUrl),
        domain,
        family: 'research',
        provider: 'OpenAlex',
        snippet: abstract.slice(0, 400),
        text: abstract,
        publishedAt: year ? `${year}-01-01` : undefined,
        score: relevanceScore(`${work.title ?? ''} ${abstract}`, analysis),
        titleScore: relevanceScore(work.title ?? '', analysis),
        citedBy: Number(work.cited_by_count) || 0,
        venue: venue || 'Research literature',
      };
    })
    .filter(Boolean)
    .filter((candidate) => {
      if (candidate.score <= 0.12) return false;
      const title = candidate.title.toLowerCase();
      const namesSubject = analysis.entities.some((entity) => title.includes(entity.toLowerCase()));
      return candidate.titleScore > 0.08 || namesSubject;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!candidates.length) warnings.push('Research results were not relevant enough to read');
  return { candidates, warnings };
}
