# Implementation Plan: BMW Requirements Platform

## Progress

| Phase | Title | Status | Commit | Verification result |
|---|---|---|---|---|
| 0 | Align docs, database design | done | 8d9d1e8 | Both Mermaid files render with mmdc 11.4.2; no "finding" left in design docs (BMW challenge transcriptions and meeting notes keep their original wording); database-design.md covers all tables |
| 1 | Foundation | done | 6dfc8e2 | 14 tests passed (all tables + RLS, HNSW indexes, audit_event refuses UPDATE/DELETE/TRUNCATE, service_role has no UPDATE/DELETE grant, audited diff, stale save, tombstone, config sales check, strict schema, prompts, local embedder); 7 migrations apply on local Postgres 16 + pgvector; not yet applied to Supabase (no credentials) |
| 2 | Seed | done | 2463e1b | 28 tests passed. Seeded 134 sources, 27 competitors, 231 slugs, 6 vehicles, 36 sales records, 387 study scores, 153 features (candidate), 78 option-list pages, 3,282 equipment rows, 116 tech values, 10,128 feedback records, 13,771 signals (13,105 valid, 666 quarantined), 10 configs; counts match the data README; every quote found in its record; every seeded row audited. Team review of the CSVs pending |
| 3 | Signal contract and validation gate | done | 4cf8b03 | 14 gate tests passed (+ foundation, seed, review-fix tests); all 13,105 valid seed signals embedded (local provider); car-area eval: heuristic baseline 34.7 % on 300 verbatims, LLM eval pending OPENAI_API_KEY |
| 4 | Cases | done | 7051b60 | 6 case tests passed; seed data (local embedder, threshold 0.15): 1,322 cases, 712 spanning several lines, 293 opened per line, 1 market conflict; threshold report in backend/reports/clustering_thresholds.md |
| 5 | Scoring | done | 1c23f9f | 9 tests passed (scoring + cases); seed data: 29,584 case scores for 10 configs x 4 profiles in 15 s; G60 / USA: 6 cases in the top 10 under every profile |
| 6 | Requirements | done | 8f6b836 | 4 requirement tests passed (+ case tests); seed data: confirming the top G60 / USA case generated REQ-G60-0930 (26 customers, study satisfaction 0.74, evidence bmw_data, rank 0.331) |
| 7 | RAG sidebar agent | done | 0c4645f (code), phase commit on 2026-10-11 | 3 RAG tests passed; every plan item present (index, hybrid search function, 7 tools, citation check, edits as proposals); dev database: index rebuild 1,206 case + 13,105 signal + 5,000 audit-event chunks (after the taxonomy re-seed); decisions in changes.md 7.1 to 7.3 |
| 8 | Daily fetch loop (steps 1 to 9) | done (first real backfill waits for the checkpoint) | see git log | 15 fetch tests passed on recorded pages; every step 1 to 9 source has an adapter (dry run: no source "not built", about 4,500 requests per incremental run, about 150,000 for the backfill); 71 extra slugs from fetching-sources 3.4 / 3.9; on-demand predecessor research endpoint. Reddit and YouTube report "not configured" until the keys exist. Decisions 8.1 to 8.7 |
| T | Fixed taxonomy (between phases 8 and 9) | done (not committed yet) | | 98 tests passed (83 + 15 seed). Seed: 11 car areas, 11 aspect groups, 219 topics + `other`; 11,214 signals mapped by BMW label, 2,557 wait for the LLM classifier; 116 price signals out of scope. Cases: 1,206 (612 topic + aspect groups, 35 split), 19 % singletons, 376 of 2,378 case-line pairs opened by rule, 0 market conflicts; 32,400 case scores for 10 configs. Topics only from BMW labels or the LLM classifier (no similarity guess); LLM classification and eval pending the key. See changes.md, section Taxonomy |
| 9 | API for the UI teammate | done | see git log | 106 tests passed (8 API tests: dev auth and HS256 token, board filters, logged views, 409 on stale save, confirm -> requirement -> engineer cost -> PM approve -> export -> audit chain -> tombstone, profiles + compare + source filter, chat citations, taxonomy review). 50 paths in the OpenAPI spec; guide in `backend/API.md`; decisions in changes.md 9.1 to 9.12 |
| 10 | Hardening and demo readiness | done | see git log | 106 + 8 tests passed. `python -m app.demo build --fresh` rebuilt the local database in about 10 min (1,206 cases, 376 opened, 32,400 scores, 19,311 RAG chunks, 5 demo users); `e2e` through the HTTP API ran for G60 / USA and F70 / Europe with only the config name changed (reports in `backend/reports/`); audit chain report per requirement; offline dump 38 MB. Supabase build pending the user's go. Decisions 10.1 to 10.7 |

