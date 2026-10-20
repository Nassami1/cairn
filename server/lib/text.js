/**
 * Text analysis shared by the whole pipeline.
 *
 * The goal is not linguistic perfection; it is a deterministic, inspectable
 * reading of a claim and its sources. Every score below can be explained in
 * one sentence to a user, which is the point of the product.
 */

const STOPWORDS = new Set(
  `a about above after again against all almost also am an and another any are aren't as at be because been
  before being below between both but by can cannot can't could couldn't did didn't do does doesn't doing don't
  down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here
  here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just
  least less let's like made make makes many may me might more most mostly much must mustn't my myself no nor not
  now of off on once one only or other ought our ours ourselves out over own same shan't she she'd she'll she's
  should shouldn't so some such than that that's the their theirs them themselves then there there's these they
  they'd they'll they're they've this those through to too two under until up upon us very was wasn't we we'd
  we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will
  with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves`
    .split(/\s+/)
    .filter(Boolean)
);

/** Words that flip a claim's polarity. Kept out of keyword lists. */
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'none', 'cannot', 'cant', 'isnt', 'arent', 'wasnt', 'werent',
  'doesnt', 'dont', 'didnt', 'wont', 'wouldnt', 'couldnt', 'shouldnt', 'without', 'neither', 'nor'
]);

const NEGATION_TEST = /\b(?:not|never|cannot|can't|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|won't|wouldn't|couldn't|shouldn't|without|none|neither|nor|no longer)\b/i;
const NEGATION_EXCEPTIONS = /\bnot (?:only|just|merely|simply)\b/gi;

const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'hundred', 'thousand', 'million', 'billion',
  'half', 'quarter', 'dozen', 'percent', 'percentage', 'tenth', 'third', 'fourth', 'fifth', 'twice', 'double', 'triple',
]);

const SUPERLATIVES = new Set([
  'longest', 'tallest', 'largest', 'smallest', 'highest', 'lowest', 'deepest', 'fastest', 'slowest',
  'oldest', 'youngest', 'first', 'last', 'biggest', 'heaviest', 'lightest', 'greatest', 'most', 'least',
]);

const SYNONYM_GROUPS = [
  ['visible', 'visibility', 'see', 'seen', 'sight', 'observe', 'observable', 'view', 'eye'],
  ['tall', 'taller', 'height', 'heights', 'grow', 'grows', 'grown', 'growth', 'expand', 'expands', 'expansion'],
  ['summer', 'hot', 'heat', 'warm', 'temperature', 'thermal', 'winter', 'cold', 'cool'],
  ['brain', 'brains', 'cerebral', 'mind', 'mental', 'cortex'],
  ['use', 'uses', 'used', 'using', 'utilize', 'utilise', 'consume', 'employ'],
  ['percent', 'percentage', 'fraction', 'proportion', 'tenth'],
  ['long', 'longer', 'longest', 'length'],
  ['large', 'larger', 'largest', 'big', 'bigger', 'biggest', 'size'],
  ['fast', 'faster', 'fastest', 'speed', 'quick', 'quickly'],
  ['old', 'older', 'oldest', 'age', 'ancient'],
  ['cost', 'costs', 'expensive', 'price', 'priced', 'pay', 'paid'],
  ['danger', 'dangerous', 'risk', 'risky', 'safe', 'safety', 'harmful'],
  ['health', 'healthy', 'illness', 'disease', 'medical'],
  ['deep', 'deeper', 'deepest', 'depth'],
  ['high', 'higher', 'highest', 'altitude'],
  ['heavy', 'heavier', 'heaviest', 'weight', 'weigh'],
  ['human', 'humans', 'people', 'person', 'persons'],
  ['world', 'earth', 'global', 'planet'],
  ['majority', 'major', 'primarily', 'mainly', 'most'],
  ['only', 'solely', 'exclusively'],
  ['true', 'truth', 'real', 'actually', 'fact', 'factual', 'correct'],
  ['false', 'myth', 'debunk', 'debunked', 'misconception', 'untrue', 'incorrect', 'wrong'],
  ['find', 'found', 'discover', 'discovered', 'show', 'shows', 'shown', 'demonstrate'],
  ['increase', 'increases', 'increased', 'rise', 'rises', 'rising'],
  ['decrease', 'decreases', 'decreased', 'fall', 'falls', 'drop', 'drops'],
  ['cause', 'causes', 'caused', 'lead', 'leads', 'trigger', 'triggers'],
  ['live', 'lives', 'living', 'survive', 'survives'],
  ['build', 'built', 'building', 'construct', 'constructed', 'construction'],
  ['invent', 'invented', 'invention', 'create', 'created', 'creator'],
  ['first', 'earliest', 'initial'],
  ['prove', 'proof', 'proven', 'evidence', 'evidenced'],
  ['climate', 'weather', 'warming', 'warm'],
];

const CONCEPTS = (() => {
  const index = new Map();
  SYNONYM_GROUPS.forEach((group, groupIndex) => {
    for (const word of group) index.set(word, `c${groupIndex}`);
  });
  return index;
})();

