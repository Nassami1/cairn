import { analyzeClaim, hasNegation, normalizeText } from '../lib/text.js';

export { analyzeClaim };

/**
 * Input validation is part of the product: the tool weighs statements, so it
 * says so rather than guessing what a question asserts.
 */
export function validateClaim(raw, { min = 8, max = 400 } = {}) {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'invalid_type', message: 'A claim must be sent as text.' };
  }
  const claim = normalizeText(raw);
  if (!claim) {
    return { ok: false, code: 'empty', message: 'Paste a claim first.' };
  }
  if (claim.length < min) {
    return { ok: false, code: 'too_short', message: `That is too short to weigh — at least ${min} characters, please.` };
  }
  if (claim.length > max) {
    return { ok: false, code: 'too_long', message: `Keep the claim under ${max} characters. One claim at a time works best.` };
  }
  if (/^https?:\/\//i.test(claim)) {
    return { ok: false, code: 'url', message: 'Paste the claim itself, not a link.' };
  }
  if (/\?\s*$/.test(claim)) {
    return {
      ok: false,
      code: 'question',
      message: 'Cairn weighs statements. Try “X is Y” instead of “Is X Y?”',
    };
  }
  if (!/[a-zA-Z]/.test(claim)) {
    return { ok: false, code: 'no_words', message: 'A claim needs words to weigh.' };
  }
  const analysis = analyzeClaim(claim);
  if (!analysis.keywords.length) {
    return { ok: false, code: 'no_keywords', message: 'That claim has no checkable terms in it.' };
  }
  if (analysis.keywords.length < 2) {
    return { ok: false, code: 'too_vague', message: 'Add a little more detail — a claim of one word cannot be checked.' };
  }
  return { ok: true, analysis };
}

export { hasNegation };
