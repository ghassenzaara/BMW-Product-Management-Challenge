# Data Insights: What the Provided BMW Data Says

Pre-computed findings from the provided datasets, so agents don't have to re-derive them. Everything here comes from the files in [`processed/`](processed/) (built by [`scripts/build_processed.py`](scripts/build_processed.py)) and can be re-checked there.

**Counting rule:** feedback counts are **distinct verbatims** (unique `id`), not spreadsheet rows. One verbatim can carry several topics, so topic counts don't add up to the total. Topic names are BMW's own labels (`topic` = VFC level 2).

**Evidence status:** this is *evidence about today's cars* (F70, G60, G70 as sold in 2024 to 2025). Statements about what customers will want in 3 to 5 years are **assumptions** and need external sources ([external-sources.md](external-sources.md)).

---

## 0. Coverage first (read before generalizing)

| | F70 · 1 Series | G60 · 5 Series | G70 · 7 Series |
|---|---|---|---|
| Distinct verbatims | 2,128 | 4,000 | 4,000 |
| Feedback countries | GB 61%, JP 32%, SE 3% | **US 90%**, KR 5% | **US 95%**, KR 3% |
| Verbatims from Europe | ~1,430 | ~110 | ~19 |
| Verbatims from China | **0** | **0** | **0** |
| Powertrains in feedback | ICE only | ICE 2,259 · BEV 1,363 · PHEV 378 | ICE 2,568 · BEV 1,129 · PHEV 303 |
| Sources | A only | B 66%, A 21%, C 10%, D 3% | B 71%, A 17%, C 8%, D 3% |
| Customer study | EU (means) | EU + China G68 (means) + US (distributions) | EU + China (means) + US (distributions) |
| Sales markets 2025 | EU 85k, RoW 28k (no CN/US) | EU 115k, US 78k, CN 75k, RoW 28k | EU 13k, US 12k, CN 10k, RoW 7k |

**Consequences**
- **China:** only the customer study has data (G68, G70). No verbatims, so any China requirement needs external evidence and a lower evidence level.
- **Europe for G60/G70:** the verbatims are almost entirely American. The EU customer study is the only European signal, even though Europe is the biggest G60 and G70 market by volume.
- **F70:** the UK and Japan dominate the feedback. Japan is not a market in the sales sheet (it sits in Rest of World). The F70 is not sold in the US or China.

**What the anonymized sources look like** (inferred from the text style, not documented by BMW):

| Source | Looks like | Example style |
|---|---|---|
| A | Owner reviews or ratings written by customers (multi-country, often lower-case, includes pros and cons) | "really solid build ... only knock off one mark because there's no paper user manual." |
| B | Dealer or customer-care contact notes, third person, US | "Customer stated they would like the vehicle to have a front trunk ..." |
| C | Quality survey with problem codes and severity, US | "I had a minor problem with Trunk/hatch/tailgate - Touch-free sensor doesn't work consistently/DTU: ..." |
| D | Short survey answers, US | "Strong.. That is the one thing I love most about the engine/motor of my vehicle." |

Source C carries a severity ("minor", "very serious"), which is useful for severity weighting.

---

## 1. Cross-model themes (strongest requirement candidates)

Ranked roughly by breadth of evidence. "Pain" means verbatims tagged *Defect* or *Difficult to Use*. Market tags show where the evidence comes from.