Every phase ends with a commit `Completed phase N: <title>` pushed to `main`, and its row updated here.

## Open issues

- Phase 2 checkpoint closed on 2026-10-11: the user approved every row of the review CSVs (changes.md R2.1).
- 666 feedback rows without a Feedback Type stay quarantined, and 2,557 rows without a usable VFC topic stay without a topic and in no case, until the LLM classifier runs (the OpenAI key is set since 2026-10-11; the Supabase build classifies them before grouping).
- Taxonomy eval with the LLM (dev, then test once) and the case threshold re-tune for OpenAI embeddings (0.55 is untuned) are still open.
- Supabase Auth: production needs `app_user` rows for the real users (ids = Supabase auth user ids); `python -m app.demo users` only creates demo users.
- Market conflicts dropped from 1 to 0 on the seed data: BMW's level-3 labels put likes mostly under `function` and usability complaints under `usability`, so the two sides of a conflict can sit in different cases. To check with the team.
- Supabase is configured in `backend/.env` (session pooler, eu-west-3, secret key). The first build there (`python -m app.demo build`) is in progress since 2026-10-11 with the OpenAI key set (gpt-6-luna, gpt-6.1-sol; changes.md 8.12, 10.10, 10.11). Do not run `app.demo e2e` on Supabase (see `HANDOFF.md`).
- Phase 8 checkpoint: `backend/reports/fetch_plan.md` now plans about 336 requests per day on average (cadence per source, budget 500, changes.md 8.8); the first real backfill still needs the user's go. Reddit is disabled (8.9); the YouTube key is set.


## Context
The design phase is finished: concepts, pipeline and data model are agreed and live in `CLAUDE.md`, `architecture.mmd` and `data-model.mmd`. The repo holds no code yet. Claude implements the whole backend ("the brain"); the user supervises. A teammate builds the UI (Notion-like pages, boards). The web sources are specified in `docs/05-web-sources/fetching-sources.md` (source registry with URL patterns, categories A to J, fetch order steps 1 to 13, competitor list, slugs per site, record format). No timeline: phases are ordered by dependency and each ends in a runnable, verifiable state.

Decisions added in this round:
- **Signal** = every piece of evidence (previously "finding"). **Case** = a problem, composed of a group of signals. **Requirement** = the answer to a confirmed case.
- End filters: car area / category and **release fit** (current car update, next generation, OTA), judged by an LLM from how big the case is; the PM can override.
- **Competitor signals** (e.g. E-Class complaints, Tesla forum) attach to the BMW case of the same feature as competitor evidence; they feed the competitor gap and never count as BMW customers.
- **Fetch scope v1: steps 1 to 9** of the fetch order (reference APIs, structured APIs, news/press feeds, app reviews, forums, owner review sites, expert reviews, price lists, market/trend data). Steps 10 to 13 (native Chinese sites, browser-only, login) come later.
- **Depth:** one backfill run fetches all pages; daily runs are incremental (newest first, stop at already-stored records).
- The sources file gives URL patterns and APIs directly, so a general web-search provider is only needed for discovery (e.g. new launches); it stays pluggable.

Stack: Python 3.12, FastAPI, Supabase (Postgres + pgvector, Storage, Realtime, Auth), OpenAI (chat + embeddings), `uv` venv, httpx + selectolax for scraping, feedparser for RSS, pdfplumber for PDFs, openpyxl/pandas inside the venv.

