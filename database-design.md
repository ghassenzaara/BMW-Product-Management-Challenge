# Database Design: BMW Requirements Platform

Supabase Postgres with `pgvector`. This file is the source of truth for tables, columns and rules; `data-model.mmd` is its diagram. Phase 1 builds it as migrations in `backend/supabase/migrations/`.

Chain: **source record → signal → case (problem) → PM confirms per vehicle → requirement (solution) → PM approves**, every step written to `audit_event`.

## Conventions

- Schema `public`. Keys are `uuid` (default `gen_random_uuid()`) or readable `text` IDs where people quote them (`CASE-0012`, `REQ-G60-0012`, `record_id`).
- Every table has `created_at timestamptz default now()`. Mutable tables also have `updated_at`.
- Every write goes through the backend's single write path (`audit.py`), which writes the change and its `audit_event` in the same transaction.
- **No hard deletes** of evidence, cases or requirements. A delete is a tombstone: content columns set to null, `deleted_at` set, row kept, audit event written.
- Field names and values follow `All-context/05-web-sources/fetching-sources.md` section 7.
- Vehicle, market, competitors, weights and thresholds are rows, never constants in code.

### Shared value sets (Postgres domains)

| Domain | Values |
|---|---|
| `market_t` | `USA`, `China`, `Europe`, `Rest of World`, `unknown` |
| `powertrain_t` | `ICE`, `PHEV`, `BEV`, `unknown` (BMW `BEVE` is mapped to `BEV`) |
| `vehicle_role_t` | `current`, `predecessor`, `competitor`, `unknown` |
| `actor_type_t` | `ai`, `human`, `system` |

Smaller value sets are `check` constraints on the column and listed below.

## 1. Reference and configuration

### `vehicle`
BMW vehicle lines and their predecessors (from fetching-sources 2.1 and the sales file).

| Column | Type | Notes |
|---|---|---|
| `code` | text PK | `G60`, `F70`, `G70`, `G68`; predecessors `G30`, `F40`, `G11` too |
| `brand` | text | `BMW` |
| `series` | text | `5 Series` |
| `segment` | text | `entry`, `business`, `luxury` |
| `generation` | text | `8th generation` |
| `on_sale_since` | date | records published earlier belong to the predecessor |
| `predecessor_code` | text FK → `vehicle.code` | null for predecessors without data |
| `is_current` | bool | true for the lines we plan successors for |
| `markets_sold` | market_t[] | derived from 2030 sales > 0 at seed time |
| `variants` | text[] | `520i`, `i5 eDrive40`, … |

### `competitor`
One row per rival of one BMW line (fetching-sources 2.3). Category J sources add rows.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bmw_vehicle` | text FK → `vehicle` | the BMW line it competes with |
| `brand`, `model` | text | `Mercedes-Benz`, `E-Class` |
| `generation`, `since` | text | `W214`, `2023` |
| `names` | jsonb | `{"de": "E-Klasse", "fr": "Classe E", "zh": "奔驰E级"}` |
| `wikipedia_page` | text | |
| `markets` | market_t[] | markets where the BMW line is sold and the rival competes |
| `status` | text | `active`, `ended`, `announced` |
| `origin` | text | `registry` (seed), `agent:competitor` (new launch, PM confirms) |
| `confirmed` | bool | default list is confirmed; agent-added rows wait for the PM |

Unique (`bmw_vehicle`, `brand`, `model`).

### `source_registry`
Every source ID of fetching-sources section 3, parsed once, plus the internal sources `bmw_feedback`, `bmw_study`, `bmw_sales`, `option_list`.
Evidence a PM adds by hand uses three more sources, registered on first use and never fetched: `pm_upload` (rows of a file; the only ones that count as customers), `pm_link` and `pm_note` (market evidence). Their records and signals go through the validation gate like every other.

| Column | Type | Notes |
|---|---|---|
| `source_id` | text PK | `reddit`, `kbb`, `bmw_feedback` |
| `name` | text | |
| `url_pattern` | text | as written in the sources file |
| `categories` | text[] | `A` … `J` |
| `country` | text | ISO code or `Global` |
| `level` | text | `model`, `brand`, `market` |
| `access` | text | `API`, `RSS`, `Scraping`, `Browser`, `Download`, `Library`, `Login`, `Internal` |
| `check_status` | text | `Data OK`, `Pattern OK`, `Blocked (403)`, … |
| `fetch_step` | int | 1 to 13; null for internal sources |
| `enabled` | bool | false for steps 10 to 13 in v1 |
| `delay_seconds` | numeric | per-site politeness delay |
| `last_cursor` | jsonb | newest seen item per subject; drives incremental runs |
| `backfill_done_at` | timestamptz | set after the one-time backfill |
| `refresh_days` | int | fetch cadence: the daily worker runs the source only when its last successful run is at least this old (1 to 365; migration 0012, values from `backend/seed/source_decisions.yaml`) |
| `disabled_reason` | text | why a source is switched off (e.g. `reddit`: API access needs an approved developer application) |

### `site_slug`
Slug of each vehicle or competitor on each site (fetching-sources 3.9, 3.10).

| Column | Type | Notes |
|---|---|---|
| `subject_type` | text | `vehicle`, `competitor` |
| `subject_id` | text | vehicle code or competitor uuid |
| `source_id` | text FK → `source_registry` | |
| `slug` | text | `mercedes/e-class`, `genesis/g80/saloon/review/n23156` |
| `note` | text | `expert only`, body type |

PK (`subject_type`, `subject_id`, `source_id`, `slug`): a few sites have more than one page per car (What Car? body types), so the slug is part of the key.

### `search_term`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_type`, `subject_id` | text | as in `site_slug` |
| `term` | text | `BMW i5`, `宝马5系` |
| `language` | text | `en`, `de`, `zh` |
| `collision_safe` | bool | true for the safe forms of section 2.4 |
| `scope` | text | `any`, `single_brand_source` (bare model name allowed only there) |

