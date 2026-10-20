import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // No .env is the normal case: Cairn is keyless by default.
}

const env = process.env;
const contactEmail = (env.CONTACT_EMAIL ?? '').trim();
const deepseekKey = env.DEEPSEEK_API_KEY ?? '';
const apiKey = env.LLM_API_KEY ?? env.OPENAI_API_KEY ?? deepseekKey;
const isDeepSeek = !env.LLM_BASE_URL && Boolean(deepseekKey);

export const config = {
  root,
  host: env.HOST ?? '127.0.0.1',
  port: Number(env.PORT) || 8787,
  contactEmail,
  userAgent: `Cairn/0.1 (${contactEmail ? `mailto:${contactEmail}` : 'https://github.com/; educational hackathon project'})`,
  llm: apiKey
    ? {
        apiKey,
        baseUrl: (env.LLM_BASE_URL ?? (isDeepSeek ? 'https://api.deepseek.com' : 'https://api.openai.com/v1')).replace(/\/+$/, ''),
        model: env.LLM_MODEL ?? (isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'),
      }
    : null,
  braveKey: (env.BRAVE_API_KEY ?? '').trim(),
  tavilyKey: (env.TAVILY_API_KEY ?? '').trim(),
  limits: {
    claimMin: 8,
    claimMax: 400,
    maxSources: 5,
    maxCandidates: 8,
    readConcurrency: 4,
    fetchTimeoutMs: 10_000,
    retrieveTimeoutMs: 9_000,
    totalBudgetMs: 38_000,
  },
  cache: {
    ttlMs: 30 * 60 * 1000,
    max: 200,
  },
  rate: {
    windowMs: 60_000,
    limit: 10,
  },
};

export function llmEnabled() {
  return Boolean(config.llm);
}

export function providerMode() {
  const families = ['reference', 'news', 'research'];
  if (config.braveKey || config.tavilyKey) families.push('web');
  return {
    mode: config.llm ? 'llm' : 'local',
    families,
    webSearch: Boolean(config.braveKey || config.tavilyKey),
  };
}
