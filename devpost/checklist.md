---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (mechanical verification at every slice; the hands-on checkpoints below are the learner's).

## Slices

- [x] **1. A claim can be submitted and the desk shows real stage progress**
  Becomes usable: A running app where submitting a claim opens a dossier and the five stages move from waiting to running to done as the server works.
  Why now: Proves the whole path — browser, SSE, pipeline events, dossier shell — before any retrieval exists.
  PRD ref: `prd.md > The Core Journey` (steps 1–3)
  Spec ref: `spec.md > Components`, `spec.md > File Structure`
  Build: Scaffold Vite/React/Express, add the composer, the SSE route, the client stream parser, and the stage rail.
  Verify (mechanical): `npm run build`; submit a claim; every stage reaches `done`; the result event renders a verdict shell.
  Learner check: Open the app, submit a claim, and say whether the waiting experience feels alive rather than frozen.
  Commit: `Scaffold Cairn and its design tokens`

- [x] **2. Reference and news retrieval produce readable candidates**
  Becomes usable: Real pages arrive in the ledger, with title, domain, and a quotable passage; unreadable pages are dropped and counted.
  Why now: Retrieval quality is the ceiling on every later judgement, and the source mix is the product's independence argument.
  PRD ref: `prd.md > Features and Behavior > Evidence ledger`
  Spec ref: `spec.md > External Services and Dependencies`
  Build: Wikipedia provider with endpoint fallbacks and caching; Bing News RSS with redirect unwrapping; SSRF-safe fetch; Cheerio extraction with reference/chrome stripping.
  Verify (mechanical): Live run on the Great Wall claim reads 3+ pages across 2+ families; a JavaScript-only publisher is dropped, not quoted.
  Learner check: Run one claim and check that every ledger entry is a page you could open and read yourself.
  Commit: `Add retrieval, stance, verdict engine, and SSE API`

- [x] **3. Stance, verdict, and confidence are computed and explainable**
  Becomes usable: Each source is tagged Supports / Contradicts / Neutral with a quote, and the dossier shows a verdict, a score, and four factor readings.
  Why now: This is the kernel. If the stance logic is wrong, the interface is just decoration.
  PRD ref: `prd.md > Features and Behavior > Verdict`, `prd.md > Features and Behavior > Confidence and factors`
  Spec ref: `spec.md > How This Works, In Plain Language`
  Build: Claim analysis with entities/predicates/anchors; passage scoring; negation and refutation cues; source weighting; four verdict states; confidence caps.
  Verify (mechanical): `npm test` covers 39 cases including nested negation, off-topic tourism pages, the 10-percent anchor, and confidence caps; live Great Wall run returns Contradicted with quoted counter-evidence.
  Learner check: Read the Great Wall dossier and try to argue with the verdict using the quotes on screen.
  Commit: `Add retrieval, stance, verdict engine, and SSE API`

- [x] **4. The dossier is a complete, usable product surface**
  Becomes usable: Citations jump to their source, passages expand, the receipt copies, the claim bar resets, errors and rate limits are explained, and the layout works on a phone.
  Why now: Design and presentation are half the judging weight; a correct engine behind a confusing screen does not land.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Components`
  Build: Verdict card, confidence cairn, factors, ledger, paper/grain visual system, responsive breakpoints, focus management, reduced motion, copy receipt.
  Verify (mechanical): Chrome screenshots at 1440 and 390 px; zero horizontal overflow on mobile; citation click expands and scrolls; copy writes the visible receipt; no console errors.
  Learner check: Open the same dossier on a phone and a laptop and say which one you would actually use.
  Commit: `Build the evidence dossier interface`

- [x] **5. Failure states are real, not happy-path theatre**
  Becomes usable: Rate limits, no readable sources, provider outages, and a dead stream each produce a clear surface with a recovery action.
  Why now: The demo must survive the network; judges will try something unexpected.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`
  Build: input validation on both sides, 429 with retry-after, JSON fallback for SSE failure, partial-provider warnings, empty-state error panel with retry.
  Verify (mechanical): 400 on a question; 429 after ten checks; forced no-source run returns 422 with a human message; JSON fallback exercised by aborting the stream.
  Learner check: Try a one-word claim and a question, and confirm the app tells you what to fix.
  Commit: `Add retrieval, stance, verdict engine, and SSE API`

- [x] **6. Repository, tests, and handoff artifacts are ready**
  Becomes usable: A stranger can clone, install, run, and understand the project without a call.
  Why now: The submission is a public repo and a video; undocumented working code fails the mechanical requirements.
  PRD ref: `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: README with run/test/limits, MIT license, `.env.example`, Dockerfile, `devpost/` planning docs, app map, demo shot list, submission worksheet.
  Verify (mechanical): `npm ci && npm run build && npm start` from a clean checkout; `npm test` green; license at repo root; no `.env` or secrets tracked.
  Learner check: Follow the README from the top on a fresh terminal and note the first instruction that is unclear.
  Commit: `Add tests, documentation, and submission artifacts`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — the learner submits a claim and reacts to the streaming dossier before the final review.
- [ ] Final kick-the-tires exploration and feedback completed.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship.

## Code Tour and App Map

- [x] `devpost/app-map.html` generated from the finished code, checked in a browser, and shown with a project-grounded practice to reuse.
- [ ] Learning activity complete — a short learner walkthrough of one click through three files still to do.
- [ ] Optional edit and transfer reflection addressed.

Activity and evidence: app map generated and opened in Chrome; the "follow one click" route is `example chip → App.run → streamVerification → POST /api/verify → verifyClaim → examineSource/weighEvidence/composeVerdict → VerdictCard`.
Route and stops: `src/App.tsx` (`run`, `applyResult`), `src/lib/api.ts` (`streamVerification`), `server/routes/verify.js` (`handleStream`), `server/engine/verify.js` (`verifyClaim`), `server/engine/examine.js` (`examineSource`), `server/engine/weigh.js` (`weighEvidence`), `server/engine/compose.js` (`composeVerdict`).
Edit outcome: not attempted — the learner may change one factor weight in `server/engine/weigh.js` and watch the score move.
Reflection: pending the learner's own run.
Activity mode: live app in Chrome plus the static app map.

## Revisions

- Wikipedia plaintext included reference lists, which were being counted as evidence — the build switched to HTML extraction with reference/navigation stripping and drops the References, Notes and External links sections.
- Tourism and celebrity news about the Great Wall were counted as support because they shared the subject — the build now requires distinct predicate concepts and claim-specific anchors (numbers, percent, superlatives) before a passage can take a side.
- The first confidence formula awarded 95/100 to a four-source run — the build added breadth caps (sources, families, domains) and a mixed-verdict cap.
- The first live stream showed source cards before their final order existed — ids are now assigned at candidate selection and the final ledger is sorted by evidence weight without renumbering.
