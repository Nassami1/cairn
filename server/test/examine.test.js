import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeClaim } from '../lib/text.js';
import { examineSource, classifySentence } from '../engine/examine.js';

const wall = analyzeClaim('The Great Wall of China is visible from space with the naked eye.');

test('a direct negation contradicts a positive claim', () => {
  const reading = classifySentence(
    'The Great Wall of China cannot be seen by the naked human eye from the Moon.',
    wall
  );
  assert.equal(reading.stance, 'refutes');
  assert.ok(reading.strength > 0.5);
});

test('an affirmative sentence supports a positive claim', () => {
  const reading = classifySentence(
    'The Great Wall can be seen from space with the naked eye under favourable conditions.',
    wall
  );
  assert.equal(reading.stance, 'supports');
});

test('nested negation is not double-counted', () => {
  const reading = classifySentence(
    'The Great Wall cannot be seen from orbit with the naked eye; the myth that it is visible from space has been debunked.',
    wall
  );
  assert.equal(reading.stance, 'refutes');
});

test('a myth cue contradicts even without an explicit "not"', () => {
  const reading = classifySentence(
    'The claim that the Great Wall is visible from space with the naked eye is a myth.',
    wall
  );
  assert.equal(reading.stance, 'refutes');
});

test('off-topic sentences stay neutral', () => {
  for (const sentence of [
    'Tourists visit the Great Wall of China every summer.',
    'The Great Wall is a series of fortifications built across northern China.',
    'Archaeologists found pottery near a section of the wall.',
  ]) {
    assert.equal(classifySentence(sentence, wall).stance, 'neutral', sentence);
  }
});

test('a negative claim inverts the readings', () => {
  const negative = analyzeClaim('The Great Wall of China is not visible from space with the naked eye.');
  assert.equal(classifySentence('It cannot be seen from orbit with the naked eye.', negative).stance, 'supports');
  assert.equal(classifySentence('It is visible from space with the naked eye.', negative).stance, 'refutes');
});

test('numbers anchor a claim to the right passages', () => {
  const brain = analyzeClaim('Humans only use 10 percent of their brains.');
  const myth = classifySentence(
    'The ten-percent-of-the-brain myth states that humans generally use only one-tenth of their brains.',
    brain
  );
  assert.equal(myth.stance, 'refutes');
  const unrelated = classifySentence(
    'Regional gene expression patterns differ between human and chimpanzee brains.',
    brain
  );
  assert.equal(unrelated.stance, 'neutral');
});

test('source examination picks the deciding quote and reports its stance', () => {
  const candidate = {
    title: 'Great Wall of China',
    url: 'https://en.wikipedia.org/wiki/Great_Wall_of_China',
    domain: 'en.wikipedia.org',
    family: 'reference',
    provider: 'Wikipedia',
    venue: 'Wikipedia',
    quality: 1,
    sections: [
      { heading: 'History', text: 'The Great Wall was built over many centuries by several dynasties. It stretches across northern China.' },
      {
        heading: 'Visibility from space',
        text: 'The claim that the Great Wall of China is visible from space with the naked eye has been debunked many times. Astronauts report that it is too narrow to resolve from orbit.',
      },
    ],
  };
  const source = examineSource(candidate, wall);
  assert.equal(source.stance, 'refutes');
  assert.ok(source.quote.length > 30);
  assert.ok(source.quote.toLowerCase().includes('debunked') || source.quote.toLowerCase().includes('too narrow'));
  assert.equal(source.passages.length > 0, true);
});

test('a fact-check headline cannot turn a quoted claim into support', () => {
  const covid = analyzeClaim('COVID-19 vaccines have caused more deaths than they prevented.');
  const source = examineSource(
    {
      title: "Fact Check: CDC didn't say COVID-19 vaccines are 'largest carcinogenic exposure in history'",
      url: 'https://example.com/fact-check',
      domain: 'example.com',
      family: 'news',
      provider: 'test',
      quality: 0.65,
      text: 'COVID-19 vaccines have caused more deaths than they prevented.',
    },
    covid
  );
  assert.equal(source.stance, 'unclear');
  assert.match(source.note, /fact check/i);
});

