export type Family = 'reference' | 'news' | 'research' | 'web';
export type Stance = 'supports' | 'refutes' | 'neutral' | 'unclear';
export type VerdictLabel = 'supported' | 'contradicted' | 'mixed' | 'unverifiable';
export type ConfidenceBand = 'high' | 'medium' | 'low';
export type StageId = 'understand' | 'retrieve' | 'read' | 'compare' | 'write';
export type StageStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface Stage {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
}

export interface Source {
  id: number;
  title: string;
  url: string;
  domain: string;
  family: Family;
  provider: string;
  venue?: string;
  publishedAt?: string;
  stance: Stance;
  stanceStrength: number;
  relevance: number;
  quality: number;
  note: string;
  quote: string;
  passages: string[];
}

export interface ConfidenceFactor {
  key: 'agreement' | 'independence' | 'directness' | 'quality';
  label: string;
  score: number;
  weight: number;
  note: string;
}

export interface Confidence {
  score: number;
  band: ConfidenceBand;
  factors: ConfidenceFactor[];
  rationale: string;
}

export interface Verdict {
  label: VerdictLabel;
  headline: string;
  summary: string;
  confidence: Confidence;
  counts: { supports: number; refutes: number; neutral: number };
  caveats: string[];
}

export interface VerificationResult {
  id: string;
  claim: string;
  createdAt: string;
  durationMs: number;
  mode: 'local' | 'llm';
  verdict: Verdict;
  sources: Source[];
  stats: {
    candidates: number;
    read: number;
    dropped: number;
    domains: number;
    families: Family[];
    providers: Record<string, number>;
  };
  warnings: string[];
  cached: boolean;
  scope?: 'weighed' | 'causal-comparison';
  engine: string;
}

export interface Meta {
  mode: 'local' | 'llm';
  llm: boolean;
  webSearch: boolean;
  families: Family[];
  version: string;
  maxClaimLength: number;
  cacheTtlMinutes: number;
}

export interface StageUpdate extends Partial<Stage> {
  id: StageId;
  status: StageStatus;
}
