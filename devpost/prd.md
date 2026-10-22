---
doc: prd
status: approved
---

# Cairn — Product Requirements

A one-page claim verification desk for Maya, a junior policy analyst who has to defend what she forwards. Source: `scope.md > Who It's For`.

## The Core Journey

1. Maya lands on the desk. The headline states the promise in one line, the input is already focused, and three example claims sit underneath for anyone who does not have one ready.
2. She pastes a claim (or taps an example) and presses **Weigh this claim**.
3. The page becomes a dossier. A stage rail shows five real stages — reading the claim, finding sources, reading them, comparing evidence, writing the verdict — each moving from waiting to active to done as the server actually does the work.
4. Source cards arrive one at a time as pages are read, each stamped with a stance, a source family, and the quoted passage that produced the stance.
5. When the last stage completes, the verdict lands: a large verdict word, a confidence score with an explicit cairn of stones, and a short answer whose sentences carry citation markers.
6. Maya clicks `[2]`. The matching source card scrolls into view, highlights, and opens its evidence panel. She reads the quote in context, checks the domain, and follows the outbound link if she wants the original.
7. She copies the answer and citation list with one button — formatted as plain text she can paste into an email — and optionally presses **Weigh another claim** to reset.
8. Success: she can explain *why* the verdict is what it is, citing the specific sources, without opening another tab.

## Screens and Layout

One route, two modes on the same page. No navigation, no settings screen.

**Desk (empty state).** A narrow, left-aligned masthead: wordmark, a one-line description, a status line ("Keyless mode · 3 source families"). Below it, the claim composer: a paper card with a large serif textarea, a character counter, the primary button, and a row of example claim chips. Beneath the composer, a three-column "how it works" strip (find / read / weigh) with numbered labels. On wide screens the right third holds a vertical "field notes" column: a short explanation of the confidence model and the source families, set in small mono type. On narrow screens this column moves below the composer.

**Dossier (result state).** The composer shrinks to a single-line "claim bar" pinned at the top with the submitted claim and a **New claim** action. Below it:

- Left column, 60%: the verdict block (eyebrow "VERDICT", huge word, confidence meter, answer paragraph with citation chips, a **Copy the receipt** button), then the "How we weighed it" factor panel.
- Right column, 40%: the evidence ledger — a numbered stack of source cards, each with family and stance stamps, title, domain, quote, and expandable detail.
- Above both: the stage rail, which collapses into a thin completed summary bar once the verdict lands.
- Below both: a full-width "What this dossier does not cover" strip with three plain-language caveats, and the footer.

On mobile the columns stack: verdict, answer, confidence, ledger, factors, caveats.

## Look and Feel

Established direction, carried from `scope.md > Inspiration & Identity`:

- **Typography.** Fraunces (variable, soft-serif, high optical size) for the wordmark, verdict word and section headlines; Newsreader for the answer and body copy; Azeret Mono for labels, citations, metadata and numbers. No sans-serif UI font, no rounded cards.
- **Colour.** Warm paper `#F4EFE6` as the surface, ink `#17140F` as text, oxblood `#A63A2B` for contradiction and primary action, moss `#2F5D4A` for support, ochre `#A96B12` for mixed/unclear, cool grey `#6F6A61` for neutral metadata. Tints are mixed from paper, never pure white.
- **Texture and rules.** A faint SVG grain overlay at very low opacity; 1px hairline rules in `#D9D0C0`; corner ticks on the main cards instead of drop shadows; slightly rotated rubber-stamp style verdict stamps.
- **Density and tone.** Calm and editorial, not dense. Generous margins, a strong vertical rhythm, small caps labels with wide tracking. Copy is direct and non-anthropomorphic — "the evidence contradicts this", never "I think".
- **Motion.** One orchestrated moment: dossier sections rise in with staggered delays as data arrives. Source cards fade in from the top. Citation clicks pulse the target card. All motion collapses under `prefers-reduced-motion`.
- **Avoid.** Purple gradients, glassmorphism, chat bubbles, assistant avatars, neon accents, centred marketing hero, emoji.

## Features and Behavior

### Intake

