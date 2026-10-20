/**
 * Wikipedia provider, on the Wikimedia REST API.
 *
 * Search returns candidate titles; the article HTML is extracted with the same
 * reader used for the open web. One article is normally enough: it carries the
 * section that addresses the claim, and fetching more mostly adds noise and
 * rate-limit pressure.
 */

import { safeFetch } from '../lib/http.js';
import { canonicalizeUrl } from '../lib/domains.js';
import {
  relevanceScore,
  sectionsFromText,
  splitWikiSections,
  normalizeText,
  tokenize,
  stemWord,
} from '../lib/text.js';
import { extractArticle } from '../engine/extract.js';
import { config } from '../config.js';

const SEARCH_URL = 'https://en.wikipedia.org/w/rest.php/v1/search/page';
const PAGE_URL = 'https://en.wikipedia.org/api/rest_v1/page/html';
const ACTION_URL = 'https://en.wikipedia.org/w/api.php';
const CORE_SEARCH_URL = 'https://api.wikimedia.org/core/v1/wikipedia/en/search/page';
const CORE_PAGE_URL = 'https://api.wikimedia.org/core/v1/wikipedia/en/page';
const SPACING_MS = 650;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const PAGE_TTL_MS = 60 * 60 * 1000;

let chain = Promise.resolve();
let lastRequestAt = 0;
let cooldownUntil = 0;
const memo = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function memoized(key, ttlMs, load) {
  const hit = memo.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  const promise = load().catch((error) => {
    memo.delete(key);
    throw error;
  });
  memo.set(key, { promise, expiresAt: Date.now() + ttlMs });
  if (memo.size > 120) memo.delete(memo.keys().next().value);
  return promise;
}

function schedule(task) {
  const run = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(SPACING_MS - (now - lastRequestAt), cooldownUntil - now);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}