| # | Theme | Evidence | Markets | Evidence level |
|---|---|---|---|---|
| T1 | **Operating concept too complex: menus, touch-only, lost physical buttons** | F70 touch screen 83 DTU + 34 defects; G60 OS wants (physical presets, memory buttons) 14; G70 operating concept 33 DTU ("harder than my prior 7 Series"), touch screen 26. US study: *intuitiveness of controls* G70 top-2 only 25% (bottom-3 26%); *menu structure* G60 36% / G70 bottom-3 21%. EU study: *easy to use infotainment* 7.99 to 8.26, among the lower scores | UK, JP, US, EU | High |
| T2 | **Climate control: performance and operation** | G70 climatization 32 DTU (slow cooling; "Mercedes has a much better system"). US study: *operation of heater/AC controls* G60 top-2 29% (bottom-3 15%), G70 bottom-3 20%; *AC performance* G70 bottom-3 21%. EU study HVAC: F70 7.30, G60 7.47 (both near the bottom) | US, EU | High |
| T3 | **Connected services, apps and phone integration** | *Connected services* is in the bottom 3 to 6 for every model and market in the CN/EU study (7.32 to 7.86). G70 Personal eSIM 26 DTU + 11 defects, My BMW App 24 DTU, Intelligent Personal Assistant 17 DTU. G60 Apple CarPlay 22 DTU + 11 defects, wireless charging 11 defects. US: WiFi hotspot bottom-3 13% (G60), phone charging 10% (G60) | All | High |
| T4 | **Luggage space and loading** | Lowest or near-lowest in the EU study for every model: luggage capacity F70 **7.07** (lowest F70 score), G60 7.54, G70 7.41; ease of loading G60 7.24, F70 7.50, China G68 7.25. Wants: frunk on i5 (8) and i7. G60 non-contact trunk opening 39 DTU ("rarely works on the first try") | EU, CN, US | High (study) |
| T5 | **Value for money and affordability** | EU study value for money: G70 **6.47** (lowest value in the whole sheet), G60 7.36, F70 7.82. US: *affordable to buy* top-2 G70 6% / G60 20%; *resale value* G70 bottom-3 34%. "Dislike: price-performance" wants in F70 (23), G60 (17), G70 (10) | EU, US | High, **but pricing is out of scope.** Turn it into perceived value: standard equipment level and premium feel |
| T6 | **EV range and public charging (BEV)** | G60 BEV pain: electric range 43, public charging 28, HV charging 17; G70 BEV: range 17, public charging 17. Verbatims: winter range, compatible chargers hard to find, fast-charge limits, Tesla network envy | US, Nordics | Medium-High (US-centric) |
| T7 | **Auto start-stop (MSA): permanent off** | Explicit wants: G60 10, G70 10 ("permanent switch-off not possible"); G60 MSA 21 DTU | US | High, low effort, quick win |
| T8 | **Spare tire / flat-tire preparedness** | US study bottom-3: G70 **32%**, G60 18% (highest bottom-3 in G60). Verbatims "no spare tire"; G70 run-flat wants | US | Medium-High |
| T9 | **Opening sunroof, light and sun protection** | G70 panorama roof wants 14 ("sunroof that can open"), sun protection 8; G60 panorama roof 12, ambient light 13 | US | Medium |
| T10 | **Seat comfort features: massage, ventilation** | Seat massage wants G60 8, G70 9; seat ventilation/heat G70 7. Note: brand-fit question (Mercedes is seen as owning massage seats `[DE]`) | US | Medium |

**Strengths to preserve** (high *Likes* volume and high study scores; a successor must not lose these):
- **Driving dynamics, drivetrain, handling**: the top 3 *Likes* topics for all three models (F70: chassis/dynamics 475, drivetrain 424; G60: drivetrain 347, handling 215; G70: drivetrain 300, handling 232).
- **Exterior design**: G60 EU exterior styling **9.83** (second-highest value in the sheet after G60 ride quality 9.95), G60/G70 likes 144/161.
- **F70 sportiness 9.34, reliability 9.40, fuel economy 9.30** (EU).
- **G70 rear comfort and space** (US top-2: 2nd-row roominess 78%, ride comfort 75%), automatic doors (33 likes), quietness EU **9.78**.
- **Prestige / brand reputation**: 8.9 to 9.2 everywhere; US G60 top-2 71%.

---

## 2. Per model

### F70 · BMW 1 Series (entry model, ICE, Europe)
Context: about 85k EU units, flat to 2030 (+2%). PMs: the 1 Series is #3 in its European segment, wants to be #1, and faces **cheap Chinese competitors with rich feature baselines** `[PM1]`.