### `car_area`
The 11 car areas of the fixed taxonomy (`taxonomy/car_areas.csv`): level 1, what the PM sees and filters by. A signal's car area is always derived from its topic, never predicted.

| Column | Type | Notes |
|---|---|---|
| `code` | text PK | `exterior_design`, `interior_comfort`, `seats`, `climate`, `infotainment_hmi`, `connectivity_digital`, `driver_assistance`, `dynamics_powertrain`, `range_charging`, `practicality`, `quality_materials` |
| `name` | text | label |
| `description` | text | |

### `aspect_group`
The 11 aspect groups of the taxonomy (grouped from BMW's 84 VFC level-3 labels): what a statement is about. Neutral, so likes and complaints share a group.

| Column | Type | Notes |
|---|---|---|
| `code` | text PK | `function`, `usability`, `reliability`, `performance`, `efficiency_range`, `design`, `comfort`, `space`, `quality`, `sound`, `price` |
| `description` | text | |

`price` is pricing, which is out of scope: such signals get `scope_tag = out_of_scope` and stay visible.

### `taxonomy_proposal`
Review queue for signals the classifier could not place (topic `other`) or placed with low confidence. Only a human resolves a row; a topic is never created automatically. The usual outcome is "mapped to an existing topic". View `taxonomy_review` lists the open rows with quote and summary.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `signal_id` | uuid FK → `signal`, unique | |
| `suggested_name` | text | the classifier's `other_suggestion` |
| `reason` | text | `other`, `low_confidence` |
| `status` | text | `open`, `mapped_to_existing`, `accepted_new_topic`, `dismissed` |
| `resolved_feature_id` | uuid FK → `feature` | |
| `decided_by`, `decided_at` | text, timestamptz | required once the status is not `open` |
| `description` | text | used in the agent prompt |

### `brand_profile`
Versioned assumption of BMW brand identity (sporty, driving dynamics, design, efficiency), PM-editable.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `version` | int | unique |
| `body_md` | text | |
| `created_by` | text | actor |

### `config`
One PM view: vehicle + market.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | `G60 / USA` |
| `vehicle` | text FK → `vehicle` | must be `is_current` |
| `market` | market_t | not `unknown` |
| `competitor_ids` | uuid[] | defaults to confirmed competitors of the vehicle in this market |
| `brand_profile_id` | uuid FK | |
| `source_filter` | jsonb | `{"exclude_sources": [...], "exclude_categories": [...], "exclude_content_types": [...]}`. Applied when scoring the config: the case figures are recomputed without the excluded sources, and the rationale names them. Stored case figures stay unfiltered |
| `thresholds` | jsonb | `open_min_customers`, `conflict_min_customers` (5), `similarity_case`, `case_split_min_signals` (50), `reach_cap` |
| `active` | bool | |

Unique (`vehicle`, `market`). Trigger: insert or update fails unless `sales_volume` has 2030 units > 0 for this vehicle and market.

### `weight_profile`
Several per config, with a compare view.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `config_id` | uuid FK | |
| `name` | text | `balanced`, `focus comfort`, `focus budget` |
| `case_weights` | jsonb | `distinct_customers 0.25, severity 0.20, satisfaction_gap 0.15, competitor_gap 0.15, market_volume 0.10, removed_vs_predecessor 0.05, reach 0.05, trend 0.05` |
| `brand_multipliers` | jsonb | `fits 1.0, neutral 0.8, off_brand 0.5` |
| `cost_multipliers` | jsonb | `S 1.0, M 0.85, L 0.7` |
| `is_default` | bool | one default per config |
| `created_by` | text | |

Check (`weights_valid`, migration 0009): `case_weights` is a non-empty object, every weight is a JSON number (finite by definition; strings such as `"NaN"` are rejected) ≥ 0, and the sum is > 0. The scorer normalizes by the sum, so weights need not add up to exactly 1, but all-zero weights would divide by zero.

### `app_user`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = Supabase `auth.users.id` |
| `name` | text | |
| `role` | text | `pm`, `engineer`, `admin` |
| `vehicles` | text[] | lines the user owns (several PMs share the platform); the API lets a PM act only on these lines, an empty list means all lines |

## 2. Baseline (seeded once, team-confirmed)

### `feature`
**A feature is a topic of the fixed taxonomy**: one row per topic (219, BMW's VFC level 2) plus the fallback `other`. Loaded from `taxonomy/taxonomy.json`; only a human changes the list, in `taxonomy/`. The topic is the hidden link to equipment, study and cost; the PM sees the car area. Shared across vehicles (Baukasten: seats, materials and driver-assistance software span series).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `topic_id` | text unique | taxonomy slug: `seat_massage`; `other` = fallback |
| `name` | text unique | BMW's VFC level-2 label: `Seat massage` |
| `car_area` | text FK → `car_area` | exactly one per topic; null only for `other` |
| `description`, `hint` | text | hint for ambiguous BMW labels |
| `vfc_level2` | text[] | the BMW label and its aliases |
| `taxonomy_version` | text | `2026-10-11.1` |
| `status` | text | `confirmed` for taxonomy topics (`candidate`, `rejected` unused since the taxonomy) |
| `embedding` | vector(1536) | label + hint; null for `other` |

### `feature_mapping`
Normalized links from the catalog to BMW labels.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `feature_id` | uuid FK | |
| `kind` | text | `vfc_topic`, `option_code`, `study_attribute` |
| `value` | text | `Seats : Not user-friendly`, `S453A`, `Seating comfort` |
| `vehicle` | text FK, nullable | option codes and study attributes can be vehicle-specific |
| `confirmed_by` | text | team member who confirmed it |

Unique (`kind`, `value`, `vehicle`, `feature_id`).

### `vehicle_feature`
Equipment today, from the option lists (German market).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `vehicle` | text FK | |
| `feature_id` | uuid FK, nullable | null until mapped |
| `variant` | text | `i5 eDrive40` |
| `market` | text | country of the list, `DE` |
| `availability` | text | `standard`, `optional`, `absent`, `removed` |
| `sa_code` | text | option code |
| `item_name` | text | German name as printed |
| `price_eur` | numeric | incl. 19 % VAT, null if standard |
| `package` | text | package the item belongs to, if any |
| `record_id` | text FK → `source_record` | option-list page record |

### `study_score`
Customer study 2025.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `vehicle` | text FK | |
| `market` | market_t | |
| `sheet` | text | `CN_EU_2025`, `US_2025` |
| `attribute` | text | as printed |
| `method` | text | `mean_10pt`, `dist_7level` |
| `raw` | jsonb | the mean, or the 7 shares |
| `normalized` | numeric | 0..1 (mean / 10, or weighted mean of the levels) |
| `dissatisfied_share` | numeric | US only: share of the three lowest levels |
| `feature_id` | uuid FK, nullable | through `feature_mapping` |
| `source_location` | text | sheet + cell range |

### `data_record`
Numeric records of fetching-sources 7.3: BMW sales (`source_id = bmw_sales`), option-list tech data, competitor specs and facts, registrations, trend figures.

| Column | Type | Notes |
|---|---|---|
| `record_id` | text PK | `bmw_sales-G60-USA-2030` |
| `source_id` | text FK → `source_registry` | |
| `category` | text | `A` … `J` |
| `url` | text | or file name |
| `raw_ref` | text | storage path of the raw file |
| `fetched_at` | timestamptz | |
| `brand`, `model`, `chassis_code` | text | empty for whole-market figures |
| `competitor_id` | uuid FK, nullable | when the figure is about a rival |
| `powertrain` | powertrain_t | |
| `country` | text | ISO code |
| `market` | market_t | |
| `period` | text | `2025`, `2030 forecast`, `2026-09` |
| `metric` | text | `sales units`, `range WLTP`, `launch date` |
| `value` | numeric | |
| `value_text` | text | for non-numeric values such as a date |
| `unit` | text | |
| `source_location` | text | sheet + cell, table, PDF page |
| `suspect` | bool | e.g. identical RoW sales for F70 and G60 |
| `run_id` | uuid FK → `agent_run` | |

View **`sales_volume`** (`vehicle`, `market`, `year`, `units`, `forecast`, `suspect`) on top of `bmw_sales` rows.

## 3. Evidence

### `agent_run`
One row per seed script, fetch run or agent run.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `agent` | text | `seed:feedback`, `fetch:reddit`, `agent:competitor` |
| `mode` | text | `seed`, `backfill`, `incremental`, `on_demand` |
| `params` | jsonb | steps, sources, subjects |
| `started_at`, `ended_at` | timestamptz | |
| `records_fetched`, `signals_valid`, `signals_quarantined` | int | |
| `llm_tokens` | int | |
| `llm_cost_usd` | numeric | |
| `status` | text | `running`, `ok`, `partial`, `failed` |
| `error` | text | |

### `source_record`
Text records of fetching-sources 7.2. BMW feedback verbatims (`source_id = bmw_feedback`) and option-list pages (`source_id = option_list`) are stored here too, so every quote can be checked against one table.

| Column | Type | Notes |
|---|---|---|
| `record_id` | text PK | `reddit-1abc23-c4`, `bmw_feedback-G60-0001`, `option_list-G60-p12` |
| `source_id` | text FK → `source_registry` | |
| `category` | text | one of `A` … `J` |
| `content_type` | text | `owner`, `expert`, `press`, `news`, `bmw_internal` |
| `level` | text | `model`, `brand` |
| `url` | text | permalink, or file + row / page |
| `raw_ref` | text | storage path in bucket `raw-records` |
| `fetched_at`, `published_at` | timestamptz | `published_at` null when unknown (BMW feedback has no dates) |
| `search_term` | text | |
| `thread_id` | text | |
| `author_hash` | text | sha256 of the user name; never the name |
| `brand`, `model`, `chassis_code`, `model_year` | text | |
| `vehicle_role` | vehicle_role_t | |
| `powertrain` | powertrain_t | |
| `country` | text | ISO code |
| `market` | market_t | from `country` (fetching-sources 7.4) |
| `language` | text | |
| `title` | text | |
| `text_original` | text | null after a tombstone |
| `text_en` | text | English translation if not English |
| `rating_value`, `rating_scale` | numeric | |
| `engagement` | jsonb | upvotes, likes, views, replies |
| `extra` | jsonb | source-specific fields (BMW `Source A..D`, NHTSA `odiNumber`) |
| `content_hash` | text, indexed (not unique) | sha256 of source_id + normalized text; duplicate-detection hint only. Records are deduplicated by their source-native identity (`record_id`, PK). Distinct customers can write identical text (G70: 4,000 verbatim IDs, 3,993 distinct texts), so equal hashes never block a record. |
| `run_id` | uuid FK → `agent_run` | |
| `deleted_at` | timestamptz | tombstone |

### `signal`
One statement about one topic from one source record. Versioned JSON contract (fixed core fields + `extra`). Three closed facets: topic (`feature_id`), aspect group and car area (derived).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `record_id` | text FK → `source_record` | |
| `run_id` | uuid FK → `agent_run` | |
| `schema_version`, `prompt_version`, `model` | text | `model` = null for rule-based seed signals |
| `customer_ref` | text | BMW verbatim ID or `author_hash`; counts distinct customers |
| `market` | market_t | |
| `market_basis` | text | `stated`, `inferred`, `unknown` |
| `vehicle` | text FK → `vehicle`, nullable | the current BMW line the evidence belongs to; null = brand level (applies to every line sold in the market) |
| `chassis_code` | text | the car actually discussed: `G30`, `W214` |
| `competitor_id` | uuid FK, nullable | set when `evidence_role = competitor` |
| `vehicle_role` | vehicle_role_t | `predecessor` when the record predates `on_sale_since` |
| `evidence_role` | text | `bmw_customer`, `competitor`, `market` (trend, study, launch) |
| `powertrain` | powertrain_t | |
| `kind` | text | `complaint`, `wish`, `like`, `competitor_fact`, `trend`, `innovation` |
| `severity` | text | `defect`, `difficult_to_use`, `wish`, `none` |
| `feature_id` | uuid FK, nullable | the topic (`feature.topic_id`). BMW rows: lookup from the VFC level-2 label; web signals: picked by the LLM from the closed list (enum). Null = waits for the LLM classifier (a topic is never guessed) |
| `aspect_group` | text FK → `aspect_group`, nullable | BMW rows: lookup from the VFC level-3 label; web signals: LLM, closed list |
| `car_area` | text[] | the one car area of the topic, derived in code and stored for filtering; empty without a topic |
| `classified_by` | text | `bmw_label`, `llm`, `pm` |
| `classification_confidence` | text | `high`, `medium`, `low` |
| `taxonomy_version` | text | version the signal was classified with |
| `feature_hint` | text | BMW's VFC level-2 label for seed rows |
| `case_id` | text FK → `case_item`, nullable | |
| `summary` | text | English, ≤ 20 words (checked in the gate) |
| `quote` | text | exact excerpt of `source_record.text_original` |
| `quote_en` | text | English translation for non-English quotes |
| `quote_start` | int | character offset of the quote in `text_original` |
| `reach`, `reach_unit` | int, text | from engagement; `views`, `upvotes`, `likes`, `none` |
| `data_record_id` | text FK → `data_record`, nullable | the structured competitor fact |
| `published_at` | timestamptz | copied from the record for sorting |
| `scope_tag` | text | `in_scope`, `out_of_scope` (regulatory, engineering spec, pricing) |
| `extra` | jsonb | e.g. BMW VFC topic, NHTSA component |
| `validation` | text | `valid`, `quarantined`, `deleted` |
| `reject_reason` | text | gate check that failed |
| `embedding` | vector(1536) | of `summary` |
| `deleted_at` | timestamptz | tombstone |

Checks: `validation = 'valid'` requires `quote`, `summary` and `record_id`; `evidence_role = 'competitor'` requires `competitor_id`; a competitor signal never counts as a BMW customer in case figures.

## 4. Cases and requirements

A case is a **problem**, composed of a group of signals about one topic and one aspect group. Each case sits under one topic and so under one car area; a car area holds many cases. It is **not tied to one vehicle**: the same problem (e.g. "My BMW app loses the phone key") can come from several lines and series, because features are shared (Baukasten). The vehicles a case applies to are tags in `case_vehicle`, and each line's PM works the case for that line.

### `case_item`
Named `case_item` because `CASE` is a reserved word in SQL. API and UI call it "case".

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `CASE-0012`, from a sequence, stable forever; four digits up to `CASE-9999`, then the plain number (`CASE-10000`) |
| `feature_id` | uuid FK | the topic |
| `aspect_group` | text FK → `aspect_group`, nullable | cases are grouped by topic + aspect group; only groups with `case_split_min_signals` (50) signals or more are split further by similarity |
| `title` | text | the problem, never the solution |
| `body_md` | text | Notion-like page |
| `body_version` | int | stale saves rejected |
| `figures` | jsonb | per vehicle × market × powertrain: distinct customers, opinions (complaints / wishes / likes), capped reach, study score, equipment today, competitor offer and competitor evidence, trend |
| `scope_tag` | text | `in_scope`, `out_of_scope` |
| `brand_fit`, `brand_fit_source` | text | `fits`, `neutral`, `off_brand`; `ai` or `pm` |
| `segment`, `segment_source` | text | `base`, `premium`, `luxury`; `ai` or `pm` |
| `tags` | text[] | free tags set by the PM or the AI |
| `embedding` | vector(1536) | centroid of the signal summaries |
| `created_by` | text | |

### `case_vehicle`
The case per BMW line: lifecycle, PM ranking and release fit belong to a vehicle, because each line has its own PM and its own generation timing.

| Column | Type | Notes |
|---|---|---|
| `case_id` | text FK | |
| `vehicle` | text FK | |
| `state` | text | `observed`, `open`, `confirmed`, `rejected` |
| `state_reason` | text | rule that opened it, or the PM's reason |
| `opened_by` | text | `rule:min_customers`, `rule:defect`, `rule:competitor_gap`, `rule:removed_feature`, `pm:<user>` |
| `market_conflict` | bool | one market mostly negative, another mostly positive, each ≥ `conflict_min_customers` |
| `release_fit`, `release_fit_reason`, `release_fit_source` | text | `current_car`, `next_gen`, `ota`; `ai` or `pm` |
| `manual_rank`, `manual_rank_reason` | int, text | PM override; null = rank by score |
| `flag_new_evidence` | int | signals added since confirmation ("+40 complaints") |
| `confirmed_at` | timestamptz | |

PK (`case_id`, `vehicle`).

### `case_lineage`
Merges and splits; IDs never change.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `from_case`, `to_case` | text FK | |
| `op` | text | `merge`, `split` |
| `actor`, `rationale` | text | |

### `case_score`
One row per computation; the newest per (`case_id`, `weight_profile_id`) is current (view `case_score_current`). The weight profile belongs to a config, so a score is always for one vehicle and market.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `case_id` | text FK | |
| `weight_profile_id` | uuid FK | |
| `factors` | jsonb | per factor: raw value, normalized 0..1, weight, contribution |
| `brand_multiplier` | numeric | |
| `score` | numeric | |
| `rationale` | text | generated from the factor breakdown |
| `computed_at` | timestamptz | |

### `requirement`
The answer to a confirmed case, for one BMW line.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `REQ-G60-0012` (number = case number); `REQ-G60-USA-0012` when split per market |
| `case_id` | text FK | |
| `vehicle` | text FK | the line whose PM confirmed the case |
| `market` | market_t, nullable | set only when split per market |
| `title` | text | |
| `body_md`, `body_version` | text, int | |
| `metric_target` | jsonb | metric, today's value + source, target, competitor values + `data_record` IDs |
| `acceptance_criteria` | jsonb | list |
| `release_target` | text | `next_gen`, `current_car`, `ota` |
| `evidence_level` | text | `bmw_data`, `web`, `assumption` (display only, not in the score) |
| `assumptions` | jsonb | assumptions and uncertainties |
| `cost_size` | text | `S`, `M`, `L` |
| `cost_source` | text | `option_price`, `ai_estimate`, `pm`, `engineering` |
| `cost_price_eur` | numeric | option price if it exists |
| `status` | text | `draft`, `in_discussion`, `approved`, `rejected`, `deleted` |
| `rank_score` | numeric | **cache only**, for the default weight profile of the config that matches `vehicle` (and `market` when split). The rank for any profile is computed on read (view `requirement_rank`) |
| `manual_rank`, `manual_rank_reason` | int, text | |
| `argument_md` | text, nullable | the PM's edited argument sheet (migration 0017); null = generated from the requirement and its evidence. Not part of a version |
| `model`, `prompt_version` | text | generator |
| `deleted_at` | timestamptz | tombstone |

**Rank per weight profile (view `requirement_rank`, migration 0009).** Case scores exist per weight profile, and a
profile belongs to one config (vehicle × market), so one stored number cannot hold every ranking. The view joins each
live requirement to every weight profile whose config has the requirement's vehicle (and its market, when the
requirement is split per market) and returns `rank_score = case_score_current.score × cost_multipliers[cost_size]` of
that profile, plus `manual_rank`. A missing `cost_size` counts as 1.0 and is shown as `cost_missing`. The board and
the compare view read this view with the requested `weight_profile_id`; `requirement.rank_score` is refreshed from the
default profile only and is never read for another profile.

### `page_version`
History of every Notion-like page.

| Column | Type | Notes |
|---|---|---|
| `object_type` | text | `case`, `requirement` |
| `object_id` | text | |
| `version` | int | |
| `body_md` | text | |
| `author` | text | |

PK (`object_type`, `object_id`, `version`). Saving with an old `body_version` fails (409 in the API).

## 5. Collaboration and audit

### `decision`
PM and engineer actions as domain records (the audit log holds them too).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `object_type`, `object_id` | text | |
| `vehicle` | text FK, nullable | |
| `actor` | text | `pm:<user>`, `engineer:<user>` |
| `action` | text | `open`, `confirm`, `reject`, `edit`, `reorder`, `merge`, `split`, `approve`, `delete`, `export` |
| `rationale` | text | required for reject, reorder, delete |

### `chat_message`
RAG sidebar on case and requirement pages.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `object_type`, `object_id` | text | |
| `role` | text | `pm`, `agent` |
| `author` | text | |
| `content` | text | |
| `cited_signals` | uuid[] | must be a subset of `retrieved_signals` |
| `retrieved_signals` | uuid[] | what the search returned |
| `proposed_diff` | jsonb | page edit proposal |
| `diff_status` | text | `none`, `proposed`, `accepted`, `rejected` |
| `model`, `prompt_version` | text | |

### `notification`
Realtime-enabled.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `type` | text | `case_opened`, `new_evidence`, `market_conflict`, `run_failed`, `candidate_feature`, `new_competitor` |
| `object_type`, `object_id` | text | |
| `vehicle`, `market` | text | for routing to the right PM |
| `message` | text | |
| `read_by` | uuid[] | |

### `rag_chunk`
Hybrid search index.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `object_type`, `object_id` | text | `case`, `requirement`, `signal`, `source_record`, `decision`, `audit_event` |
| `vehicle`, `market`, `case_id` | text | filters |
| `text` | text | |
| `embedding` | vector(1536) | |
| `tsv` | tsvector | generated from `text` (English) |

### `audit_event`
Append-only.

| Column | Type | Notes |
|---|---|---|
| `seq` | bigserial PK | |
| `at` | timestamptz | default `now()` |
| `actor` | text | `seed:<script>`, `agent:<name>`, `pm:<user>`, `engineer:<user>`, `system` |
| `actor_type` | actor_type_t | |
| `action` | text | `create`, `update`, `delete` (tombstone), `state_change`, `score`, `view`, `export`, … |
| `object_type`, `object_id` | text | |
| `before`, `after` | jsonb | changed fields only |
| `rationale` | text | |
| `run_id` | uuid, nullable | |
| `request_id` | text, nullable | API request that caused it |

## 6. Rules

- **Append-only audit:** `UPDATE`, `DELETE` and `TRUNCATE` on `audit_event` are revoked from every role, and a trigger raises an exception for them, so even the service role cannot change history.
- **Tombstones:** deleting a source record, signal or requirement nulls its content columns, sets `deleted_at`, keeps the row and writes an audit event. A quarantined signal deleted by the PM is purged the same way.
- **Stale saves:** page saves run `update … where body_version = :expected` and write a `page_version` row; zero updated rows means someone else saved first.
- **Agents write signals only.** No agent code path writes `case_item`, `case_vehicle` or `requirement` content directly; the case and requirement services do, and new evidence on a confirmed case only raises `flag_new_evidence`.
- **Config validity:** trigger on `config` checks 2030 sales > 0.
- **Indexes:** HNSW (`vector_cosine_ops`) on every `embedding`; GIN on `rag_chunk.tsv`; btree on `signal(case_id)`, `signal(feature_id)`, `signal(market)`, `signal(vehicle)`, `signal(record_id)`, `source_record(source_id, published_at)`, `case_vehicle(vehicle, state)`, `source_record(content_hash)` (not unique, see `source_record`).
- **Security:** RLS on for every table, deny-all for `anon`; `authenticated` may only `select` from `notification` (Realtime). Everything else goes through the FastAPI backend with the service role.
- **Storage:** bucket `raw-records` holds every raw response and the provided BMW files, referenced by `raw_ref`.
