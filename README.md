# Cairn

**A claim verification desk that shows what the answer is standing on.**

Paste a claim. Cairn reads independent sources, quotes the passage that decides each reading, and returns a verdict with a confidence score you can inspect — not a confident paragraph you have to trust.

![Cairn's verdict dossier](docs/dossier.png)

## Why

A wrong answer and a right answer look the same in a chat window. Cairn makes the difference visible: for every source it shows the quote, the stance, the domain, and the reason. When sources disagree, the dossier says so and the confidence drops. When the evidence is too thin, it says that too.

The name is the metaphor. A cairn is a stack of stones that marks a safe path; an answer is only as good as the stones under it.

## What it does

- Takes **one statement** (not a question, not a paragraph) between 8 and 400 characters.
- Reads three independent source families — reference, news, research — and only counts pages it could actually read.
- Tags each source **Supports / Contradicts / Neutral** and keeps the deciding quote.
- Produces one of four verdicts — **Supported, Contradicted, Mixed, Not enough evidence**.
- Derives confidence from four visible factors: agreement, independence, directness, source quality.
- Streams the work as it happens (Server-Sent Events) and lets you click a citation to jump to its evidence.
- Copies a plain-text receipt with the verdict and numbered sources.
- Works without any API key. Optional LLM synthesis and optional web search are upgrades, never requirements.

![The empty desk](docs/desk.png)

## Quick start

Requires **Node.js 20.19+** and Git. No database, no API key, no account.

```bash
git clone <your-fork-url> cairn
cd cairn
npm install
npm run build
npm start
```

Open <http://localhost:8787>.

For development with hot reload:

```bash
npm run dev   # Vite on :5173, API on :8787
```

`npm run dev` proxies `/api` to the API server. The production build is served by Express from one process.

## How it works

```
claim ──► understand ──► retrieve ──► read & examine ──► weigh ──► compose ──► verdict
                              │             │              │          │
                     Wikipedia / News /   passages +    weighted    summary with
                     Research / [Web]     stance +      votes +     [n] citations
                                          quotes        factors
```

1. **Understand.** Normalise the claim, extract named entities, separate the predicate from the subject, detect negation, and collect anchors (numbers, percent, superlatives) that a source must touch to be on topic.
2. **Retrieve.** Query the source families in parallel, dedupe by URL and title, drop off-topic or disambiguation pages, and interleave families so a chatty provider cannot crowd out an independent one.
3. **Read.** Fetch pages through an SSRF-safe reader (`http`/`https` only, public IPs only, 10s timeout, 1.5 MB cap, 3 redirects), strip navigation/scripts/references, and split the article into passages. JavaScript-only pages are dropped, not guessed at.
4. **Examine.** Score passages against the claim's concepts, require at least two distinct predicate concepts, detect negation near those concepts plus explicit refutation cues ("myth", "debunked", "false"), and keep the strongest quote. Nested negation is not double-counted.
5. **Weigh.** Weight each source by quality, relevance and stance strength. The balance of support and contradiction gives the verdict; four factors give the confidence.
6. **Compose.** Write 2–3 sentences from the counted stances and the strongest quote, with `[n]` markers that map to the ledger. If an LLM is configured, it may rewrite the prose — but the server validates every citation index and rejects the rewrite otherwise.

### The confidence model

```
score = 12 + 88 × (0.32·agreement + 0.24·independence + 0.26·directness + 0.18·quality)
```

Capped when the evidence is thin:

| Condition | Cap |
|---|---|
| Fewer than 2 decisive sources | 55 |
| Only one source family | 66 |
| Fewer than 3 domains | 76 |
| Fewer than 4 sources | 80 |
| Fewer than 5 sources | 88 |
| Mixed verdict | 64 |
| Not enough evidence | 34 |
| Absolute ceiling | 94 |

The four factors and their weights are printed in the dossier. Nothing is a model-invented percentage.

## Source families

| Family | Source | Key required | Notes |
|---|---|---|---|
| Reference | Wikipedia REST / action API | No | Falls back across three Wikimedia endpoints; one article normally, two when the second title also names the predicate. |
| News | Bing News RSS | No | Publisher URLs are decoded from Bing's `apiclick` wrapper; unreadable publishers are dropped. |
| Research | OpenAlex | No | Abstracts reconstructed from the inverted index; title must name the subject. |
| Web | Brave Search or Tavily | Optional | Only runs when a key is present. |

Wikimedia asks anonymous clients to be polite. Requests are serialised, spaced, cached in memory (10 min searches, 60 min pages) and backed off on 429. If a family is unavailable, the dossier proceeds with the others and says so.

## Configuration

Copy `.env.example` to `.env` if you want the optional paths. Nothing is required.

| Variable | Effect |
|---|---|
| `PORT`, `HOST` | Where the server listens (default `127.0.0.1:8787`). |
| `CONTACT_EMAIL` | Contact in the Wikimedia user agent and OpenAlex `mailto`. |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | OpenAI-compatible synthesis. The verdict, stances and citations remain server-computed. |
| `BRAVE_API_KEY` or `TAVILY_API_KEY` | Adds general web search as a fourth family. |

The masthead badge shows **Keyless evidence engine** or **AI-assisted synthesis** depending on the server's configuration.

## Tests

```bash
npm test          # 39 unit/integration tests, no network
npm run test:live # one real claim end-to-end (needs the public web)
npm run typecheck # tsc --noEmit
```

The unit suite covers claim analysis, predicate concepts, nested negation, anchor gating, verdict thresholds, confidence caps, summary validation, HTML extraction, the SSRF guard, URL canonicalisation, caching, rate limiting, and the semaphore.

## Project structure

```
cairn/
├── server/
│   ├── engine/        # analyze, retrieve, extract, examine, weigh, compose, llm
│   ├── providers/     # wikipedia, news, openalex, websearch
│   ├── lib/           # text, http (SSRF-safe), domains, cache, rate limit
│   ├── routes/        # SSE + JSON endpoint, meta, health
│   └── test/          # node:test suites
├── src/
│   ├── components/    # Desk, Dossier, Verdict, Ledger, Factors, ...
│   ├── lib/           # SSE parser, receipt builder, formatting
│   └── styles/        # design tokens + layout
├── devpost/           # scope.md, prd.md, spec.md, checklist.md, app-map.html
├── docs/              # screenshots used in this README
├── Dockerfile
├── LICENSE
└── README.md
```

## Design notes

The interface is deliberately editorial: warm paper, hairline rules, corner ticks, a rotated confidence stamp, and a numbered evidence ledger. Type is Fraunces (display), Newsreader (body) and Azeret Mono (labels, citations), self-hosted through Fontsource so the page makes no third-party font request.

The confidence cairn is not decoration. Each filled stone maps to a band of the score, and the numeric score, band, rationale, and four factors are always shown together. Motion is limited to staged reveals and the citation pulse and collapses under `prefers-reduced-motion`.

## Limits and honest failure modes

- **Stance detection is heuristic.** It reads negation, refutation cues, predicate concepts and anchors. It can miss sarcasm, conditionals, and unusual phrasing. The quote is always shown so a reader can disagree with the tag.
- **Coverage is not completeness.** A dossier reports what readable sources said at the time it ran. Other sources may exist.
- **Not a truth machine.** "Supported" means the readable sources support the claim, not that the claim is objectively true.
- **Readability matters.** JavaScript-only and paywalled pages are dropped; the run notes report how many.
- **Confidence is not calibrated** against a labelled claim set. The formula is deterministic and documented, which is the next best thing.
- **Rate limits are real.** If Wikimedia throttles a request, the dossier proceeds with the other families and the confidence caps reflect it.

## Privacy and security

- No accounts, no analytics, no cookies, no client-side storage.
- Claims are sent only to this server and then to the retrieval providers; nothing is persisted beyond a 30-minute in-memory cache.
- Server-side fetching refuses non-HTTP(S), non-standard ports, loopback/private/link-local addresses and metadata endpoints on every redirect hop.
- Input is capped at 400 characters and request bodies at 16 KB; each IP is limited to 10 checks a minute and the server bounds concurrent runs.
- The optional LLM receives only the claim and the quoted evidence; it has no tools and its output is validated before display.

## Hackathon

Built for **[Build With AI: Basics](https://learn-ai-basics.devpost.com)** (Devpost), 2026. The planning documents in `devpost/` were produced through the Devpost Learn Skill Pack (`npx skills add challengepost/learn-ai-basics --all -y`).

- **License:** MIT.
- **Pre-existing code:** none. The project was created during the submission period.
- **AI assistance:** the product and its documentation were built with a coding agent; all cited sources are quoted, not generated.
- **Demo video and public repository URL** are added to the Devpost submission — see `devpost/submission-worksheet.md` for the remaining human steps.

## License

MIT — see [LICENSE](LICENSE).
