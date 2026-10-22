---
doc: scope
status: approved
---

# Cairn

One line: Cairn takes a single factual claim, reads independent sources, and shows a cited verdict with a confidence you can inspect.

## The Unique Kernel

Cairn does not just answer — it **shows what the answer is standing on**. Every verdict is assembled from quoted passages, tagged by whether each source supports or contradicts the claim, and the confidence score is an explicit function of that disagreement. Two sources agreeing is a fact; three sources disagreeing is the interesting part, and Cairn makes that visible instead of hiding it behind one confident paragraph.

The name is the metaphor: a cairn is a stack of stones that marks a safe path. Each source is a stone. Confidence is how well the stones stack.

## Who It's For

Maya, a 27-year-old junior policy analyst at a small public-health nonprofit. Part of her job is answering "can you check this?" emails from senior staff before a claim goes into a briefing note or a social post. Today she opens three or four tabs — a search engine, Wikipedia, maybe a news article — skims for a sentence that sounds authoritative, and writes "sources suggest…" while privately hoping nobody asks how sure she is. She does not need a chatbot. She needs a defensible paper trail she can paste into a reply.

## The Core Loop

She pastes a claim she has been asked about — "The Great Wall of China is visible from space with the naked eye" — and presses **Weigh this claim**. Over the next ten to twenty seconds she watches the desk fill: sources are found, read, and tagged; a verdict appears with the exact sentences that decided it. She clicks a citation marker to jump to the passage behind it, checks the source's domain and family, and copies the verdict plus its sources into her reply. Next claim, same loop. She comes back because the receipt is faster than building one by hand.

## Inspiration & Identity

An evidence dossier crossed with a field notebook: paper, ink, oxblood stamps, monospaced annotations in the margins, hairline rules, footnotes that actually work. Think a research desk at a small library, an OCCRP investigation, an Audubon field guide, a coroner's report — precise, calm, a little severe, never chatty.

- https://www.occrp.org — investigative layout, evidence-first tone
- https://pudding.cool — editorial data storytelling, generous type
- https://www.economist.com — restrained authority, confident hierarchy
- https://en.wikipedia.org/wiki/Cairn — the object and the metaphor
- https://www.are.na — archival, collected-material feel

Aesthetic direction: warm off-white paper (#F4EFE6), near-black ink (#17140F), oxblood for contradiction (#A63A2B), moss for support (#2F5D4A), ochre for ambiguity (#A96B12). Display serif Fraunces, body serif Newsreader, labels and citations in Azeret Mono. Subtle paper grain, no glossy gradients.

## Why This Matters to the Learner

I use AI answers every day and I have caught myself repeating claims I never checked. The uncomfortable part is not that AI can be wrong — it is that a wrong answer and a right answer look exactly the same. I want to practise building the thing I actually need: a tool whose output is an argument I can audit, not an answer I have to trust.

## What "Working" Looks Like

Maya pastes the Great Wall claim. Within twenty seconds she sees:

1. A verdict: **Contradicted**, with a 2–3 sentence explanation carrying `[1]`–`[3]` citation markers.
2. Three to five source cards from at least two independent source families (reference, news, research), each with a stance tag, the quoted passage that triggered it, its domain, and a link out.
3. A confidence panel that explains the score in plain language ("two independent sources contradict directly; one qualifies it"), not just a number.
4. The "oh, that's cool" beat: one source says the Wall is visible only under very favourable conditions from low orbit. The verdict is not a flat "false" — the UI shows the qualification and lowers confidence accordingly, which is exactly the nuance a one-paragraph chatbot answer loses.

The whole interaction is one screen, one claim, no login, no setup, no API key required.

## The POC Boundary

In:

- One claim at a time, pasted as text (a statement, not a question).
- Evidence retrieval from three keyless source families: Wikipedia (reference), Bing News RSS (news), OpenAlex (research), plus optional Brave/Tavily web search if the operator supplies a key.
- Three to five readable sources; pages that cannot be read are dropped and reported.
- Per-source stance (supports / contradicts / neutral) that requires the claim's head predicate to relate to one of its objects; quoted and reported claims count as neutral, not support.
- The deciding quote is the sentence that carries the stance, not the start of the retrieved chunk.
- A four-way verdict (Supported / Contradicted / Mixed / Not enough evidence) and a 0–100 confidence score with visible factors.
- A scope guard that withholds a verdict on aggregate causal comparisons and keeps the sources as a reading list.
- An extractive, citation-anchored summary with no invented facts.
- Optional LLM synthesis when an OpenAI-compatible endpoint is configured; the heuristic path remains the default and the fallback.
- Live progress over Server-Sent Events, because waiting twenty seconds with no feedback is a design failure.
- Responsive layout, keyboard access, reduced-motion support.

## Later

- Claim history and saved dossiers (needs persistence and a privacy story).
- Multi-claim decomposition: one paragraph in, several verdicts out.
- Checking a claim against user-supplied documents, not just the open web.
- Shareable read-only dossier links.
- Persian and other language support.
- A browser extension that checks the claim under the cursor.
- Scheduled re-checks when a claim's evidence changes.

## Explicitly Cut

- **Accounts and login** — nothing in the core loop needs identity; adding it would add a privacy obligation and a password screen to a 30-second task.
- **Chat follow-ups** — a conversation invites drift and makes the evidence trail ambiguous. One claim, one dossier.
- **PDF/URL upload** — a different retrieval problem (parsing arbitrary documents, chunking, access control). It would double the build and dilute the "open sources" promise.
- **A verdict for questions** ("Is the Great Wall visible from space?") — stance detection needs a proposition to support or contradict. Questions would force a guess at what is being asserted.
- **Custom source whitelists** — interesting for professional fact-checkers, but it turns a one-screen tool into a settings product.
- **Mobile app** — the web page is responsive; a native shell adds a release pipeline with no new capability.
- **Fine-tuned model** — retrieval and cross-checking are the hard, useful parts; a fine-tune would hide the reasoning and add cost.
- **Aggregate causal comparisons** — "A caused more deaths than B prevented" needs study-level evidence. The engine retrieves and shows the sources but refuses to score the claim; guessing from correlated passages is worse than saying so.
