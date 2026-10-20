---
doc: spec
status: approved
---

# Cairn — Technical Spec

## How This Works, In Plain Language

Cairn is one small web server and one web page. The server has four jobs, in order: **understand the claim**, **find candidate sources**, **read and examine them**, and **weigh the evidence into a verdict**. The page is only a view of that process — it shows each job as it happens and then lays out the result.

- **Understand the claim.** The server tidies the text, pulls out the important words and any capitalised names ("Eiffel Tower"), notices whether the claim is already negative ("is *not* visible"), and builds a few search queries from those.
- **Find candidate sources.** Three retrievers ask three different kinds of source in parallel: an encyclopedia (Wikipedia), recent news (Bing News RSS), and research literature (OpenAlex). Each returns candidates with a title, a link, and a source family. Optionally a fourth web-search retriever runs if the operator configured one.
- **Read and examine.** The server fetches each candidate page, strips the navigation and scripts, keeps the article text, and scores its sentences against the claim's concepts. For each source it picks the strongest passages and asks: does this passage agree with the claim, contradict it, or neither? The answer is a stance plus the exact quoted sentence that produced it.
- **Weigh and write.** Each source becomes a weighted vote — better sources and more direct passages count more. The balance of votes produces one of four verdicts. A confidence score is computed from four named factors, and a short answer is assembled from the deciding quotes. If an LLM is configured, it may rewrite that answer into cleaner prose under strict rules; it never gets to change the verdict, the sources, or invent a citation.

Why this shape: every number on screen must be traceable to a quote and a rule. A single large model call would be simpler to write but impossible to audit, and the product's entire promise is auditability. The LLM is therefore an optional prose layer, not the source of truth.

## The Core Journey Through the System

1. Maya presses **Weigh this claim** → the page opens `POST /api/verify` and reads a stream of events.
2. The server validates the claim (8–400 chars, no question mark) → `analyzeClaim()` produces keywords, entities, polarity and query variants → emits `stage: understand` done.
3. `retrieveCandidates()` fan-outs to Wikipedia, Bing News and OpenAlex with a shared 8-second budget → dedupes by URL and domain, ranks, and emits `stage: retrieve` done with counts and any provider errors.
4. `readSources()` fetches the top candidates in parallel (max 4 at a time), extracts article text, drops pages under 400 characters, and keeps up to five sources with at least two families where possible. Each surviving source is examined immediately and emitted as a `source` event.
5. `examineSource()` splits the text into passages, scores them, detects stance and picks the quote. The page renders its card as soon as the event arrives.
6. `weighEvidence()` computes source weights, the support/refute balance, the verdict label and the four confidence factors. `composeVerdict()` writes the headline and the citation-anchored answer from the quotes.
7. If configured, `refineWithLLM()` may rewrite only the headline/summary and per-source reasons; the server validates every returned citation index and stance, and falls back to the deterministic text on any error.
8. The server emits `result`, caches it for 30 minutes under the normalised claim, and closes the stream. The page swaps the stage rail for the finished dossier and moves focus to the verdict heading.
9. Clicking `[2]` calls a client-side handler that scrolls source 2 into view and expands it; no server round-trip.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Runtime | Node.js ≥ 20.19 (built on 24) | Native `fetch`, `AbortSignal.timeout`, `node:test`; no extra HTTP client or test framework. |
| Server | Express 5 | Tiny, familiar, first-class async error handling; serves both API and built assets from one process. |
| HTML extraction | Cheerio 1 | Server-side jQuery-like parsing without a browser; fast enough for 5 pages. |
| Client | React 19 + TypeScript 5.8 | Component state machine for streaming stages is much clearer than manual DOM; types keep the event contract honest. |
| Build | Vite 8 | One command builds the static app; the server serves `dist/`. |
| Styling | Hand-written CSS with custom properties | The visual direction is specific (paper, hairlines, stamps); a utility framework would fight it and bloat the bundle. |
| Fonts | `@fontsource-variable/*` | Self-hosted, no external font request, works offline. |
| Tests | `node:test` + `assert` | Zero dependencies; runs with `npm test`. |
| LLM (optional) | Any OpenAI-compatible `/chat/completions` | DeepSeek, OpenAI, or a local Ollama endpoint all work without code changes. |

