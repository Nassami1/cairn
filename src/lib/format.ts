import type { ConfidenceBand, Family, Stance, VerdictLabel } from '../types';

export const FAMILY_LABELS: Record<Family, string> = {
  reference: 'Reference',
  news: 'News',
  research: 'Research',
  web: 'Web',
};

export const STANCE_LABELS: Record<Stance, string> = {
  supports: 'Supports',
  refutes: 'Contradicts',
  neutral: 'Neutral',
  unclear: 'Unclear',
};

export const VERDICT_LABELS: Record<VerdictLabel, string> = {
  supported: 'Supported',
  contradicted: 'Contradicted',
  mixed: 'Mixed',
  unverifiable: 'Not enough evidence',
};

export const BAND_LABELS: Record<ConfidenceBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function verdictLabel(label: VerdictLabel): string {
  return VERDICT_LABELS[label] ?? label;
}

export function familyLabel(family: Family): string {
  return FAMILY_LABELS[family] ?? family;
}

export function stanceLabel(stance: Stance): string {
  return STANCE_LABELS[stance] ?? stance;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

export function stripMarkers(text: string): string {
  return text.replace(/\s*\[\d{1,2}\]/g, '');
}

export function sourceName(source: { venue?: string; domain: string }): string {
  const name = source.venue?.trim() || source.domain;
  return name.length > 46 ? source.domain : name;
}