## Database design (built in phase 1, documented in phase 0)
Full design: [`database-design.md`](database-design.md) (diagram: `data-model.mmd`). Table groups: reference and configuration (`vehicle`, `competitor`, `source_registry`, `site_slug`, `search_term`, `car_area`, `brand_profile`, `config`, `weight_profile`, `app_user`), baseline (`feature`, `feature_mapping`, `vehicle_feature`, `study_score`, `data_record` + view `sales_volume`), evidence (`agent_run`, `source_record`, `signal`), cases and requirements (`case_item`, `case_vehicle`, `case_lineage`, `case_score`, `requirement`, `page_version`), collaboration and audit (`decision`, `chat_message`, `notification`, `rag_chunk`, `audit_event`).

Changes agreed with the user in phase 0 against the first draft of this plan:
- The case table is `case_item` (`CASE` is reserved in SQL); API and UI still say "case".
- A case is not tied to one vehicle or config: one problem can apply to several BMW lines. Vehicles are tags in `case_vehicle`, which holds the per-vehicle state, PM rank, release fit, conflict flag and new-evidence flag. Case IDs are `CASE-0012`; requirements are per line (`REQ-G60-0012`, `REQ-G60-USA-0012` when split). Scores stay per weight profile, so per config.
- `car_area` is a table (the 11 car areas of the fixed taxonomy in `taxonomy/`) instead of a hard-coded list.
- Option-list pages are stored as `source_record` rows (`source_id = option_list`), so equipment facts are quotable like every other source.
- `site_slug` key includes the slug (some sites have several pages per car).

## Phase 0 — Align docs and write the database design
- `CLAUDE.md` already uses Signal and holds this round's decisions. Rename Finding → Signal in `architecture.mmd`, `data-model.mmd`, `README.md`; add "a case is composed of a group of signals", the two end filters, competitor signals, fetch scope steps 1 to 9, backfill + incremental.
- Update `data-model.mmd` to the database design above (SOURCE → `source_record`, sales folded into `data_record`, new `competitor`, `site_slug`, `search_term`, `source_registry`, `feature_mapping`, `case_lineage`, `page_version`, `rag_chunk`, `notification`, `app_user`, `brand_profile`).
- Write `database-design.md` (the tables above, with rules) to the repo root. `plan.md` (this file) already exists; keep its progress table current.
- Commit `Completed phase 0: docs aligned and database design` and push.

## Phase 1 — Foundation
- `backend/` skeleton: `uv` project, FastAPI app, `config.py` (pydantic-settings), `db.py` (psycopg pool + Supabase storage client), `.env.example` (keys never committed).
- `backend/supabase/migrations/`: one migration per table group above, extensions (`vector`), indexes, append-only trigger on `audit_event`, Realtime on `notification`, storage bucket `raw-records`.
- `audit.py`: `write(object_type, object_id, before, after, actor, rationale)` in the same transaction as the change; actors `seed:<script>`, `agent:<name>`, `pm:<user>`, `system`.
- `llm/`: OpenAI wrapper with structured outputs (JSON schema), retries, cost logging; `prompts/` as versioned files.
- Test: update/delete on `audit_event` fails.

