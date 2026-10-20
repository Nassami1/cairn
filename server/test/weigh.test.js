import test from 'node:test';
import assert from 'node:assert/strict';
import { weighEvidence, verdictFromWeights } from '../engine/weigh.js';
import { composeVerdict, validSummary } from '../engine/compose.js';
import { analyzeClaim } from '../lib/text.js';

const analysis = analyzeClaim('The Great Wall of China is visible from space with the naked eye.');

function source(overrides) {
  return {
    id: 1,
    title: 'Source',
    url: 'https://example.com/a',
    domain: 'example.com',
    family: 'news',
    provider: 'test',
    stance: 'neutral',
    stanceStrength: 0.8,
    relevance: 0.9,
    quality: 0.8,
    quote: 'The Great Wall of China cannot be seen from space with the naked eye.',
    note: 'test',
    passages: [],
    ...overrides,
  };
}

test('verdict thresholds are symmetric and conservative', () => {
  assert.equal(verdictFromWeights(2, 0, 2), 'supported');
  assert.equal(verdictFromWeights(0, 2, 2), 'contradicted');
  assert.equal(verdictFromWeights(1, 1, 2), 'mixed');
  assert.equal(verdictFromWeights(0, 0, 0), 'unverifiable');
  assert.equal(verdictFromWeights(0.3, 0.2, 2), 'mixed');
});

test('three contradicting sources across domains produce a capped, explained verdict', () => {
  const weighed = weighEvidence(analysis, [
    source({ id: 1, stance: 'refutes', domain: 'a.com', family: 'reference', quality: 1 }),
    source({ id: 2, stance: 'refutes', domain: 'b.com', family: 'news', quality: 0.8 }),
    source({ id: 3, stance: 'refutes', domain: 'c.com', family: 'research', quality: 0.9 }),
    source({ id: 4, stance: 'neutral', domain: 'd.com', family: 'news', quality: 0.7 }),
  ]);
  assert.equal(weighed.label, 'contradicted');
  assert.equal(weighed.factors.length, 4);
  assert.equal(weighed.counts.refutes, 3);
  assert.ok(weighed.score <= 88);
  assert.ok(weighed.score >= 70);
  assert.match(weighed.rationale, /contradict/);
  assert.ok(weighed.sources.every((item) => typeof item.weight === 'number'));
});

test('one family cannot buy high confidence', () => {
  const weighed = weighEvidence(analysis, [
    source({ id: 1, stance: 'refutes', domain: 'a.com', family: 'news' }),
    source({ id: 2, stance: 'refutes', domain: 'b.com', family: 'news' }),
    source({ id: 3, stance: 'refutes', domain: 'c.com', family: 'news' }),
  ]);
  assert.equal(weighed.label, 'contradicted');
  assert.ok(weighed.score <= 66);
  assert.equal(weighed.band, 'medium');
});

test('no decisive source is not a verdict', () => {
  const weighed = weighEvidence(analysis, [
    source({ id: 1, stance: 'neutral', domain: 'a.com', family: 'reference' }),
    source({ id: 2, stance: 'neutral', domain: 'b.com', family: 'news' }),
  ]);
  assert.equal(weighed.label, 'unverifiable');
  assert.ok(weighed.score <= 34);
  assert.equal(weighed.band, 'low');
});

test('a single decisive voice is capped', () => {
  const weighed = weighEvidence(analysis, [
    source({ id: 1, stance: 'refutes', domain: 'a.com', family: 'reference' }),
    source({ id: 2, stance: 'neutral', domain: 'b.com', family: 'news' }),
  ]);
  assert.equal(weighed.label, 'contradicted');
  assert.ok(weighed.score <= 58);
});

test('composed prose cites a real source and carries caveats', () => {
  const weighed = weighEvidence(analysis, [
    source({ id: 1, stance: 'refutes', domain: 'wikipedia.org', family: 'reference', quality: 1 }),
    source({ id: 2, stance: 'supports', domain: 'example.com', family: 'news' }),
  ]);
  const verdict = composeVerdict(analysis, weighed);
  assert.match(verdict.summary, /\[\d\]/);
  assert.equal(verdict.caveats.length, 3);
  assert.ok(verdict.headline.length > 5);
  assert.equal(verdict.confidence.factors.length, 4);
});

test('summary validation rejects uncited, overlong, and out-of-range prose', () => {
  const filler = 'This sentence is long enough to pass the length requirement and reads clearly';
  assert.equal(validSummary(`${filler} [1].`, 3), true);
  assert.equal(validSummary(`${filler} without a citation.`, 3), false);
  assert.equal(validSummary(`${filler} [4].`, 3), false);
  assert.equal(validSummary(`${filler} <b>html</b> [1].`, 3), false);
});
