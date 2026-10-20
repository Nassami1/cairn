/**
 * News provider, via Bing News RSS.
 *
 * RSS is the only keyless news route that reliably exposes publisher URLs.
 * Bing wraps each link in an apiclick redirect; the real URL is in its `url`
 * parameter, which we decode rather than fetch through Bing.
 */

import * as cheerio from 'cheerio';
import { safeFetch } from '../lib/http.js';
import { canonicalizeUrl, domainFromUrl } from '../lib/domains.js';
import { normalizeText, relevanceScore } from '../lib/text.js';
import { config } from '../config.js';

const FEED = 'https://www.bing.com/news/search';
const MAX_ITEMS = 6;

export function unwrapBingLink(link) {
  try {
    const url = new URL(link);
    if (/(^|\.)bing\.com$/.test(url.hostname) && url.pathname.includes('apiclick')) {
      const target = url.searchParams.get('url');
      if (target) return target;
    }
  } catch {
    // fall through
  }
  return link;
}

function cleanTitle(title, sourceName) {
  let clean = normalizeText(title);
  if (sourceName) {
    const suffix = new RegExp(`\\s*[-–|]\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    clean = clean.replace(suffix, '');
  }
  return clean;
}

async function fetchFeed(query, { signal }) {
  const url = new URL(FEED);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'RSS');
  url.searchParams.set('setmkt', 'en-US');
  url.searchParams.set('setlang', 'en-US');
  url.searchParams.set('cc', 'US');

  const response = await safeFetch(url.toString(), {
    signal,
    timeoutMs: config.limits.retrieveTimeoutMs,
    userAgent: config.userAgent,
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  const $ = cheerio.load(response.text, { xmlMode: true });
  const items = [];
  $('item').each((_, element) => {
    const $item = $(element);
    const rawLink = $item.find('link').first().text().trim();
    const link = unwrapBingLink(rawLink);
    const url = canonicalizeUrl(link);
    const title = cleanTitle($item.find('title').first().text(), $item.find('source').first().text());
    const description = normalizeText($item.find('description').first().text().replace(/<[^>]+>/g, ' '));
    const pubDateRaw = $item.find('pubDate').first().text().trim();
    const publishedAt = pubDateRaw && !Number.isNaN(Date.parse(pubDateRaw)) ? new Date(pubDateRaw).toISOString() : undefined;
    if (!url || !title) return;
    const domain = domainFromUrl(url);
    if (!domain || /(^|\.)bing\.com$/.test(domain)) return;
    items.push({
      title,
      url,
      domain,
      family: 'news',
      provider: 'Bing News',
      snippet: description.slice(0, 400),
      publishedAt,
      score: 0,
      venue: $item.find('source').first().text().trim() || domain,
    });
  });
  return items;
}

export async function searchNews(analysis, { signal } = {}) {
  const warnings = [];
  const seen = new Set();
  const collected = [];

  const entity = analysis.entities[0];
  const predicate = analysis.predicate.length ? analysis.predicate : analysis.keywords;
  const broad = entity ? `${entity} ${predicate.slice(0, 3).join(' ')}` : predicate.slice(0, 6).join(' ');
  const narrow = entity ? `${entity} ${predicate.slice(0, 2).join(' ')}` : predicate.slice(0, 4).join(' ');
  const queries = [...new Set([broad, narrow].filter(Boolean))];

  for (const query of queries) {
    if (collected.length >= MAX_ITEMS) break;
    try {
      const items = await fetchFeed(query, { signal });
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        collected.push(item);
      }
      if (collected.length >= 3) break;
    } catch (error) {
      if (signal?.aborted) return { candidates: collected, warnings };
      warnings.push('News search was unavailable, so this dossier used the other families.');
      break;
    }
  }

  if (!collected.length) {
    warnings.push('News search returned no readable publishers');
    return { candidates: [], warnings };
  }

  const ranked = collected
    .map((item) => ({
      ...item,
      score: relevanceScore(`${item.title} ${item.snippet}`, analysis) + 0.1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS);

  return { candidates: ranked, warnings };
}