| Likes (verbatims) | Pain: Difficult to Use | Pain: Defect | Wants |
|---|---|---|---|
| Driving dynamics/chassis 475 | Touch screen operation 83 | ConnectedDrive/infotainment 42 | Price-performance 23 |
| Drivetrain 424 | Drivetrain 79 | Touch screen 34 | Handling usability 21 |
| Handling/riding 179 | ConnectedDrive/infotainment 59 | Seats 25 | Owner's manual 17 |
| Exterior design 56 | Owner's manual 44 | Audio 22 | Engine performance 13 |
| Body equipment 54 | Navigation 20 | Drivetrain 21 | Engine sound 13 |

- **EU study, lowest:** luggage capacity 7.07, HVAC 7.30, connected services 7.36, loading 7.50, environmental friendliness 7.55, quietness 7.62. **Highest:** reliability 9.40, sportiness 9.34, fuel economy 9.30.
- **Verbatim signals:** no paper owner's manual (UK pensioners, Japan); "premium digital costs extra"; fake exhaust pops through the speakers on the M135 ("quite sad"); low roofline makes entry hard; deep door pockets; would prefer a dial over touch.
- Requirement angles: keep the class-leading sportiness and efficiency; fix usability of the screen-centric UI; more usable luggage space; perceived value (equipment level) vs. Chinese entrants.

### G60 · BMW 5 Series / i5 (G68 = China long-wheelbase variant)
Context: the volume model. 2025: EU 115k, US 78k, CN 75k, RoW 28k. 2030: EU +10%, others +3 to 11%.

| Likes | Pain: Difficult to Use | Pain: Defect | Wants |
|---|---|---|---|
| Drivetrain 347 | Body equipment 60 | ConnectedDrive 15 | Price-performance 17 |
| Handling 215 | Electric range 52 | Drivetrain 15 | OS usability / physical buttons 14 |
| Exterior design 144 | Non-contact trunk opening 39 | Seats 13 | Exterior design 13 |
| Body equipment 128 | Drivetrain 36 | Audio 13 | MSA permanent off 10 |
| Interior design 86 | Seats 30 | CarPlay 11, wireless charging 11 | Range 10, ambient light 9, panorama roof 9, frunk 8, seat massage 8 |

- **EU study, lowest:** loading 7.24, value 7.36, connected 7.37, fuel economy 7.45, rear roominess 7.46, HVAC 7.47, **sportiness 7.64** (vs F70 9.34). **Highest:** ride 9.95, exterior styling 9.83, reliability 9.25.
- **China G68, lowest:** loading 7.25, connected 7.35, braking 7.38, **level of equipment 7.49** (vs G70 China 9.82), quietness 7.52. China rates luggage capacity highly (8.73).
- **US study, weakest top-2:** affordable to buy 20%, cost of ownership 28%, heater/AC controls 29%, climate performance 36%, menu structure 36%. **Highest bottom-3:** flat-tire preparedness 18%, heater/AC controls 15%, resale 13%, WiFi hotspot 13%, menu structure 13%. **Best:** prestige 71%, headlights 70%, handling 70%.
- **BEV-specific pain:** range 43, public charging 28, HV battery charging 17.

### G70 · BMW 7 Series / i7 (luxury flagship)
Context: small volumes, fastest growth: 2025 EU 13k, US 12k, CN 10k, RoW 7k. 2030: EU **+31%**, RoW +29%, CN +20%, US +17%.

| Likes | Pain: Difficult to Use | Pain: Defect | Wants |
|---|---|---|---|
| Drivetrain 300 | Body equipment 52 | Exterior 28 | Wheels/tires 19 (all-season, run-flat, reuse rims) |
| Handling 232 | Operating concept 33 | ConnectedDrive 24 | Exterior design 17 |
| Exterior design 161 | Climatization 32 | Drivetrain 22 | Panorama roof that opens 14 |
| Interior design 97 | Personal eSIM 26 | Personal eSIM 11 | Range 13, MSA off 13 |
| Interior comfort 70 | Touch screen 26, My BMW App 24 | Seats 11, exterior lighting 10 | Digital rear-view mirror 11, seat massage 9, sun protection 8 |