## Phase 2 — Seed
- Pre-seeding: everything in `docs/02-bmw-data/raw/` (3 feedback files, customer study, sales volumes, 3 option-list PDFs) is imported into the tables created in phase 1, read-only from `raw/`, each file also stored in the `raw-records` bucket.
- **Registry seed** (parse `fetching-sources.md` once into YAML, reviewed, then load): `source_registry`, `competitor`, `site_slug`, `search_term`, vehicle generations / `on_sale_since`.
- **Portfolio** → `vehicle`. **Sales** → `data_record` (identical RoW values flagged `suspect`).
- **Fixed taxonomy** (`taxonomy/taxonomy.json`, not reviewed in the seed; only a human changes it in `taxonomy/`): 11 car areas → `car_area`, 11 aspect groups → `aspect_group`, 219 topics plus the fallback `other` → `feature` (one row per topic, `feature.topic_id`), BMW's VFC level-2 labels and aliases → `feature_mapping`.
- **Study** → `study_score` (CN_EU means normalized; US distributions → normalized mean + dissatisfied share), linked to topics through the review CSV `study_attributes.csv`.
- **BMW feedback** → `source_record` per verbatim ID + one `signal` per topic row (kind/severity from Feedback Type, market via fetching-sources 7.4, `BEVE` → `BEV`, source C prefix stripped, `evidence_role = bmw_customer`). Topic and aspect group by lookup from the VFC level-2 and level-3 labels (`classified_by = bmw_label`); the car area is derived from the topic. Aspect group `price` is tagged out of scope.
- Rows the labels cannot place are classified from the text by the LLM (`feedback_classify@v2`, closed lists): rows without a Feedback Type (kind/severity) and rows labelled `no_class_found` or general enquiry (topic and aspect group). Without a key they wait: no kind means quarantine, no topic means in no case.
- **Option lists** (once, together with the user): pdfplumber word positions + LLM vision on hard pages + checks (cells = variants, prices, unique codes) → review CSV → `vehicle_feature`, linked to topics through the review CSV `option_features.csv`; tech data → `data_record`.
- Checks: 2,128 / 4,000 / 4,000 verbatims; per-type counts match `02-bmw-data/README.md`; 11 car areas, 11 aspect groups, 219 topics + `other`; every stored car area is the car area of its topic; every row audited.

## Phase 3 — Signal contract and validation gate
- Pydantic `Signal` (fixed core + `extra`, versioned; `signal@2`): agents send `topic_id` and `aspect_group`, never a car area.
- Gate: schema → record exists + hash → quote found in `text_original` → kind / severity consistent → topic and aspect group exist in the stored lists (car area derived from the topic) → duplicate / near-duplicate → source known → competitor fact dated → vehicle role from `on_sale_since` (predecessor tagged) → scope tag (pricing, incl. aspect group `price`, regulation, homologation).
- Quarantine view with counts per agent; PM delete = tombstone.
- Review queue `taxonomy_proposal` (view `taxonomy_review`) for signals with topic `other` or low confidence; a topic is never created automatically.
- Summary embeddings (OpenAI). Eval: the LLM classifier against BMW's own labels (`taxonomy/eval/gold.csv`, scored by `taxonomy/eval/score.py`); tune on dev, run test once.

## Phase 4 — Cases
- Signals without a topic go through the LLM classifier before grouping (`signals.reclassify`); a topic is never matched by similarity.
- Grouping: one case per topic + aspect group, across all BMW lines. Only groups with `case_split_min_signals` (50) signals or more are split further by similarity (agglomerative, cosine threshold), never across a topic. Topic `other` is never grouped. LLM writes case title + problem body.
- Incremental assignment of new signals to the case of their topic + aspect group (nearest case when the group was split); stable IDs; merge / split via `case_lineage`.
- Threshold tuning script with a report on the seed data.
- Figures: distinct BMW customers per market + powertrain, opinions, capped reach, study score, equipment today, competitor offer (`data_record`) and competitor evidence (`evidence_role = competitor` signals), trend.
- Tags (scope, brand fit, segment); conflict flag (≥ 5 distinct customers per side).
- **Release fit**: LLM judges current car update / next generation / OTA from case size, with reason; PM override.
- Lifecycle observed → open (threshold or PM) → confirmed / rejected; notifications.

## Phase 5 — Scoring
- Eight factor normalizers + brand multiplier; `case_score` versions with breakdown and rationale.
- Manual rank override with reason; rescoring flags instead of moving overridden cases.
- Profile compare: cases in the top N under every profile.
- Requirement rank = case score × cost multiplier.

## Phase 6 — Requirements
- On case confirm: generator (description, metric + target from seed value and competitor `data_record`, acceptance criteria, assumptions, evidence level, release target from release fit).
- One per case; one per market when markets clearly differ.
- Cost: option price → S/M/L bands, else LLM estimate (`ai_estimate`); edits by PM / engineers audited.
- Status flow, tombstone delete, versioned body with stale-save rejection.

