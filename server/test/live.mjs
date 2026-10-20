import assert from 'node:assert/strict';
import { verifyClaim } from '../engine/verify.js';

/**
 * Live smoke test. It needs the public web, so it is not part of `npm test`.
 * Run with: npm run test:live
 */
async function main() {
  const claim = process.argv[2] || 'The Eiffel Tower is taller in summer than in winter.';
  const stages = [];
  const result = await verifyClaim(claim, {
    onEvent: (type, data) => {
      if (type === 'stage') stages.push(`${data.id}:${data.status}`);
    },
  });

  assert.ok(result, 'pipeline returned a result');
  assert.equal(result.claim, claim);
  assert.ok(result.sources.length >= 1, 'at least one readable source');
  assert.ok(result.verdict.confidence.score > 0 && result.verdict.confidence.score <= 100);
  assert.ok(result.verdict.summary.length > 40);
  assert.ok(result.verdict.summary.match(/\[\d\]/), 'summary carries a citation');
  for (const source of result.sources) {
    assert.ok(source.url.startsWith('http'));
    assert.ok(source.quote.length > 0);
    assert.ok(['supports', 'refutes', 'neutral', 'unclear'].includes(source.stance));
  }
  assert.ok(stages.some((stage) => stage.startsWith('write:done')), 'write stage completed');

  console.log(`\n${result.verdict.label.toUpperCase()} ${result.verdict.confidence.score}/100 · ${result.sources.length} sources`);
  console.log(result.verdict.summary);
}

main().catch((error) => {
  console.error('Live check failed:', error);
  process.exitCode = 1;
});