test('a quoted claim is reported, not asserted as support', () => {
  const einstein = analyzeClaim('Albert Einstein failed mathematics in school.');
  const reading = classifySentence(
    '"Albert Einstein failed math in school," the story says, "and that is why he struggled later."',
    einstein
  );
  assert.equal(reading.stance, 'neutral');
  assert.match(reading.reason, /reports or quotes/i);
});

test('an adversative success clause refutes a failure claim', () => {
  const einstein = analyzeClaim('Albert Einstein failed mathematics in school.');
  const reading = classifySentence(
    'He failed to reach the required standard in the general part of the test, but performed with distinction in physics and mathematics.',
    einstein
  );
  assert.equal(reading.stance, 'refutes');
});

test('a success statement without the failure verb still refutes', () => {
  const einstein = analyzeClaim('Albert Einstein failed mathematics in school.');
  const reading = classifySentence('In fact, he performed strongly in mathematics during his early education.', einstein);
  assert.equal(reading.stance, 'refutes');
});

test('entity and date co-occurrence is not support for a faking claim', () => {
  const moon = analyzeClaim('NASA faked the Moon landing in 1969.');
  const reading = classifySentence(
    "NASA's missions and media initiatives, including the NASA+ streaming service, contribute significantly to its public visibility. The agency also influenced popular culture after the Apollo 11 Moon landing in 1969.",
    moon
  );
  assert.equal(reading.stance, 'neutral');
});

test('a film premise is reporting, not support', () => {
  const brain = analyzeClaim('Humans only use 10 percent of their brains.');
  const reading = classifySentence(
    'The 2014 film "Lucy" is based on this premise: ordinary humans only use 10% of their brains.',
    brain
  );
  assert.equal(reading.stance, 'neutral');
});

test('a reporting frame around a fake claim is neutral, not a refutation', () => {
  const moon = analyzeClaim('NASA faked the Moon landing in 1969.');
  const reading = classifySentence(
    'Since the 1970s conspiracy theories have emerged which claim that NASA faked the moon landing in 1969.',
    moon
  );
  assert.equal(reading.stance, 'neutral');
  assert.match(reading.reason, /reports or quotes/i);
});

test('a pest passage does not support a nutrition claim through the word carrot', () => {
  const carrots = analyzeClaim('Eating carrots improves night vision.');
  const reading = classifySentence(
    'Among pests of carrot crops is the carrot fly (Chamaepsila rosae), a dipteran fly in the family Psilidae.',
    carrots
  );
  assert.equal(reading.stance, 'neutral');
});

test('the carrot myth passage refutes through help and see', () => {
  const carrots = analyzeClaim('Eating carrots improves night vision.');
  const reading = classifySentence(
    'Despite common claims, the provitamin A beta-carotene from carrots does not actually help people to see in the dark unless they suffer from vitamin A deficiency.',
    carrots
  );
  assert.equal(reading.stance, 'refutes');
});

test('a fact-check headline can still refute when the body refutes', () => {
  const covid = analyzeClaim('COVID-19 vaccines have caused more deaths than they prevented.');
  const source = examineSource(
    {
      title: 'Fact Check: The claim that COVID-19 vaccines caused more deaths than they prevented is false',
      url: 'https://example.com/fact-check-2',
      domain: 'example.com',
      family: 'news',
      provider: 'test',
      quality: 0.9,
      text: 'The claim that COVID-19 vaccines caused more deaths than they prevented is false; the data show the opposite.',
    },
    covid
  );
  assert.equal(source.stance, 'refutes');
});

test('a source that ignores the predicate cannot support the claim', () => {
  const candidate = {
    title: 'A guide to visiting the Great Wall',
    url: 'https://example.com/guide',
    domain: 'example.com',
    family: 'news',
    provider: 'Bing News',
    quality: 0.7,
    text: 'A guide to visiting the Great Wall of China. The best season is autumn, when the crowds thin out and the hills turn gold.',
  };
  const source = examineSource(candidate, wall);
  assert.equal(source.stance, 'neutral');
});