async function politeFetch(url, accept, { signal, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await schedule(() =>
        safeFetch(url, {
          signal,
          timeoutMs: 12_000,
          maxBytes: 1_600_000,
          userAgent: config.userAgent,
          headers: { accept },
        })
      );
    } catch (error) {
      lastError = error;
      if (error?.code === 'http_429') {
        cooldownUntil = Date.now() + 800;
        if (attempt < retries) continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function stripHtml(html) {
  return normalizeText(String(html ?? '').replace(/<[^>]+>/g, ' '));
}

async function coreSearch(query, { signal }) {
  const url = new URL(CORE_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const response = await politeFetch(url.toString(), 'application/json', { signal });
  const data = JSON.parse(response.text);
  return (data?.pages ?? []).map((page) => ({
    title: page.title,
    key: page.key,
    description: stripHtml(page.description),
    snippet: stripHtml(page.excerpt),
  }));
}

async function coreArticle(title, { signal }) {
  const url = `${CORE_PAGE_URL}/${encodeURIComponent(title.replace(/ /g, '_'))}/html`;
  const response = await politeFetch(url, 'text/html', { signal });
  const article = extractArticle(
    response.text,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  );
  if (!article) throw new Error('article HTML was not readable');
  const sections = sectionsFromText(article.text).filter(keepSection);
  return {
    title: article.title || title,
    text: sections
      .map((section) => `${section.heading ? `## ${section.heading}\n` : ''}${section.text}`)
      .join('\n\n'),
    sections,
    publishedAt: article.publishedAt,
  };
}

async function restSearch(query, { signal }) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const response = await politeFetch(url.toString(), 'application/json', { signal });
  const data = JSON.parse(response.text);
  return (data?.pages ?? []).map((page) => ({
    title: page.title,
    key: page.key,
    description: stripHtml(page.description),
    snippet: stripHtml(page.excerpt),
  }));
}

async function restArticle(title, { signal }) {
  const url = `${PAGE_URL}/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const response = await politeFetch(url, 'text/html', { signal });
  const article = extractArticle(
    response.text,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  );
  if (!article) throw new Error('article HTML was not readable');
  const sections = sectionsFromText(article.text).filter(
    (section) =>
      !/^(references|notes|bibliography|external links|see also|further reading|citations|sources|footnotes|works cited)$/i.test(
        section.heading.trim()
      ) && section.text.length > 20
  );
  const text = sections
    .map((section) => `${section.heading ? `## ${section.heading}\n` : ''}${section.text}`)
    .join('\n\n');
  return {
    title: article.title || title,
    text,
    sections,
    publishedAt: article.publishedAt,
  };
}

const REFERENCE_SECTION = /^(references|notes|bibliography|external links|see also|further reading|citations|sources|footnotes|works cited)$/i;

function keepSection(section) {
  return !REFERENCE_SECTION.test(section.heading.trim()) && section.text.length > 20;
}

async function actionSearch(query, { signal }) {
  const url = new URL(ACTION_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', '5');
  url.searchParams.set('srprop', 'snippet');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const response = await politeFetch(url.toString(), 'application/json', { signal });
  const data = JSON.parse(response.text);
  return (data?.query?.search ?? []).map((hit) => ({
    title: hit.title,
    key: hit.title.replace(/ /g, '_'),
    description: '',
    snippet: stripHtml(hit.snippet),
  }));
}

/** Lighter than the REST HTML endpoint: plaintext with section headings. */
async function actionArticle(title, { signal }) {
  const url = new URL(ACTION_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('exlimit', '1');
  url.searchParams.set('titles', title);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const response = await politeFetch(url.toString(), 'application/json', { signal });
  const data = JSON.parse(response.text);
  const page = data?.query?.pages?.[0];
  if (!page?.extract || page.extract.length < 500) throw new Error('article extract was empty');
  const sections = splitWikiSections(page.extract).filter(keepSection);
  if (!sections.length) throw new Error('article had no readable sections');
  const text = sections
    .map((section) => `${section.heading ? `## ${section.heading}\n` : ''}${section.text}`)
    .join('\n\n');
  return {
    title: page.title ?? title,
    text,
    sections,
    publishedAt: undefined,
  };
}

async function restArticleSafe(title, { signal }) {
  const article = await restArticle(title, { signal });
  const sections = article.sections.filter(keepSection);
  return {
    ...article,
    sections,
    text: sections.map((section) => `${section.heading ? `## ${section.heading}\n` : ''}${section.text}`).join('\n\n'),
  };
}

function isDisambiguation(title) {
  return /\(disambiguation\)$/i.test(title) || /^List of /i.test(title);
}

export async function searchWikipedia(analysis, { signal } = {}) {
  const warnings = [];
  const query = analysis.entities[0] ?? analysis.queries[0] ?? analysis.claim;

  let hits = [];
  try {
    hits = await memoized(`search:${query}`, SEARCH_TTL_MS, async () => {
      try {
        return await coreSearch(query, { signal });
      } catch (coreError) {
        if (signal?.aborted) throw coreError;
        try {
          return await restSearch(query, { signal });
        } catch (restError) {
          if (signal?.aborted) throw restError;
          return actionSearch(query, { signal });
        }
      }
    });
  } catch (error) {
    if (signal?.aborted) return { candidates: [], warnings: ['Reference search was cancelled'] };
    return { candidates: [], warnings: ['Reference search was unavailable, so this dossier leans on the other families.'] };
  }

  const ranked = hits
    .filter((hit) => !isDisambiguation(hit.title))
    .map((hit, index) => ({
      ...hit,
      score:
        relevanceScore(`${hit.title} ${hit.snippet} ${hit.description}`, analysis) +
        (analysis.entities.some((entity) => hit.title.toLowerCase().includes(entity.toLowerCase())) ? 0.3 : 0) +
        Math.max(0, 0.18 - index * 0.05),
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    warnings.push('Reference search returned no usable articles');
    return { candidates: [], warnings };
  }

  // A second article is only worth a request if its title also speaks to the
  // claim's predicate; otherwise it is usually a sibling topic.
  const predicateTokens = new Set([...analysis.predicate, ...analysis.predicate.map(stemWord)]);
  const picks = [ranked[0]];
  if (ranked[1]) {
    const titleTokens = tokenize(ranked[1].title).map(stemWord);
    if (titleTokens.some((token) => predicateTokens.has(token))) picks.push(ranked[1]);
  }

  const candidates = [];
  for (const hit of picks) {
    try {
      const article = await memoized(`page:${hit.key ?? hit.title}`, PAGE_TTL_MS, async () => {
        try {
          return await actionArticle(hit.title, { signal });
        } catch (actionError) {
          if (signal?.aborted) throw actionError;
          try {
            return await coreArticle(hit.title, { signal });
          } catch (coreError) {
            if (signal?.aborted) throw coreError;
            return restArticleSafe(hit.title, { signal });
          }
        }
      });
      if (!article.text || article.text.length < 500) continue;
      candidates.push({
        title: article.title,
        url: canonicalizeUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(hit.key ?? hit.title)}`),
        domain: 'en.wikipedia.org',
        family: 'reference',
        provider: 'Wikipedia',
        snippet: hit.snippet,
        text: article.text,
        sections: article.sections,
        publishedAt: article.publishedAt,
        score: hit.score,
        quality: 1,
        venue: 'Wikipedia',
      });
    } catch (error) {
      if (signal?.aborted) break;
      warnings.push('One reference article could not be read and was left out.');
    }
  }

  if (!candidates.length) warnings.push('Reference articles could not be read');
  return { candidates, warnings };
}
