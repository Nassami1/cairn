/**
 * Fetching the open web safely.
 *
 * A verification tool takes URLs from search results, so it is an SSRF risk by
 * construction. Every hop is resolved and checked before the request, redirects
 * are followed manually, responses are capped, and only text documents are read.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const DEFAULT_TIMEOUT = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

export class FetchError extends Error {
  constructor(message, code = 'fetch_failed') {
    super(message);
    this.name = 'FetchError';
    this.code = code;
  }
}

export function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new FetchError('Refusing to fetch a local address', 'blocked_host');
  }
  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchError(`Could not resolve ${host}`, 'dns_failed');
  }
  if (!records.length) throw new FetchError(`Could not resolve ${host}`, 'dns_failed');
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new FetchError('Refusing to fetch a private address', 'blocked_host');
    }
  }
}

function isTextDocument(contentType) {
  if (!contentType) return true;
  const type = contentType.split(';')[0].trim().toLowerCase();
  return (
    type === 'text/html' ||
    type === 'application/xhtml+xml' ||
    type === 'text/plain' ||
    type === 'application/xml' ||
    type === 'text/xml' ||
    type === 'application/json' ||
    type === 'text/json' ||
    type === 'application/ld+json'
  );
}

function charsetOf(contentType) {
  const match = /charset=([\w-]+)/i.exec(contentType ?? '');
  const charset = match?.[1]?.toLowerCase();
  return charset && ['utf-8', 'utf8', 'utf-16le', 'latin1', 'iso-8859-1', 'windows-1252'].includes(charset)
    ? charset
    : 'utf-8';
}

async function readCapped(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', truncated: false, bytes: 0 };
  const decoder = new TextDecoder(charsetOf(response.headers.get('content-type')), { fatal: false });
  let text = '';
  let bytes = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        const remaining = value.subarray(0, Math.max(0, value.byteLength - (bytes - maxBytes)));
        text += decoder.decode(remaining, { stream: false });
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    text += decoder.decode();
  }
  return { text, truncated, bytes };
}

/**
 * Fetch a URL, following at most three redirects, refusing private targets,
 * capping the body, and surfacing a typed error instead of throwing raw noise.
 */
export async function safeFetch(rawUrl, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT, headers = {}, signal: externalSignal, maxBytes = MAX_BYTES } = options;
  let current;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new FetchError('Not a valid URL', 'invalid_url');
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!/^https?:$/.test(current.protocol)) {
      throw new FetchError('Only http and https are supported', 'invalid_protocol');
    }
    if (current.port && current.port !== '80' && current.port !== '443') {
      throw new FetchError('Only standard web ports are supported', 'blocked_port');
    }
    await assertPublicHost(current.hostname);

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal;

    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': options.userAgent ?? 'Cairn/0.1 (+https://github.com/; educational project)',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          ...headers,
        },
      });
    } catch (error) {
      if (error?.name === 'TimeoutError') throw new FetchError('The page took too long to respond', 'timeout');
      if (error?.name === 'AbortError') throw new FetchError('The request was cancelled', 'aborted');
      throw new FetchError(`Connection failed: ${error?.message ?? 'unknown'}`, 'network');
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) throw new FetchError('Redirect without a destination', 'bad_redirect');
      if (hop === MAX_REDIRECTS) throw new FetchError('Too many redirects', 'too_many_redirects');
      current = new URL(location, current);
      continue;
    }

    if (response.status >= 400) {
      await response.body?.cancel().catch(() => {});
      throw new FetchError(`The page returned HTTP ${response.status}`, `http_${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!isTextDocument(contentType)) {
      await response.body?.cancel().catch(() => {});
      throw new FetchError('Not a readable text page', 'not_text');
    }

    const { text, truncated, bytes } = await readCapped(response, maxBytes);
    return { url: current.toString(), status: response.status, contentType, text, truncated, bytes };
  }

  throw new FetchError('Too many redirects', 'too_many_redirects');
}
