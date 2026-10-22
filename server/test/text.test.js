import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeClaim,
  contentWords,
  extractEntities,
  hasNegation,
  normalizeText,
  relevanceScore,
  sectionsFromText,
  splitPassages,
  splitSentences,
  splitWikiSections,
  stemWord,
  tokenize,
} from '../lib/text.js';

test('normalise and tokenise keep contractions and drop punctuation', () => {
  assert.equal(normalizeText('  The   Nile\u00a0is  long. '), 'The Nile is long.');
  assert.deepEqual(tokenize("It isn't the world's longest — really."), ['it', "isn't", 'the', "world's", 'longest', 'really']);
});

test('content words remove stopwords and negations', () => {
  const words = contentWords('The Great Wall is not visible from space');
  assert.ok(words.includes('great'));
  assert.ok(words.includes('visible'));
  assert.ok(!words.includes('not'));
  assert.ok(!words.includes('the'));
});

test('questions are recognised', () => {
  assert.equal(analyzeClaim('Is the Great Wall visible from space?').isQuestion, true);
  assert.equal(analyzeClaim('The Great Wall is visible from space.').isQuestion, false);
});

test('entity extraction skips sentence-opening capitals but keeps names', () => {
  assert.deepEqual(extractEntities('The Eiffel Tower is taller in summer than in winter.'), ['Eiffel Tower']);
  assert.deepEqual(extractEntities('The Great Wall of China is visible from space.'), ['Great Wall of China']);
  assert.deepEqual(extractEntities('Humans only use 10 percent of their brains.'), []);
  assert.deepEqual(extractEntities('NASA says the wall cannot be seen.'), ['NASA']);
});

test('claim analysis separates subject, predicate, anchors and polarity', () => {
  const wall = analyzeClaim('The Great Wall of China is visible from space with the naked eye.');
  assert.deepEqual(wall.entities, ['Great Wall of China']);
  assert.deepEqual(wall.entityTokens, ['great', 'wall', 'china']);
  assert.deepEqual(wall.predicate, ['visible', 'space', 'naked', 'eye']);
  assert.equal(wall.polarity, 'positive');
  assert.deepEqual(wall.anchors, []);
  assert.ok(wall.queries[0].includes('Great Wall of China'));

  const brain = analyzeClaim('Humans only use 10 percent of their brains.');
  assert.equal(brain.entities.length, 0);
  assert.deepEqual(brain.anchors.sort(), ['10', 'percent']);
  assert.ok(brain.predicate.includes('brains'));

  const negative = analyzeClaim('The Great Wall of China is not visible from space.');
  assert.equal(negative.polarity, 'negative');
  assert.equal(hasNegation('This is not only wrong but late'), false);
});

test('head predicates and objects are extracted from common claims', () => {
  const einstein = analyzeClaim('Albert Einstein failed mathematics in school.');
  assert.equal(einstein.mainPredicate.concept, 'fail');
  assert.deepEqual(einstein.objectTokens.sort(), ['mathematics', 'school']);

  const moon = analyzeClaim('NASA faked the Moon landing in 1969.');
  assert.equal(moon.mainPredicate.concept, 'fake');
  assert.ok(moon.objectTokens.includes('landing'));
  assert.ok(moon.objectTokens.includes('1969'));

  const carrots = analyzeClaim('Eating carrots improves night vision.');
  assert.equal(carrots.mainPredicate.concept, 'improve');
  assert.ok(carrots.objectTokens.includes('vision'));

  const passive = analyzeClaim('The Moon landing was faked by NASA.');
  assert.equal(passive.mainPredicate.concept, 'fake');
});

test('aggregate causal comparisons are classified separately', () => {
  assert.equal(
    analyzeClaim('COVID-19 vaccines have caused more deaths than they prevented.').claimType,
    'causal-comparison'
  );
  assert.equal(analyzeClaim('Vaccines prevent more deaths than they cause.').claimType, 'causal-comparison');
  assert.equal(analyzeClaim('The Eiffel Tower is taller in summer than in winter.').claimType, 'simple');
  assert.equal(analyzeClaim('The Great Wall of China is visible from space with the naked eye.').claimType, 'simple');
});

test('sentence splitting protects common abbreviations', () => {
  const sentences = splitSentences('Dr. Smith studied the U.S. record. It was 12 m long. That mattered.');
  assert.equal(sentences.length, 3);
  assert.ok(sentences[0].startsWith('Dr. Smith'));
});

test('passages group up to three sentences and respect a character cap', () => {
  const text = Array.from({ length: 6 }, (_, index) => `This is sentence number ${index + 1} and it carries enough words to count.`).join(' ');
  const passages = splitPassages(text, 300);
  assert.ok(passages.length >= 2);
  for (const passage of passages) assert.ok(passage.length <= 320);
});

test('section parsing understands headings from HTML and MediaWiki', () => {
  const html = sectionsFromText('Intro text here.\n## Height\nTaller in summer.\n## Costs\nSix euros.');
  assert.equal(html.length, 3);
  assert.equal(html[1].heading, 'Height');

  const wiki = splitWikiSections('Lead.\n== History ==\nOld.\n=== Detail ===\nFine.');
  assert.equal(wiki.length, 3);
  assert.equal(wiki[1].heading, 'History');
  assert.equal(wiki[2].heading, 'Detail');
});

test('relevance uses entities and synonyms', () => {
  const analysis = analyzeClaim('The Eiffel Tower is taller in summer than in winter.');
  const onTopic = relevanceScore('The tower height varies with temperature during the year.', analysis);
  const offTopic = relevanceScore('A recipe for sourdough bread with olive oil.', analysis);
  assert.ok(onTopic > offTopic);
  assert.ok(onTopic > 0.3);
});

test('stemming is conservative enough to be predictable', () => {
  assert.equal(stemWord('towers'), 'tower');
  assert.equal(stemWord('visible'), 'visible');
  assert.equal(stemWord('running'), 'runn');
});
