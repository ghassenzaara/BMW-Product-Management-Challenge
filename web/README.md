# Argon (web)

The clickable demo of our BMW hackathon tool: **Signals → Cases → Requirements → Vehicle plan**. It runs on synthetic data behind a real REST contract, so the team can work in three tracks at once and replace the mock backend later with no UI changes.

- **Signal:** one piece of evidence with its source. Either a real BMW record (verbatim, study row) or a web finding (synthetic in the demo).
- **Case:** a customer problem built from signals. It has an importance score but no cost. The PM works it with open questions, meeting notes and Argus, the AI assistant, then decides one of: confirm, refer, innovation pool, park, merge or reject.
- **Requirement:** what BMW builds, created from a confirmed case. It carries a SMART text, measurable targets, a release (next generation, mid-life update or OTA) and a rough cost. It moves from draft through discussion and PM approval to head sign-off, then the vehicle plan, then Codebeamer export.

## Screens (six, after Thomas's "less is more" feedback)

| Nav | What the PM does there |
|---|---|
| **My desk** | Four cards sorted by kind of work: *Agent flags* (competitor alerts, @mentions) · *My cases* · *Review* (requirements sent back or in progress; for the head: regional brief differences, sign-off and escalations inline) · *Follow up* (answers that came back, questions due) |
| **Inbox** | Referrals to accept or decline, agent flags, all notifications |
| **Cases** | Kanban (drag = state change with a reason). A *Ranked* toggle shows the score order; weights sit behind one button |
| **Vehicle plan** | All requirements of a series as a list grouped by car area, with status filter chips, plan action and release; today's equipment folds per area; Codebeamer export |
| **Signals** | One Sankey: sources → car areas → cases. Click a node to see its signals and start a case from loose ones. *Refresh* plays the agent run step by step (fetch → classify → gate → match metrics → assess impact) |
| **Innovation pool** | Ideas parked for a future series; vote or pull into your series |