- A textarea accepting 8–400 characters; the counter turns oxblood past the limit and the submit button disables.
- Enter submits; Shift+Enter inserts a newline. The textarea auto-grows to a maximum of six lines.
- Three example chips fill the textarea and immediately submit: the Great Wall claim (contradicted), the Eiffel Tower thermal-expansion claim (supported), and the ten-percent-of-the-brain claim (contradicted). The examples give a first-time visitor two decisive outcomes without inventing a claim; Mixed and Not enough evidence appear whenever the evidence warrants them.
- Trailing question marks are rejected with an inline hint: "Cairn weighs statements. Try 'X is Y' instead of 'Is X Y?'". (Questions have no proposition to support or contradict.)
- Empty and whitespace-only submissions are rejected client-side.

### Live assembly

- Submission opens a `POST /api/verify` request and reads Server-Sent Events from the response body.
- Five stages are rendered in order with three visual states: waiting (hairline circle), active (pulsing dot and elapsed ms), done (filled tick). Stage labels never claim work that is not happening; each corresponds to a real server phase.
- Each readable source is streamed as it is examined, so cards appear progressively rather than all at once.
- If streaming fails, the client falls back once to the non-streaming JSON endpoint and shows a small "recovered" note; if that fails, an error state with a retry action.
- A "stop" action aborts the request and returns to the desk with the claim preserved.

### Verdict

- Four labels, each with its own stamp colour and motion treatment: **Supported** (moss), **Contradicted** (oxblood), **Mixed** (ochre), **Not enough evidence** (grey).
- A one-sentence headline plus a 2–3 sentence answer. Every factual sentence carries at least one `[n]` marker that maps to a numbered source; markers are buttons, not plain text.
- The answer is composed from the selected evidence quotes and stance counts. It may describe *what the sources say* and *how they line up*; it may not introduce facts absent from the quotes.
- Confidence: a large two-digit score, a band label (High / Medium / Low), and a cairn of three stones that fill according to the score. Hovering or focusing a stone reveals the factor it represents.
- A rationale line explains the score in words: "High: 3 independent sources, 2 contradict directly, 1 qualifies."

### Evidence ledger

- Each source card shows: index number, family stamp (Reference / News / Research / Web), stance stamp (Supports / Contradicts / Neutral / Unclear), title, domain, publication date when available, and the deciding quote in quotation marks.
- Stance is also encoded by a 2px left edge colour, so it survives greyscale.
- Expanding a card reveals the full retrieved passage(s), the retrieval route ("Wikipedia search", "Bing News", "OpenAlex"), and a **Open original** link.
- Sources are numbered when selected and keep that number in the ledger, so a citation marker and its card never disagree.
- A source that only mentions the subject, quotes the claim, or reports it inside a framing ("the story that...", "conspiracy theories claim...") is tagged Neutral, not Support. Support requires the claim's head predicate to relate to one of its objects in the same sentence.
- Clicking an answer citation scrolls to the card, sets a ring, and expands it; clicking again collapses.
- A source that contributed nothing gets stance "Neutral" and is still shown — silence is evidence about the evidence.

### Confidence and factors

- Four factors, each 0–1 with a short note: **Agreement** (how lopsided support vs contradiction is), **Independence** (distinct domains and families), **Directness** (relevance and strength of the deciding passages), **Source quality** (encyclopedic/research/government vs low-tier domains).
- The factor panel shows each as a small horizontal rule with a tick, the value, and the note. The confidence number is the weighted sum, rounded; it is not independently invented.
- Low evidence yields "Not enough evidence" and a confidence capped in the Low band, even if the few sources agree.

### Caveats and actions

- "Copy the receipt" copies: claim, verdict, confidence, answer with markers, and a numbered source list (title — domain — URL). A toast confirms.
- **Weigh another claim** resets to the desk and focuses the input.
- A "mode" badge in the masthead reads **Keyless evidence engine** or **AI-assisted synthesis** depending on whether an LLM is configured server-side. It is informational, not a setting.
- An "About the evidence" disclosure explains the three source families and the limits of stance detection.

## States and Boundaries