- **EU study:** overall satisfaction **7.98** (lowest of all), value for money **6.47**, sportiness **6.97**. **Highest:** quietness 9.78, front roominess 9.69, reliability 9.67, braking 9.60.
- **China G70:** overall satisfaction **9.64** (highest of all), level of equipment 9.82. Lowest: connected 7.32, environmental friendliness 7.44, loading 7.46, **rear roominess 7.52, front roominess 7.69**.
- **US study, weakest top-2:** affordable 6%, resale 13%, price/deal 14%, cost of ownership 16%, intuitiveness of controls 25%, place for phone 27%. **Highest bottom-3:** resale 34%, flat tire 32%, ease of customization 30%, intuitiveness 26%, cost of ownership 25%, controls placement 24%. **Best:** 2nd-row roominess 78%, front roominess 77%, ride comfort 75%.
- **Verbatim signals:** the rear-view mirror is blocked when privacy blinds or the theatre screen are down, so customers want a camera mirror; rear screens can't be disabled (kids); slow AC cool-down; eSIM unusable until a software update.

---

## 3. Conflicting signals (good demo material for "don't hide, let the PM decide")

| Conflict | Data | Why it matters |
|---|---|---|
| **G70 China vs. Europe** | Overall satisfaction CN 9.64 vs EU 7.98; sportiness 8.64 vs 6.97; value 8.29 vs 6.47; but front/rear roominess CN 7.69/7.52 vs EU 9.69/9.41 (gaps of −2.0/−1.9) | Chinese owners love the car but find it **cramped** (they're likely chauffeured, rear-seat buyers). Europeans find it roomy but overpriced and not sporty. One car or two variants? |
| **Sportiness by series** | F70 9.34 vs G60 7.64 vs G70 6.97 (EU) | "BMW = sporty" is satisfied in the 1 Series, much less so in the 5 and 7. Is sportiness a must-have for luxury buyers? |
| **G60 exterior styling** | EU 9.83 vs China G68 8.19 | Design that wins in Europe is weaker in China |
| **Level of equipment in China** | G68 7.49 vs G70 9.82 | The 5 Series is perceived as under-equipped in China, which matters against Chinese rivals |
| **Luggage** | China G68 rates luggage 8.73, EU G60 7.54 | Long wheelbase and different use |
| **Likes vs. pains on the same topic** | Drivetrain is the #1 like *and* a top pain in all models; automatic doors (G70) are liked (33) and also a pain (18 DTU) | Preserve and fix at the same time: needs finer sub-topics (`aspect` column) |
| **Volume vs. relevance** | US verbatims dominate G60/G70 feedback, but Europe is the biggest market | Weight findings by market volume (sales sheet), not by number of verbatims |

---

## 4. Data quality notes
- 300 F70, 446 G60 and 452 G70 verbatims have **no feedback type**, and many rows have `topic = no_class_found`, so classify them from the text. Among them are general statements ("Really love this car!").
- Topic labels are coarse and sometimes odd ("Body equipment, overall technology : Dislike: price-performance ratio" is tagged *Wants*). Read the `aspect` column and the text.
- Feedback type labels mix sentiment and request. A verbatim can be *Likes* and *Difficult to Use* at once (see F70-0002).
- The CN/EU study gives **means only**, with no sample sizes. The US study gives **distributions only**. Don't compare the two directly. For the US, use `top2_box`, `bottom3_box` or `mean_score_7` from `study_us_2025.csv`.
- Sales: Rest of World is identical for F70 and G60_G68 (25k/28k/31k), which is probably a placeholder. 2030 is a forecast.
- F70 is labelled ICE only, yet the option list shows 48 V mild-hybrid variants, and a few verbatims mention a "hybrid motor".
