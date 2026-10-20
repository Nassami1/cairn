/**
 * Reading one source.
 *
 * Passages are scored by overlap with the claim, then classified as supporting
 * or contradicting it. The classifier is deliberately small and legible: a
 * negation near the claim's own terms, plus explicit refutation cues ("myth",
 * "debunked", "false"), and a polarity flip when a refutation cue nests over a
 * negated clause. Every stance keeps the passage that produced it.
 */

import {
  splitPassages,
  relevanceScore,
  trimQuote,
  tokenize,
  hasNegation,
  stemWord,
  expandToken,
  sectionsFromText,
  conceptOf,
} from '../lib/text.js';

const REFUTE_PATTERNS = [
  /\bmyths?\b/i,
  /\bfalse(?:ly|hood)?\b/i,
  /\bdebunk(?:ed|s|ing)?\b/i,
  /\bmisconceptions?\b/i,
  /\bincorrect(?:ly)?\b/i,
  /\buntrue\b/i,
  /\bno (?:credible )?evidence\b/i,
  /\bnot true\b/i,
  /\bcontrary to (?:popular|common) belief\b/i,
  /\bhoax\b/i,
  /\bdisprove[dn]?\b/i,
  /\brefute[ds]?\b/i,
  /\binaccurate\b/i,
  /\bmisleading\b/i,
  /\bimpossible\b/i,
  /\btoo (?:narrow|small|thin|faint)\b/i,
  /\bnever (?:been )?(?:visible|seen)\b/i,
  /\bnot visible\b/i,
  /\bcan(?:not|'t) be seen\b/i,
];

const SUPPORT_PATTERNS = [
  /\bconfirmed\b/i,
  /\bverified\b/i,
  /\bproven\b/i,
  /\bevidence (?:shows|suggests|indicates)\b/i,
  /\bin fact\b/i,
  /\bindeed\b/i,
  /\bconsistent with\b/i,
  /\bcorrect\b/i,
];

const BOILERPLATE_PATTERNS = [
  /\b(subscribe|newsletter|sign up|sign-up|click here|read more|advertisement|advertising|sponsored|affiliate|commission)\b/i,
  /\b(cookie|privacy policy|terms of (?:use|service)|all rights reserved)\b/i,
  /\b(follow us|share this|download the app|top stories|don't miss|here's what you'll learn|getty images)\b/i,
  /\b(when you buy through links|we may earn|this article was originally published)\b/i,
];

const NEGATION_TOKENS = new Set([
  'not', 'no', 'never', 'none', 'cannot', 'cant', 'isnt', 'arent', 'wasnt', 'werent', 'doesnt',
  'dont', 'didnt', 'wont', 'wouldnt', 'couldnt', 'shouldnt', 'without', 'neither', 'nor',
]);

function keywordSet(analysis) {
  const set = new Set([...analysis.keywords, ...analysis.stems]);
  for (const entity of analysis.entities) for (const token of tokenize(entity)) set.add(token);
  for (const token of [...set]) {
    const expanded = expandToken(token);
    if (expanded) for (const synonym of expanded) set.add(synonym);
  }
  return set;
}

function isBoilerplate(text) {
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));
}

function predicateSetFor(analysis) {
  const set = new Set([...analysis.predicateSet, ...analysis.predicate]);
  for (const token of [...set]) {
    const expanded = expandToken(token);
    if (expanded) for (const synonym of expanded) set.add(synonym);
  }
  return set;
}

const DIGIT_WORDS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight',
  9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 20: 'twenty', 30: 'thirty', 50: 'fifty', 100: 'hundred',
};

function anchorSetFor(analysis) {
  const set = new Set([...analysis.anchorSet, ...analysis.anchors]);
  for (const token of [...set]) {
    if (/^\d+$/.test(token) && DIGIT_WORDS[token]) set.add(DIGIT_WORDS[token]);
    const expanded = expandToken(token);
    if (expanded) for (const synonym of expanded) set.add(synonym);
  }
  return set;
}

function hitCount(tokens, keywords) {
  let hits = 0;
  for (const token of new Set(tokens)) {
    if (keywords.has(token) || keywords.has(stemWord(token))) hits += 1;
  }
  return hits;
}