Three things borrowed from the market (see the competitor research):
- **Quality check on every requirement** (like Raiqon and Polarion run inside Codebeamer): vague wording, scope vs. evidence, out-of-scope content (regulatory, technical, pricing), duplicates, conflicting targets and Baukasten overlap. Rules always run; with an LLM key an AI pass adds issues. It warns but never blocks: *Approve as PM* lists the open issues and the reason is logged.
- **Ask the segment** in the case chat (like Dovetail's digital twins, but grounded): chips such as *USA (24) · USA BEV (9) · China (0)* answer only from that segment's real BMW verbatims, with citations. No verbatims means "no evidence" plus a proposed open question, never a guess.
- **Engineering deck** next to *Export to Codebeamer* (like Aha! roadmap decks): one slide per signed-off or planned requirement with the SMART text, three customer quotes, the score breakdown, the competition and the decision log.

A **case** opens with a Sankey of its evidence (*sources → what they say → case*, where "what they say" is a taxonomy topic × type, e.g. *Public charging · hard to use*). Every node is clickable and shows its quotes. Then three steps: **① Evidence** (Sankey + three bullets, full analysis on demand) → **② Your stance** (brief values you inherit, overridable with a reason; your take on the evidence; what you know that the data can't show; how far to go. Argus, the AI assistant, answers with follow-up questions; open questions to engineering and finance) → **③ Requirements** (up to three shape questions with defaults, then the draft in a side panel). Settings, the audit trail and **My series brief** live in the persona menu.

### PM context layers (why a draft reads like the PM wrote it)
The drafter combines five layers; [docs/06-solution-concept/ux-and-collaboration.md](../docs/06-solution-concept/ux-and-collaboration.md#5a-pm-context-layers-requirements-that-read-like-the-pm-wrote-them) has the design.

| Layer | UI | Budget |
|---|---|---|
| 0 Brand profile | Settings (head) | existing |
| 1 Series brief (shared + regional overlay) | `/brief`; onboarding on first login; *Paste your strategy doc* proposes values | ≤ 8 questions, pre-filled from data |
| 2 Case stance | step ② | 3 questions |
| 3 Shape questions | step ③ form, mirrored in the case chat | ≤ 3, each with a default and "why I'm asking" |
| 4 Engineering / finance feedback | *Engineering feedback* on a requirement → proposal for the next version | per round |

Every part of a drafted requirement shows where it came from (evidence with signal IDs, your context with the layer, or assumption). The **Versions** tab keeps the history on the same ID; a brief change shows the affected requirements and creates a version proposal per owner; a regional PM's variant shows a side-by-side "two briefs" comparison.

### Trace replay and the competitor ripple (no new nav item)
- **Trace replay** (*Replay* in the trace strip of every requirement, side panel and full page): a full-screen overlay plays the requirement's life in about 15 s. It opens on the requirement card, rewinds in 1 s to the first quote, then plays forward:
  1. voices: real BMW quotes with market and source; a sample of 12, all counted
  2. signals: topic × type nodes, each with its BMW label or model and prompt version
  3. case and score: the score built factor by factor under the weight profile active on the decision date, next to today's
  4. decisions: agent steps dashed with a bot icon, people solid with an avatar and their quoted reason
  5. planned: the vehicle-plan slot

  It ends in **Chain intact** with four checks recomputed on every call: every quote found in its source record, every record's SHA-256 matching, no gaps in the audit sequence, a rationale on every status change. A failed check shows in red with its reason. Esc closes, Space pauses, ←/→ step, 1×/2×, and a scrubber shows version, score and evidence as of any date. *Export dossier* downloads Markdown with the backend's `audit_chain.render` sections plus scores and integrity. Under `prefers-reduced-motion` the beats step without sweeps. The static Sankey with highlights is the base; the motion is layered on top.
- **Competitor ripple** (`/ripple/[id]`, opened from the Refresh toast, the agent flag on My desk, notifications and the alert strip on an affected requirement): a competitor fact with a metric is matched on `targetSpec.key` against every requirement target in the portfolio (all series, market variants, Baukasten). A competitor update affects requirements, not cases: a case without a requirement only carries the fact as evidence, and every competitor alert comes from a ripple. A newer fact from the same competitor on the same metric replaces the older one's open alerts. Each comparison converts into that target's cycle and market and gets a verdict: behind, at par (±3%), still ahead or not comparable, e.g. a different segment.
  - The band shows the conversion ("800 km CLTC ≈ 680 km WLTP, factor 0.85, range 0.80–0.90, assumption"); its factor is a live what-if, and only the head saves a new team value, with a reason.
  - The grid is series × car area; cells pulse from the source row, are colored by the worst target verdict, outlined for your items and show colleagues' avatars.
  - The impact drawer shows ours vs. the normalized competitor value, rank before → after with "moved because", and who was notified (owner and co-owners alert, watchers FYI, the head when a signed-off target is affected).
  - Row actions are proposals or audited decisions only: *Raise target* (a version proposal; a signed-off requirement drops back to PM-approved), *Keep, with reason* (mutes repeats until the gap grows by more than the threshold in Settings; the reason goes into the monitor's context), *Create market variant* (a regional PM's proposal), *Reopen case*.
  - Low-trust facts (D, E) only go on the watch list. Every decision appears in that requirement's replay.

### The brain seam (for the AI track)
Drafting goes through one interface, `src/mock/ai/drafter.ts`:

```ts
interface Drafter {
  shapeQuestions(input: DraftInput): ShapeQuestion[];      // ≤ 3, with defaults and "why"
  draft(input: DraftInput): Promise<DraftOutput>;           // RequirementSnapshot[] with provenance on every path
}
```

`DraftInput` already carries everything: case, its signals, brand profile, resolved brief (shared + overlay), the PM's stance, shape answers, feedback, the previous version and sibling requirements. Today `getDrafter()` returns the scripted, deterministic composer (`composer@1` in `src/mock/ai/composer.ts`). To plug in the real brain, implement `Drafter` (an LLM call that returns the same snapshot shape) and return it from `getDrafter()`; handlers, versions, impact proposals and the UI stay as they are. The contract test checks that every part has provenance (`fullyTagged`).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 and pick a persona. The persona menu (top right) switches users and has **Reset demo data**.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js 16 app plus the mock backend at `/api` |
| `npm run seed` | Rebuilds `src/mock/fixtures/seed.json` from the real CSVs in `docs/02-bmw-data/processed/` plus the authored content. Validated against the contract |
| `npm run export-contract` | Writes `../contracts/openapi.yaml` and `../contracts/schemas/*.json` |
| `npm run contract-test` | Calls every endpoint against a running backend (`API_BASE`, default `http://localhost:3000/api`) and validates each response. Also walks the demo storyline |
| `npm run typecheck` / `lint` | Static checks |

Optional live AI chat: set `ANTHROPIC_API_KEY` (optionally `LLM_MODEL`). Free-form chat questions then go to Claude with the case as context. Proposals, drafts and research stay scripted so they keep the contract. Without a key the scripted assistant answers offline. The team docs name OpenAI as the provider; to switch, change the single function in `src/mock/ai/live.ts`.

## How the code is split (three tracks)

```
contracts/                 (repo root) generated OpenAPI + JSON Schemas for the backend team
web/src/contracts/         Zod schemas = THE contract (enums, entities, endpoints, UI labels)
web/src/lib/api/           typed client (base URL: NEXT_PUBLIC_API_BASE_URL, default /api) + TanStack Query hooks
web/src/app/(app)/         screens                                   ← frontend track
web/src/components/        UI building blocks (shadcn/ui in components/ui)
web/src/app/api/[...path]  MOCK BACKEND: one route implementing every endpoint   ← replaced by the backend track
web/src/mock/              in-memory store, reference scoring, scripted AI, seed fixtures   ← logic + data track
web/scripts/               seed, contract export, contract test
```

| Track | Owns | Works against |
|---|---|---|
| **Frontend** | `src/app/(app)`, `src/components` | `src/lib/api` hooks only (never imports `src/mock`) |
| **Backend / API** | A FastAPI service on Supabase (Ghassen's `data-model.mmd`) implementing `contracts/openapi.yaml` | `npm run contract-test` with `API_BASE=<their url>`; then set `NEXT_PUBLIC_API_BASE_URL` |
| **Logic + data** | Fetch agents, clustering, scoring, requirement drafting, chat/RAG, meeting-note extraction | The reference behaviour in `src/mock/scoring.ts`, `src/mock/ai/*` and the seed. Same inputs and outputs |

**Changing the contract:** edit `src/contracts/*.ts`, then run `npm run typecheck`, which shows every UI and mock spot to update. Then run `npm run export-contract` and commit `contracts/` so the backend sees the change.

**Rules the contract encodes (keep them in the real backend):**
- The acting user comes in as header `x-user-id` (mock auth); the real backend uses a token.
- Every status change needs a `rationale` and writes an `AuditEvent` (actor = person or `agent:<name>`).
- The AI never edits directly: it returns `Proposal`s (field, body, question answer, new question, new requirement) that a PM accepts or rejects.
- Only the owner or a co-owner changes a case or requirement. The head of product line signs off and resolves escalations. Everyone can read, comment, watch and escalate.
- Case score = weighted mean of 8 factors (0..1), with no cost. Requirement rank = case score × cost multiplier (S/M/L). Evidence level is separate from the score.

### Contract additions vs. `data-model.mmd` (to sync with Ghassen)
`User` · `Workspace.projectType` · case and requirement `shortTitle` (2–4 words for lists; the title stays the full sentence) · signal `topicId` + `aspectGroup` (fixed taxonomy, see `../taxonomy/`) and `GET /taxonomy` · case `highlights`, `topicId`, `stances` (one `CaseStance` per PM, `PUT /cases/:id/stance`; replaces `pmContext`) · `SeriesBrief` (shared + regional overlay with per-field source and reason; `/briefs`, `/briefs/mine`, `PUT /briefs/:id` returns the impact, `/briefs/:id/impact`, `/briefs/:id/extract`, `/brief-conflicts`, `POST /briefs/:id/conflicts/:field`) · shape questions (`GET /cases/:id/shape-questions`, `POST /cases/:id/shape-questions/ask` posts them to the chat; `POST /cases/:id/requirements/generate` takes the answers) · requirement `descriptionParts`, `provenance[]` (path → source, layer, ref, signal IDs), `version`, `shapeAnswers`, `briefId`, `drafter` · `RequirementVersion` snapshots · `FeedbackEntry` (`POST /requirements/:id/feedback` → new-version proposal) · proposal kinds `brief_field` and `new_version` · metric `targetSpec` (`key` ev_range / dc_10_80_min, comparator, value, unit, cycle WLTP / CLTC / EPA / none, market) · signal `classification` (BMW label, or model + prompt version) · `SourceRecord` (raw text + sha256 per `recordRef`) · `AuditEvent.scoreSnapshot` (factors, weights, profile name and version, score, rank at confirm, approve, sign-off, rank change, re-score) · `GET /requirements/:id/replay` (`ReplayResponse` with integrity checks) · `CycleConversion` (`GET /conversions`, `PUT /conversions/:id` head only) · `Ripple` / `RippleItem` (`GET /ripples`, `GET /ripples/:id`, `POST /ripples/:id/items/:itemId/decision`) · `MonitorSettings` (`GET`/`PUT /settings/monitor`) · `Alert.rippleId` / `itemVerdict` / `comparison` · `AgentRun.steps` / `rippleId` · shared comparison rule `src/contracts/compare.ts` · case `outcome` (confirmed / referred / innovation pool / parked / merged / rejected) plus the states `investigating`, `awaiting_answers`, `ready` · case taxonomy `carArea` / `type` / `changeDepth` and `relatedSeries` · `context` (preset context + PM inputs) · `OpenQuestion` · `MeetingNote` · `Proposal` · `Referral` (referral or escalation) · `InnovationMeta` · `VehiclePlan` / `PlannedFeature` · `Comment` · `Notification` · `Alert` · requirement statuses `pm_approved`, `signed_off`, `planned`.

## Synthetic data, honestly labelled

- **Real** (no tag): 404 BMW verbatims selected by topic and text from `feedback_verbatims.csv` (e.g. `G60-1430`, `G60-0878`), study rows from `study_*_2025.csv`, and 2030 sales shares. Per-market counts are computed from them.
- **Synthetic** (tagged): people, web signals and competitor facts (their URLs point to the source site, not a real post), chats, decisions, requirements and the audit history. The story follows `docs/02-bmw-data/insights.md`.
- The case pages and the desk say so: there are no Chinese verbatims, and 5 and 7 Series feedback is 90 to 95% US.
- **Assumptions in the ripple:** the CLTC↔WLTP (0.85, range 0.80–0.90) and EPA↔WLTP (1.12, range 1.08–1.18) factors are team rules of thumb, not published conversions. The 1 Series BEV requirement is itself an assumption (the F70 data is ICE only). G68 (5 Series China) is the China row of the 5 Series, not a separate series. Web source records are synthetic snapshots; their hashes prove they were not edited after capture, not that the page existed.

## Personas

| Persona | Role | Demo focus |
|---|---|---|
| Lena Hofmann | PM 5 Series · Rest of World, owns the shared G60 brief | Brief → stance → shape questions → provenance; engineering feedback; brief change. Also: refer the buttons case, paste a meeting note, what-if weights |
| Wei Zhang | PM 5 Series · China, not onboarded yet | Onboarding from a pasted strategy doc; co-drafts the China variant. Also: escalate the equipment conflict, react to the CLTC alert |
| Jonas Berger | PM Operating concept & HMI (cross-series) | Accept referrals into one Baukasten case |
| Katrin Maier | Head of product line | Regional brief differences, sign-off and escalations from her desk, brand profile |
| Sofia Rossi / Daniel Okafor | PM 1 Series / PM 7 Series | Light series for referrals and the portfolio |

## Demo script: world changed + trace replay (about 60 seconds, after *Reset demo data*)

1. **Lena → Signals → Refresh** (once): the agent run plays its five steps; the toast says *Competitor fact: Xiaomi SU7 800 km CLTC affects 4 items in 3 series* → **View ripple**. The Zeekr 900 km owner post (trust D) only lands on the watch list.
2. **Ripple:** China is red (REQ-G60-CN-0003, 750 km CLTC, −6.2%), the 7 Series green (the battery Baukasten at 750 km WLTP, +10%), the 5 Series amber (REQ-G60-0010, 690 vs. ≈ 680 km WLTP, +1.5%) and the 1 Series grey (compact segment, not judged). Only requirements are listed. The cases behind them are re-scored, and the impact list gives the reason (REQ-G60-0010: "Competitor gap 0.55 → 0.70", rank unchanged).
3. **Drag the factor to 0.90:** "800 km CLTC ≈ 720 km WLTP", and the 5 Series cell turns red. The verdict hinges on an assumption, and the screen says so. *Team value 0.85* resets it.
4. **Impact list → REQ-G60-0010 → Keep, with reason** ("At par in WLTP; we win on 10–80% charging time"). Repeats stay muted until the gap grows by more than 3 points.
5. **Wei → the same row → Create market variant** (≥ 840 km CLTC): a proposal on his REQ-G60-CN-0003, not an edit.
6. **Katrin → notifications:** "Signed-off REQ-G60-0010 is at par … any change needs a new sign-off"; My desk shows one agent-flag row for the ripple.
7. **REQ-G60-0010 → Replay:** the card, rewind, voices (17 customers), signals (BMW labels), score 0.614 on 12 Sep under *Balanced v1*, next to 0.630 today. Decisions end with the competitor alert, Lena's kept target and Wei's variant, then the plan slot, then **Chain intact** and *Export dossier*.

## Demo script: context layers (about 5 minutes, after *Reset demo data*)

1. **Lena → persona menu → My series brief:** eight answers, most pre-filled (*from data*, *from the brand profile*). The thesis names the A6 e-tron.
2. **CASE-G60-0003 → ② Your stance:** the brief values show as inherited chips. Add a take (*Focus on BEV owners*) and inside knowledge (*Battery team is sampling next-gen cells*), then *Save context and ask Argus*: Argus asks what the brief and the data can't answer (China weighted 25% with no Chinese records).
3. **③ Requirements → Confirm case:** three shape questions open, each with a default and *Why I'm asking*. Pick *Beat the best competitor* → *Create requirements*. The draft says *≥ 800 km, beating Audi A6 e-tron 756 km*; every sentence carries a chip (green evidence with signal IDs, blue your context, amber assumption), and the inside knowledge is an assumption.
4. **Engineering feedback:** "800 km needs the next-gen cells; 700 km is the max for the current pack" → *Compromise* + reason → a v2 proposal with the diff. Accept: **Versions** shows v1 → v2 on the same ID.
5. **My series brief → Cost envelope → High, ≤ +1%** → *Save*: the dialog lists the affected requirement first; saving creates a v3 proposal on it instead of editing it.
6. **Switch to Wei:** he lands on onboarding. *Create my regional brief* (China pre-filled at 100%) → *Paste your strategy doc → Use demo doc → Propose brief values*: six field proposals with quotes; accept them → *Confirm*.
7. **Wei → CASE-G60-0003 → Draft my regional variant:** different questions (China variant, Mercedes CLA, beat), and the draft is *CLTC range ≥ 980 km (China)* (the CLA's 792 km WLTP converted with the 0.85 team assumption, then beaten), a CN variant of Lena's requirement with the "two briefs" comparison.
8. **Katrin, My desk → Review → 5 Series brief:** Wei differs on seven fields; decide each as regional variant or align, with one rationale.

## Demo script: the rest (about 6 minutes)

1. **Lena, My desk:** four cards, one per kind of work. After *Signals → Refresh*, the competitor ripple sits on top of Agent flags as one row per fact.
2. **CASE-G60-0003** (i5 range and charging): the Sankey shows 36 customers, where they spoke and what they say. Click *Public charging · hard to use* to read the six quotes; the competitor facts are the grey nodes.
3. **② Your stance:** see the context-layer script above. Argus opens with questions the data can't answer.
4. **CASE-G60-0001 → Decide → Refer** to Jonas (Baukasten). **Switch to Jonas → Inbox → Accept:** a linked case appears in his workspace.
5. **Lena, CASE-G60-0005 → ② → Paste meeting notes → Use demo note:** the AI proposes the answers; accept them, the audit trail logs each one.
   - **Ask owners** in the case chat (e.g. CASE-G60-0012): click a chip with data for a cited summary, then *China (0)*: "no evidence", plus a proposed question to the market PM.
   - **Vehicle plan → REQ-G60-0019:** the quality check flags "seamless" and "intuitive" (not testable) and that the evidence is 100% US while the scope is global. *Approve as PM* shows the issues and asks for the reason.
6. **Cases → Ranked → Weights:** move *Brand fit*; the list re-ranks with arrows and "moved because…".
7. **Katrin, My desk → Review:** sign off REQ-G60-0004 inline and resolve the 7 Series escalation as a market variant.
8. **Vehicle plan:** requirements by car area, open one in the side panel (trace chain, quality check, argument sheet, *Harden with AI*), then **Download deck** for the engineering round and **Export to Codebeamer**.
9. **Signals:** the whole evidence base as one Sankey; *Refresh* fetches new signals and raises a competitor flag.
