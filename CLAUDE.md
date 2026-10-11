# BMW Product Management Challenge (TUM.ai Hackathon Final)

## Mission
The app is called **Argon**; its AI assistant (the RAG sidebar agent, buttons "Ask Argus") is **Argus**.

Build an AI-powered platform that helps BMW product managers (PMs) derive, justify and prioritize **customer-facing requirements for the successor** of an existing vehicle line, 3 to 5 years ahead. It ingests BMW data plus web research, turns it into cases (problems) and requirements (solutions), prioritizes them with explainable logic, keeps the PM in control, and records everything in an audit trail.

The platform is generic: vehicle and market are configuration. The demo shows at least one derivative in one market.

BMW values: trustworthy sources, transparent reasoning, thoughtful prioritization, clear handling of uncertainty and conflicting evidence, evidence vs. assumption made explicit.

## Scope
**In:** features, equipment, comfort, space, usability, infotainment and digital services, design and quality perception, driving experience, range and charging as experienced by the customer, variant and package offering.
**Out:** regulatory / homologation, technical / engineering specs, pricing and business case (cost or effort only as a rough prioritization factor).

## Deliverables
1. Concept + demonstrable prototype.
2. Sample requirement list. Each requirement: unique ID, clear actionable description, linked signals and sources, priority / score, prioritization rationale, evidence level, future-facing assumptions and uncertainties, decision status.
3. End-to-end workflow: what the AI does autonomously, where human review is mandatory.
4. Audit trail: source, signal, consolidation, scoring, prioritization, human decision. Records changes to content, scores, priorities, evidence and status with actor (AI or human), timestamp and rationale.

## Repository map
- `README.md`: short project overview.
- `plan.md`: approved implementation plan (phases 0 to 10). Progress table and open issues at the top.
- `architecture.mmd`: target architecture (Mermaid). **Source of truth for the pipeline.**
- `database-design.md`: database design (tables, columns, rules) for Supabase Postgres + pgvector. **Source of truth for tables and fields.**
- `data-model.mmd`: diagram of `database-design.md` (Mermaid ER).
- `changes.md`: every decision changed during implementation, with reason and who decided.
- `taxonomy/`: the fixed taxonomy (11 car areas, 219 topics, 11 aspect groups), its build script and the classifier eval. **Source of truth for the classification.** Only a human changes it.
- `backend/`: the brain (FastAPI, migrations in `backend/supabase/migrations/`, tests in `backend/tests/`). Run tests with `cd backend && uv run pytest` (embedded local Postgres, no network).
- `backend/reports/`: generated reports (clustering thresholds, fetch plan, end-to-end runs with audit chains).
- `backend/API.md`: how the UI calls the API (auth, errors, main flows); the OpenAPI spec at `/docs` is the contract.
- `web/`: the UI (Next.js). Its REST contract is `web/src/contracts`; `web/src/backend` is the adapter that serves this contract from the API (`DATA_SOURCE=backend`), `web/src/mock` the synthetic demo data (default, offline fallback). The two are never mixed.
- `HANDOFF.md`: state of the work, decisions of the last session, what is not verified, what to do next. Read after this file.
- `INTEGRATION-GUIDE.md`: the gap analysis between UI and backend. Finished; kept as a record.
- `layers.mmd`: BMW's process slide as a diagram, for reference only (not our architecture).
- `docs/README.md`: index of all material. Read first.
- `docs/01-challenge/`: briefing, mission sheet, BMW process slides (md transcriptions + original PDF/PNG).
- `docs/02-bmw-data/raw/`: provided data. Its `README.md` documents columns, counts and caveats.
- `docs/03-meetings/`: meeting summaries and notes, transcripts in `raw/`. **The two PM interviews are the primary user research.**
- `docs/04-team-notes/`: early brainstorm (superseded by the architecture where they differ), original in `raw/`.
- `docs/05-web-sources/fetching-sources.md`: web sources, fetch order and record format for the fetch agents (owned by a teammate).
- `docs/06-solution-concept/`: solution concept from the UI side (scope, end-to-end flow, UX and collaboration, web loop).
- `docs/design/`, `docs/ux-audit/`, `docs/assets/`: brand marks, restyle references, UX audit, README images. `docs/archive/`: superseded versions.
- Until 2026-10-11 this material was split between `All-context/` and `docs/`; it is now one `docs/` folder. Older entries in `changes.md` and `INTEGRATION-GUIDE.md` still use the old paths.

