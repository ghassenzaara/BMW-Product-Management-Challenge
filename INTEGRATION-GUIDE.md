# Integration guide: frontend (`web/`) ↔ backend (`backend/`)

> **Status: finished (2026-10-11).** The integration this guide plans is done. It is kept as the record of the gap analysis; do not work from its plan any more.
>
> - **Approach taken:** option 1 and option 2 of section 8.3 together. The adapter in `web/src/backend` serves all 67 endpoints of the UI contract from the API, and the backend got the tables and endpoints for everything the UI needed (migrations 0014 to 0016, `backend/app/collab/`, `backend/app/api/routers/workspace.py`). The JSON sidecar and the persona table no longer exist.
> - **The decisions of section 8.5** are taken and recorded in `changes.md`, section "UI alignment" (U.1 to U.18): requirement statuses extended in the backend, structured requirement editing with versions, brand fit stays a multiplier, case workflow and outcomes as columns of `case_vehicle`, free chat on the RAG agent, signals shown by their id.
> - **Out of date below:** the "Backend today" columns of section 5, the coverage table of 8.2, the plan of 8.4 and the gotchas about the sidecar describe the state before the work. Sections 1, 3, 4 and 6 (what the UI is and which rules it keeps) still hold.
> - **What is still open** (UI limits on real data, fetch sources, documents to update): `HANDOFF.md`.
> - **How to run it:** `HANDOFF.md`, section "How to run". `npm run adapter-flow` walks one case from open to exported through the adapter.

