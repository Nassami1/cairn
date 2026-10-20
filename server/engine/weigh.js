/**
 * Turning examined sources into one verdict and one explainable number.
 *
 * The verdict is a weighted balance of stances. The confidence is a weighted
 * sum of four factors shown in the UI — never a free-floating percentage.
 */

const WEIGHTS = {
  agreement: 0.32,
  independence: 0.24,
  directness: 0.26,
  quality: 0.18,
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

function effectiveWeight(source) {
  return (source.quality ?? 0.6) * (0.55 + (source.relevance ?? 0)) * Math.max(0.2, source.stanceStrength ?? 0);
}

export function weighEvidence(analysis, sources, { providerFailures = [] } = {}) {
  const examined = sources.map((source) => ({ ...source, weight: round(effectiveWeight(source), 3) }));
  const supports = examined.filter((source) => source.stance === 'supports');
  const refutes = examined.filter((source) => source.stance === 'refutes');
  const neutral = examined.filter((source) => source.stance !== 'supports' && source.stance !== 'refutes');
  const decisive = [...supports, ...refutes];

  const supportWeight = supports.reduce((sum, source) => sum + source.weight, 0);
  const refuteWeight = refutes.reduce((sum, source) => sum + source.weight, 0);
  const totalWeight = supportWeight + refuteWeight;
  const balance = totalWeight > 0 ? (supportWeight - refuteWeight) / totalWeight : 0;

  const domains = new Set(examined.map((source) => source.domain)).size;
  const families = [...new Set(examined.map((source) => source.family))];

  let label = 'unverifiable';
  if (examined.length && decisive.length && totalWeight >= 0.45) {
    if (balance >= 0.3) label = 'supported';
    else if (balance <= -0.3) label = 'contradicted';
    else label = 'mixed';
  }

  const agreement = totalWeight > 0 ? Math.abs(balance) : 0;
  const independence = clamp01(Math.min(1, domains / 3) * 0.55 + Math.min(1, families.length / 2) * 0.45);
  const directness = decisive.length
    ? clamp01(
        decisive.reduce((sum, source) => sum + (source.relevance * 0.45 + source.stanceStrength * 0.55), 0) / decisive.length
      )
    : 0;
  const quality = decisive.length
    ? clamp01(decisive.reduce((sum, source) => sum + (source.quality ?? 0.5), 0) / decisive.length)
    : examined.length
      ? clamp01(examined.reduce((sum, source) => sum + (source.quality ?? 0.5), 0) / examined.length)
      : 0;

  let score = Math.round(
    12 + 88 * (agreement * WEIGHTS.agreement + independence * WEIGHTS.independence + directness * WEIGHTS.directness + quality * WEIGHTS.quality)
  );

  // Honest caps: a confident verdict needs more than one voice, and one family
  // is not independence.
  const caps = [];
  if (decisive.length < 2) caps.push(55);
  if (families.length < 2) caps.push(66);
  if (domains < 3) caps.push(76);
  if (label === 'unverifiable') caps.push(34);
  if (label === 'mixed') caps.push(64);
  if (examined.length < 5) caps.push(88);
  if (examined.length < 4) caps.push(80);
  if (analysis.isQuestion) caps.push(40);
  if (caps.length) score = Math.min(score, ...caps);
  score = Math.max(4, Math.min(94, score));

  const band = score >= 72 ? 'high' : score >= 48 ? 'medium' : 'low';

  const factorNotes = {
    agreement:
      decisive.length === 0
        ? 'No source took a clear side'
        : supports.length && refutes.length
          ? `Sources split ${supports.length}–${refutes.length}`
          : `${decisive.length === 1 ? 'One source' : `${decisive.length} sources`} point the same way`,
    independence:
      `${domains} ${domains === 1 ? 'domain' : 'domains'} across ${families.length} ${families.length === 1 ? 'family' : 'families'}`,
    directness: decisive.length
      ? 'Key passages name the claim’s own terms'
      : 'Relevant passages were thin',
    quality: decisive.length
      ? 'Weighted by source tier'
      : 'No decisive source to weigh',
  };

  const factors = [
    { key: 'agreement', label: 'Agreement', score: round(agreement), weight: WEIGHTS.agreement, note: factorNotes.agreement },
    { key: 'independence', label: 'Independence', score: round(independence), weight: WEIGHTS.independence, note: factorNotes.independence },
    { key: 'directness', label: 'Directness', score: round(directness), weight: WEIGHTS.directness, note: factorNotes.directness },
    { key: 'quality', label: 'Source quality', score: round(quality), weight: WEIGHTS.quality, note: factorNotes.quality },
  ];

  const decisiveCount = supports.length + refutes.length;
  let reading;
  if (!decisiveCount) reading = 'No source took a clear side.';
  else if (supports.length && refutes.length) reading = `The decisive sources split ${supports.length}–${refutes.length}.`;
  else if (supports.length) reading = `${decisiveCount} decisive ${decisiveCount === 1 ? 'source supports' : 'sources support'} the claim.`;
  else reading = `${decisiveCount} decisive ${decisiveCount === 1 ? 'source contradicts' : 'sources contradict'} the claim.`;
  const neutrality = neutral.length
    ? ` ${neutral.length} ${neutral.length === 1 ? 'source stayed' : 'sources stayed'} neutral.`
    : '';
  const rationale = `${reading}${neutrality} ${domains} ${domains === 1 ? 'domain' : 'domains'} across ${families.length} ${
    families.length === 1 ? 'family' : 'families'
  }.`;

  const warnings = [];
  if (neutral.length && label !== 'unverifiable') {
    warnings.push(`${neutral.length} source${neutral.length === 1 ? '' : 's'} did not take a clear side`);
  }
  if (families.length === 1 && examined.length) warnings.push('Only one source family was readable');
  if (decisive.length === 1) warnings.push('Only one source took a clear side');
  for (const failure of providerFailures) if (failure) warnings.push(failure);

  return {
    label,
    score,
    band,
    factors,
    rationale,
    counts: { supports: supports.length, refutes: refutes.length, neutral: neutral.length },
    domains,
    families,
    warnings,
    sources: examined,
  };
}

/** Exposed for tests: is the label defensible from the counts? */
export function verdictFromWeights(supportWeight, refuteWeight, decisiveCount) {
  if (!decisiveCount || supportWeight + refuteWeight < 0.45) return 'unverifiable';
  const balance = (supportWeight - refuteWeight) / (supportWeight + refuteWeight);
  if (balance >= 0.3) return 'supported';
  if (balance <= -0.3) return 'contradicted';
  return 'mixed';
}