Documentation: [Express 5](https://expressjs.com/), [Cheerio](https://cheerio.js.org/), [Vite](https://vite.dev/), [React 19](https://react.dev/), [Node test runner](https://nodejs.org/api/test.html).

No database, no ORM, no auth library, no analytics.

## Where It Runs and How Someone Tries It

- **Runtime:** a local Node process; the browser only needs to reach `http://localhost:8787`. Internet access is required for retrieval.
- **Install:** Node 20.19+ and Git. `npm install`.
- **Run the production build (recommended for the demo):**

  ```
  npm install
  npm run build
  npm start          # http://localhost:8787
  ```

- **Develop:** `npm run dev` starts Vite on `http://localhost:5173` and the API on `http://localhost:8787`; Vite proxies `/api`.
- **Environment:** none required. Optional (see `.env.example`): `PORT`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `BRAVE_API_KEY` or `TAVILY_API_KEY`, `CONTACT_EMAIL` (for the OpenAlex polite pool and Wikimedia user agent).
- **Demo recording:** run the production build, open the URL, submit the Great Wall example, click citation `[2]`, expand a source, copy the receipt. Record at 1440×900.
- **Deployment (optional):** a `Dockerfile` is included for any Node host (`docker build -t cairn . && docker run -p 8787:8787 cairn`). Deployment never substitutes for the repo or the video.

## Look and Feel

Carried forward from `prd.md > Look and Feel`; this is implementable direction, not a redesign.

- **Palette as CSS variables:** `--paper:#f4efe6`, `--paper-2:#ece5d7`, `--ink:#17140f`, `--ink-soft:#4a443a`, `--muted:#6f6a61`, `--rule:#d7cdbb`, `--oxblood:#a63a2b`, `--moss:#2f5d4a`, `--ochre:#a96b12`, `--slate:#4c5560`. Status colours also ship as `-tint` and `-ink` variants for stamps and edges.
- **Type scale:** Fraunces variable (opsz 9–144, wght 300–700) for display; Newsreader variable for body at 1.05–1.15rem with a 1.65 line-height; Azeret Mono at 0.68–0.78rem, uppercase, 0.12em tracking for labels. Numerals use `font-variant-numeric: tabular-nums`.
- **Layout:** a 12-column grid with a max width of 1240px and 28px gutters. Desk: composer spans 7 columns, field notes 4, offset by one. Dossier: verdict 7, ledger 5, factors full width under the verdict. Below 960px everything stacks to one column.
- **Texture:** an inline SVG `feTurbulence` grain fixed over the page at 3.5% opacity with `mix-blend-mode: multiply`; a 1px paper edge at the top of cards; corner ticks drawn with `::before/::after` borders. No box-shadows except a 1px hairline and a very soft 24px ambient under the dossier sheet.
- **Motion:** `@keyframes rise` (12px, 520ms, cubic-bezier(.2,.7,.2,1)) staggered by source index via `--i`; verdict stamp uses a 140ms scale from 1.06 with slight rotation; citation pulse is a 1.2s outline fade. A global `prefers-reduced-motion: reduce` block sets animation and transition durations to 0.01ms.
- **Responsive:** type clamps with `clamp()`; the verdict word scales 3.4rem → 6.4rem; the ledger becomes a horizontal scroll-snap strip under 720px only for the compact source chips, otherwise stacks.
- **Consistency constraint:** the only images are inline SVG (grain, cairn, icons); no stock photography, so the paper palette and typography carry the identity.

## Components

### Server

- `server/app.js` — Express wiring: security headers, JSON limit, routes, static serving, error handler.
  PRD ref: `prd.md > Features and Behavior > Verdict`.
- `server/routes/verify.js` — validates input, applies the rate limiter, checks the cache, chooses SSE or JSON, and translates pipeline events to the wire format.
  PRD ref: `prd.md > States and Boundaries`.
- `server/engine/verify.js` — the orchestrator: analysis → retrieval → reading → examination → weighing → composition, emitting stage/source/result events and honouring an abort signal.
- `server/engine/analyze.js` — normalisation, tokenisation, stopwords, entity phrases, polarity, query variants, synonym expansion.
- `server/engine/retrieve.js` — runs providers with `Promise.allSettled` under a 14-second per-provider budget, dedupes by canonical URL and title, filters off-topic and disambiguation pages, ranks candidates, enforces per-family quotas.
- `server/engine/extract.js` — HTML → title/date/main text via Cheerio; removes chrome; extracts `article:published_time`; returns `null` below the readability threshold. Also parses Wikipedia section headings.
- `server/engine/examine.js` — passage splitting and scoring, stance detection, quote selection, per-source relevance and quality.
- `server/engine/weigh.js` — weights, verdict thresholds, confidence factors and band.
- `server/engine/compose.js` — deterministic headline/summary writer with citation anchoring and caveats.
- `server/engine/llm.js` — optional synthesis; builds a numbered-evidence prompt, requests JSON, validates stance labels and citation indices, falls back on any failure.

### Client

- `src/App.tsx` — mode state machine (`desk | running | dossier | error`), claim state, abort controller, SSE subscription.
  PRD ref: `prd.md > The Core Journey`.
- `src/components/Desk.tsx` — masthead, composer, examples, how-it-works strip.
  PRD ref: `prd.md > Screens and Layout`.
- `src/components/StageRail.tsx` — five stages with waiting/active/done and elapsed time.
  PRD ref: `prd.md > Features and Behavior > Live assembly`.
- `src/components/Verdict.tsx` — stamp, headline, answer with citation buttons, confidence cairn, copy action.
  PRD ref: `prd.md > Features and Behavior > Verdict`.
- `src/components/Ledger.tsx` + `SourceCard.tsx` — numbered source stack, expandable quotes, outbound links.
  PRD ref: `prd.md > Features and Behavior > Evidence ledger`.
- `src/components/Factors.tsx` — four factor rules with notes.
  PRD ref: `prd.md > Features and Behavior > Confidence and factors`.
- `src/components/CairnMark.tsx` — three-stone SVG whose fill tracks confidence.
- `src/lib/api.ts` — POST + `text/event-stream` parser over `fetch` (EventSource cannot POST), JSON fallback, abort support, and the meta fetch.
- `src/lib/format.ts` — domain, date, number and citation rendering helpers.
- `src/lib/copy.ts` — plain-text receipt builder matching the visible result.

## Data Model

All state is request-scoped plus a bounded in-memory cache. Nothing is written to disk.

```ts
type ClaimAnalysis = {
  claim: string; normalized: string; isQuestion: boolean;
  keywords: string[]; entities: string[]; polarity: 'positive' | 'negative';
  queryVariants: string[];
};

type Candidate = {
  title: string; url: string; domain: string;
  family: 'reference' | 'news' | 'research' | 'web';
  provider: string; snippet?: string; publishedAt?: string;
  text?: string; sections?: { heading: string; text: string }[];
  score: number;
};

type Source = {
  id: number; title: string; url: string; domain: string;
  family: Candidate['family']; provider: string;
  stance: 'supports' | 'refutes' | 'neutral' | 'unclear';
  stanceStrength: number; relevance: number; quality: number;
  quotes: string[]; passages: string[];
  publishedAt?: string; note: string;
};

type Confidence = {
  score: number; band: 'high' | 'medium' | 'low';
  factors: { key: 'agreement'|'independence'|'directness'|'quality';
             label: string; score: number; weight: number; note: string }[];
  rationale: string;
};

type VerificationResult = {
  id: string; claim: string; createdAt: string; durationMs: number;
  mode: 'local' | 'llm'; verdict: {
    label: 'supported'|'contradicted'|'mixed'|'unverifiable';
    headline: string; summary: string; confidence: Confidence;
    counts: { supports: number; refutes: number; neutral: number };
  };
  sources: Source[];
  stats: { candidates: number; read: number; domains: number; families: string[] };
  warnings: string[]; cached?: boolean;
};
```

Where it lives: `result` in the cache (`Map<string, {value, expiresAt}>`, TTL 30 min, max 200 entries, LRU eviction); sources and quotes inside `result`; nothing on the client beyond React state. On reload, everything is gone. On a repeat claim within TTL, the cached result is replayed through the event stream with `cached: true` and no refetch.

## File Structure

```
cairn/
├── server/
│   ├── index.js                 # listen, load .env
│   ├── app.js                   # express app, static, routes
│   ├── config.js                # env parsing, limits, mode
│   ├── routes/verify.js         # POST /api/verify (SSE + JSON)
│   ├── engine/
│   │   ├── verify.js            # orchestrator + stage events
│   │   ├── analyze.js           # claim analysis
│   │   ├── retrieve.js          # provider fan-out + ranking
│   │   ├── extract.js           # HTML -> text
│   │   ├── examine.js           # passages + stance
│   │   ├── weigh.js             # verdict + confidence
│   │   ├── compose.js           # answer with citations
│   │   └── llm.js               # optional synthesis
│   ├── providers/
│   │   ├── wikipedia.js
│   │   ├── news.js              # Bing News RSS
│   │   ├── openalex.js
│   │   └── websearch.js         # optional Brave/Tavily
│   ├── lib/
│   │   ├── http.js              # SSRF-safe fetch, redirects, size cap
│   │   ├── cache.js             # TTL + LRU
│   │   ├── rate-limit.js
│   │   ├── text.js              # tokens, sentences, stems, synonyms
│   │   └── domains.js           # eTLD+1, family/quality tiers
│   └── test/                    # node:test suites + fixtures
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/                  # tokens.css, app.css
│   ├── components/              # Desk, StageRail, Verdict, Ledger, ...
│   ├── lib/                     # sse.ts, copy.ts, format.ts
│   └── types.ts
├── devpost/                     # scope.md, prd.md, spec.md, checklist.md, app-map.html, submission.md
├── public/favicon.svg
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── .gitignore
├── Dockerfile
├── LICENSE
└── README.md
```

## External Services and Dependencies

### Wikipedia (reference family, no key)

- Search: Wikimedia Core `GET https://api.wikimedia.org/core/v1/wikipedia/en/search/page?q={q}&limit=5`, then REST `GET https://en.wikipedia.org/w/rest.php/v1/search/page?q={q}&limit=5`, then the action API as a final fallback.
- Article: action API extract (`prop=extracts&explaintext=1`), then Wikimedia Core HTML, then REST HTML. Section headings are parsed; reference, notes and external-link sections are dropped.
- Docs: https://www.mediawiki.org/wiki/API:Search, https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page and https://api.wikimedia.org/
- Policy: descriptive `User-Agent` with contact; requests serialised with ~650ms spacing; searches cached 10 minutes and pages 60 minutes; on `429`, back off 800ms with one retry. No key, no cost. Wikimedia asks for ≤ 1 req/s for anonymous clients; a claim typically costs 2–4 requests, and one article is fetched unless a second title also names the claim's predicate.

### Bing News RSS (news family, no key)

- `GET https://www.bing.com/news/search?q={q}&format=RSS`
- Result links are wrapped in `apiclick.aspx?…&url={encoded}`; the server extracts and decodes the `url` parameter. Items carry `title`, `pubDate`, `source`.
- Docs: https://www.bing.com/news (no official RSS SLA); treated as best-effort. May be region-biased; a `404`/`429`/short feed drops the family with a warning. No key, no cost.

### OpenAlex (research family, no key)

- `GET https://api.openalex.org/works?search={q}&per-page=4&filter=has_abstract:true&mailto={contact}`
- Abstracts arrive as an inverted index and are reconstructed (max 1 400 chars). The DOI or OpenAlex ID becomes the source URL.
- Docs: https://docs.openalex.org/. Anonymous requests share a small daily budget; a `429` drops the family with a warning. No key, no cost.

### Optional web search (web family, key required)

- Brave: `GET https://api.search.brave.com/res/v1/web/search?q={q}&count=5`, header `X-Subscription-Token`.
- Tavily: `POST https://api.tavily.com/search` with `{ api_key, query, max_results: 5 }`.
- Docs: https://api-dashboard.search.brave.com/app/documentation and https://docs.tavily.com/. Free tiers exist; absent a key this provider is skipped silently and the badge stays "Keyless evidence engine".

### Optional LLM (synthesis only)

- `POST {LLM_BASE_URL}/chat/completions` with `model`, `temperature: 0.2`, `response_format: { type: 'json_object' }`, and a system prompt that forbids outside facts.
- Provider limits are the operator's; the server applies a 20s timeout and one retry. Cost: one short call per uncached claim.

### Target pages (any family with a URL and no supplied text)

- `GET` with `User-Agent: Cairn/1.0 (+contact)`, `Accept: text/html`, 10s timeout, 1.5MB cap, max 3 redirects, `Accept-Language: en`.
- SSRF guard: only `http(s)`, resolve the hostname, reject loopback/private/link-local/ULA/metadata ranges on every hop, cap redirects, never send credentials.
- Some publishers return 403 or render with JavaScript (MSN, Britannica); those sources are dropped rather than half-read.

## Important Failure Modes

- **Wikipedia rate-limits the request** → retry twice with backoff; if still limited, continue with News/OpenAlex and surface "Reference search was unavailable" in the dossier footer. The verdict still computes, with lower independence.
- **Every provider returns fewer than two readable pages** → verdict `unverifiable`, confidence Low, with "We could read 1 of 6 sources" and the attempted URLs. The UI does not pretend to have a verdict.
- **A publisher's page is JavaScript-only or blocks the fetch** → the candidate is marked unreadable and dropped; the ledger only shows sources whose text we actually read, and the stats line reports the drop count.
- **LLM times out or returns invalid JSON/citations** → the deterministic composition is used unchanged; a non-blocking warning notes that AI synthesis was skipped.
- **The browser disconnects mid-stream** → the abort signal cancels in-flight fetches; no orphan work beyond the current microtask.
- **A user pastes a URL or an oversized claim** → validation rejects it with a specific inline message; the server also enforces the limit and returns `400`.

## What Was Simplified and Why

- **Heuristic stance detection** instead of a trained NLI/LLM classifier — keeps the keyless path free, deterministic and explainable, and makes every stance traceable to cue words plus overlap. The fuller version would need a model download or API spend and would still need the quote for trust.
- **Sentence and passage scoring** instead of embeddings — no vector store, no embedding API, instant cold start. The trade-off is synonym gaps; mitigated by a small synonym lexicon, entity weighting and Wikipedia section titles. The fuller version would embed the claim and every sentence.
- **A 30-minute in-memory cache** instead of a database — no schema, no cleanup job, no privacy policy. The fuller version would persist dossiers and support history.
- **One claim per request** instead of paragraph decomposition — keeps the citation-to-claim mapping exact. The fuller version would split conjunctions and verify each atom separately.
- **RSS news search** instead of a paid search API — the only keyless route that reliably returns publisher URLs. The fuller version would use Brave or Tavily for broader coverage.

## Decisions and Open Issues

- **Keyless by default** (learner decision) — the tool must work for a judge with no accounts and no spend; the optional keys are an upgrade, never a requirement.
- **Extractive first, LLM second** (learner decision) — the answer must remain supportable by quoted text even if the model is removed.
- **Four verdicts instead of a truth score** (learner decision) — "Mixed" and "Not enough evidence" are information, not failure.
- **SSE over WebSocket** (implementation) — progress is one-directional; SSE survives proxies and needs no extra dependency. Trade-off: no client→server messages beyond abort.
- **Server-rendered nothing** (implementation) — Vite builds a static SPA; Express serves it. Trade-off: no SSR, irrelevant for a single-user tool.
- **Genuine uncertainty during planning:** I did not know whether Wikipedia alone would produce enough *independent* sources, or whether the news layer would be readable. We probed four claims and found that one family is often enough for the key fact but not for confidence; the build therefore counts distinct domains and families explicitly and warns when only one family contributes. The risk that remains is a claim whose coverage is a single Wikipedia article — the UI will show Low independence, which is the honest answer.
- **Open:** the confidence formula is heuristic and uncalibrated against a labelled set; documented as such, and a calibration harness is deferred.
- **Open:** RSS and API terms can change without notice; providers are isolated behind one function each so a replacement does not touch the engine (must decide before submission whether to add a paid provider fallback — currently no).
