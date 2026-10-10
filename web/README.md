# Requirement Studio (web)

The clickable demo of our BMW hackathon tool: **Signals → Cases → Requirements → Vehicle plan**. It runs on synthetic data behind a real REST contract, so the team can work in three tracks at once and replace the mock backend later with no UI changes.

- **Signal:** one piece of evidence with its source. Either a real BMW record (verbatim, study row) or a web finding (synthetic in the demo).
- **Case:** a customer problem built from signals. It has an importance score but no cost. The PM works it with open questions, meeting notes and an AI assistant, then decides one of: confirm, refer, innovation pool, park, merge or reject.
- **Requirement:** what BMW builds, created from a confirmed case. It carries a SMART text, measurable targets, a release (next generation, mid-life update or OTA) and a rough cost. It moves from draft through discussion and PM approval to head sign-off, then the vehicle plan, then Codebeamer export.

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
| `npm run seed` | Rebuilds `src/mock/fixtures/seed.json` from the real CSVs in `docs/02-data/processed/` plus the authored content. Validated against the contract |
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
`User` · `Workspace.projectType` · case `outcome` (confirmed / referred / innovation pool / parked / merged / rejected) plus the states `investigating`, `awaiting_answers`, `ready` · case taxonomy `carArea` / `type` / `changeDepth` and `relatedSeries` · `context` (preset context + PM inputs) · `OpenQuestion` · `MeetingNote` · `Proposal` · `Referral` (referral or escalation) · `InnovationMeta` · `VehiclePlan` / `PlannedFeature` · `Comment` · `Notification` · `Alert` · requirement statuses `pm_approved`, `signed_off`, `planned`.

## Synthetic data, honestly labelled

- **Real** (no tag): 404 BMW verbatims selected by topic and text from `feedback_verbatims.csv` (e.g. `G60-1430`, `G60-0878`), study rows from `study_*_2025.csv`, and 2030 sales shares. Per-market counts are computed from them.
- **Synthetic** (tagged): people, web signals and competitor facts (their URLs point to the source site, not a real post), chats, decisions, requirements and the audit history. The story follows `docs/02-data/insights.md`.
- The case pages and the desk say so: there are no Chinese verbatims, and 5 and 7 Series feedback is 90 to 95% US.

## Personas

| Persona | Role | Demo focus |
|---|---|---|
| Lena Hofmann | PM 5 Series · Rest of World | Refer the buttons case, paste a meeting note, what-if weights |
| Wei Zhang | PM 5 Series · China | Escalate the equipment conflict, react to the CLTC alert |
| Jonas Berger | PM Operating concept & HMI (cross-series) | Accept referrals into one Baukasten case |
| Katrin Maier | Head of product line | Portfolio, sign-off, resolve escalations, brand profile |
| Sofia Rossi / Daniel Okafor | PM 1 Series / PM 7 Series | Light series for referrals and the portfolio |

## Demo script (about 6 minutes)

1. **Lena, My desk:** alerts, mentions and questions due; the coverage meter shows the data gaps honestly.
2. **Signal radar:** the theme map and the agent feed. Press **Refresh now**: new signals arrive, a competitor fact raises an alert, and a second run finds nothing new (dedupe).
3. **Cases → Ranked:** move *Brand fit* up; the list re-ranks with "moved because…", and the robustness column shows what stays in the top 5 under every profile.
4. **CASE-G60-0001** (buttons): the case page, signals with real verbatims, the score breakdown, the context pack. Ask the AI *"Why is this ranked so high?"*: the answer has clickable citations. **Decide → Refer** to Jonas (Baukasten).
5. **Switch to Jonas → Inbox → Accept:** a linked case is created in his workspace.
6. **Lena, CASE-G60-0005 → Open questions → Paste meeting notes → Use demo note:** the AI proposes the three answers and a decision-log entry. Accept them; the audit trail shows each one.
7. **Lena → Decide → Confirm:** the requirement agent drafts the SMART requirement. Open it: trace chain, argument sheet for engineering, edit a target (the reason is logged).
8. **Wei, CASE-G60-CN-0001 → Escalate.** **Katrin → Approvals:** resolve it as a *market variant*, then sign off REQ-G60-0004.
9. **Lena → REQ-G60-0004 → Add to vehicle plan → Vehicle plan:** the protect list plus kept, new and improved features. **Export to Codebeamer** (CSV).
10. **Audit trail:** filter by *AI agents* vs *People*.

Reset with the persona menu before each run.
