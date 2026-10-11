# Fixed Taxonomy: Hand-off Spec

**For:** Ghassen (backend + agents) · **From:** Amine · **Version:** `2026-10-11.1`

## Why
Feedback from Thomas (BMW AI engineer) on 10.10.2026 ([meeting summary](../docs/03-meetings/2026-10-10_2308_thomas-demo-feedback_summary.md) §2):

- A free-running agent invents new categories that mean the same thing as existing ones, so we end up with "ten categories that mean the same but are written differently".
- **Use a fixed list derived from BMW's VFC topics** in the customer-feedback CSV, and make the agents map every signal onto it. In his words it is "a classification, not a regression problem".

This folder is that fixed list. It also has a ready-made way to **measure** the classifier against BMW's own labels, which we can show in the pitch.

## The model: three closed facets per finding
| Facet | Count | What it is | Who sets it |
|---|---|---|---|
| **Car area** | 11 | Level 1: UI chips, case filter, vehicle-plan rows. Same IDs as `CarArea` in `web/src/contracts/enums.ts` | **Derived** from the topic in code, never predicted |
| **Topic** | 219 | Level 2, "the component": BMW's VFC level-2 labels, each mapped to exactly one car area | BMW rows: lookup. Other sources: LLM, enum-constrained |
| **Aspect group** | 11 | What about it: function, usability, reliability, performance, efficiency_range, design, comfort, space, quality, sound, price. Grouped from BMW's 84 VFC level-3 labels | BMW rows: lookup. Other sources: LLM |