## Provided data (short)
| Dataset | Vehicles | Key facts |
|---|---|---|
| Customer feedback (xlsx, 3 files) | F70 1 Series, G60 5 Series, G70 7 Series | Free-text English verbatims, classified by type (Likes, Difficult to Use, Defect, Wants) and topic. One row per topic, so count unique IDs. F70: 2,128 verbatims, UK/JP, ICE only. G60 and G70: 4,000 each, ~90% US, ICE/PHEV/BEV. Sources A to D differ in style (source C has only pain points, source D is unclassified). Some BMW topic labels are wrong. No dates. |
| Customer study 2025 (xlsx) | all, incl. G68 (China 5 Series) | `CN_EU_2025`: mean scores (10-point) per category. `US_2025`: G60/G70 only, ~100 attributes as 7-level rating distributions. Not directly comparable. No sample sizes. |
| Sales volumes (xlsx) | all | EU / CN / US / RoW for 2024, 2025, 2030 forecast. F70 not sold in CN or US. No powertrain split. RoW values for F70 and G60 identical (likely placeholder). |
| Option lists (PDF, German) | F70, G60, G70 | German market, July 2026. Encrypted: `pypdf` + `reader.decrypt('')`. Equipment x variant grid (■ standard, □ optional); plain text extraction loses the columns. Baseline of what the car offers today. |

Competitors and 3-to-5-year trends come only from web research, labelled as external or assumption.

Environment note: system Python 3.12 has `pypdf`; `pandas` is broken (numpy ABI mismatch) and `openpyxl` is missing. Use a project venv for implementation. The xlsx files use inline strings (no sharedStrings part).

## User insights (PM interviews, team meetings, lifecycle voice note)
- PMs today use benchmarking, customer studies, social listening, sentiment reports and car clinics. Tools: Excel, PowerPoint, Jira, Confluence, SharePoint. **Research is the bottleneck.**
- Funnel: see everything first, then narrow down. Handover is roughly the **top 10 requirements to engineering via codebeamer**, each with arguments: customer complaint, customer wish, competition, then rough cost / sellability.
- Prioritization signals: number of mentions (not enough alone), functional complaints weigh heavily, features removed vs. predecessor, cost, competitor offering, segment fit (base, premium, luxury).
- The PM sets priorities (e.g. speed vs. comfort vs. budget) and wants to see how the ranking changes and which items stay on top regardless.
- Reach is not relevance: one influencer is one opinion. Brand fit filters off-brand wishes. BMW identity: sporty, driving dynamics, design, efficiency; no single documented source of truth for brand taste.
- Markets are separate worlds (China, US, Middle East have their own PMs). Market conflicts must be shown with statistics, never decided by the AI.
- PMs want to skip sources (e.g. social media users who are not the target audience).
- Cars evolve, they are not reinvented. A new model fixes predecessor complaints and adds a few innovations; innovation comes mostly from competitors, other industries and suppliers.
- Lifecycle: a new generation can change everything; a mid-life update (~year 3) only small things (colours, rims, options). Too big for an update means next generation, not "no".
- No black box: every proposal shows source type, market and evidence. AI proposes, PM decides. Agents flag, never overwrite.
- Target vision: one shared platform for all PMs (same baseline and logic), several PMs can work on it. It is a PM tool; engineering feasibility is the next scope.
- Main competitors: German premium (above all Mercedes) and Chinese brands (e.g. Xiaomi).

## Core concepts: Signal, Case, Requirement
Chain: **Signal → Case (problem) → PM confirms → Requirement (solution) → PM approves → engineering.** Every step is logged with actor, timestamp, before/after and rationale.

