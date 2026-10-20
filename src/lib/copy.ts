import type { VerificationResult } from '../types';
import { VERDICT_LABELS, formatCheckedAt, sourceName, stanceLabel } from './format';

export function buildReceipt(result: VerificationResult): string {
  const { verdict } = result;
  const lines = [
    'CAIRN — EVIDENCE RECEIPT',
    `Claim: ${result.claim}`,
    `Verdict: ${VERDICT_LABELS[verdict.label].toUpperCase()} · ${verdict.confidence.score}/100 (${verdict.confidence.band} confidence)`,
    `Checked: ${formatCheckedAt(result.createdAt)}`,
    '',
    verdict.summary,
    '',
    'SOURCES',
  ];

  for (const source of result.sources) {
    lines.push(
      `[${source.id}] ${source.title}`,
      `    ${sourceName(source)} · ${stanceLabel(source.stance)} · ${source.family}`,
      `    ${source.url}`
    );
  }

  if (result.warnings.length) {
    lines.push('', 'NOTES', ...result.warnings.map((warning) => `- ${warning}`));
  }

  lines.push(
    '',
    'Stance is inferred from quoted passages. Open a source before relying on this.',
    'A dossier reports what readable sources say, not absolute truth.'
  );

  return lines.join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
