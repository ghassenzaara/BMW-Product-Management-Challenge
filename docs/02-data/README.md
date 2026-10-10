# Provided Data: Overview

**Start here for data.** Then read [`insights.md`](insights.md) for pre-computed findings, [`equipment-baseline.md`](equipment-baseline.md) for what each car offers today, and [`external-sources.md`](external-sources.md) for what to add from outside.

## Folder layout

| Path | What | Use it for |
|---|---|---|
| [`raw/`](raw/) | 8 original BMW files (only renamed, never edited) | Ground truth, citations |
| [`processed/`](processed/) | Agent-readable CSV and text built from `raw/` | **Analysis: read these, not the xlsx/pdf** |
| [`scripts/build_processed.py`](scripts/build_processed.py) | Rebuilds `processed/` | Run after raw data changes: `python 02-data/scripts/build_processed.py` |
| [`insights.md`](insights.md) | Key findings per model, cross-model themes, conflicts, coverage | Evidence for requirements |
| [`equipment-baseline.md`](equipment-baseline.md) | English summary of the option lists | Gap analysis (is a want already offered?) |
| [`external-sources.md`](external-sources.md) | Competitors, web sources, evidence trust levels | Enrichment and evidence levels |

### Processed files

| File | Rows | Grain | Key columns |
|---|---|---|---|
| `processed/feedback_rows.csv` | 13,771 | one row per verbatim x topic (all 3 models) | `id, model, series, source, country, engine, feedback_type, topic, aspect, text` |
| `processed/feedback_verbatims.csv` | 10,128 | **one row per verbatim** | `id, model, series, source, country, engine, feedback_types, topics, text, text_len` (multiple labels joined with a pipe character) |
| `processed/feedback_topic_counts.csv` | ~3,100 | model x engine x type x topic x aspect | `n_verbatims` (distinct ids) |
| `processed/study_cn_eu_2025.csv` | 185 | attribute x market x model | `mean_score_10` |
| `processed/study_us_2025.csv` | 202 | attribute x model (G60, G70) | 7 level shares, `top2_box`, `bottom3_box`, `mean_score_7` (1 = I Hate It ... 7 = I Love It) |
| `processed/sales_volumes.csv` | 12 | model x market | volumes 2024/2025/2030, `growth_2025_2030_pct`, `share_of_model_2025_pct` |
| `processed/option-lists/*.txt` | 3 files | page text, layout kept (German) | grep for features, e.g. `Sitzbelüftung`, `Head-Up` |

In processed files `engine` uses `BEV` (raw: `BEVE`), an empty feedback type becomes `Unclassified`, and an empty topic becomes `no_class_found`. CSVs are UTF-8 and some `text` values contain line breaks, so read them with a CSV parser, not line by line.

## Raw files

| File                                   | Type        | Vehicle         | Content                              | Original name                           |
| -------------------------------------- | ----------- | --------------- | ------------------------------------ | --------------------------------------- |
| `customer-feedback_F70_1-series.xlsx`  | Excel       | 1 Series (F70)  | Classified customer feedback         | `F70_feedback_hackathon.xlsx`           |
| `customer-feedback_G60_5-series.xlsx`  | Excel       | 5 Series (G60)  | Classified customer feedback         | `G60_feedback_hackathon.xlsx`           |
| `customer-feedback_G70_7-series.xlsx`  | Excel       | 7 Series (G70)  | Classified customer feedback         | `G70_feedback_hackathon.xlsx`           |
| `customer-study_2025_all-models.xlsx`  | Excel       | All (incl. G68) | Customer survey ratings, 2025        | `F70_G60_G68_G70_customer_studies.xlsx` |
| `sales-volumes_2024-2030.xlsx`         | Excel       | All             | Units per market, 2024 / 2025 / 2030 | `sales_volumes.xlsx`                    |
| `option-list_F70_1-series_2026-07.pdf` | PDF (23 p.) | 1 Series (F70)  | Official option list, German         | `F70_OptionList.PDF`                    |
| `option-list_G60_5-series_2026-07.pdf` | PDF (28 p.) | 5 Series (G60)  | Official option list, German         | `G60_OptionList.PDF`                    |
| `option-list_G70_7-series_2026-07.pdf` | PDF (27 p.) | 7 Series (G70)  | Official option list, German         | `G70_OptionList.PDF`                    |