**Signal** (every piece of evidence; formerly called "finding"): one statement about one feature from one source record (a customer verbatim, a review sentence, a competitor fact, a trend). Versioned JSON with exact quote (must be found in the stored source record), short English summary (≤ 20 words), market, topic, aspect group, car area, vehicle role, author hash and reach. Invalid signals go to a visible quarantine.

**Fixed taxonomy (`taxonomy/`).** Every signal carries three closed facets; agents can only pick from BMW's own labels and never invent a theme:
- **Topic** (219, BMW's VFC level 2). The topic is the feature: one `feature` row per topic. It is the hidden link to equipment, study and cost.
- **Aspect group** (11, grouped from VFC level 3): function, usability, reliability, performance, efficiency_range, design, comfort, space, quality, sound, price. Neutral, so likes and complaints share a group. `price` is tagged out of scope and stays visible.
- **Car area** (11): what the PM sees and filters by. Always derived from the topic in code, never predicted.
- BMW rows get topic and aspect group by lookup from their VFC labels; rows labelled `no_class_found` or general enquiry are classified from the text. Web signals: the LLM picks from the closed lists (strict enums).
- `other` is the only way out: it goes to a review queue (`taxonomy_proposal`) and no topic is ever created automatically.

Competitor signals (e.g. complaints about the E-Class) attach to the BMW case of the same feature as competitor evidence; they feed the competitor gap and never count as BMW customers.

**Case = a problem, composed of a group of signals.** One topic and one aspect group, as customers and the market see it: what is wrong, missing or valued. Never what to build. Each case sits under one topic and so under one car area; a car area holds many cases.
- Example: "Front seat ventilation too weak" (topic: Seats, ventilate / heat; aspect group: performance; car area: Seats).
- Usually groups many signals, each linked to its quote and source.
- Holds all opinions (complaints, wishes, likes), counted per market and powertrain, so market conflicts become visible.
- **Not tied to one vehicle.** A problem can come from several BMW lines and series (shared Baukasten features, the My BMW app). The vehicles it applies to are tags (`case_vehicle`); lifecycle state, PM rank and release fit are per vehicle, because each line has its own PM. Case IDs carry no vehicle (`CASE-0012`); the table is `case_item` (`CASE` is reserved in SQL).
- **Owned per line.** A case has an owner, co-owners and watchers per line. Only the owner, a co-owner or the head of product line changes it; the first PM who works an unowned case becomes its owner; anyone may escalate to the head. Handing a case to another PM or pulling it from the innovation pool never copies it: the same case then applies to the receiver's line.
- Card texts written with the page: a short title (2 to 4 words), a summary and three highlights (problem, who, competition). AI tags also cover case type and change depth.
- Figures: distinct customers, reach (capped), study satisfaction, equipment today (standard / optional / absent), competitor offer, trend.
- Tags: vehicles, scope, brand fit, segment (AI proposes, PM can override).
- **No cost.** A problem has no cost.
- Importance score from case factors weighted by the PM's weight profile; PM can override the rank by dragging, with a reason.
- Lifecycle (per vehicle): **observed** (auto-clustered, overview map only) → **open** (threshold reached: enough distinct customers, a defect, a competitor gap or a removed feature; or opened by the PM) → **confirmed** or **rejected** by the PM after meetings and discussion. Rejected cases stay with their reason.
- While a case is open the PM moves it through a **workflow** step (new, investigating, awaiting answers, ready). The PM's decision is the **outcome**: confirmed, rejected, merged, or, with the case staying open, referred to another PM, sent to the innovation pool or parked.
- Notion-like page (markdown body + structured fields) with a RAG sidebar agent that discusses, cites sources and proposes edits as diffs the PM accepts or rejects.
- After confirmation the daily loop still attaches new signals, but the case never changes by itself; it gets a flag ("+40 complaints since confirmation").

**Requirement = the answer to a confirmed case.** What BMW will build or change, customer-facing and measurable, no engineering specs.
- Generated by the requirement agent only after the PM confirms a case. In the UI the PM first answers at most three shape questions (scope, benchmark, release, solution, offer); the agent drafts with the PM's context: the series brief (layer 1), the stance on the case (layer 2), the shape answers (layer 3). Feedback from engineering or finance (layer 4) leads to a proposed new version.
- Structured fields are the source of truth (short title, description by sentence, metrics with basis and benchmark, acceptance criteria, assumptions, scope, release, cost); the page is rendered from them. Every part carries its provenance: evidence (with signal IDs), PM context (with the layer) or assumption. Every content change is a numbered version with its cause.
- One per confirmed case and BMW line (`REQ-G60-0012`). Several only when markets differ clearly: then one per market (`REQ-G60-USA-0012`).
- Content: description; metric and target based on today's value (seed) and competitor values; acceptance criteria; release target (next generation, current car update, OTA software); assumptions and uncertainties; evidence level (BMW data / web / assumption, display only, not in the score); link to its case and through it to every signal and source.
- **Cost lives here**: option price if it exists, else an AI estimate S / M / L; PM and engineers edit it.
- Editable with engineering: PM and engineers edit, re-target or delete (delete = tombstone in the audit log). Same Notion-like page with RAG sidebar.
- Rank = case score x cost multiplier (S 1.0, M 0.85, L 0.7); PM can override by dragging.
- Status flow: draft → in discussion → approved (by the PM) → signed off (by the head of product line, who can also send it back) → planned (on the vehicle plan) → exported. The approved top 10 go to engineering.

## Pipeline (steps in `architecture.mmd`)
0. **Configuration:** vehicle + market (valid only if sales > 0), competitor set (default, AI suggests, PM confirms), brand profile (versioned assumption, PM-editable), source filter, several weight profiles per vehicle with a compare view.
1. **Seed (one-time, logged):** option lists (extracted once by the team and verified, page as source), portfolio (segment, generation, markets), sales (2030 forecast = market weight), customer study (raw + normalized 0..1 + US dissatisfied share), BMW feedback Excel converted to signals (car area via topic mapping), the fixed taxonomy as the feature catalog (one feature per topic), with option codes and study attributes mapped to topic IDs (these two mappings confirmed by the team). Predecessor-generation research only on demand when the PM flags a removed feature.
2. **Daily fetch loop:** Python worker + cron, four agents (competitor, customer/public feedback, trends, innovation scout), daily budget (500 requests) with priority (features with open cases first, rest rotates), cadence per source (forums, app reviews, news daily; reviews and complaint sites weekly; reference and market data monthly). Reddit is not used (API access needs an approved developer application). Sources, categories A to J and record format: `fetching-sources.md` (sections 3 and 7). Scope v1: fetch-order steps 1 to 9 (steps 10 to 13 later). Depth: one backfill over all pages, then daily incremental runs that stop at already-stored records. A general search provider is only needed for discovery and stays pluggable.
3. **Signal JSON + validation gate:** schema, stored record, quote found, duplicates, source filter, dated competitor facts. Rejected → quarantine (PM can delete: content purged, tombstone kept). Agents pick topic and aspect group from the fixed taxonomy; the car area is derived from the topic (no separate classifier). Older-generation signals kept and tagged. Original quote + English translation for non-English sources. Schema has fixed core fields + `extra`, versioned.
4. **Cases:** group signals by topic + aspect group ("Seats + comfort" and "Seats + reliability" are separate cases); only large groups are split further by similarity (summary embeddings, OpenAI embeddings, threshold tuned on seed data), never across a topic. Stable IDs, merges/splits logged. Figures and tags per case. Conflict flag when one market is mostly negative and another mostly positive, each with ≥ 5 distinct customers (PM-tunable).
5. **Case score** (no cost), computed per weight profile, so per config (vehicle + market), from the signals of that vehicle; defaults: distinct customers 0.25, severity 0.20, satisfaction gap 0.15, competitor gap 0.15, market volume 0.10, removed vs predecessor 0.05, reach 0.05 (capped, log, per market), trend 0.05; brand fit multiplier (fits 1.0, neutral 0.8, off-brand 0.5). Rationale text generated from the factor breakdown.
6. **PM workspace:** notification toast (new open case, new evidence, conflict, failed run), case board, case page with RAG sidebar, PM confirms case.
7. **Requirement generation** from confirmed cases (see concept above).

End filters on the case and requirement boards: market, car area / category, state, source type, and **release fit** (current car update, next generation, OTA), judged by an LLM from how big the case is; the PM can override.
8. **Requirement ranking, discussion with engineering, approval.** Export format (codebeamer / Jira) is a later feature.

## Technical decisions
- Storage: Supabase Postgres + pgvector, relational with link tables (no graph DB). Raw records in storage, referenced by `raw_ref`.
- Audit: append-only event table enforced in the DB (no update / delete); actor (AI agent or PM), timestamp, before/after, rationale; views and exports logged too. Deletions are tombstones.
- Field names and market values follow `fetching-sources.md` section 7: markets `USA`, `China`, `Europe`, `Rest of World`, `unknown`; `vehicle_role` current / predecessor / competitor / unknown; `author_hash` for distinct web customers.
- LLM: OpenAI models. gpt-6-luna for everything high-volume (row classification, signal extraction, case pages, case tags, RAG sidebar), gpt-6.1-sol only for requirement texts (`OPENAI_STRONG_TASKS`). Thinking effort: `low` for the reading tasks (classification, signal extraction, case pages, case tags; `OPENAI_MINIMAL_REASONING_TASKS`), the model's default for the RAG sidebar and the requirement texts. Every agent output stores model and prompt version.
- Embeddings: text-embedding-3-small stored with 768 dimensions (`EMBEDDING_DIM`). No vector index on `signal` and `rag_chunk` (exact search at this size); see the size budget below.
- The LLM never works inside a database transaction: a batch step reads, closes the transaction, lets the calls run in parallel (`LLM_WORKERS`) into the disk cache `backend/.data/llm_cache/` (key = prompt version + model + thinking effort + inputs), then writes in a short transaction.
- Size budget: Supabase free plan, 500 MB database and 1 GB storage. Observed cases are not scored (a case is scored when it opens); machine events are not indexed for the RAG agent; a fetched web record without a relevant statement keeps only a marker row. BMW's provided data is never dropped: irrelevant rows are kept out of cases, scores and the index (quarantine, out of scope), not deleted.
- RAG agent: hybrid keyword + vector search over case and requirement pages, signals with quotes, source records, decisions and audit events of people. Every factual claim cites a signal ID; no source means "no evidence found". Edits are proposals the PM accepts.
- The RAG agent also knows the PM context (series briefs, stances, open questions and answers, meeting notes, feedback, comments) through its own tool; it cites it as PM context, never as customer evidence, and uses only the brief of the asking PM's line.
- AI proposals are rows of `proposal` (seven kinds); a person accepts or rejects each, and accepting applies the change through the object's own audited endpoint.
- Collaboration lives in the database, all audited: series briefs (one shared per line plus a regional overlay per PM), stances, open questions, meeting notes, referrals and escalations, innovation pool, comments, alerts, the vehicle plan (a plan feature is a topic; only the PM's decisions are stored).
- Users: `app_user.role` is the permission (pm, engineer, admin); `pm_role` is the place in the organisation (vehicle PM, attribute PM, head of product line). Each user has a workspace: one config (vehicle and market) and one weight profile.
- Pages: markdown body stored in the DB with versions; structured fields (score, status, market, cost) separate; stale saves rejected by version check.
- UI (Notion-like pages, boards) is built by a teammate; the backend provides data, scores and the RAG agent. The UI keeps its own vocabulary (markets EU / US / CN / RoW, release `lci`, status `pm_approved`); the adapter translates, the database keeps the backend values.
- Text shown to a person in the UI is readable prose ("Status: planned → exported"), never raw JSON.
- YouTube: videos of the last 60 days on the listed review channels, the 10 most relevant comments per video, BMW lines only (quota). Transcripts come through an unofficial library and can be blocked.

## Rejected options (do not re-propose)
- A separate confidence axis in the score (evidence level is display only).
- A graph database.
- A separate car-area classifier step (Jev); the car area is derived from the topic.
- Loading the database from the processed CSVs (`docs/02-bmw-data/processed`); it is loaded from BMW's original files, which keep the sheet and row of every value.
- Deleting BMW feedback rows that are not relevant; they are kept out of cases, scores and the index instead.
- Copying a case when it is handed to another PM.
- Brand fit as a score factor (it is a multiplier) and dropping `reach` as a factor, although the UI's weight panel still shows it that way.
- Free-text themes, an own car-area list or a merged feature catalog; agents never create a topic (fixed taxonomy from BMW's VFC labels).
- Treating the case as the solution; the case is the problem.
- An "exploration level" setting and a "project type" setting (replaced by: no case without signals; the release-fit filter).

## Open items
- Export format for codebeamer / Jira (later feature).
- Fetch steps 10 to 13 (native Chinese sites, browser-only, login) after v1.
- Fetch sources: a live check (`python -m app.fetch.smoke`, report in `backend/reports/fetch_smoke.md`) returned records from 32 of 81 enabled sources; the rest is listed in `HANDOFF.md`.
- UI on real data: Refresh button (the fetch loop runs from the worker only), the Signals diagram on aggregates, a reach slider and the brand-fit tag in the weight panel.

## Risks
- **Market mismatch:** feedback mostly US (G60/G70) or UK/JP (F70), option lists German, study markets differ by sheet.
- **Skewed coverage:** F70 one source and ICE only; no study sample sizes; no feedback dates.
- **Hallucinated sources** would destroy traceability: every claim must point to a stored source record.
- **Clustering noise:** unclassified and mislabelled BMW rows; countered by grouping on topic + aspect group, the similarity threshold only splits large groups and must be tuned and measured.
- **Volume bias:** loud or off-brand signals ranked too high; distinct customers, capped reach and brand fit counter it.
- **Scope drift** into engineering specs when setting targets.
- **Arbitrary-looking scores** unless every factor is shown and tunable.
- **Prompt injection** from scraped pages: page content is data; agents can only write signals, never cases.
- **Demo fragility:** network, free-tier pausing, API quotas; keep a seed backup and cached records.
- **Hardcoding** a vehicle or market.

## Principles
- Every artifact traces to a real source. Never fabricate sources or citations.
- Audit log is append-only and part of the core from day 1.
- Every change records actor (AI agent or human), timestamp and rationale.
- Vehicle and market are configuration, never hardcoded.
- AI proposes and flags; the PM decides.
- Raw data in `docs/02-bmw-data/raw/` is never modified; derived data goes elsewhere.

## Current phase
Phases 0 to 10 of `plan.md` are implemented, and the schema, the agents and the API are fitted to the UI (`changes.md`, section "UI alignment", U.1 to U.24; migrations 0014 to 0016). The UI adapter serves the whole UI contract from the API. Supabase has all 16 migrations and the seed of BMW's data; the build with OpenAI (case pages, tags, scores, search index) was running when the last session ended. **Read `HANDOFF.md` next:** it says how to check that build, what is not verified and what to do next.

Open: the design documents other than `changes.md` still describe the state before the UI alignment (`database-design.md`, `data-model.mmd`, `backend/API.md`, `plan.md`); the case threshold re-tune for OpenAI embeddings; the taxonomy eval with the LLM; the first real web backfill (needs the user's go, and a decision on the 1 GB storage limit).

Working rules: ask the user before running backend processes, tests, builds, fetches or anything on Supabase or OpenAI, and say what it costs. Tests run offline (`cd backend && uv run pytest`). `python -m app.dev_local` starts the API on the local database without Supabase or OpenAI. Demo tooling: `python -m app.demo` (build, users, e2e, dump, restore); never run `e2e` on Supabase. Commit only when the user asks.