Polarity stays where it is today: `kind` / `severity` on FINDING (from BMW's Feedback Type: Likes, Difficult to Use, Defect, Wants).

**One finding = one topic.** A verbatim that talks about seats and the screen gives two findings. Cases and clusters are built **within a topic** (or within a car area for broad themes). The agent never names a theme freely.

Topics per car area:
| Car area | Topics | Car area | Topics |
|---|---|---|---|
| exterior_design | 20 | driver_assistance | 34 |
| interior_comfort | 17 | dynamics_powertrain | 31 |
| seats | 8 | range_charging | 13 |
| climate | 9 | practicality | 28 |
| infotainment_hmi | 28 | quality_materials | 5 |
| connectivity_digital | 26 | | |

Special rows in `topics.csv` (`status` column):
- **`alias` (5):** exact duplicates inside BMW's own list, e.g. `Dynamic Stability Control (DSC)` → `dynamic_stability_control`. They resolve to one canonical topic.
- **`meta` (2):** `no_class_found` and `General enquiry: customer feedback`. These carry no topic, so the text is re-classified by the LLM.
- **`fallback` (1):** `other`. The only way out when nothing fits. It goes to a human review queue and **never creates a topic automatically**.

## Files
| File | Kind | Content |
|---|---|---|
| `car_areas.csv` | authored | 11 car areas with label and description |
| `topics.csv` | authored | `topic_id, vfc_level2, car_area, status, alias_of, hint`. Hints exist for ambiguous BMW labels (checked against sample verbatims) |
| `aspects.csv` | authored | VFC level 3 → aspect group |
| `build.py` | script | Validates the CSVs, **fails if any VFC label in the data is unmapped**, writes everything below |
| `taxonomy.json` | generated | What the backend, agents and UI load: areas, topics (with verbatim counts per model), aspect groups, `vfc_level2_to_topic`, `vfc_level3_to_aspect_group` |
| `classifier.schema.json` | generated | JSON Schema for structured output. `topic_id` is an enum of the 219 topics + `other` |
| `prompt_topics.md` | generated | The topic list for the prompt (about 3.5k tokens) |
| `classifier-prompt.md` | authored | Reference prompt, post-processing rules, optional embedding shortlist |
| `eval/gold.csv` | generated | 8,906 BMW-labelled verbatims with canonical gold topics and areas; `split` = dev (882) / test (8,024) |
| `eval/unlabeled.csv` | generated | 1,222 verbatims BMW could not classify, to backfill with the classifier |
| `eval/score.py` | script | Scores your predictions against `gold.csv` |

```bash
python taxonomy/build.py
```
It needs only the Python standard library and reads `docs/02-bmw-data/processed/feedback_rows.csv`.

## Changes to `data-model.mmd`
```
CAR_AREA {
    text id PK "exterior_design ... quality_materials"
    text label
    text description
}
TOPIC {
    text id PK "seat_massage"
    text car_area FK
    text label "BMW VFC level 2 label"
    text_array vfc_level2 "label + aliases"
    text hint
    text status "active, alias, meta, fallback"
    text taxonomy_version
}
TAXONOMY_PROPOSAL {
    uuid id PK
    uuid finding_id FK
    text suggested_name "other_suggestion from the LLM"
    text reason "other, low_confidence"
    text status "open, mapped_to_existing, accepted_new_topic, dismissed"
    text resolved_topic_id FK
    text decided_by
    timestamptz decided_at
}
FINDING
    - text_array car_area
    + text topic_id FK
    + text aspect_group
    + text car_area "derived from topic, stored for filtering"
    + text classification_confidence "high, medium, low"
    + text classified_by "bmw_label, llm"
    + text taxonomy_version
FEATURE
    - text_array vfc_topics
    + text_array topic_ids
```

## Pipeline
1. **BMW feedback rows:** `topic_id = vfc_level2_to_topic[Vfc level2 Name]` and `aspect_group = vfc_level3_to_aspect_group[Vfc level3 Name]`. No LLM; `classified_by = bmw_label`. If the label maps to `null` (meta), go to step 2.
2. **Everything else** (web reviews, YouTube transcripts, Reddit, news, unlabelled BMW rows): the LLM with [`classifier-prompt.md`](classifier-prompt.md) and `classifier.schema.json`. The enum makes invented topics impossible.
3. **Post-processing in code:**
   - Check that each quote exists in the text; quarantine the finding if not.
   - Derive `car_area` and stamp `taxonomy_version`.
   - Send `other` and low-confidence findings to `TAXONOMY_PROPOSAL`.
4. **Clustering / case candidates:** group findings by `topic_id` (and market). Similarity clustering, if any, runs **inside** a topic and never across topic boundaries.
5. **UI:** chips and filters use `car_area`. The signal card shows the topic label and the aspect group.

## Governance: how the list changes
- Only a human changes the taxonomy: edit `topics.csv` in a PR, run `build.py`, and bump `VERSION` in `build.py`.
- The `TAXONOMY_PROPOSAL` queue is the input. The usual outcome is "mapped to an existing topic"; a new topic is the exception.
- Findings keep the `taxonomy_version` they were classified with. Re-classifying is an explicit batch job, never silent.

## Measuring the classifier
1. Run the classifier on `eval/gold.csv` rows with `split = dev` (882 verbatims). Write `predictions.csv` with columns `id,topic_ids` (`;`-separated, most confident first).
2. Run:
   ```bash
   python taxonomy/eval/score.py predictions.csv --split dev
   ```
3. Tune the prompt and hints on **dev only**. Run **test** once at the end and report that number.

The scorer reports:
- **Invalid labels:** must be 0, otherwise the enum isn't enforced.
- **Topic hit@1, precision, recall and F1:** a topic only counts as right if it matches exactly.
- **Car-area precision and recall:** the level the UI uses, so it is the number to pitch.
- **`other` rate.**
- **Top car-area confusions.**

Sanity checks already run: perfect predictions score 1.0, shuffled labels score 0.04 on topics and 0.19 on areas, and invented IDs are counted as invalid.

**Caveat for honest reporting:** BMW tagged some topics per verbatim, not necessarily all of them, so a correct extra topic counts as a false positive. Precision is a **lower bound**. Recall and area-level numbers are the fairer headline. Report the test-split numbers as they are.

## Checklist for Ghassen
- [ ] Load `taxonomy.json` into `CAR_AREA` / `TOPIC` (seed migration).
- [ ] FINDING columns as above; drop free-text categories from agent outputs.
- [ ] Deterministic mapping for BMW rows.
- [ ] LLM classifier with the schema-constrained output plus the post-processing checks.
- [ ] `TAXONOMY_PROPOSAL` table and a minimal review list (can be an admin page or a SQL view for the demo).
- [ ] Run `score.py` on dev, then test; send Amine the numbers for the pitch slide.
- [ ] Backfill `eval/unlabeled.csv` (1,222 verbatims) so no BMW feedback stays unclassified.

## Notes on mapping choices
- Topic IDs are slugs of BMW's labels. The topic `exterior_design` and the car area `exterior_design` share a name but are different namespaces.
- **Judgement calls** (edit `topics.csv` if you disagree, then rebuild):
  - The digital key and the display key are under `connectivity_digital`. The physical key, Comfort Access and lock/unlock are under `practicality`.
  - Regenerative braking and the 12 V battery are under `dynamics_powertrain`. The high-voltage battery and the fuel tank are under `range_charging`.
  - `Body equipment, overall technology` is under `quality_materials`.
- `quality_materials` has few topics on purpose. Quality is mostly an **aspect** (damage, workmanship, rattles) that applies across all areas, so filter by `aspect_group = quality` to see it everywhere.