## Phase 7 — RAG sidebar agent
- `rag_chunk` index over case/requirement bodies, signals (summary + quote), source texts, decisions, audit events.
- Hybrid search SQL function (full-text + pgvector, rank fusion) with vehicle / market / case filters.
- Tool-calling agent: `search_signals`, `get_case`, `get_requirement`, `score_breakdown`, `compare_markets`, `what_if_weights`, `propose_edit`.
- Citation check (cited signal IDs must exist and be retrieved, else "no evidence found"); diffs applied only on PM accept.

## Phase 8 — Daily fetch loop (steps 1 to 9)
- `python -m app.fetch.worker [--backfill] [--steps 1-9]`, cron daily; `agent_run` per run.
- Adapters by access type, driven by `source_registry`:
  - **API**: wikipedia, wikidata, nhtsa-vpic, fueleconomy, nhtsa-complaints / recalls, reddit (OAuth), youtube-comments (Data API v3; transcripts skipped).
  - **RSS**: news and press feeds (step 3), app-store reviews (step 4).
  - **Scraping**: httpx + selectolax with pagination rules from 3.9 and slugs from 3.10 (steps 5 to 7, step 3 press pages, auto-data, ev-database).
  - **Library**: google-play reviews, google-trends.
  - **Download**: price lists, KBA, IEA and other reports (step 8 and 9) → `data_record` / `source_record`.
- Polite fetching: robots.txt respected, per-site delay, user agent, retries; raw response to storage first (`raw_ref`).
- Backfill once over all pages; daily incremental via `last_cursor` (stop at known records).
- Four agents extract signals from records (competitor: J, E · feedback: A, B, C, D, H · trends: F, G, I · innovation scout: I + J on other industries / shows); vehicle and search terms from `competitor`, `search_term`, collision rules 2.4; market mapping from section 4 and 7.4; non-English text translated.
- Signals → gate → feature / case linking → figures → rescoring → notifications; new evidence on confirmed cases only flags.
- Prompt-injection guard: page text is data; agents create signals only.
- On-demand predecessor research endpoint.

## Phase 9 — API for the UI teammate
- FastAPI routers with OpenAPI spec as the contract: config / profiles (+ compare), signals + quarantine, cases (board with filters market, car area, release fit, state, source type; page get / save; open / confirm / reject / reorder / merge / split), requirements (board, page, approve / reject / delete / reorder), chat + proposed edits, audit trail per object, notifications.
- Supabase Auth: every action carries a user; access logging middleware (views, exports → audit).

## Phase 10 — Hardening and demo readiness
- Second configuration (F70 / Europe) runs end-to-end with only a config change.
- DB dump + seed script + cached raw records for offline demos / paused Supabase.
- Audit chain report for one requirement: source record → signal → case → score → PM decisions → requirement → approval.

## Verification
- `pytest` units: normalizers, gate checks (incl. unknown topic and aspect group), quote matching, review queue for `other`, grouping by topic + aspect group, cost bands, rank math, append-only audit, stale-save rejection.
- Seed count checks against the data README and the taxonomy (11 car areas, 11 aspect groups, 219 topics; 11,214 rows mapped by BMW label); registry load checked against the sources file (number of source IDs, competitors).
- Eval scripts with numbers: topic classification against BMW's labels (`app.signals.eval_taxonomy`: invalid labels must be 0, topic hit@1 / precision / recall, car-area precision / recall), case threshold report.
- Adapter smoke tests per access type on one BMW model + one competitor (recorded responses for CI).
- End-to-end on G60 / USA: seed → cases → scores → confirm a case via API → requirement → RAG answer with citations → audit chain printed; repeat on F70 / Europe with only a config change.

## Prerequisites from the user
- OpenAI API key and Supabase project (URL, service key) in `backend/.env`; Reddit OAuth app and YouTube Data API key for step 2.
- One joint session for the option-list review and the confirmation of the two topic mappings (study attributes, option-list items).