**For:** whoever (human or AI agent) connects the synthetic-data frontend to Ghassen's real backend.
**State as of 11.10.2026, 02:30:** frontend on branch `feature/frontend-demo` ([PR #5](https://github.com/ghassenzaara/BMW-Product-Management-Challenge/pull/5) into `main`); backend on `main` (phases 0 to 10 done, see `plan.md`).

> **Status, 11.10.2026 (after PR #10 and #11).** The adapter exists and is complete: `web/src/backend/` serves all 77 endpoints of the contract from FastAPI when `DATA_SOURCE=backend`; the mock serves all 77 on the demo data otherwise. The two sources are never mixed (`route.ts`), so the per-endpoint fallback and the sidecar store described in section 8 are history. Sections 5 to 8 describe the starting point and the plan; where they differ from the code, the code and `backend/API.md` are right (for example `savePmContext` became `saveCaseStance`).
>
> What the real backend does not offer yet: starting a fetch run from the UI, the competitor ripple with its conversion factors and monitor settings. `GET /me` reports this as `features: { agentRefresh, competitorRipple }` and the UI hides those controls instead of failing. Everything else (cases by hand, PM evidence, detail edits, trace replay, exports) is stored and audited by the backend.
>
> **How to use this file.** Read sections 1 to 3 to understand the product and the two codebases, then section 7 (the gap) and section 8 (the plan). Sections 4 to 6 are reference material: every screen, endpoint and business rule of the frontend, so nothing gets lost while swapping the data source.

---

## 0. TL;DR

- The **frontend** is a Next.js 16 app that talks to **its own REST contract** (`web/src/contracts/*.ts`, Zod, exported to `contracts/openapi.yaml`). Today that contract is served by a **mock backend inside Next.js** (`web/src/app/api/[...path]/route.ts` + `web/src/mock/`) on synthetic data plus 404 real BMW verbatims.
- The **backend** is FastAPI + Postgres/pgvector (Supabase) with **its own, different REST API** (`backend/app/api/routers/*.py`, guide in `backend/API.md`), on the full real data (1,206 cases, ~13,000 signals, scores for 10 configs, RAG index).
- The two APIs **do not match** (different paths, field names, vocabularies, IDs and concepts: per-vehicle case state, configs and weight profiles per vehicle × market, page-based requirements). About half of the UI features (open questions, meeting notes, referrals, innovation pool, vehicle plan, comments, alerts, head sign-off, quality check, segments, deck) **have no backend counterpart yet**.
- **Recommended approach: an adapter layer (BFF) inside Next.js.** Keep the UI and its contract unchanged; replace the mock handlers endpoint by endpoint with handlers that call FastAPI and map the shapes. Features the backend lacks keep running on a small "sidecar" store keyed by real IDs. Switchable per endpoint, so the demo can always fall back to the mock. Details and step-by-step plan in section 8.

---

## 1. The product in one page

BMW product managers (PMs) decide which customer requirements go into the next generation of a vehicle (G60 = 5 Series, F70 = 1 Series, G70 = 7 Series). The app turns heterogeneous evidence into traceable, prioritized requirements, with the PM deciding at every step.

**Chain:** `Signal → Case → Requirement → Vehicle plan → Codebeamer`

| Concept | Meaning | Frontend entity | Backend table |
|---|---|---|---|
| **Signal** | One piece of evidence with its source: a BMW verbatim, a study row, a web review, a competitor fact | `Signal` | `signal` (+ `source_record`) |
| **Case** | A customer **problem**, built from a group of signals on one topic. Has an importance score, **no cost** | `Case` | `case_item` + `case_vehicle` (per line) + `case_score` |
| **Requirement** | What BMW builds to solve a confirmed case: SMART text, measurable targets, release, rough cost | `Requirement` | `requirement` |
| **Vehicle plan** | Requirements of a series grouped by car area, next to today's equipment; exported to Codebeamer | `VehiclePlan` / `PlannedFeature` | (none; `vehicle_feature` holds today's equipment) |

**Non-negotiable rules (both codebases agree):**
1. **AI proposes, PM decides.** The AI never edits directly: it returns proposals (frontend `Proposal`, backend `chat_message.proposed_diff`) that a person accepts or rejects.
2. **Every human decision has a reason** and every change writes an **append-only audit event** (who or what, when, before/after, rationale).
3. **Traceability:** every requirement links back to its case, the case to its signals, signals to their source quote.
4. **Fixed taxonomy:** 11 car areas, 219 topics, 11 aspect groups (`taxonomy/taxonomy.json`). Agents classify into it; they never invent categories (Thomas's feedback).
5. **Customer-facing requirements only:** regulatory, engineering specs and pricing are out of scope.
6. **Score formula is explainable:** case score = weighted mean of factors (0..1); requirement rank = case score × cost multiplier (S/M/L).

**Personas (frontend demo, synthetic):** Lena Hofmann (PM 5 Series, rest of world), Wei Zhang (PM 5 Series, China), Jonas Berger (cross-series attribute PM, operating concept / HMI, "Baukasten"), Katrin Maier (head of product line: signs off, resolves escalations), Sofia Rossi (PM 1 Series), Daniel Okafor (PM 7 Series).

---

## 2. Repository map

```
contracts/                 Frontend REST contract exported for the backend (openapi.yaml + schemas/*.json)
web/                       Frontend (Next.js 16, React 19, TanStack Query, shadcn/ui, Zod 4)
  src/contracts/           THE frontend contract: enums.ts, entities.ts, api.ts (endpoints), labels.ts
  src/lib/api/             typed client (client.ts) + React Query hooks (hooks.ts)
  src/app/(app)/           screens
  src/components/          UI building blocks
  src/app/api/[...path]/   MOCK BACKEND entry: one catch-all route dispatching to src/mock/handlers.ts
  src/mock/                in-memory store, scoring, scripted AI (ai/*), seed fixture, authored story
  scripts/                 seed.ts, export-contract.ts, contract-test.ts
backend/                   Backend (on main): FastAPI app, Postgres migrations, seed, pipelines, RAG, fetch loop
  app/api/routers/         cases, requirements, signals, config, collab (chat, audit, notifications, runs)
  API.md                   backend API guide
taxonomy/                  Fixed taxonomy shared by both (taxonomy.json, build.py, classifier schema)
All-context/               Challenge material, BMW data, meeting notes (main's canonical docs folder)
docs/                      Older copy of the docs on the frontend branch (web/scripts/seed.ts still reads docs/02-data/processed)
database-design.md, data-model.mmd, plan.md, changes.md, CLAUDE.md   Backend design and decision log (on main)
```

---

## 3. How the frontend works (architecture)

### 3.1 Contract-first
- Every endpoint is declared once in `web/src/contracts/api.ts` (`endpoints` object: method, path, query, body, response as Zod schemas). Entities in `entities.ts`, vocabularies in `enums.ts`, UI labels in `labels.ts`.
- `npm run export-contract` writes `contracts/openapi.yaml` and `contracts/schemas/*.json`.
- `npm run contract-test` (`API_BASE=…`) calls every endpoint against a running server, validates every response with Zod, and walks the demo storyline. **Any data source behind the UI must pass it** (the storyline uses seeded IDs such as `CASE-G60-0001`, so it needs parametrizing for real data).

### 3.2 Data access
- The UI never imports `src/mock`. It calls `api(name, { params, query, body })` from `src/lib/api/client.ts`, or the hooks `useApi(name, opts)` / `useApiMutation(name)` from `src/lib/api/hooks.ts`.
- Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `/api` = the mock route).
- **Every successful mutation invalidates every query** (`qc.invalidateQueries()`): simple and always consistent, fine for demo-sized data. With 13,000 real signals some screens will need pagination (section 9).
- Errors: the client expects `{ error: string, issues? }` and an HTTP status; it throws `ApiRequestError`, shown as a toast.

### 3.3 Auth (demo)
- `/login` lists users (`GET /users`); picking one sets the cookie `rs_user` (`src/lib/session.ts`). The client sends it as header `x-user-id`. The mock route resolves the user from its store (`u-lena`, `u-wei`, `u-jonas`, `u-katrin`, `u-sofia`, `u-daniel`).

### 3.4 The mock backend
- `route.ts` matches method + path against the contract, parses query/body with Zod, calls `handlers[name]({ params, query, body, user })`, validates the response in dev, maps `ApiError(status)` to JSON errors.
- `src/mock/store.ts`: one in-memory `Dataset` (shape = `Dataset` entity) cloned from `fixtures/seed.json`; `audit()`, `notify()`, `nextId()`, `now()`; `POST /admin/reset` restores the seed. Quality checks live in a side map (`checks()`).
- `src/mock/handlers.ts`: one function per endpoint, holding the business rules (section 6).
- `src/mock/scoring.ts`: reference scorer. `src/mock/ai/*`: scripted AI (chat intents, drafts, meeting-note extraction, quality check, segments); `ai/live.ts` optionally calls Claude when `ANTHROPIC_API_KEY` is set (free-form chat, quality-check LLM pass, segment summary). The backend uses OpenAI; after integration the chat should go to the backend RAG agent.
- Seed: `npm run seed` rebuilds `seed.json` from the real CSVs in `docs/02-data/processed/` (404 selected verbatims, study rows, 2030 sales) plus authored synthetic content (people, web signals, competitor facts, decisions, requirements, audit history). Synthetic objects carry `synthetic: true` and the UI tags them.

### 3.5 Running it
```bash
cd web
npm install
npm run dev          # http://localhost:3000, pick a persona
npm run typecheck && npm run lint && npm run build
API_BASE=http://localhost:3000/api npm run contract-test
```

---

## 4. Screens and use cases

Six navigation entries (after Thomas's "less is more"), plus detail pages. Endpoints in `code` are frontend contract names (section 5).

| Screen | Route | What the PM does | Endpoints used |
|---|---|---|---|
| **Login** | `/login` | Pick a persona | `users` |
| **My desk** | `/` | Four cards: agent flags (competitor alerts, @mentions), my cases, review (requirements sent back or in progress; for the head: sign-off and escalations inline), follow-up (answers back, questions due) | `me`, `cases`, `requirements`, `alerts`, `notifications`, `questions`, `referrals`, `decideReferral`, `transitionRequirement` |
| **Inbox** | `/inbox` | Accept or decline referrals from other PMs, see agent flags and notifications | `referrals`, `decideReferral`, `notifications`, `readNotifications`, `cases`, `me` |
| **Cases** | `/cases` | Kanban by state (drag = state change with a reason); "Ranked" toggle shows score order; weights panel with what-if re-ranking and robustness | `cases`, `scores`, `previewScores`, `weightProfiles`, `createWeightProfile`, `updateWorkspace`, `transitionCase`, `me` |
| **Case page** | `/cases/[id]` | Sankey of the evidence (sources → topic × aspect → case), click a node to read quotes. Three steps: ① Evidence, ② Your knowledge (PM context questionnaire, open questions to engineering/finance, paste meeting notes → AI proposals), ③ Requirements (create, open in a side panel). AI colleague chat with citations, proposals, "Ask owners" segment chips. Decide: confirm, refer, innovation pool, park, merge, reject | `caseBundle`, `patchCase`, `transitionCase`, `savePmContext`, `createQuestion`, `patchQuestion`, `addMeetingNote`, `generateRequirements`, `messages`, `postMessage`, `decideProposal`, `caseSegments`, `resolveAlert`, `exportCaseMd`, `taxonomy`, `comments`, `addComment`, `audit` |
| **Requirement** (side panel and `/requirements/[id]`) | | Trace chain, **quality check** (re-run, warns before approval), SMART spec editing (every edit needs a reason), argument sheet for engineering, "Harden with AI" chat, status buttons (discuss, approve, send back, sign off, plan, export, reject, restore) | `requirementBundle`, `patchRequirement`, `transitionRequirement`, `runRequirementCheck`, `messages`, `postMessage`, `decideProposal`, `comments`, `audit` |
| **Vehicle plan** | `/plan/[series]` | Requirements of a series by car area with status filters; today's equipment per area; **Download deck** (engineering round), **Export to Codebeamer** (CSV) | `plan`, `requirements`, `patchPlanFeature`, `requirementDeck`, `exportRequirements`, `me` |
| **Signals** | `/radar` | One Sankey (sources → car areas → cases); click a node to see its signals; start a case from loose signals; Refresh runs the fetch agents (new signals, competitor alerts, dedupe); quarantine popover | `signals`, `cases`, `createCase`, `refresh`, `agentRuns`, `quarantine`, `me` |
| **Innovation pool** | `/innovation` | Ideas parked for a future series; vote; pull into my series as a linked case | `innovation`, `voteInnovation`, `pullInnovation`, `me` |
| **Settings** (persona menu) | `/settings` | Workspace (series, region, project type, source filters, watchlist), weight profiles, brand profile (head) | `me`, `updateWorkspace`, `weightProfiles`, `brandProfile`, `saveBrandProfile` |
| **Audit trail** (persona menu) | `/audit` | Global append-only log, filter people vs AI agents | `audit` |
| Shell | | Notification bell, global search (Ctrl K), persona switch, reset demo data | `notifications`, `readNotifications`, `search`, `reset`, `alerts`, `referrals` |

**Demo storyline** (also in `web/README.md`): Lena's desk → case CASE-G60-0003 Sankey → step ② knowledge → refer CASE-G60-0001 to Jonas (Baukasten) → Jonas accepts in the inbox → meeting note on CASE-G60-0005 → re-rank with weights → Katrin signs off REQ-G60-0004 and resolves an escalation → vehicle plan → deck + Codebeamer export → Signals refresh raises a competitor flag. New this round: "Ask owners" chips (CASE-G60-0012), quality check on REQ-G60-0019.

---

## 5. The frontend REST contract (56 endpoints at the time of writing; 77 today, see `web/src/contracts/api.ts`)

Base `/api`, header `x-user-id`. Full schemas: `web/src/contracts/api.ts` and `entities.ts` (or `contracts/openapi.yaml`). "Backend today" = the closest call on main (section 7), or **none**.

### Identity and workspace
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `me` | GET `/me` | `{ user, workspace, weightProfile }` | GET `/me` (user only; no workspace) + GET `/configs` |
| `users` | GET `/users` | All users (login, avatars) | **none** (only `app_user` table) |
| `updateWorkspace` | PUT `/workspace` | Series, region, project type, weight profile, source filter, watchlist | **none** (closest: PATCH `/configs/{id}` source filter) |
| `search` | GET `/search?q` | Cases, requirements, signals, users | **none** (closest: case board `q`, RAG search) |

### Signals and agents
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `signals` | GET `/signals?series&caseId&agent&market&kind&status&q&limit` | Signal list | GET `/signals` (`{total, items}`, filters differ, paginated) |
| `clusters` | GET `/clusters?series` | Theme clusters (not used by current screens) | none |
| `agentRuns` | GET `/agent-runs` | Recent runs | GET `/runs` |
| `refresh` | POST `/agent-runs/refresh` `{series}` | Run the fetch loop once | **none** (CLI `python -m app.fetch.worker`) |
| `quarantine` | GET `/quarantine` | Rejected signals with reason | GET `/quarantine` (`{summary,total,items}`) |
| `taxonomy` | GET `/taxonomy` | Car areas, topics, aspect groups | GET `/taxonomy` (different field names) |

### Cases
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `cases` | GET `/cases?series&ownerId&state&scope` | Case list | GET `/cases?profile_id=…` (ranked board of one config) |
| `createCase` | POST `/cases` | Start a case from loose signals | **none** (closest: `/cases/{id}/split`) |
| `caseBundle` | GET `/cases/:id` | Case + signals, questions, requirements, referrals, alerts, notes, proposals, linked cases | GET `/cases/{id}` + GET `/signals?case_id=` |
| `patchCase` | PATCH `/cases/:id` | Edit fields/body, watchers, manual rank, brand fit | PUT `/cases/{id}/page`, POST `/cases/{id}/tags`, POST `…/vehicles/{v}/rank` |
| `transitionCase` | POST `/cases/:id/transition` `{action, rationale, toUserId?, mergeIntoId?, horizon?, escalate?}` | State and outcome changes | POST `/cases/{id}/vehicles/{v}/transition` (open/confirm/reject/reopen), POST `/cases/{id}/merge` |
| `createQuestion` | POST `/cases/:id/questions` | Open question to engineering/finance/… | **none** |
| `addMeetingNote` | POST `/cases/:id/meeting-notes` | Paste notes → AI proposals | **none** |
| `savePmContext` | PUT `/cases/:id/pm-context` | Step ② knowledge; AI answers with follow-up questions | **none** |
| `generateRequirements` | POST `/cases/:id/requirements/generate` | Draft requirements from a confirmed case | POST `/cases/{id}/vehicles/{v}/requirements` |
| `exportCaseMd` | GET `/cases/:id/export.md` | Case as markdown + YAML | none (page has `body_md`) |
| `caseSegments` | GET `/cases/:id/segments` | Market / market × powertrain segments with real verbatim counts | **none** |

### Questions
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `questions` | GET `/questions?all` | Open questions (mine) | **none** |
| `patchQuestion` | PATCH `/questions/:id` | Edit or answer | **none** |

### Requirements
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `requirements` | GET `/requirements?series&caseId` | List | GET `/requirements?profile_id=…` (ranked board) |
| `requirementBundle` | GET `/requirements/:id` | Requirement + case, signals, questions, variants, alerts, proposals, planned feature, quality check | GET `/requirements/{id}` (+ case summary, decisions, ranks) |
| `patchRequirement` | PATCH `/requirements/:id` `{patch, rationale}` | Edit SMART fields | PUT `…/page` (body_md), POST `…/retarget`, `…/cost`, `…/rank` |
| `transitionRequirement` | POST `/requirements/:id/transition` `{action, rationale}` | discuss, approve, send_back, sign_off, plan, export, reject, restore | POST `/requirements/{id}/status` (draft/in_discussion/approved/rejected), POST `…/delete` |
| `runRequirementCheck` | POST `/requirements/:id/check` | Quality check (section 6.9) | **none** |

### Scoring
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `scores` | GET `/scores?profileId&series` | Ranked cases (with factor contributions) and requirements | GET `/cases?profile_id` (score, rationale), GET `/cases/{id}` (factors per profile) |
| `previewScores` | POST `/scores/preview` `{weights}` | What-if ranking for unsaved weights | **none** (RAG tool `what_if_weights` only; GET `/configs/{id}/compare` for robustness) |
| `weightProfiles` | GET `/weight-profiles` | Profiles | GET `/configs` (profiles per config) |
| `saveWeightProfile` | PUT `/weight-profiles/:id` | Save | PATCH `/profiles/{id}` |
| `createWeightProfile` | POST `/weight-profiles` | Create | POST `/configs/{id}/profiles` |
| `brandProfile` / `saveBrandProfile` | GET/PUT `/brand-profile` | Pillars, do-nots, notes | GET / POST `/brand-profile` (versioned `body_md`) |

### Routing (collaboration between PMs)
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `referrals` | GET `/referrals` | Referrals and escalations | **none** |
| `decideReferral` | POST `/referrals/:id/decide` | accept / decline / escalate / resolve | **none** |
| `innovation` / `voteInnovation` / `pullInnovation` | GET `/innovation`, POST `/innovation/:caseId/vote`, `/pull` | Innovation pool | **none** |

### Vehicle plan and hand-off
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `plan` | GET `/plans/:series` | Successor plan: features by car area, today's availability, linked requirements | **none** (data: `vehicle_feature`) |
| `patchPlanFeature` | PATCH `/plans/:series/features/:featureId` | keep / new / improve / remove, protect | **none** |
| `exportRequirements` | POST `/exports` `{series, format}` | Codebeamer CSV / JSON; planned → exported | GET `/requirements/export?profile_id&format=csv\|json` (approved top N, logged) |
| `requirementDeck` | POST `/plans/:series/deck` | Slides payload for the engineering-round PowerPoint (rendered in the browser) | **none** |

### Conversation
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `messages` | GET `/threads/:type/:id/messages` | AI chat thread | GET `/chat/{type}/{id}` |
| `postMessage` | POST `/threads/:type/:id/messages` `{content, segment?}` | Ask; returns messages + proposals | POST `/chat/{type}/{id}` `{question}` |
| `decideProposal` | POST `/proposals/:id/decide` `{decision, rationale?}` | Accept / reject a proposal | POST `/chat/messages/{id}/decision` `{accept}` (body diffs only) |
| `comments` / `addComment` | GET/POST `/comments` | Comments with @mentions → notifications | **none** |

### Inbox and oversight
| Name | Method + path | Purpose | Backend today |
|---|---|---|---|
| `notifications` / `readNotifications` | GET `/notifications`, POST `/notifications/read` | Bell | GET `/notifications`, POST `/notifications/{id}/read` |
| `alerts` / `resolveAlert` | GET `/alerts`, POST `/alerts/:id/resolve` | Monitor flags ("competitor raises the bar") | **none** (notifications of type `new_competitor`, `market_conflict` come closest) |
| `audit` | GET `/audit?objectId&actorType&limit` | Global or per-object audit log | GET `/audit/{object_type}/{object_id}`, GET `/audit-chain/{requirement_id}` |
| `portfolio` | GET `/portfolio` | Head overview (not in the nav anymore) | none |
| `reset` | POST `/admin/reset` | Reset mock store | n/a |

---

## 6. Business logic implemented in the frontend mock

These rules live in `web/src/mock/handlers.ts` and `web/src/mock/ai/*`. Whatever replaces the mock must keep them (in the backend, the adapter or the sidecar).

### 6.1 Permissions
- Only the case **owner or a co-owner** (or the head) changes a case; everyone can read, comment, watch, escalate. Only the requirement owner (or head) edits it.
- **Head of product line** (`role = head`) sends back, signs off, resolves escalations, edits the brand profile and default weight profiles.
- Series PMs (plan `ownerIds`) edit the vehicle plan.

### 6.2 Case lifecycle (frontend)
- States: `observed → new → investigating → awaiting_answers → ready → decided`. Actions `open`, `start`, `await`, `ready`, `reopen` move the state; every move needs a rationale.
- Deciding sets `state = decided` and an **outcome**: `confirm` (drafts requirements via the requirement agent if none exist), `refer` (to another PM: creates a `Referral`, the receiver becomes a watcher and is notified), `innovation` (adds to the pool with a horizon and the PM's pitch), `park`, `reject`, `merge` (moves signals into the target, recomputes its figures, notifies the target owner).
- `refer` with `escalate: true` creates an **escalation** to the head instead (anyone involved may escalate, e.g. China vs. rest-of-world conflict).
- Every decision is prepended to the case page's "Decision log" and audited.
- Referral decisions: `accept` creates a **linked case** in the receiver's workspace (`originCaseId`), `decline` puts the source case back to `ready`, `escalate` hands it to the head, `resolve` (head) records a resolution (one market, market variant, keep both, take over, return) in the case context and decision log.

### 6.3 Requirement lifecycle (frontend)
`draft → in_discussion → pm_approved → signed_off → planned → exported`, plus `rejected` (restore → `draft`).
- `approve` (owner, from draft or in discussion) notifies the head with a sign-off request; the open quality-check issues are recorded in the audit event (section 6.9).
- `send_back` (head, from pm_approved) → `in_discussion` with `sentBackReason`, owner notified.
- `sign_off` (head, from pm_approved) → owner notified.
- `plan` (owner/head, from signed_off) links or creates a `PlannedFeature` in the series plan.
- `export` (from planned); the Codebeamer export also moves every planned requirement to `exported`.
- IDs: `REQ-<series>-NNNN`, China variants `REQ-<series>-CN-NNNN`.

### 6.4 Scoring (reference, `mock/scoring.ts`)
- Factors (all 0..1): `customers`, `severity`, `satisfaction_gap`, `competitor_gap`, `market_volume`, `regression`, `trend`, `brand_fit`.
- `case score = Σ w_f · factor_f / Σ w_f` (no cost). `requirement score = case score × costMultiplier[size]`.
- Manual ranks (with reason) win over the computed order. Observed, rejected and merged cases are not ranked.
- `previewScores` re-ranks with unsaved weights; the UI shows "moved because…" and a robustness column (stays in the top 5 under every profile).
- `customers` is recomputed from the case's signals: `log10(1 + n) / log10(61)`.

### 6.5 AI assistant (`mock/ai/chat.ts`, scripted unless a key is set)
Intent by message text; every answer cites evidence as `[SIGNAL-ID]`, and every change is a proposal:
- "research …" → mock research run adds two synthetic web signals to the case (audited as `agent:researcher`).
- "draft a SMART requirement" → `new_requirement` proposal(s) from `ai/drafts.ts`.
- "what should I ask engineering/finance" → `new_question` proposals.
- "why is this ranked so high", "compare the markets", "what do competitors offer", "argument sheet", "set the target to …" (field proposal) → cited answers.
- Free-form questions go to the live LLM when available (context: case, figures, up to 40 signals, page, requirement).
- `savePmContext` stores the PM's market focus, cost sensitivity, positioning, timing and note in the case context, then the assistant posts 1 to 2 follow-up questions the data cannot answer (market mismatch, platform change vs. LCI, paid option vs. standard, match/beat competitors).
- `addMeetingNote` (`ai/notes.ts`) extracts answers to open questions, field updates and decision-log entries from pasted notes as proposals.
- Proposal kinds: `field`, `body`, `question_answer`, `new_question`, `new_requirement`. Accepting applies the change, logs a context entry and an audit event.

### 6.6 Monitoring and refresh
- `refresh` runs once over a pool of authored web findings: new signals attach to their case, owners and watchers are notified, a competitor fact with a metric raises an **alert** ("raises the bar") on the case; a second run finds nothing (dedupe by URL and content hash). An `AgentRun` is recorded.
- `resolveAlert`: dismiss, or `rework` (requirement back to in_discussion, case back to investigating).

### 6.7 Vehicle plan and export
- The plan lists features per car area with today's availability (standard/optional/absent/removed), action (keep/new/improve/remove), release, protected flag and linked requirements.
- Codebeamer CSV columns: ID, Summary, Description, Category, Market, Release, Priority, Score, Evidence level, Metrics, Acceptance criteria, Assumptions, Cost size, Cost band, Linked case, Linked findings, Rationale, Status. Sorted by rank under the user's weight profile.

### 6.8 Engineering deck (`requirementDeck` + `web/src/lib/deck.ts`)
Signed-off, planned and exported requirements of a series, sorted by rank. Per slide: SMART text and metrics, top 3 BMW complaint quotes (not likes), score breakdown (factor value × normalized weight), competitor gap, last 5 decisions (requirement and case), open quality issues. Rendered client-side with `pptxgenjs`. Easy to rebuild on real data: it only needs requirement, case factors + weights, case signals and decisions.

### 6.9 Quality check (`mock/ai/quality.ts`)
Runs automatically after drafting and every edit, and on demand. Warns, never blocks; approving lists the open issues and requires a reason.
- `vague_word` (title, description, acceptance criteria: "improved", "better", "user-friendly", "intuitive", "seamless", …; red if no metric has a numeric target).
- `missing_scope` (scope global while > 80 % of the case's verbatims come from one market; China scope with < 3 Chinese verbatims).
- `out_of_scope` (homologation, type approval, UN-R, ISO 26262, emissions, crash test, ECU, CAN bus, supplier, part number, price/pricing, business case) — red.
- `duplicate` (≥ 30 % word overlap with a live requirement of the same series, red) / `baukasten` (same in another series, or the case spans several series, amber, suggests the cross-series PM).
- `conflict` (same metric question with another target in the same car area; or relies on a feature the plan removes).
- Optional LLM pass adds issues of the same kinds (strict JSON, related IDs validated).
Portable as-is: inputs are a requirement, its case figures, all requirements and the plan. Could later move to Python next to `requirements/service.py`.

### 6.10 Ask the segment (`mock/ai/segment.ts`)
- Segments = markets of the case (+ market × powertrain with ≥ 3 verbatims), counted **only from real BMW verbatims** (no synthetic, no web).
- With verbatims: counts by kind + 3 to 5 strongest quotes, cited. Live LLM gets only that segment's quotes and must summarize in the third person; citations not in the set are dropped.
- Without verbatims: "No evidence for China owners", the closest segment with data, and a `new_question` proposal to the market PM. Never a guess.
- On real data: segments come from `GET /signals?case_id=…` filtered by `evidence_role = bmw_customer` (or `source_id = bmw_feedback`), grouped by `market` and `powertrain`.

### 6.11 Audit actions written by the mock
`case.created/edited/state_changed/decided/pm_context_saved/exported_md`, `requirement.drafted/edited/status_changed/checked/deck_exported`, `requirements.exported`, `proposal.accepted/rejected/created`, `question.created/answered/edited`, `meeting_note.added`, `referral.*`, `escalation.*`, `alert.*`, `plan.feature_*`, `signals.fetched/researched`, `segment.asked`, `comment.added`, `weight_profile.*`, `brand_profile.updated`, `workspace.updated`. Actor = user id or `agent:<name>`.

---

## 7. The backend on `main` (what exists)

**Stack:** Python 3.12, FastAPI, psycopg, Supabase Postgres + pgvector (local embedded Postgres for dev), OpenAI (chat + embeddings; key still missing → offline fallbacks), `uv`.

**Run:**
```bash
cd backend
cp .env.example .env          # Supabase URL/keys or leave empty for local; AUTH_MODE=dev for X-User-Id
uv run python -m app.demo build --fresh   # local DB: migrate, seed, cases, scores, RAG, demo users (~10 min)
uv run python -m app.demo users           # prints demo user ids
uv run uvicorn app.main:app --reload      # http://localhost:8000/docs
```
CORS already allows `http://localhost:3000`.

**Auth:** `AUTH_MODE=dev` → header `X-User-Id: <app_user uuid>`; production → `Authorization: Bearer <Supabase JWT>`. Demo users (fixed ids):
`00000000-0000-4000-8000-000000000001` Demo PM 5 Series (`pm`, `[G60]`), `…0002` PM 7 Series (`[G70]`), `…0003` PM 1 Series (`[F70]`), `…0004` engineer, `…0005` admin. Roles: `pm`, `engineer`, `admin`; a PM acts only on the lines in `app_user.vehicles` (empty = all).

**Core concepts that differ from the frontend:**
- **Config** = one PM view: vehicle × market (`G60 / USA`). Each config has several **weight profiles**; scores and ranks exist **per profile**. Boards always need `profile_id`.
- **Case is not tied to one vehicle**: `case_item` (topic + aspect group, page `body_md` with `body_version`, figures per vehicle × market × powertrain, brand fit, segment) and `case_vehicle` (per line: state `observed | open | confirmed | rejected`, opened-by rule, market conflict, release fit, manual rank, new-evidence flag). Case IDs `CASE-0012`.
- **Requirement** is a page: `title`, `body_md` (+ version, stale saves → 409), `metric_target` (jsonb), `acceptance_criteria`, `assumptions`, `release_target` (`next_gen | current_car | ota`), `evidence_level` (`bmw_data | web | assumption`), `cost_size` + `cost_source`, status `draft | in_discussion | approved | rejected | deleted` (tombstone). IDs `REQ-G60-0012` (number = case number), `REQ-G60-USA-0012` when split per market. Generated when the PM confirms the case for a line.
- **Scoring:** factors `distinct_customers, severity, satisfaction_gap, competitor_gap, market_volume, removed_vs_predecessor, reach, trend`; `score = brand_multiplier × Σ w·f / Σ w` (brand fit is a **multiplier** `fits 1.0 / neutral 0.8 / off_brand 0.5`, not a factor); requirement rank = case score × cost multiplier (`S 1.0, M 0.85, L 0.7`; missing cost = 1.0). Manual ranks first; `score_moved` flag when a score changes by ≥ 0.1.
- **RAG sidebar agent:** hybrid search (full text + pgvector), tools `search_signals, get_case, get_requirement, score_breakdown, compare_markets, what_if_weights, propose_edit`; citations `[signal:<uuid>]` must have been retrieved, else "No evidence found in the stored sources."; edits are a proposed page diff accepted via `/chat/messages/{id}/decision`.
- **Signals:** uuid ids, `record_id` → `source_record` (exact quote checkable), `evidence_role` (`bmw_customer | competitor | market`), `kind`, `severity`, topic (`feature`), `aspect_group`, `car_area[]`, `market` (`USA | China | Europe | Rest of World | unknown`), `powertrain`, `scope_tag`, `validation` (`valid | quarantined | deleted`).
- **Audit:** `audit_event` append-only (`actor` like `pm:<uuid>`, `agent:rag`, `seed:…`), `decision` table for PM actions, `page_version` for page history, `log_access` for views and exports.

**Endpoints (about 50):** see the table in `backend/API.md`. Highlights the UI does not use yet: case page versions and stale-save protection, merge/split, tag overrides (brand fit, segment, release fit), predecessor research, profile compare (robust top N), config source filter, quarantine release/delete, taxonomy review queue, audit chain report per requirement, overview map per line, signal detail with its source record.

---

## 8. The gap and the recommended plan

### 8.1 Vocabulary mapping (adapter must translate both ways)

| Concept | Frontend | Backend |
|---|---|---|
| Market | `EU`, `US`, `CN`, `RoW`, `unknown` | `Europe`, `USA`, `China`, `Rest of World`, `unknown` |
| Requirement scope | `marketScope`: `global` \| `RoW` \| `CN` | `market`: null (all) or one market when split |
| User role | `vehicle_pm`, `attribute_pm`, `head` | `pm` (lines in `vehicles`), `engineer`, `admin` |
| User id | `u-lena` … | uuid (`00000000-0000-4000-8000-00000000000X`) |
| Case id | `CASE-G60-0001` | `CASE-0012` (opaque string either way; UI only displays it) |
| Case series | `series` + `relatedSeries` | `case_vehicle` rows (series = the current config's vehicle, related = the others) |
| Case state | `observed, new, investigating, awaiting_answers, ready, decided` + outcome | per vehicle `observed, open, confirmed, rejected` (+ `case_lineage` for merges) |
| Requirement status | `draft, in_discussion, pm_approved, signed_off, planned, exported, rejected` | `draft, in_discussion, approved, rejected, deleted` |
| Release | `next_gen`, `lci`, `ota` | `next_gen`, `current_car`, `ota` |
| Evidence level | `high, medium, low, assumption` | `bmw_data, web, assumption` |
| Score factors | `customers, severity, satisfaction_gap, competitor_gap, market_volume, regression, trend, brand_fit` | `distinct_customers, severity, satisfaction_gap, competitor_gap, market_volume, removed_vs_predecessor, reach, trend` + brand **multiplier** |
| Cost source | `option_price, ai_estimate, pm, finance` | `option_price, ai_estimate, pm, engineering` |
| Weight profile | per user workspace, global | per config (vehicle × market) |
| Brand profile | `pillars[]`, `doNot[]`, `notesMd` | versioned `body_md` |
| Citations in chat | `[G60-1430]`, `[SIG-…]` (UI links them) | `[signal:<uuid>]` |
| Proposals | own entity, 5 kinds | `chat_message.proposed_diff` (page body diff) only |
| Signal source | `agent` + `sourceType` + `trust` | `evidence_role` + `source_record.source_id` / `content_type` / `category` |
| Taxonomy payload | `{version, carAreas[{id,label,description}], topics[{id,label,shortLabel,carArea,hint}], aspectGroups[{id,description}]}` | `{car_areas[{code,name,description}], aspect_groups[{code,description}], topics[{id(uuid),topic_id,name,car_area,hint}]}` |

### 8.2 Feature coverage

| Area | Backend has it | Missing on the backend (needs sidecar or a backend extension) |
|---|---|---|
| Signals, quarantine, taxonomy, runs | yes | trigger a fetch run from the UI (`refresh`), `trust` tier, `agent` label |
| Case board, page, scores | yes (per profile) | owner / co-owners / watchers, the finer workflow states (investigating, awaiting answers, ready), outcomes refer / innovation / park, `highlights`, PM context, create a case from loose signals, what-if preview endpoint |
| Requirements | yes (page-based) | structured SMART fields edit (`metrics[]` with basis/benchmark, acceptance criteria, assumptions, marketScope) as an endpoint; head sign-off, plan and export statuses; send back reason; owner |
| Chat | yes (RAG, cited, page diffs) | proposals other than page diffs (new question, new requirement, field), research runs, PM-context follow-ups, segment mode |
| Collaboration | notifications, decisions, audit per object | users list, open questions, meeting notes, referrals and escalations, innovation pool, comments + mentions, alerts with resolve, global audit list, search |
| Vehicle plan | today's equipment in `vehicle_feature` | plan features (action, protected, release), plan endpoints, Codebeamer CSV in the UI's column set, deck payload |
| Quality check, segments | — | both (frontend logic is portable, section 6.9 / 6.10) |

### 8.3 Options

1. **Adapter / BFF in Next.js (recommended).** Keep the UI and its contract. Add backend-backed handlers next to the mock handlers, same `Handlers` type, choose per endpoint. UI-only collaboration objects live in a sidecar store keyed by real backend IDs. Pros: zero UI churn, contract test still guards the shapes, instant fallback to the mock for the demo, backend unchanged. Cons: mapping code; sidecar is in-memory until persisted.
2. **Implement the frontend contract in FastAPI** (a new `ui` router that serves `contracts/openapi.yaml`, plus tables for the missing features). Cleanest long-term, everything audited in Postgres; more Python work and riskier before a demo.
3. **Rewrite the UI against `backend/API.md`.** Most churn; loses features the backend lacks.

A good path: start with option 1 now, and move pieces into the backend (option 2) when they stabilize (users list, statuses, structured requirement patch, questions, referrals).

### 8.4 Step-by-step plan (option 1)

**Step 0 — Branch and run both.**
- Merge PR #5 (or merge `main` into `feature/frontend-demo` again: `main` gained phases 7 to 10 after the PR was opened). Work on a new branch `feature/integration`.
- Run the backend locally (`AUTH_MODE=dev`, `python -m app.demo build --fresh`, uvicorn on :8000) and the web app (:3000).

**Step 1 — Plumbing.**
- `web/.env.local`: `DATA_SOURCE=backend`, `BACKEND_URL=http://localhost:8000`.
- New folder `web/src/backend/`:
  - `client.ts`: server-side `fetch` to `BACKEND_URL` with `X-User-Id` (or Bearer), JSON errors → `ApiError(status, detail)` (FastAPI errors are `{detail}`).
  - `map.ts`: all vocabulary mappings of 8.1, in both directions, unit-tested.
  - `handlers.ts`: `Partial<Handlers>` implemented against the backend.
  - `sidecar.ts`: in-memory store for UI-only objects (questions, meeting notes, PM context, referrals, innovation, plan features, comments, alerts, proposals of non-diff kinds, owner/workflow state, quality checks), keyed by backend IDs; reuse `mock/store.ts` helpers.
- `route.ts`: pick `backendHandlers[name] ?? mockHandlers[name]` when `DATA_SOURCE=backend`; keep the mock as the default.
- **Users and personas:** keep the persona UX. Map personas to backend users with a table in the adapter (e.g. Lena → `…0001` PM 5 Series; Daniel → `…0002`; Sofia → `…0003`; Katrin → `…0005` admin acting as head; Jonas → a PM with all lines; Wei → a second 5 Series PM, needs a new `app_user` row). `users` returns the persona list with backend ids attached.
- **Config choice:** each persona needs a config (vehicle × market) and default weight profile from `GET /configs`. Proposal: Lena → `G60 / USA` (most G60 verbatims are US), Wei → `G60 / China`, Sofia → `F70 / Europe`, Daniel → `G70 / USA`; `updateWorkspace` switches config/profile. `me.workspace.weightProfileId` = that profile id.

**Step 2 — Read path (what the screens show).**
- `taxonomy`, `quarantine`, `agentRuns`, `notifications` (+ `readNotifications` by looping ids): pure mapping.
- `cases`: `GET /cases?profile_id=<workspace profile>&state=observed&state=open&state=confirmed&state=rejected` → map each board row to a full `Case` (fill fields the board lacks with defaults or a per-case `GET /cases/{id}` when needed; owner from sidecar, default = the persona of the config). `figures.perMarket` from `markets` (customers, negative share).
- `caseBundle`: `GET /cases/{id}` + `GET /signals?case_id=…&limit=500` (+ sidecar questions, referrals, alerts, notes, proposals). Map `figures.by_vehicle[vehicle]` to `figures.perMarket`, `scores[]` of the current profile to `factors`, `decisions` + `body_md` to the page.
- `signals`: `GET /signals` with mapped filters; map `id` (uuid), `market`, `kind`, `severity`, `quote`/`quote_en`, topic, aspect group, car area, `source_id`/`content_type` → `sourceType`/`agent`, `evidence_role = bmw_customer` → `agent = bmw_data`, `synthetic = false`. Pagination: the Sankey needs aggregates, not 13,000 rows (see section 9).
- `requirements` / `requirementBundle`: `GET /requirements?profile_id=…&status=…` and `GET /requirements/{id}`; map `metric_target`, `acceptance_criteria`, `assumptions`, `release_target`, `evidence_level`, `cost_*`, `market` → `marketScope`; the sidecar adds the signed-off / planned / exported layer, owner and quality check.
- `scores`: build `ScoresResponse` from the board rows (score, rank) and the per-profile factor breakdown of `GET /cases/{id}` (`scores[].factors[f].contribution`), or add a backend endpoint returning factors on the board.
- `weightProfiles`: profiles of the persona's config (`GET /configs`), factor names mapped; `brand_fit` slider ↔ brand multipliers (decision needed, 8.5).
- `audit`: per object → `GET /audit/{object_type}/{object_id}` (map `actor` `pm:<uuid>` → persona id); global list → needs a backend endpoint (or merge per-object calls for the current case and requirements).
- `brandProfile`: backend `body_md` → `notesMd`; pillars from the sidecar or parsed headings.

**Step 3 — Write path.**
- `transitionCase`: `confirm | reject | reopen | open` → `POST /cases/{id}/vehicles/{vehicle}/transition` (vehicle = the persona's line); `merge` → `POST /cases/{id}/merge {target_id, rationale}` (backend refuses cross-topic merges); `start | await | ready | refer | innovation | park` and escalations → sidecar (backend state stays `open`). After confirm, the backend returns the generated requirement ids.
- `generateRequirements` → `POST /cases/{id}/vehicles/{vehicle}/requirements`.
- `patchCase`: `bodyMd`/`title` → `PUT /cases/{id}/page` with `expected_version = bodyVersion` (409 → toast "someone saved first, reload"); `brandFit` → `POST /cases/{id}/tags {field: "brand_fit", …}` (map 0..1 → fits/neutral/off_brand); `manualRank` → `POST …/vehicles/{v}/rank`; watchers / co-owners → sidecar.
- `transitionRequirement`: `discuss` → status `in_discussion`, `approve` → `approved`, `reject` → `rejected`, `restore` → `draft`; `send_back | sign_off | plan | export` → sidecar layer on top of backend `approved` (or extend the backend status flow, 8.5).
- `patchRequirement`: `releaseTarget` → `/retarget`, `cost.size` → `/cost`, `manualRank` → `/rank`, everything else (title, description, metrics, acceptance criteria, assumptions, scope) → render into `body_md` and `PUT /page` with the version, or add a structured PATCH on the backend (preferred, 8.5).
- `postMessage` (no segment) → `POST /chat/{type}/{id} {question}`; map the agent row to `ChatMessage` (rewrite `[signal:<uuid>]` to `[<uuid>]` and fill `citations` from `cited_signals`); a `proposed_diff` becomes a `Proposal { kind: "body", id: <message id> }`. `decideProposal` on such an id → `POST /chat/messages/{id}/decision {accept}`; other proposal kinds stay in the sidecar/scripted flow.
- `postMessage` with `segment` and `caseSegments`: compute in the adapter from the case's real signals (port of `mock/ai/segment.ts`).
- `exportRequirements`: map to `GET /requirements/export?profile_id=…&format=csv` or build the UI's Codebeamer CSV from the requirements (the backend export is "approved top N" only; it logs the export in `decision` and `audit_event` either way).
- Weight profiles: `createWeightProfile` → `POST /configs/{id}/profiles`, `saveWeightProfile` → `PATCH /profiles/{id}`; `previewScores` → recompute in the adapter from stored factor values (`score = brand × Σ w·f / Σ w`) or add a backend preview endpoint.

**Step 4 — UI-only features on real data (sidecar).**
Open questions, meeting notes (+ `ai/notes.ts`), PM context (+ follow-ups), referrals / escalations, innovation pool, comments + mentions, alerts, vehicle plan (seed today's equipment from backend `vehicle_feature` once an endpoint exists), quality check (`ai/quality.ts` on mapped requirements), deck (`requirementDeck` on mapped data), search (combine backend board `q` and sidecar). Persist the sidecar later as backend tables (option 2).

**Step 5 — Verify.**
- `npm run contract-test` with `API_BASE=http://localhost:3000/api` and `DATA_SOURCE=backend` (parametrize the IDs: pick the first open case and a confirmed one from the board instead of `CASE-G60-0001`).
- Backend: `uv run pytest` and `uv run python -m app.demo e2e "G60 / USA"`.
- Click through the demo storyline with real data; check the audit trail shows backend events (actor `pm:<uuid>`).

### 8.5 Decisions the team must make

1. **Which data source per screen for the demo** (real where it exists, sidecar for the rest, or full mock as fallback)? Recommendation: real for signals, cases, scores, requirements, chat, audit; sidecar for collaboration.
2. **Persona ↔ backend user ↔ config mapping** (8.4 step 1). Do we keep the six named personas on real data?
3. **Requirement statuses:** extend the backend flow with `signed_off` (head) and `planned`/`exported`, or keep them as a frontend layer? Recommendation: extend the backend (two statuses + who may set them), small change in `requirements/service.py` and the check constraint.
4. **Structured requirement editing:** add `PATCH /requirements/{id}` for metrics, acceptance criteria, assumptions, scope (audited like the rest), or keep editing the page markdown only?
5. **Brand fit:** factor (frontend) or multiplier (backend)? Recommendation: follow the backend (multiplier); the weights panel hides the `brand_fit` slider and shows the brand-fit tag instead; add `reach` as a slider.
6. **Case workflow:** do the frontend sub-states (investigating, awaiting answers, ready) and outcomes (refer, innovation pool, park) become backend concepts? Recommendation: store them in the sidecar first; later a `case_vehicle.workflow` column + `referral` and `innovation` tables.
7. **Chat:** backend RAG agent for free-form questions (OpenAI key needed), keep the scripted flows (draft requirement, questions for engineering, segment mode) in the adapter?
8. **Which ID the UI shows for signals:** uuid, or the readable `record_id` (`bmw_feedback-G60-0001`, matching the old `G60-0001` style)?

---

## 9. Gotchas

- **Scale.** The mock has 28 cases and ~500 signals; the backend has 1,206 cases (376 opened by rule per line pair), ~13,000 valid signals. The case board should show `open` + `confirmed` by default (backend default) and the Sankey needs aggregated counts (sources × car areas × cases) rather than every signal: add an aggregate endpoint or compute from `GET /cases?profile_id` (per-case `source_types`, `markets`, `distinct_customers`).
- **"Invalidate everything after a mutation"** (`hooks.ts`) re-fetches all active queries; with real data, narrow it to the affected keys if screens get slow.
- **Stale saves:** backend returns 409 when `expected_version` is old; the UI must reload the page instead of overwriting.
- **Per-vehicle actions:** every case action on the backend needs the vehicle (`/vehicles/{vehicle}/…`). Use the persona's config vehicle; Baukasten cases appear for several lines and each line decides separately.
- **Permissions differ:** backend lets any PM of one of the case's lines act; the frontend uses owner/co-owners. Until owners exist in the backend, check ownership in the adapter (sidecar) before calling.
- **Market labels:** `Rest of World` has spaces; URL-encode it in query strings.
- **Citations:** the UI's markdown turns `[ID]` into clickable links that open the signal on the case page. Backend signal ids are uuids, and the case page must be able to find them (the signals of the case must be loaded with the same ids).
- **Real data has no Chinese verbatims** for G60/G70 feedback (US-heavy). The UI says so honestly; keep that (segment chips show `China (0)`).
- **LLM keys:** backend needs `OPENAI_API_KEY` for the RAG agent's LLM mode and the classifier (2,557 signals still unclassified); without it the agent answers extractively with citations. The frontend's optional live features use `ANTHROPIC_API_KEY`.
- **`docs/` vs `All-context/`:** the frontend branch still has `docs/` (seed script reads `docs/02-data/processed`); `main` uses `All-context/02-data-provided-by-pm/processed`. Point `web/scripts/seed.ts` at `All-context` when `docs/` is removed.
- **Synthetic labels:** real backend objects are not synthetic; personas, sidecar content and demo decisions are. Keep the `synthetic` flag honest in the mapping.

---

## 10. Quick reference: where to look

| Need | File |
|---|---|
| Frontend endpoint list and schemas | `web/src/contracts/api.ts`, `entities.ts`, `enums.ts` (or `contracts/openapi.yaml`) |
| Frontend business rules | `web/src/mock/handlers.ts`, `web/src/mock/scoring.ts`, `web/src/mock/ai/*` |
| Where the data source is chosen | `web/src/app/api/[...path]/route.ts`, `web/src/lib/api/client.ts` |
| Demo storyline and personas | `web/README.md`, `web/src/mock/authored/*` |
| Backend API guide | `backend/API.md`, `backend/app/api/routers/*.py`, `http://localhost:8000/docs` |
| Backend data model and rules | `database-design.md`, `data-model.mmd`, `CLAUDE.md` |
| Backend decisions and progress | `plan.md`, `changes.md` |
| Taxonomy | `taxonomy/README.md`, `taxonomy/taxonomy.json` |
| Meeting feedback that shaped the UI | `All-context/03-meetings-with-pm/` (Thomas demo feedback, PM interviews) |