- **First use** — desk state, input focused, examples visible, no stored data.
- **Running** — stage rail active, ledger skeleton with three placeholder slots, submit disabled.
- **Partial failure** — one provider down: the dossier proceeds with fewer sources and a note in the footer of the ledger ("News search unavailable — this dossier used 2 families").
- **Not enough evidence** — fewer than two readable sources or no source with a decisive passage: grey verdict, explanation of what was missing, and a suggestion to make the claim more specific. This is a first-class result, not an error.
- **Causal comparison** — a claim of the form "A caused more X than B prevented" is retrieved and shown, but the verdict is withheld: "Not enough evidence" with the headline "Beyond this desk's scope", confidence displayed as "Not scored", and the sources kept as a reading list. LLM synthesis is skipped.
- **No readable sources** — error panel with the reason ("the pages we found could not be read"), a retry, and a link to the sources that were attempted.
- **Rate limited** — 429 from the server: "The desk is taking a short breath. Try again in 30 seconds." with a live countdown.
- **Invalid input** — inline hint under the textarea; focus returns to it.
- **Cached** — a repeat claim returns immediately with a "checked X minutes ago" note in the stage bar.
- **Persistence** — nothing is stored in the browser beyond the current claim in memory; the server keeps results in a 30-minute in-memory cache. Refreshing clears the dossier. No accounts, no analytics, no cookies.
- **Reduced motion** — all staggered reveals become instant; the stage pulse becomes a static dot.

## Product Decisions

- **One claim, not a conversation** — a fixed proposition keeps every citation unambiguous and every stance comparable.
- **Quotes over paraphrase** — the tool's credibility depends on showing the sentence that decided the verdict, not a model's retelling of it.
- **Confidence must be explainable** — a percentage with no derivation is theatre; the four factors are shown next to the number.
- **Keyless by default** — judges and strangers must be able to test it without buying an API key; the optional LLM improves prose, not access.
- **Four verdicts, not a truth score** — "Mixed" and "Not enough evidence" are honest outcomes that most fact-checking UIs collapse into a misleading binary.
- **Server-side retrieval** — browser CORS makes direct fetching impossible, and a server lets us guard SSRF and cache results.
- **No login** — identity is irrelevant to the loop and would add a privacy surface.

## What We're Building

- A Node/Express server exposing one verification pipeline with SSE streaming, JSON fallback, caching, rate limiting, and SSRF-safe fetching.
- A React single-page desk with the desk and dossier modes described above, fully responsive.
- Retrieval across Wikipedia, Bing News RSS, and OpenAlex, with optional Brave/Tavily web search.
- An explainable stance/verdict/confidence engine, plus optional OpenAI-compatible LLM synthesis with strict fallback.
- A scope guard for aggregate causal comparisons, so the engine withholds a verdict instead of inferring causation from correlated passages.
- Unit and integration tests for the engine, a live smoke test, and a documented local run.
- The public-repo furniture: README, MIT license, `.env.example`, demo shot list, submission worksheet.

## Deferred From the POC

- **Dossier history** — needs a database, retention policy, and a privacy decision; the 30-minute server cache is enough for repeat checks.
- **Share links** — a dossier is currently reproducible from its claim, so links add storage without new value in v1.
- **Document upload** — a second retrieval pipeline (parsing, chunking, permissions) that would crowd out the cross-source core.
- **Claim decomposition** — splitting a paragraph into atomic claims is a whole product; v1 takes atomic claims as input and says so.
- **Persian/other languages** — search providers and stance lexicons are English-first; a half-supported second language would produce confidently wrong verdicts.

## Possible Later Enhancements

- Re-run a saved claim when its evidence changes and show the diff.
- Let a user exclude a source family and watch confidence fall — an interactive lesson in independence.
- Add a "counter-evidence only" view for people who already believe the claim.
- Export a dossier as a one-page PDF with the verdict and receipts.

## Non-Goals

- **Determining absolute truth** — the product reports what independent sources say and how strongly; it does not adjudicate reality.
- **Real-time monitoring of breaking news** — retrieval is on demand, and news coverage of a fresh event is often contradictory by nature.
- **Answering open-ended questions** — no proposition, no stance; this is a verification tool, not an assistant.
- **Being a search engine** — the ledger is short and curated, not exhaustive.
- **Adjudicating aggregate causal comparisons** — passage-level evidence cannot establish population-level causation; the engine says so instead of guessing.
- **Storing user data** — no accounts, no analytics, no cookies beyond none at all.

## Open Questions

- Should the confidence band be calibrated against a labelled claim set? — Can wait; v1 uses a documented, deterministic formula and says it is heuristic.
- Should causal comparisons ever be scored when a source states the comparison explicitly? — Deferred; v1 withholds every aggregate causal comparison rather than carve exceptions.
- Is headline-level news evidence acceptable when a publisher blocks page fetching? — Resolved for v1: only full readable pages count, and blocked pages are dropped; revisit if the readable-page rate is poor.
- Should the LLM path be on by default when a key exists? — Resolved: yes, with a visible badge and heuristic fallback, because synthesis quality is the main gain and the citations remain server-verified.
