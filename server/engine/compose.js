/**
 * Deterministic verdict prose.
 *
 * Everything here is assembled from counted stances and verbatim quotes. The
 * optional LLM may rewrite this later, but this text is always available and
 * always supportable by the ledger.
 */

import { trimQuote } from '../lib/text.js';

const HEADLINES = {
  supported: 'The evidence holds this up.',
  contradicted: 'The evidence cuts against it.',
  mixed: 'The sources disagree.',
  unverifiable: 'The evidence is too thin.',
};

function nameOf(source) {
  const raw = source.venue?.trim() || source.domain;
  const short = raw.split(/\s*[（(]|\s+[—–]\s+|\s+-\s+/)[0].trim();
  return short.length > 42 || !short ? source.domain : short;
}

function keyQuote(quote) {
  const first = String(quote ?? '').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)[0]?.trim() ?? '';
  if (first.length >= 35 && first.length <= 220) return first;
  return trimQuote(first || quote, 220);
}

function strongestOf(sources) {
  const clarity = (source) => (source.weight ?? 0) * (1 + 0.18 * Math.min(5, source.quoteHits ?? 0));
  return sources.slice().sort((a, b) => clarity(b) - clarity(a))[0];
}

export function composeVerdict(analysis, weighed) {
  const { label, score, band, factors, rationale, counts, sources, families, domains } = weighed;

  if (weighed.outOfScope) {
    return {
      label: 'unverifiable',
      headline: 'Beyond this desk’s scope.',
      summary:
        'This claim asserts a causal comparison: that one thing caused more harm than another prevented. Cairn reads and quotes sources, but it cannot weigh population-level causation. The sources below are a reading list, not a verdict.',
      confidence: { score, band, factors, rationale },
      counts,
      caveats: [
        'Causal comparisons require study-level evidence; this engine does not adjudicate them.',
        'The stance tags below are readings of passages, not a verdict on the claim.',
        'A more specific, attributable claim is easier to verify.',
      ],
    };
  }

  const decisive = sources.filter((source) => source.stance === 'supports' || source.stance === 'refutes');
  const neutral = sources.filter((source) => source.stance !== 'supports' && source.stance !== 'refutes');
  const sentences = [];

  if (label === 'unverifiable') {
    if (!sources.length) {
      sentences.push('We could not read any source closely enough to weigh this claim.');
    } else if (decisive.length === 0) {
      sentences.push(
        `We read ${sources.length} source${sources.length === 1 ? '' : 's'}, but none took a clear side on the claim itself.`
      );
    } else {
      sentences.push(
        `We could read ${sources.length} source${sources.length === 1 ? '' : 's'}, but only ${decisive.length} took a clear side — not enough to call it either way.`
      );
    }
  } else {
    sentences.push(
      `We read ${sources.length} source${sources.length === 1 ? '' : 's'} across ${families.length} ${
        families.length === 1 ? 'family' : 'families'
      } of evidence. ${counts.supports} ${counts.supports === 1 ? 'supports' : 'support'} the claim, ${counts.refutes} ${
        counts.refutes === 1 ? 'contradicts' : 'contradict'
      } it, and ${counts.neutral} ${counts.neutral === 1 ? 'stays' : 'stay'} neutral.`
    );

    if (decisive.length) {
      const strongest = strongestOf(decisive);
      if (strongest) {
        const verb = strongest.stance === 'refutes' ? 'cuts directly against it' : 'backs it up';
        sentences.push(`${nameOf(strongest)} ${verb}: “${keyQuote(strongest.quote)}” [${strongest.id}].`);
      }
    } else if (neutral.length) {
      const strongest = strongestOf(neutral);
      if (strongest) {
        sentences.push(
          `${nameOf(strongest)} discusses the subject without a clear side: “${keyQuote(strongest.quote)}” [${strongest.id}].`
        );
      }
    }

    if (label === 'supported') sentences.push('On the readable evidence, the claim holds.');
    else if (label === 'contradicted') sentences.push('On the readable evidence, the claim does not hold.');
    else sentences.push('That split is the finding: the claim is contested rather than settled.');
  }

  const caveats = [
    'Stance is inferred from the quoted passages. Open a source before relying on this.',
    'A dossier reports what readable sources say, not absolute truth.',
    'Coverage is not completeness: other sources may exist that we did not find or could not read.',
  ];
  if (label === 'unverifiable') {
    caveats.unshift('A more specific claim gives the retrieval and the stance check a better target.');
    caveats.unshift('This is not a ruling on the claim — only on the evidence we could read.');
  }

  return {
    label,
    headline: HEADLINES[label],
    summary: sentences.join(' '),
    confidence: { score, band, factors, rationale },
    counts,
    caveats,
  };
}

/** Validate LLM prose before it replaces the deterministic version. */
export function validSummary(summary, sourceCount, { minLength = 80, maxLength = 900 } = {}) {
  if (typeof summary !== 'string') return false;
  const text = summary.trim();
  if (text.length < minLength || text.length > maxLength) return false;
  const markers = [...text.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1]));
  if (!markers.length) return false;
  if (markers.some((id) => id < 1 || id > sourceCount)) return false;
  if (/<[a-z][\s\S]*>/i.test(text)) return false;
  return true;
}
