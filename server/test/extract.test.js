import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticle } from '../engine/extract.js';

const longParagraph = (topic) =>
  `${topic} has been studied for decades, and the evidence now points in a direction that most careful readers find surprising. ` +
  'Researchers measured the effect across several independent sites, controlled for the obvious confounders, and published their work for others to check. ' +
  'The result held up when the analysis was repeated with a different method and a larger sample, which is why the finding is worth taking seriously.';

const html = `<!doctype html>
<html>
  <head>
    <title>Fallback title | Example News</title>
    <meta property="og:title" content="A measured look at the claim" />
    <meta property="og:site_name" content="Example News" />
    <meta property="article:published_time" content="2026-05-04T10:00:00Z" />
  </head>
  <body>
    <nav>Navigation only content should be removed</nav>
    <article>
      <h1>A measured look at the claim</h1>
      <p>${longParagraph('The claim')}</p>
      <p>${longParagraph('The rebuttal')}</p>
      <p>${longParagraph('The conclusion')}</p>
      <script>window.bad = true;</script>
    </article>
    <aside>Subscribe to our newsletter</aside>
    <footer>Footer only content</footer>
  </body>
</html>`;

test('extracts article text and metadata while stripping page chrome', () => {
  const article = extractArticle(html, 'https://example.com/story');
  assert.ok(article);
  assert.equal(article.title, 'A measured look at the claim');
  assert.equal(article.siteName, 'Example News');
  assert.equal(article.publishedAt, '2026-05-04T10:00:00.000Z');
  assert.ok(article.text.includes('The claim'));
  assert.ok(article.text.includes('worth taking seriously'));
  assert.ok(!article.text.includes('Navigation only'));
  assert.ok(!article.text.includes('Subscribe to our newsletter'));
  assert.ok(!article.text.includes('window.bad'));
  assert.ok(!article.text.includes('Footer only'));
});

test('short or unreadable pages return null instead of thin evidence', () => {
  assert.equal(extractArticle('<html><body><article><p>Too short to matter.</p></article></body></html>', 'https://example.com'), null);
  assert.equal(extractArticle('', 'https://example.com'), null);
  assert.equal(extractArticle(null, 'https://example.com'), null);
});

test('headings become passage boundaries', () => {
  const article = extractArticle(
    `<html><body><article><h2>Height</h2><p>${longParagraph('Height')}</p><h2>Cost</h2><p>${longParagraph('Cost')}</p></article></body></html>`,
    'https://example.com'
  );
  assert.ok(article.text.includes('## Height'));
  assert.ok(article.text.includes('## Cost'));
});
