# Submission worksheet

> The Devpost Learn Skill Pack requires the entrant to write the submission answers. This file is a
> worksheet: facts, links and checks the copy can be built from. It is **not** submission prose.

## Where things stand

| Item | Status |
|---|---|
| Working proof of concept | Built and exercised end-to-end; `npm test` green (39 tests), live check returns a cited verdict. |
| `scope.md`, `prd.md`, `spec.md` | Present in `devpost/`, marked approved. |
| Public repository | Not pushed yet — needs the entrant's GitHub account and explicit OK to publish. |
| MIT license at repo root | Present. |
| Demo video | Not recorded yet — shot list in `demo-shot-list.md`. |
| Devpost submission | Not submitted. |
| Eligibility | The Official Rules exclude residents of Iran and several other regions. Confirm eligibility before spending time on the video or submission. |

## The entrant still has to do

1. **Read the three planning docs** and change anything that does not sound like their decision.
2. **Run the app themselves** (`npm install && npm run build && npm start`) and complete the two hands-on
   checkpoints in `devpost/checklist.md`. The build checklist marks them pending on purpose.
3. **Record the demo video** from the shot list, in their own voice, under three minutes.
4. **Create the public GitHub repository** and push. Check the repo in a private window afterwards.
5. **Write the submission fields** (name, tagline, description, "built with", testing instructions,
   video URL, repo URL) in their own words. Grammar and spelling fixes only after that.
6. **Complete the exit survey** and submit on Devpost before **26 Oct 2026, 17:00 ET**.

## Factual source material for the description

- Takes one factual claim as text (8–400 characters) and verifies it end-to-end.
- Retrieves from three independent families: Wikipedia (reference), Bing News RSS (news), OpenAlex
  (research). Optional Brave/Tavily web search when a key is present.
- Reads the full pages, not headlines; drops pages it cannot read rather than guessing.
- Tags each source Supports / Contradicts / Neutral, with the exact passage that decided it.
- Returns Supported / Contradicted / Mixed / Not enough evidence.
- Confidence 0–100 from four published factors (agreement 32%, independence 24%, directness 26%,
  source quality 18%), with caps for thin evidence.
- Streams progress over Server-Sent Events; citations jump to the evidence; a plain-text receipt copies.
- No login, no database, no analytics, no API key required.
- Optional LLM (OpenAI-compatible) rewrites the summary only; the verdict and citations stay server-side
  and are validated.
- Built with Node 20+, Express 5, React 19, Vite, Cheerio; MIT licensed.

## Testing instructions for judges

```
git clone <public repo url>
cd cairn
npm install
npm run build
npm start
```

Open <http://localhost:8787>. No account, key, or seed data. If a port clash occurs, run
`PORT=8788 npm start`.

Try, in order:

1. Click the first example ("The Great Wall of China is visible from space with the naked eye.")
   → expect **Contradicted** with quoted counter-evidence.
2. Click the Eiffel Tower example → expect **Supported** with physics reporting.
3. Click a `[n]` marker in the answer → the matching source card scrolls into view and expands.
4. **Copy the receipt** → a plain-text verdict and source list lands on the clipboard.
5. Submit a question ("Is the Great Wall visible?") → inline explanation that Cairn weighs statements.

The app is deterministic in structure but the evidence comes from live sources, so scores and source
counts vary. A provider outage is shown in the run notes and lowers the confidence cap rather than
faking a result.

## Disclosures to keep in the submission

- New project, created during the submission period; no pre-existing code.
- Uses the Devpost Learn Skill Pack; the `devpost/` planning docs are in the repo.
- Open-source dependencies: Express, Cheerio, React, Vite, Fontsource fonts (OFL). All permissively licensed.
- The demo video contains no third-party music and no personal data.
- AI assistance: the project was built with a coding agent; the evidence quotes are retrieved, not generated.

## Final terminal checklist

- [ ] Video is public, under three minutes, and shows the working app end-to-end.
- [ ] Repository is public, MIT license visible in the About section, README run steps verified from a clean clone.
- [ ] No `.env`, keys, personal data, or `devpost/learner-profile.md` in the repo or its history.
- [ ] Description and all form fields are written by the entrant.
- [ ] Exit survey completed.
- [ ] Submitted on Devpost before the deadline.