For the purpose of each dataset see [`../01-challenge/provided-data-overview.md`](../01-challenge/provided-data-overview.md).

Model codes: **F70** = BMW 1 Series, **G60** = BMW 5 Series (sedan, incl. i5), **G68** = BMW 5 Series long-wheelbase variant for China (appears in the study and sales sheet `G60_G68`), **G70** = BMW 7 Series (incl. i7). More terms in [`../GLOSSARY.md`](../GLOSSARY.md).

---

## 1. Customer feedback: `customer-feedback_*.xlsx`

One sheet each (`Feedback_Explorer`), identical 12 columns:

| Column | Meaning |
|---|---|
| `ID` | Feedback ID (e.g. `F70-0001`). **Not unique per row**: one verbatim is repeated once per topic it was classified into. |
| `Source` | Anonymized origin of the feedback (Source A to D). |
| `Brand`, `Sales Description` | `[BMW]`, `[BMW 1 Series]` etc. |
| `Country` | ISO country code of the customer. |
| `Derivate (e-code)` | Model code (F70 / G60 / G70). |
| `Engine Type` | `ICE`, `PHEV`, `BEVE` (battery-electric). |
| `Feedback Type` | `Likes`, `Difficult to Use`, `Defect`, `Wants`, or empty (unclassified). |
| `Customer Feedback` | Free-text verbatim (English). |
| `Vfc level2 3 Name` | Topic label `Level2 : Level3` (e.g. `Seats : Not user-friendly`). |
| `Vfc level2 Name` | Topic category (e.g. `Drivetrain`, `Touch screen, operation`). |
| `Vfc level3 Name` | Sentiment or aspect within the topic (e.g. `Like: function`, `Not user-friendly`). |

### Profile

| | F70 (1 Series) | G60 (5 Series) | G70 (7 Series) |
|---|---|---|---|
| Rows | 4,076 | 5,005 | 4,690 |
| Unique IDs (verbatims) | 2,128 | 4,000 | 4,000 |
| Main countries | GB 2,790; JP 1,026; SE 121 | US 4,365; KR 278; GB 89 | US 4,418; KR 157; JP 56 |
| Engine types | ICE only | ICE 2,768; BEV 1,763; PHEV 474 | ICE 2,956; BEV 1,347; PHEV 387 |
| Sources | A only | B 2,627; A 1,858; C 384; D 136 | B 2,855; A 1,383; C 314; D 138 |
| Likes | 1,630 | 1,951 | 1,890 |
| Difficult to Use | 595 | 1,306 | 1,119 |
| Defect | 491 | 435 | 481 |
| Wants | 273 | 582 | 518 |
| Unclassified feedback type | 1,087 | 731 | 682 |

Top topic categories (`Vfc level2 Name`) across all three include Drivetrain, Handling / Riding, Drive/driving dynamics and chassis, Body equipment, Touch screen/operation, ConnectedDrive and Infotainment, Seats, Exterior and Interior design, and Electric Range (5 Series).

### Things to watch
- **Wants** are the most direct source of new-requirement ideas. **Defect** and **Difficult to Use** are pain points, **Likes** are what to preserve.
- Rows with `no_class_found` or empty topic (F70: 1,087; G60: 525 + 200 empty; G70: 470 + 200 empty) have no usable topic label, so classify them yourself from the text.
- Count **unique IDs** when you count customers or verbatims, not rows.
- Coverage is skewed. F70 is UK/Japan and ICE only. G60 and G70 are about 90% US. Do not generalize to Europe or China without caution.
- Verbatim length averages about 300 characters (median 166 to 233). The maximum is 1,554 (F70), 3,498 (G60) and 4,260 (G70).
- **No feedback comes from China**, and only about 110 G60 and 19 G70 verbatims come from Europe (see [`insights.md`](insights.md)).
- Unique-verbatim counts by first feedback type differ from the row counts above. Use `processed/feedback_verbatims.csv` for per-customer counts.

---

## 2. Customer study: `customer-study_2025_all-models.xlsx`

Survey ratings per vehicle, 2025. Two sheets with different layouts:

**`CN_EU_2025`** (37 attributes in 76 used rows; the sheet's formatted range is 84 x 13): China and EU.
- China columns: 5 Series G68, 7 Series G70.
- EU columns: 1 Series F70, 5 Series G60, 7 Series G70.
- Each block is a rating category with its **mean score** on a 10-point scale. Example: overall product satisfaction is 8.77 (G68, CN), 9.64 (G70, CN), 8.46 (F70, EU), 8.32 (G60, EU) and 7.98 (G70, EU).
- Categories include exterior and interior styling, material quality, level of equipment, safety, value for money, reliability, infotainment ease of use, connected services, seating comfort, acceleration, roadholding, efficiency, ride quality, space, build quality and quietness.

**`US_2025`** (929 used rows): USA, G60 and G70 only.
- Blocks of 9 rows (title, sample total, 7 levels) for **103 detailed attributes**. Two titles are blank, so 101 are usable (e.g. size/proportions, headlights, door handles, seat comfort, cupholders, trunk operation).
- Values are the **share of respondents per satisfaction level** ("I Hate It", "A Failure", "Unsatisfactory" and so on, as a fraction of the sample), not means. The two sheets are therefore **not directly comparable** without conversion.

---

## 3. Sales volumes: `sales-volumes_2024-2030.xlsx`

Three sheets (`F70`, `G60_G68`, `G70`) with the columns `market`, `market_code`, `volume_2024`, `volume_2025`, `volume_2030`. 2030 is a forecast.

| Market | F70 2024 / 2025 / 2030 | G60+G68 2024 / 2025 / 2030 | G70 2024 / 2025 / 2030 |
|---|---|---|---|
| Europe | 80,000 / 85,000 / 87,000 | 110,000 / 115,000 / 127,000 | 11,000 / 13,000 / 17,000 |
| China | 0 / 0 / 0 | 68,000 / 75,000 / 78,000 | 8,000 / 10,000 / 12,000 |
| USA | 0 / 0 / 0 | 75,600 / 78,000 / 80,000 | 10,000 / 12,000 / 14,000 |
| Rest of World | 25,000 / 28,000 / 31,000 | 25,000 / 28,000 / 31,000 | 5,000 / 7,000 / 9,000 |
| **Total** | 105,000 / 113,000 / 118,000 | 278,600 / 296,000 / 316,000 | 34,000 / 42,000 / 52,000 |

Growth from 2025 to 2030 is strongest for the G70 (+24% overall, Europe +31%). The G60 and G68 are about 7x the G70 volume.

Note that the F70 is not sold in China or the US (zero volumes). The G60 and G68 are combined in one sheet. The Rest of World values for F70 and G60_G68 are identical (25,000 / 28,000 / 31,000), which may be a placeholder.

---

## 4. Option lists: `option-list_*.pdf`

Official BMW German price and equipment brochures, July 2026 edition (F70 and G70 issue 1 of 28.05.2026, G60 issue 2 of 22.06.2026). Reference models are the M135 xDrive (F70), i5 M60 xDrive (G60) and i7 M70 xDrive (G70).

Sections: vehicle prices and models, standard equipment, M Sport packages, wheels and tires, exterior and interior color worlds, optional equipment, technical data and dimension drawing.

Handling notes:
- The PDFs are **encrypted** (owner-restricted, empty user password). `pdftotext -layout` and PyMuPDF read them directly. `pypdf` needs `reader.decrypt('')` plus the `cryptography` library. **Use `processed/option-lists/*.txt` instead.**
- Prices and option codes sit in a separate column, so in extracted text they don't always line up with their item. The English summary is [`equipment-baseline.md`](equipment-baseline.md).
- Text is German and extractable, but the tables are not clean. Each file has about 7 images.
- They are the baseline for what each car offers today, which you can compare against feedback and competitors to find equipment gaps.

---

## How the datasets fit together

| Question | Use |
|---|---|
| What do customers love, dislike, or want? | Feedback (`Feedback Type`, topic columns) |
| How satisfied are customers overall, and in which areas? | Customer study |
| Which markets and powertrains matter commercially? | Sales volumes, plus `Engine Type` and `Country` in feedback |
| What does the car offer today? | Option lists |
| What will matter in 3 to 5 years? | None of the files covers this. Use external sources ([`external-sources.md`](external-sources.md)) and forward-looking assumptions, and label them as such. |
| Is a wanted feature already offered? | [`equipment-baseline.md`](equipment-baseline.md) |
