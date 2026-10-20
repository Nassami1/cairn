/**
 * Domain helpers: canonical URLs, registrable domains, and the coarse
 * quality tiers used by the confidence model.
 */

const MULTI_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.in',
  'co.za', 'com.br', 'com.mx', 'com.tr', 'com.cn', 'com.hk', 'com.sg', 'co.kr', 'co.il', 'com.ar',
  'com.eg', 'com.sa', 'com.pk', 'com.ua', 'org.au', 'edu.au', 'gov.au', 'gc.ca', 'on.ca'
]);

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|oc$|ref$|ref_src$|source$|campaign$|igshid$|mc_cid$|mc_eid$|s_cid$|cmp$|CMP$)/;

export function domainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Approximate eTLD+1. Good enough for independence counting; not a full PSL. */
export function registrableDomain(hostname) {
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (!host) return '';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  if (host.includes(':') && /^[0-9a-f:]+$/.test(host)) return host;
  const parts = host.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export function canonicalizeUrl(rawUrl, base) {
  try {
    const url = new URL(rawUrl, base);
    if (!/^https?:$/.test(url.protocol)) return '';
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.port === '80' && url.protocol === 'http:') url.port = '';
    if (url.port === '443' && url.protocol === 'https:') url.port = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    url.pathname = pathname;
    return url.toString();
  } catch {
    return '';
  }
}

const FAMILY_BASE = {
  reference: 1,
  research: 0.95,
  news: 0.8,
  web: 0.82,
};

const TIER_ONE = [
  /(^|\.)wikipedia\.org$/,
  /(^|\.)britannica\.com$/,
  /(^|\.)nasa\.gov$/,
  /(^|\.)noaa\.gov$/,
  /(^|\.)nih\.gov$/,
  /(^|\.)cdc\.gov$/,
  /(^|\.)who\.int$/,
  /(^|\.)un\.org$/,
  /(^|\.)nature\.com$/,
  /(^|\.)science\.org$/,
  /(^|\.)scientificamerican\.com$/,
  /(^|\.)nationalgeographic\.com$/,
  /(^|\.)smithsonianmag\.com$/,
  /(^|\.)reuters\.com$/,
  /(^|\.)apnews\.com$/,
  /(^|\.)bbc\.co\.uk$/,
  /(^|\.)bbc\.com$/,
  /(^|\.)nytimes\.com$/,
  /(^|\.)economist\.com$/,
  /(^|\.)pewresearch\.org$/,
  /(^|\.)ourworldindata\.org$/,
];

const TIER_TWO = [
  /(^|\.)cnn\.com$/, /(^|\.)theguardian\.com$/, /(^|\.)washingtonpost\.com$/, /(^|\.)wsj\.com$/,
  /(^|\.)bloomberg\.com$/, /(^|\.)npr\.org$/, /(^|\.)pbs\.org$/, /(^|\.)cbsnews\.com$/,
  /(^|\.)nbcnews\.com$/, /(^|\.)abcnews\.go\.com$/, /(^|\.)time\.com$/, /(^|\.)theatlantic\.com$/,
  /(^|\.)wired\.com$/, /(^|\.)theverge\.com$/, /(^|\.)arstechnica\.com$/, /(^|\.)livescience\.com$/,
  /(^|\.)space\.com$/, /(^|\.)howstuffworks\.com$/, /(^|\.)usatoday\.com$/, /(^|\.)latimes\.com$/,
  /(^|\.)politifact\.com$/, /(^|\.)snopes\.com$/, /(^|\.)factcheck\.org$/,
];

const LOW_QUALITY = [
  /(^|\.)youtube\.com$/, /(^|\.)youtu\.be$/, /(^|\.)tiktok\.com$/, /(^|\.)pinterest\.[a-z.]+$/,
  /(^|\.)quora\.com$/, /(^|\.)reddit\.com$/, /(^|\.)facebook\.com$/, /(^|\.)x\.com$/,
  /(^|\.)medium\.com$/, /(^|\.)buzzfeed\.com$/, /(^|\.)dailymail\.co\.uk$/, /(^|\.)express\.co\.uk$/,
];

export function domainTier(domain) {
  if (!domain) return 0.5;
  if (TIER_ONE.some((re) => re.test(domain))) return 1;
  if (TIER_TWO.some((re) => re.test(domain))) return 0.86;
  if (/\.(gov|edu)$/.test(domain)) return 0.95;
  if (LOW_QUALITY.some((re) => re.test(domain))) return 0.35;
  if (/\.(org|int)$/.test(domain)) return 0.66;
  return 0.58;
}

export function sourceQuality({ domain, family, citedBy = 0 }) {
  const tier = domainTier(domain);
  const base = FAMILY_BASE[family] ?? 0.75;
  let quality = tier * 0.7 + base * 0.3;
  if (family === 'research' && citedBy > 0) {
    quality = Math.min(1, quality + Math.min(0.12, Math.log10(citedBy + 1) * 0.04));
  }
  return Math.round(quality * 1000) / 1000;
}

export function familyLabel(family) {
  return { reference: 'Reference', news: 'News', research: 'Research', web: 'Web' }[family] ?? 'Source';
}

export function isProbablyUnreadable(domain) {
  return /(^|\.)(msn\.com|britannica\.com|bloomberg\.com|wsj\.com|ft\.com|nytimes\.com|economist\.com)$/.test(domain);
}
