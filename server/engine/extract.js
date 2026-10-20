/**
 * HTML → readable article text.
 *
 * Cheerio, not a headless browser: fast, dependency-light, and honest about
 * failure. If a page is JavaScript-only we return null and the caller drops it
 * rather than pretending a headline is evidence.
 */

import * as cheerio from 'cheerio';
import { normalizeText } from '../lib/text.js';

const STRIP_SELECTORS = [
  'script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas', 'video', 'audio',
  'nav', 'header', 'footer', 'aside', 'form', 'button', 'input', 'select', 'textarea',
  '[aria-hidden="true"]', '[hidden]', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.cookie', '.cookies', '.cookie-banner', '.consent', '.gdpr', '.newsletter', '.subscribe', '.subscription',
  '.ad', '.ads', '.advert', '.advertisement', '.sponsor', '.sponsored', '.promo', '.promotion',
  '.related', '.recommended', '.read-more', '.more-stories', '.sidebar', '.side-bar', '.comments',
  '.comment', '.share', '.sharing', '.social', '.social-links', '.breadcrumb', '.breadcrumbs',
  '.menu', '.navbar', '.nav', '.pagination', '.tags', '.byline-social', '.paywall', '.modal', '.popup',
  '.newsletter-signup', '.widget', '.toolbar', '.skip-link', '.search',
  '.references', '.reflist', '.mw-references-wrap', '.mw-cite-backlink', '.reference',
  '.navbox', '.infobox', '.sidebar', '.metadata', '.hatnote', '.ambox', '.mbox-text',
  '.thumbcaption', '.gallery', '.toc', '#toc', '.mw-editsection', '.printfooter',
];

const STRIP_TAGS = ['table'];

const ROOT_SELECTORS = [
  '[itemprop="articleBody"]',
  'article',
  'main',
  '[role="main"]',
  '.article-body',
  '.article__body',
  '.entry-content',
  '.post-content',
  '.story-body',
  '.content-body',
  '#article-body',
  '#content',
];

function metaContent($, selectors) {
  for (const selector of selectors) {
    const value = $(selector).attr('content');
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function cleanTitle(raw) {
  let title = normalizeText(raw);
  if (!title) return '';
  // Trim common "Headline | Site" suffixes, but keep short real titles intact.
  const match = /^(.{25,}?)\s+[|–—]\s+[^|–—]{2,40}$/.exec(title);
  if (match) title = match[1];
  return title.trim();
}

function publishedAtFrom($) {
  const candidates = [
    metaContent($, ['meta[property="article:published_time"]', 'meta[name="article:published_time"]']),
    metaContent($, ['meta[name="date"]', 'meta[name="publish-date"]', 'meta[name="publication_date"]', 'meta[itemprop="datePublished"]']),
    $('time[datetime]').first().attr('datetime') ?? '',
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = Date.parse(candidate);
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return undefined;
}

function chooseRoot($) {
  let best = null;
  let bestScore = 0;
  for (const selector of ROOT_SELECTORS) {
    const element = $(selector).first();
    if (!element.length) continue;
    const paragraphs = element.find('p').toArray();
    const score = paragraphs.reduce((sum, p) => sum + normalizeText($(p).text()).length, 0);
    if (score > bestScore) {
      best = element;
      bestScore = score;
    }
  }
  if (best && bestScore > 400) return best;
  const body = $('body');
  return body.length ? body : null;
}

function articleText($, root) {
  const blocks = [];
  const seen = new Set();
  root.find('h1,h2,h3,h4,p,blockquote,li,figcaption').each((_, element) => {
    const node = $(element);
    if (node.find('p,li,blockquote').length) return; // avoid duplicate nested blocks
    const text = normalizeText(node.text());
    if (!text || seen.has(text)) return;
    const tag = element.tagName?.toLowerCase();
    if (tag === 'li' && text.length < 40) return;
    if (tag === 'p' && text.length < 25) return;
    if (tag === 'figcaption' && text.length < 30) return;
    seen.add(text);
    if (/^h[1-4]$/.test(tag)) {
      if (text.length <= 140) blocks.push(`## ${text}`);
    } else {
      blocks.push(text);
    }
  });

  if (blocks.join('\n\n').length < 400) {
    const fallback = normalizeText(root.text());
    if (fallback.length > blocks.join('\n\n').length) return fallback;
  }
  return blocks.join('\n\n');
}

/**
 * @returns {{title:string, text:string, publishedAt?:string, siteName:string, byline:string} | null}
 */
export function extractArticle(html, url) {
  if (!html || typeof html !== 'string') return null;
  const $ = cheerio.load(html);

  const title =
    cleanTitle(metaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || $('h1').first().text() || $('title').first().text()) ||
    'Untitled page';
  const publishedAt = publishedAtFrom($);
  const siteName = metaContent($, ['meta[property="og:site_name"]']) || (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const byline = metaContent($, ['meta[name="author"]', 'meta[property="article:author"]']);

  for (const selector of STRIP_SELECTORS) {
    try {
      $(selector).remove();
    } catch {
      // A malformed selector in an exotic DOM should never break extraction.
    }
  }
  for (const tag of STRIP_TAGS) $(tag).remove();

  const root = chooseRoot($);
  if (!root) return null;
  const text = articleText($, root);
  const plain = text.replace(/^##\s.*$/gm, '').trim();
  if (plain.length < 400) return null;
  const wordCount = plain.split(/\s+/).length;
  if (wordCount < 70) return null;

  return { title, text, publishedAt, siteName, byline };
}
