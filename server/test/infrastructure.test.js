import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, safeFetch, FetchError } from '../lib/http.js';
import { canonicalizeUrl, domainTier, registrableDomain, sourceQuality } from '../lib/domains.js';
import { TtlCache, createRateLimiter, createSemaphore } from '../lib/cache.js';
import { reconstructAbstract } from '../providers/openalex.js';
import { unwrapBingLink } from '../providers/news.js';
import { validateClaim } from '../engine/analyze.js';

test('private and link-local addresses are recognised', () => {
  const blocked = ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'];
  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2001:4860:4860::8888', '172.32.0.1'];
  for (const address of blocked) assert.equal(isPrivateAddress(address), true, address);
  for (const address of allowed) assert.equal(isPrivateAddress(address), false, address);
});

test('safeFetch refuses local targets and non-web protocols', async () => {
  await assert.rejects(safeFetch('http://127.0.0.1/'), (error) => error instanceof FetchError && error.code === 'blocked_host');
  await assert.rejects(safeFetch('http://localhost/'), (error) => error instanceof FetchError && error.code === 'blocked_host');
  await assert.rejects(safeFetch('file:///etc/passwd'), (error) => error instanceof FetchError);
});

test('URL canonicalisation removes tracking and fragments', () => {
  assert.equal(
    canonicalizeUrl('https://www.Example.com/a/?utm_source=x&b=2&fbclid=1#frag'),
    'https://example.com/a?b=2'
  );
  assert.equal(canonicalizeUrl('javascript:alert(1)'), '');
});

test('registrable domains collapse subdomains but respect two-part suffixes', () => {
  assert.equal(registrableDomain('en.wikipedia.org'), 'wikipedia.org');
  assert.equal(registrableDomain('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(registrableDomain('news.example.com'), 'example.com');
  assert.equal(domainTier('en.wikipedia.org'), 1);
  assert.ok(sourceQuality({ domain: 'example.com', family: 'news' }) > 0.4);
});

test('inverted abstracts are reconstructed in order', () => {
  const abstract = reconstructAbstract({ The: [0], sky: [1], is: [2], blue: [3] });
  assert.equal(abstract, 'The sky is blue');
  assert.equal(reconstructAbstract(null), '');
});

test('Bing News redirects are unwrapped without fetching them', () => {
  const wrapped =
    'https://www.bing.com/news/apiclick.aspx?ref=FexRss&url=https%3a%2f%2fwww.example.com%2fstory%3Fa%3d1&c=123';
  assert.equal(unwrapBingLink(wrapped), 'https://www.example.com/story?a=1');
  assert.equal(unwrapBingLink('https://www.example.com/direct'), 'https://www.example.com/direct');
});

test('claim validation rejects questions, links, and thin input', () => {
  assert.equal(validateClaim('Is the Great Wall visible from space?').code, 'question');
  assert.equal(validateClaim('short').code, 'too_short');
  assert.equal(validateClaim('https://example.com/claim').code, 'url');
  assert.equal(validateClaim('x'.repeat(500)).code, 'too_long');
  assert.equal(validateClaim('The Great Wall is visible from space.').ok, true);
});

test('ttl cache expires entries and evicts the oldest', async () => {
  const cache = new TtlCache({ ttlMs: 20, max: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), undefined);
  assert.equal(cache.size, 0);
});

test('rate limiter refuses past its window budget', () => {
  const check = createRateLimiter({ windowMs: 50, limit: 2 });
  assert.equal(check('ip').allowed, true);
  assert.equal(check('ip').allowed, true);
  const third = check('ip');
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfter >= 1);
});

test('semaphore honours its concurrency ceiling', async () => {
  const semaphore = createSemaphore(1);
  const release = await semaphore.acquire();
  let secondAcquired = false;
  const second = semaphore.acquire().then((releaseSecond) => {
    secondAcquired = true;
    releaseSecond();
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(secondAcquired, false);
  release();
  await second;
  assert.equal(secondAcquired, true);
});