/** Is a negation close enough to the claim's own terms to be about the claim? */
function negationNear(tokens, keywords) {
  for (let i = 0; i < tokens.length; i += 1) {
    const normalized = tokens[i].replace(/'/g, '');
    if (!NEGATION_TOKENS.has(normalized)) continue;
    for (let j = Math.max(0, i - 6); j <= Math.min(tokens.length - 1, i + 6); j += 1) {
      if (j === i) continue;
      const token = tokens[j];
      if (keywords.has(token) || keywords.has(stemWord(token))) return true;
    }
  }
  return false;
}

function matchAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyPassage(passage, analysis, keywords, predicateSet, anchorSet) {
  const tokens = tokenize(passage);
  const hits = hitCount(tokens, keywords);
  const predicateHits = hitCount(tokens, predicateSet);
  const anchorHits = hitCount(tokens, anchorSet);
  const relevance = relevanceScore(passage, analysis);
  const cleaned = passage.replace(/\bnot (?:only|just|merely|simply)\b/gi, ' ');
  const refuteCue = matchAny(cleaned, REFUTE_PATTERNS);
  const supportCue = matchAny(cleaned, SUPPORT_PATTERNS);
  const negated = hasNegation(cleaned) && negationNear(tokenize(cleaned), predicateSet);

  // A source can mention the subject without ever touching the claim. Tourism
  // articles about the Great Wall do not support a claim about seeing it from
  // orbit, so the predicate — not the entity — decides what is on topic.
  const exactKeywords = new Set([...analysis.keywords, ...(analysis.entityTokens ?? [])]);
  const exactHits = hitCount(tokens, exactKeywords);

  const present = new Set([...tokens, ...tokens.map(stemWord)]);
  const conceptsHit = new Set();
  for (const token of present) {
    if (predicateSet.has(token)) conceptsHit.add(conceptOf(token));
  }
  const claimedConcepts = analysis.predicateConcepts ?? [];
  const minConcepts = Math.min(2, claimedConcepts.length);
  const hasAnchor = anchorSet.size === 0 || anchorHits >= 1;
  const onTopic = hasAnchor && conceptsHit.size >= minConcepts;
  if (!onTopic || relevance < 0.12) {
    return {
      stance: 'neutral',
      strength: 0,
      relevance,
      hits,
      predicateHits,
      reason: 'mentions the subject without touching the claim',
    };
  }

  // "The wall cannot be seen … the myth has been debunked" expresses one
  // negative proposition, not two flips. A cue only supplies the negation when
  // the clause itself is not already negated.
  const clausePolarity = negated || refuteCue ? 'negative' : 'positive';
  const claimPolarity = analysis.polarity;
  const stance = clausePolarity === claimPolarity ? 'supports' : 'refutes';

  let strength = 0.32 + relevance * 0.4;
  if (refuteCue) strength += 0.22;
  if (supportCue) strength += 0.1;
  if (negated) strength += 0.08;
  if (hits >= 3) strength += 0.08;
  strength = Math.min(1, Math.round(strength * 1000) / 1000);

  let reason;
  if (refuteCue) reason = 'calls the claim a myth, falsehood, or misconception';
  else if (negated) reason = 'negates the claim next to its key terms';
  else if (supportCue) reason = 'affirms the claim with confirming language';
  else reason = 'states the claim’s content without contradiction';

  return { stance, strength, relevance, hits, predicateHits, exactHits, reason, explicit: refuteCue };
}

function passagesFor(candidate) {
  const sections = candidate.sections?.length
    ? candidate.sections
    : sectionsFromText(candidate.text ?? '');

  const passages = [];
  for (const section of sections) {
    const text = String(section.text ?? '').trim();
    if (!text) continue;
    for (const passage of splitPassages(text)) {
      if (isBoilerplate(passage)) continue;
      passages.push({ text: passage, heading: section.heading ?? '' });
    }
  }
  return passages;
}

function titlePrior(title, analysis) {
  const text = String(title ?? '').toLowerCase();
  if (!text) return null;
  const negated = analysis.polarity === 'negative';
  const refutePattern = /\b(isn'?t|is not|aren'?t|can'?t|cannot|not visible|myth|debunk|false|no evidence|disproved|wrong)\b/;
  const supportPattern = /\b(can be seen|is visible|does|confirmed|true|grows taller|taller in summer|longest)\b/;
  if (/\bmore than\b/.test(text) && /\bonly\b/.test(analysis.claim.toLowerCase())) return 'refutes';
  if (refutePattern.test(text)) return negated ? 'supports' : 'refutes';
  if (supportPattern.test(text)) return negated ? 'refutes' : 'supports';
  return null;
}

export function examineSource(candidate, analysis) {
  const selectedPassages = passagesFor(candidate).map(({ text, heading }, index) => {
    const headingBoost = heading && relevanceScore(heading, analysis) > 0.35 ? 0.14 : 0;
    const relevance = Math.min(1, relevanceScore(`${text} ${heading}`, analysis) + headingBoost);
    return { text, heading, relevance, index };
  });

  selectedPassages.sort((a, b) => b.relevance - a.relevance);
  const top = selectedPassages
    .filter((passage) => passage.relevance >= 0.12)
    .slice(0, 6);

  const keywords = keywordSet(analysis);
  const predicateSet = predicateSetFor(analysis);
  const anchorSet = anchorSetFor(analysis);
  const classified = top.map((passage) => ({
    ...passage,
    ...classifyPassage(passage.text, analysis, keywords, predicateSet, anchorSet),
  }));

  let supportWeight = classified
    .filter((passage) => passage.stance === 'supports')
    .reduce((sum, passage) => sum + passage.strength * (0.5 + passage.relevance), 0);
  // Explicit refutation ("myth", "false", "debunked") is about the claim, not
  // merely near it, and outweighs a narrative mention.
  let refuteWeight = classified
    .filter((passage) => passage.stance === 'refutes')
    .reduce((sum, passage) => sum + passage.strength * (0.5 + passage.relevance) * (passage.explicit ? 1.5 : 1), 0);

  const decisive = Math.max(supportWeight, refuteWeight);
  const total = supportWeight + refuteWeight;
  let stance = 'neutral';
  if (decisive >= 0.25 && total > 0) {
    const margin = Math.abs(supportWeight - refuteWeight) / total;
    if (margin >= 0.2) stance = supportWeight > refuteWeight ? 'supports' : 'refutes';
    else stance = 'unclear';
  }

  // A headline and a body can genuinely disagree ("can be seen" over an
  // abstract that argues it cannot). That is not a decisive source; it is an
  // unclear one, so it does not vote.
  const prior = titlePrior(candidate.title, analysis);
  if (prior && stance !== 'neutral' && prior !== stance) {
    stance = 'unclear';
  }

  const relevantClassified = classified.filter((passage) => passage.stance === stance);
  const pool = relevantClassified.length ? relevantClassified : classified;
  const quoteScore = (passage) =>
    (passage.stance === 'neutral' ? passage.relevance : passage.strength * (0.6 + passage.relevance)) +
    Math.min(3, passage.hits ?? 0) * 0.05 -
    (passage.index ?? 0) * 0.004;
  const best = pool.slice().sort((a, b) => quoteScore(b) - quoteScore(a))[0];

  const relevance = Math.round((top[0]?.relevance ?? 0) * 1000) / 1000;
  if (relevance < 0.25 && stance !== 'neutral') {
    stance = 'neutral';
  }
  const stanceStrength = best && stance !== 'neutral' && stance !== 'unclear'
    ? Math.round((best.strength ?? 0) * 1000) / 1000
    : 0;

  return {
    title: candidate.title,
    url: candidate.url,
    domain: candidate.domain,
    family: candidate.family,
    provider: candidate.provider,
    venue: candidate.venue,
    publishedAt: candidate.publishedAt,
    quality: candidate.quality,
    stance,
    stanceStrength: Math.min(1, stanceStrength),
    relevance,
    note: best?.reason ?? 'the retrieved text did not take a clear side',
    quote: best ? trimQuote(best.text, 220) : '',
    quoteHits: best?.exactHits ?? 0,
    passages: top.slice(0, 3).map((passage) => trimQuote(passage.text, 600)),
    hits: top[0]?.hits ?? 0,
  };
}

/** Exposed for tests: one sentence in, one reading out. */
export function classifySentence(sentence, analysis) {
  return classifyPassage(sentence, analysis, keywordSet(analysis), predicateSetFor(analysis), anchorSetFor(analysis));
}
