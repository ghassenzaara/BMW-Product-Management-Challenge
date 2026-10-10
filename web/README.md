# Requirement Studio (web)

The clickable demo of our BMW hackathon tool: **Signals → Cases → Requirements → Vehicle plan**. It runs on synthetic data behind a real REST contract, so the team can work in three tracks at once and replace the mock backend later with no UI changes.

- **Signal:** one piece of evidence with its source. Either a real BMW record (verbatim, study row) or a web finding (synthetic in the demo).
- **Case:** a customer problem built from signals. It has an importance score but no cost. The PM works it with open questions, meeting notes and an AI assistant, then decides one of: confirm, refer, innovation pool, park, merge or reject.
- **Requirement:** what BMW builds, created from a confirmed case. It carries a SMART text, measurable targets, a release (next generation, mid-life update or OTA) and a rough cost. It moves from draft through discussion and PM approval to head sign-off, then the vehicle plan, then Codebeamer export.

## Screens (six, after Thomas's "less is more" feedback)

| Nav | What the PM does there |
|---|---|
| **My desk** | Four cards sorted by kind of work: *Agent flags* (competitor alerts, @mentions) · *My cases* · *Review* (requirements sent back or in progress; for the head: sign-off and escalations inline) · *Follow up* (answers that came back, questions due) |
| **Inbox** | Referrals to accept or decline, agent flags, all notifications |
| **Cases** | Kanban (drag = state change with a reason). A *Ranked* toggle shows the score order; weights sit behind one button |
| **Vehicle plan** | All requirements of a series as a list grouped by car area, with status filter chips, plan action and release; today's equipment folds per area; Codebeamer export |
| **Signals** | One Sankey: sources → car areas → cases. Click a node to see its signals and start a case from loose ones |
| **Innovation pool** | Ideas parked for a future series; vote or pull into your series |

A **case** opens with a Sankey of its evidence (*sources → what they say → case*, where "what they say" is a taxonomy topic × type, e.g. *Public charging · hard to use*). Every node is clickable and shows its quotes. Then three steps: **① Evidence** (Sankey + three bullets, full analysis on demand) → **② Your knowledge** (four one-click questions + a note; the AI colleague answers with follow-up questions; open questions to engineering and finance) → **③ Requirements** (create, then open each in a side panel and harden it with the AI). Settings and the audit trail live in the persona menu.

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
`User` · `Workspace.projectType` · signal `topicId` + `aspectGroup` (fixed taxonomy, see `../taxonomy/`) and `GET /taxonomy` · case `highlights`, `topicId`, `pmContext` (`PUT /cases/:id/pm-context`) · case `outcome` (confirmed / referred / innovation pool / parked / merged / rejected) plus the states `investigating`, `awaiting_answers`, `ready` · case taxonomy `carArea` / `type` / `changeDepth` and `relatedSeries` · `context` (preset context + PM inputs) · `OpenQuestion` · `MeetingNote` · `Proposal` · `Referral` (referral or escalation) · `InnovationMeta` · `VehiclePlan` / `PlannedFeature` · `Comment` · `Notification` · `Alert` · requirement statuses `pm_approved`, `signed_off`, `planned`.

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
| Katrin Maier | Head of product line | Sign-off and escalations from her desk, brand profile |
| Sofia Rossi / Daniel Okafor | PM 1 Series / PM 7 Series | Light series for referrals and the portfolio |

## Demo script (about 6 minutes)

1. **Lena, My desk:** four cards, one per kind of work. A competitor flag sits on top.
2. **CASE-G60-0003** (i5 range and charging): the Sankey shows 36 customers, where they spoke and what they say. Click *Public charging · hard to use* to read the six quotes; the competitor facts are the grey nodes.
3. **② Your knowledge:** choose *Europe · Premium · Mid-life update* and save. The AI colleague opens with two questions the data can't answer (Europe vs. US evidence, platform change vs. LCI).
4. **CASE-G60-0001 → Decide → Refer** to Jonas (Baukasten). **Switch to Jonas → Inbox → Accept:** a linked case appears in his workspace.
5. **Lena, CASE-G60-0005 → ② → Paste meeting notes → Use demo note:** the AI proposes the answers; accept them, the audit trail logs each one.
6. **Cases → Ranked → Weights:** move *Brand fit*; the list re-ranks with arrows and "moved because…".
7. **Katrin, My desk → Review:** sign off REQ-G60-0004 inline and resolve the 7 Series escalation as a market variant.
8. **Vehicle plan:** requirements by car area, open one in the side panel (trace chain, argument sheet, *Harden with AI*), then **Export to Codebeamer**.
9. **Signals:** the whole evidence base as one Sankey; *Refresh* fetches new signals and raises a competitor flag.