export function conceptOf(token) {
  return CONCEPTS.get(token) ?? `w:${stemWord(token)}`;
}

const EXPANSIONS = (() => {
  const map = new Map();
  const add = (word, group) => {
    const key = word.toLowerCase();
    if (!map.has(key)) map.set(key, new Set());
    for (const member of group) map.get(key).add(member);
  };
  for (const group of SYNONYM_GROUPS) {
    const stems = group.map(stemWord);
    for (const word of group) add(word, new Set([...group, ...stems]));
  }
  return map;
})();

export function normalizeText(input) {
  return String(input ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase words, keeping internal apostrophes and hyphens. */
export function tokenize(input) {
  const matches = normalizeText(input).toLowerCase().match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
  // Hyphenated compounds carry meaning both as a whole and as their parts:
  // "ten-percent-of-the-brain" should match "10 percent" and "brain".
  return matches
    .flatMap((token) => {
      const clean = token.replace(/^['-]+|['-]+$/g, '');
      return clean.includes('-') ? [clean, ...clean.split('-')] : [clean];
    })
    .filter(Boolean);
}

/** Very small conservative stemmer: enough to match plurals and tense, no surprises. */
export function stemWord(word) {
  let w = word;
  if (w.length <= 4) return w;
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 5) w = w.slice(0, -2);
  return w;
}

/** Content tokens with stopwords and negations removed. */
export function contentWords(input) {
  return tokenize(input).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !NEGATION_WORDS.has(w.replace(/'/g, '')));
}

export function expandToken(token) {
  return EXPANSIONS.get(token) ?? null;
}

export function hasNegation(text) {
  const cleaned = String(text).replace(NEGATION_EXCEPTIONS, ' ');
  return NEGATION_TEST.test(cleaned);
}

/** Capitalised multi-word names, plus single proper nouns that are not sentence openers. */
export function extractEntities(claim) {
  const text = normalizeText(claim).replace(/[.!?]+$/, '');
  const words = text.split(' ');
  const openers = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'there', 'in', 'on',
    'according', 'new', 'scientists', 'researchers', 'experts', 'many', 'most', 'some', 'all', 'studies']);
  const isCap = (w) => /^[A-Z][a-zA-Z0-9'’-]*/.test(w);
  const isJoiner = (w) => /^(of|the|and|de|van|von|der|la|le|du)$/i.test(w);
  const entities = [];
  let i = 0;
  while (i < words.length) {
    const word = words[i].replace(/[^A-Za-z0-9'’-]/g, '');
    if (!word || !isCap(word) || (i === 0 && openers.has(word.toLowerCase()))) {
      i += 1;
      continue;
    }
    const parts = [words[i]];
    let j = i + 1;
    while (j < words.length) {
      const raw = words[j].replace(/[^A-Za-z0-9'’-]/g, '');
      if (!raw) break;
      if (isCap(raw)) {
        parts.push(words[j]);
        j += 1;
      } else if (isJoiner(raw) && j + 1 < words.length && isCap(words[j + 1].replace(/[^A-Za-z0-9'’-]/g, ''))) {
        parts.push(words[j]);
        j += 1;
      } else {
        break;
      }
    }
    const phrase = parts.join(' ').replace(/[^A-Za-z0-9'’ -]/g, '').trim();
    const acronym = /[A-Z].*[A-Z]/.test(phrase);
    if (i === 0 && parts.length === 1 && !acronym) {
      // Sentence-opening capitalisation is not a name.
      i = Math.max(j, i + 1);
      continue;
    }
    if (phrase && (parts.length > 1 || phrase.length > 3)) {
      entities.push(phrase);
    } else if (phrase && i > 0 && !STOPWORDS.has(phrase.toLowerCase())) {
      entities.push(phrase);
    }
    i = Math.max(j, i + 1);
  }
  return [...new Set(entities)].slice(0, 3);
}

/**
 * Turn a pasted claim into the handful of facts the retrievers need.
 */
export function analyzeClaim(rawClaim) {
  const claim = normalizeText(rawClaim);
  const isQuestion = /\?\s*$/.test(claim) || /^(is|are|was|were|can|could|does|do|did|should|would|will|has|have|who|what|where|when|why|how)\b/i.test(claim);
  const entities = extractEntities(claim);
  const words = contentWords(claim);
  const keywords = [...new Set(words)];
  const stems = [...new Set(keywords.map(stemWord))];
  const negation = hasNegation(claim);
  const clipped = keywords.slice(0, 12);

  const queries = [];
  if (entities[0]) queries.push(entities[0]);
  if (entities[0] && clipped.length > 1) {
    const rest = clipped.filter((w) => !tokenize(entities[0]).includes(w)).slice(0, 4);
    if (rest.length) queries.push(`${entities[0]} ${rest.join(' ')}`);
  }
  if (clipped.length) queries.push(clipped.slice(0, 7).join(' '));
  const uniqueQueries = [...new Set(queries.filter(Boolean))].slice(0, 3);
  if (!uniqueQueries.length) uniqueQueries.push(claim);

  const entityTokens = new Set(
    entities.flatMap((entity) => tokenize(entity)).filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
  const predicate = keywords.filter((keyword) => !entityTokens.has(keyword));
  const predicateOrKeywords = predicate.length ? predicate : keywords;
  const predicateConcepts = [...new Set(predicateOrKeywords.map(conceptOf))];

  // Claim-specific anchors: "10", "percent", "longest". A source that does not
  // touch one of these is about the topic, not about the claim.
  const rawTokens = tokenize(claim);
  const numbers = rawTokens.filter((token) => /^\d+$/.test(token) || NUMBER_WORDS.has(token));
  const anchors = [...new Set([...numbers, ...keywords.filter((keyword) => SUPERLATIVES.has(keyword))])];

  return {
    claim,
    normalized: claim.toLowerCase().replace(/\s+/g, ' '),
    isQuestion,
    keywords,
    stems,
    entities,
    entityTokens: [...entityTokens],
    predicate: predicateOrKeywords,
    predicateConcepts,
    predicateSet: [...new Set([...predicateOrKeywords, ...predicateOrKeywords.map(stemWord)])],
    anchors,
    anchorSet: [...new Set([...anchors, ...anchors.map(stemWord)])],
    polarity: negation ? 'negative' : 'positive',
    queries: uniqueQueries,
    primaryQuery: uniqueQueries[0],
    contentCount: keywords.length,
  };
}

/** Split text into sentences without breaking common abbreviations. */
export function splitSentences(text) {
  const protectedText = normalizeText(text)
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx|Inc|Ltd|Co|Gen|Sen|Rep)\./g, '$1<DOT>')
    .replace(/\b([A-Z])\.(?=\s?[A-Z]\.)/g, '$1<DOT>');
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(\[])/)
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.length >= 12 && /[a-z]/.test(s));
}

/** A passage is 1–3 sentences; the unit we quote and score. */
export function splitPassages(text, maxChars = 480) {
  const sentences = splitSentences(text);
  const passages = [];
  for (let i = 0; i < sentences.length; i += 1) {
    let passage = sentences[i];
    while (
      i + 1 < sentences.length &&
      passage.length + sentences[i + 1].length + 1 <= maxChars &&
      passage.split(/(?<=[.!?])\s/).length < 3
    ) {
      i += 1;
      passage = `${passage} ${sentences[i]}`;
    }
    if (passage.length >= 40) passages.push(passage);
  }
  return passages;
}

/** Split extracted HTML text on its `## Heading` markers. */
export function sectionsFromText(text) {
  const lines = String(text ?? '').split('\n');
  const sections = [];
  let current = { heading: '', lines: [] };
  for (const line of lines) {
    const match = /^##\s+(.+)$/.exec(line.trim());
    if (match) {
      if (current.lines.join('\n').trim()) sections.push(current);
      current = { heading: match[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join('\n').trim()) sections.push(current);
  return sections.map((section) => ({ heading: section.heading, text: section.lines.join('\n').trim() }));
}

/** Parse MediaWiki plaintext into sections so headings can boost relevance. */
export function splitWikiSections(extract) {
  const lines = String(extract ?? '').split('\n');
  const sections = [];
  let current = { heading: '', level: 0, lines: [] };
  for (const line of lines) {
    const match = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line.trim());
    if (match) {
      if (current.lines.join('\n').trim()) sections.push(current);
      current = { heading: match[2], level: match[1].length, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join('\n').trim()) sections.push(current);
  return sections.map((section) => ({ heading: section.heading, text: section.lines.join('\n').trim() }));
}

/** Term-overlap relevance with synonym expansion. Range 0–1. */
export function relevanceScore(text, analysis) {
  const tokens = new Set(tokenize(text));
  if (!tokens.size) return 0;
  const strong = new Set([...analysis.keywords, ...analysis.stems]);
  for (const entity of analysis.entities) {
    for (const token of tokenize(entity)) strong.add(token);
  }
  const weak = new Set();
  for (const token of strong) {
    const expanded = expandToken(token);
    if (expanded) for (const synonym of expanded) weak.add(synonym);
  }
  let hits = 0;
  for (const token of strong) if (tokens.has(token)) hits += 1;
  let weakHits = 0;
  for (const token of weak) if (tokens.has(token)) weakHits += 1;
  const denominator = Math.max(3, strong.size * 0.7);
  let score = Math.min(1, (hits + weakHits * 0.45) / denominator);
  if (analysis.entities.some((entity) => text.toLowerCase().includes(entity.toLowerCase()))) {
    score = Math.min(1, score + 0.22);
  }
  return Math.round(score * 1000) / 1000;
}

/** Keep a quote readable: sentence boundaries, no dangling words, hard cap. */
export function trimQuote(text, max = 300) {
  const clean = normalizeText(text)
    .replace(/^[^A-Za-z0-9"'“(]+/, '')
    .trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 160 ? lastSpace : max).replace(/[,;:\s]+$/, '')}…`;
}
