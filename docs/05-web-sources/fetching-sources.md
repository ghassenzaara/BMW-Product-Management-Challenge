# Fetching Sources: Where We Get External Data

The reference list of external sources to scrape: what to search for, where to get it, in which order, and what to save.

- **Purpose:** enrich the provided BMW data ([`../02-bmw-data/README.md`](../02-bmw-data/README.md)) with competitor, market and customer signals from the web.
- **Traceability:** everything fetched is saved together with the source it came from ([section 7](#7-what-to-save-with-every-record)), so any later signal can be traced back to its origin.
- **Checked on:** 2026-10-10. Lines marked ✓ were confirmed live on that date.

## Contents

1. [Scope](#1-scope)
2. [What to search for](#2-what-to-search-for)
3. [Source list](#3-source-list)
4. [Markets covered by shared platforms](#4-markets-covered-by-shared-platforms)
5. [Coverage per model and market](#5-coverage-per-model-and-market)
6. [Fetch order](#6-fetch-order)
7. [What to save with every record](#7-what-to-save-with-every-record)
8. [Sources not fetched](#8-sources-not-fetched)

---

## 1. Scope

| Topic | In scope |
|---|---|
| BMW vehicles | 1 Series (F70), 5 Series (G60, Touring G61, China long-wheelbase G68, incl. i5 and M5), 7 Series (G70, incl. i7) |
| Markets | USA, China, Europe (incl. the UK) |
| Content | Usability, quality, equipment, digital services, customer wishes, competition, new launches, market trends |
| Vehicles fetched | The three BMW models and **every competitor** in [section 2.3](#23-competitors) |
| Fetch depth | **All pages** of every listing, thread and review list: every result page, not only the entry page or the first page |

Model-market combinations (from the sales volumes file, where F70 volumes in the USA and China are zero):

| Model | USA | China | Europe |
|---|---|---|---|
| 1 Series F70 | Not sold | Not sold | **Yes** |
| 5 Series G60 / i5 | **Yes** | Sold as long-wheelbase **G68** | **Yes** |
| 7 Series G70 / i7 | **Yes** | **Yes** | **Yes** |

That gives **7 combinations**. Competitors are fetched in the markets where the matching BMW is sold.

---

## 2. What to search for

### 2.1 BMW models

| Model | Chassis code | Generation, on sale since | Predecessor | Variant names | URL slugs | Wikipedia page |
|---|---|---|---|---|---|---|
| 1 Series | F70 | 4th generation ✓, 2024 | F40, 3rd generation ✓ | 116, 118, 120, 120d, 123 xDrive, M135 | `1-series` | `BMW 1 Series (F70)` ✓ |
| 5 Series | G60 sedan, G61 Touring, G68 long wheelbase (China) ✓; M5 is G90 / G99 | 8th generation, since 2023 ✓ (US model year 2024 onward) | G30 / G31, sales from February 2017 ✓; G38 in China | 520i, 530i, 540i, 550e, 530e, i5 eDrive40, i5 xDrive40, i5 M60, M5 | `5-series`, `i5`, `m5` | `BMW 5 Series (G60)` ✓ |
| 7 Series | G70 | 7th generation, since July 2022 ✓ (US model year 2023 onward) | G11 / G12, 2015 to 2022 ✓ | 740i, 750e, 760i, i7 eDrive50, i7 xDrive60, i7 M70 | `7-series`, `i7` | `BMW 7 Series (G70)` ✓ |

Records published before the "on sale since" date belong to the predecessor.

US variant names per model year come from two APIs, both confirmed for model year 2025 ✓:

- `nhtsa-vpic`: `530i`, `540i`, `550e`, `i5`, `M5`, `740i`, `750e`, `760i`, `i7`.
- `fueleconomy`: `530i Sedan`, `530i xDrive Sedan`, `540i xDrive Sedan`, `550e xDrive Sedan`, `740i Sedan`, `740i xDrive Sedan`, `750e xDrive Sedan`, `760i xDrive Sedan`.

**NHTSA complaint names.** The complaints API uses its own names, which change from year to year. Names returned by its lookup (`api.nhtsa.gov/products/vehicle/models?modelYear={year}&make=BMW&issueType=c`) ✓, with the number of complaints on 2026-10-10:

| Model year | 5 Series names (complaints) | 7 Series names (complaints) |
|---|---|---|
| 2023 | `5 SERIES SEDAN`, `5 SERIES HYBRID SEDAN` (both are the predecessor G30) | `7 SERIES SEDAN` (23), `I7 SEDAN` (8) |
| 2024 | `530I` (13), `540I` (5), `I5` (20) | `7 SERIES SEDAN` (8), `I7 SEDAN` (15) |
| 2025 | `I5` (8), `5 SERIES HYBRID SEDAN` (2) | `I7` (1), `7 SERIES HYBRID SEDAN` |
| 2026 | `5 SERIES HYBRID SEDAN PHEV` | `I7 SEDAN BEV` |

The lookup lists only names that already have complaints, so it is queried again before each fetch. Each complaint has `odiNumber`, `dateComplaintFiled`, `dateOfIncident`, `components`, `summary`, `crash` and `fire`.

### 2.2 BMW model names per language

| Language | 1 Series | 5 Series | 7 Series | Used for |
|---|---|---|---|---|
| English | 1 Series | 5 Series, i5 | 7 Series, i7 | USA, UK, shared platforms |
| German | 1er | 5er, i5 | 7er, i7 | Motor-Talk, German magazines, KBA |
| French | Série 1 | Série 5 | Série 7 | Caradisiac, L'argus |
| Italian, Spanish | Serie 1 | Serie 5 | Serie 7 | Quattroruote, km77 |
| Dutch | 1 Serie | 5 Serie | 7 Serie | AutoWeek.nl |
| Chinese | n/a | 宝马5系, 宝马i5 | 宝马7系, 宝马i7 | Native Chinese sources |

### 2.3 Competitors

One row per competitor. "Generation, since" marked ✓ was confirmed on the listed Wikipedia page on 2026-10-10; the others are filled from that page in step 1 of the fetch order. On most sites the URL slug is the model name in lower case with hyphens (`e-class`, `model-s`); the slug each site really uses for each competitor is in section 3.10.

**Rivals of the 1 Series (Europe only)**

| Competitor | Generation, since | German / French name | Wikipedia page |
|---|---|---|---|
| Audi A3 | 4th generation (8Y) | A3 | `Audi A3` |
| Mercedes A-Class | W177, 2018 ✓ | A-Klasse / Classe A | `Mercedes-Benz A-Class (W177)` |
| VW Golf | Mk8, 2019 ✓ | Golf 8 | `Volkswagen Golf Mk8` |
| Cupra Leon | Based on the 4th SEAT León | Leon | `Cupra Leon` |
| MG4 | 2022 ✓ | MG4 | `MG4 EV` |
| BYD Dolphin | 2021 ✓ | Dolphin | `BYD Dolphin` |

**Rivals of the 5 Series**

| Competitor | Generation, since | German / French name | Chinese name | Wikipedia page |
|---|---|---|---|---|
| Mercedes E-Class (E-Class L in China) | W214, 2023 ✓ | E-Klasse / Classe E | 奔驰E级 | `Mercedes-Benz E-Class (W214)` |
| Mercedes EQE | V295, shown 2021 ✓ | EQE | 奔驰EQE | `Mercedes-Benz EQE` |
| Audi A6 (A6L in China) | 6th generation ✓ | A6 | 奥迪A6L | `Audi A6` |
| Audi A6 e-tron | 2024 ✓ | A6 e-tron | 奥迪A6 e-tron | `Audi A6 e-tron` |
| Tesla Model S | 2012 to 2026, production ended ✓ | Model S | 特斯拉Model S | `Tesla Model S` |
| Genesis G80 | 3rd generation | G80 | 捷尼赛思G80 | `Genesis G80` |
| Lexus ES | 8th generation ✓ | ES | 雷克萨斯ES | `Lexus ES` |
| NIO ET7 | 1st generation | ET7 | 蔚来ET7 | `Nio ET7` |
| Zeekr 001 | 2021 ✓ | 001 | 极氪001 ✓ | `Zeekr 001` |
| Xiaomi SU7 | 1st generation | SU7 | 小米SU7 ✓ | `Xiaomi SU7` |
| BYD Han | 2020 ✓ | Han | 比亚迪汉 ✓ | `BYD Han` |

**Rivals of the 7 Series**

| Competitor | Generation, since | German / French name | Chinese name | Wikipedia page |
|---|---|---|---|---|
| Mercedes S-Class | W223, 2020 ✓ | S-Klasse / Classe S | 奔驰S级 | `Mercedes-Benz S-Class (W223)` |
| Mercedes EQS | V297, 2021 ✓ | EQS | 奔驰EQS | `Mercedes-Benz EQS` |
| Audi A8 (A8L in China) | 4th generation ✓ | A8 | 奥迪A8L | `Audi A8` |
| Lexus LS | 5th generation | LS | 雷克萨斯LS | `Lexus LS` |
| Genesis G90 | 2nd generation, US model year 2023 onward ✓ | G90 | 捷尼赛思G90 | `Genesis G90` |
| Porsche Panamera | 3rd generation ✓ | Panamera | 保时捷Panamera | `Porsche Panamera` |
| Lucid Air | 2021 ✓ | Air | not sold in China | `Lucid Air` |
| NIO ET9 | 2025 ✓ | ET9 | 蔚来ET9 | `Nio ET9` |
| Maextro S800 | 2025 ✓ | not sold in Europe | 尊界S800 ✓ | `Maextro S800` |
| Hongqi H9 | 1st generation | H9 | 红旗H9 | `Hongqi H9` |

Newly launched or announced rivals are added to these tables from the category J sources in section 3.

### 2.4 Search terms that collide

| Term | Also means | Search as |
|---|---|---|
| `i5`, `i7` | Intel processors | `BMW i5`, `BMW i7` |
| `G70` | Genesis G70 (a car) | `BMW G70`, `BMW 7 Series` |
| `G80`, `G90` | Genesis G80 and G90 (competitors); BMW G80 is the M3, BMW G90 is the M5 | `Genesis G80`, `Genesis G90`, `BMW M5 G90` |
| `G60`, `F70`, `G30` | Product codes of many other things | `BMW G60`, `BMW F70`, `BMW G30` |
| `F40` | Ferrari F40 | `BMW F40`, `1 Series F40` |
| `ES`, `LS`, `A3`, `A6`, `A8`, `Golf`, `Leon`, `Han`, `001`, `Dolphin`, `Air`, `Model S` | Ordinary words, numbers, paper sizes | Brand plus model: `Lexus ES`, `Audi A6`, `Zeekr 001` |

On single-brand sources (r/BMW, Bimmerpost, the My BMW app) the model name or chassis code alone is enough. On Google Trends, the topic entity ("BMW 5 Series, car model") is used instead of the text.

---

## 3. Source list

One row per site. Every site has its own ID, and the other sections refer to sources by ID.

Categories:

| Cat | Category | Question it answers |
|---|---|---|
| **A** | Owner complaints and defects | What does not work? |
| **B** | Owner reviews and ratings | What do owners like, dislike, miss? |
| **C** | Community discussion | What do people wish for, why do they switch brand? |
| **D** | Expert and video reviews | How does the car compare in a test? |
| **E** | Competitor equipment | What do rivals offer that we do not? |
| **F** | Market and sales trends | Which models, powertrains, segments are growing? |
| **G** | Quality and satisfaction studies | How do independent rankings place us? |
| **H** | Digital services and apps | What fails in the app and connected services? |
| **I** | Future trends | What will matter in 3 to 5 years? |
| **J** | New launches and model generations | Which models and generations exist, what was just launched, what is coming? |

Columns:

- **URL or pattern:** `{brand}`, `{model}`, `{year}`, `{variant}` are replaced with the slugs from section 2. A pattern is given where it was tested for BMW and at least one competitor.
- **Country:** ISO code as in the BMW feedback files (`GB`, not UK). `Global` = several markets in one source ([section 4](#4-markets-covered-by-shared-platforms)).
- **Level:** `model` = about one car. `brand` = about the brand or its app. `market` = statistics, forecasts or reference data.
- **Check** (one plain HTTP request per URL on 2026-10-10):
  - `Pattern OK` = the URL pattern returned the page for several models.
  - `Data OK` = the API or feed returned real data.
  - `Page OK` = only the entry page was requested and it answered; deeper pages were not tested.
  - `Blocked` = refused (HTTP 403 or 406).
  - `Challenge` = bot check page (HTTP 202).
  - `No response` = timed out.
  - `Not tested` = needs an account, an API key or a library.
- **Access:** `API`, `RSS`, `Scraping` (plain HTTP), `Browser` (needs a real browser session), `Download` (files fetched by hand or script), `Login`.
- **Step:** position in the fetch order ([section 6](#6-fetch-order)).

For the sources in steps 5 to 7, the way to reach every page is in [section 3.9](#39-all-pages-page-structure-and-pagination) and the slug of every competitor on every site is in [section 3.10](#310-all-competitors-slug-per-site).

### 3.1 New launches and model generations (J)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `wikipedia` | Wikipedia model pages: generation codes, production years, body variants, successors | `en.wikipedia.org/w/api.php?action=query&prop=extracts&titles={page}` with the page names from section 2; also `de.` and `zh.` editions. Several titles per request, joined with a vertical bar; single rapid requests are rate-limited | J | Global | market | API | Data OK | 1 |
| `wikidata` | Wikidata: manufacturer, start of production, predecessor, successor | `wikidata.org/w/api.php?action=wbsearchentities&search={brand model}` | J | Global | market | API | Data OK | 1 |
| `nhtsa-vpic` | NHTSA vPIC: every model of a make per US model year | `vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/{brand}/modelyear/{year}?format=json` | J | US | market | API | Data OK | 1 |
| `fueleconomy` | US EPA fuel economy: exact variants and powertrains per US model year | `fueleconomy.gov/ws/rest/vehicle/menu/model?year={year}&make={brand}` | J, E | US | market | API | Data OK | 1 |
| `auto-data` | auto-data.net: generations, production years, technical specs | Brand index `auto-data.net/en/bmw-brand-86`; BMW model pages `auto-data.net/en/bmw-1-series-model-948`, `...bmw-5-series-model-944`, `...bmw-7-series-model-945`, `...bmw-i5-model-3260`, `...bmw-i7-model-3105`; competitor pages are linked from each brand index | J, E | Global | market | Scraping | Pattern OK | 1 |
| `ev-database` | EV Database: electric models on sale and announced, availability dates, specs | `ev-database.org/car/{id}/{name}`. BMW: `1906/BMW-i5-eDrive40-Sedan`, `2096/BMW-i5-xDrive40-Sedan`, `1907/BMW-i5-M60-xDrive-Sedan`, `2114/BMW-i5-eDrive40-Touring`, `2115/BMW-i5-M60-xDrive-Touring`, `1905/BMW-i7-eDrive50`, `1676/BMW-i7-xDrive60`, `1838/BMW-i7-M70-xDrive`; all cars are linked from `ev-database.org` | J, E | EU | market | Scraping | Pattern OK | 1 |
| `motor1` | Motor1 news | `motor1.com/rss/news/all/` | J, E | Global | model | RSS | Data OK | 3 |
| `insideevs` | InsideEVs news | `insideevs.com/rss/news/all/` | J, E, I | Global | model | RSS | Data OK | 3 |
| `electrek` | Electrek news | `electrek.co/feed/` | J, I | Global | model | RSS | Data OK | 3 |
| `thedrive` | The Drive news | `thedrive.com/feed` | J | US | model | RSS | Data OK | 3 |
| `carscoops` | Carscoops news and spy shots | `carscoops.com/feed/`, `carscoops.com/category/scoops/` | J | Global | model | RSS | Data OK | 3 |
| `autoevolution-feed` | autoevolution news | `autoevolution.com/rss/backend.xml` | J | Global | model | RSS | Data OK | 3 |
| `bmwblog` | BMWBlog, BMW-only news | `bmwblog.com/feed/` | J | Global | model | RSS | Data OK | 3 |
| `bimmertoday` | Bimmertoday, BMW-only news in German | `bimmertoday.de/feed/` | J | DE | model | RSS | Data OK | 3 |
| `carnewschina` | CarNewsChina: Chinese launches, specs, MIIT filings (new models before launch), monthly sales, in English | `carnewschina.com/feed/`, `carnewschina.com/tag/{brand}/`, `carnewschina.com/tag/miit/` | J, E, F | CN | model | RSS, Scraping | Data OK | 3 |
| `cnevpost` | CnEVPost: Chinese EV launches and CPCA / CAAM sales, in English | `cnevpost.com/feed/`, `cnevpost.com/tag/{brand}/` | J, E, F | CN | model | RSS, Scraping | Data OK | 3 |
| `press-bmw` | BMW Group PressClub | `press.bmwgroup.com/global`, feed `press.bmwgroup.com/global/rss` | J, E | Global | model | RSS, Scraping | Data OK | 3 |
| `press-mercedes` | Mercedes-Benz Media | `media.mercedes-benz.com` | J, E | Global | model | Scraping | Page OK | 3 |
| `press-audi` | Audi Media Center (the old `audi-mediacenter.com` address redirects here) | `audi.com/en/press-releases`, hub `audi.com/en/service-2305` | J, E | Global | model | Scraping | Page OK | 3 |
| `press-genesis` | Genesis newsroom (USA) | `genesisnewsusa.com` | J, E | US | model | Scraping | Page OK | 3 |
| `press-lexus` | Lexus pressroom (USA) | `pressroom.lexus.com` | J, E | US | model | Scraping | Page OK | 3 |
| `press-porsche` | Porsche Newsroom | `newsroom.porsche.com/en.html` | J, E | Global | model | Scraping | Page OK | 3 |
| `autocar-new-cars` | Autocar "new cars" list | `autocar.co.uk/car-news/new-cars` | J | GB | model | Scraping | Page OK | 3 |
| `caranddriver-future` | Car and Driver "future cars" | `caranddriver.com/future-cars/` | J | US | model | Scraping | Page OK | 3 |
| `autoexpress-news` | Auto Express news | `autoexpress.co.uk/news` | J | GB | model | Scraping | Page OK | 3 |
| `autohome-new` | Autohome new-car listing | `autohome.com.cn/newbrand/` | J | CN | model | Scraping, Chinese | Page OK | 3 |
| `dongchedi-new` | Dongchedi new-car listing | `dongchedi.com/newcar` | J | CN | model | Scraping, Chinese | Page OK | 3 |
| `byd-site` | BYD | `byd.com` | J, E | CN | model | Scraping | Page OK | 3 |
| `nio-site` | NIO news | `nio.com/news` | J, E | CN | model | Scraping | Page OK | 3 |
| `xiaomi-ev-site` | Xiaomi EV | `xiaomiev.com` | J, E | CN | model | Scraping | Page OK | 3 |
| `zeekr-site` | Zeekr | `zeekrlife.com` | J, E | CN | model | Scraping | Page OK | 3 |
| `iaa` | IAA Mobility (Munich auto show) | `iaa-mobility.com/en` | J, I | DE | model | Scraping | Page OK | 3 |
| `ces` | CES | `ces.tech` | J, I | US | model | Scraping | Page OK | 3 |
| `auto-china` | Auto China (Beijing and Shanghai shows) | `autochinashow.org` | J, I | CN | model | Scraping | Page OK | 3 |
| `autoblog` | Autoblog news | `autoblog.com` | J | US | model | Browser | Blocked (403) | 11 |
| `autoevolution-pages` | autoevolution model generation pages | `autoevolution.com/{brand}/{model}/` | J | Global | market | Browser | Blocked (403) | 11 |
| `gasgoo` | Gasgoo, Chinese industry news in English | `autonews.gasgoo.com` | J | CN | model | Browser | Blocked (403) | 11 |
| `tesla-ir` | Tesla investor relations (Tesla has no press portal) | `ir.tesla.com` | J, E | Global | model | Browser | Blocked (403) | 11 |

### 3.2 Owner complaints and defects (A)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `nhtsa-complaints` | NHTSA owner complaints | `api.nhtsa.gov/complaints/complaintsByVehicle?make={brand}&model={NHTSA name}&modelYear={year}`, names from section 2.1 | A | US | model | API | Data OK | 2 |
| `nhtsa-recalls` | NHTSA recalls | `api.nhtsa.gov/recalls/recallsByVehicle?make={brand}&model={NHTSA name}&modelYear={year}` | A | US | model | API | Not tested | 2 |
| `carcomplaints` | CarComplaints.com | `carcomplaints.com/{Brand}/{variant}/`; the variant list per brand is in [3.9](#39-all-pages-page-structure-and-pagination) | A | US | model | Scraping | Pattern OK | 6 |
| `adac-breakdown` | ADAC breakdown statistics | `adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik/` | A | DE | model | Scraping | Page OK | 9 |
| `tuv-report` | TÜV Report (press summaries; the full report is paid) | `tuv.com/germany/de/` | A | DE | model | Scraping | Page OK | 9 |
| `12365auto` | 12365auto owner complaint platform | `12365auto.com/zlts/` | A | CN | model | Scraping, Chinese | Page OK | 10 |
| `eu-safety-gate` | EU Safety Gate product alerts | `ec.europa.eu/safety-gate-alerts/screen/search` | A | EU | model | Scraping, JS app | Page OK | 12 |
| `samr-recalls` | SAMR recall notices | `samr.gov.cn` | A | CN | model | Scraping, Chinese | Page OK | 12 |

### 3.3 Owner reviews and ratings (B)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `parkers` | Parkers owner and expert reviews | `parkers.co.uk/{brand}/{model}/owner-reviews/`, then per generation with `?page={n}`; structure in [3.9](#39-all-pages-page-structure-and-pagination), slugs in [3.10](#310-all-competitors-slug-per-site) | B | GB | model | Scraping | Pattern OK | 6 |
| `whatcar` | What Car? reviews and Reliability Survey | `whatcar.com/{brand}/{model}/{body}/review/`, body = `hatchback`, `saloon` or `estate`: `bmw/1-series/hatchback`, `bmw/5-series/saloon`, `bmw/7-series/saloon`, `mercedes-benz/e-class/saloon` | B, G | GB | model | Scraping | Pattern OK | 6 |
| `kbb` | Kelley Blue Book consumer reviews | `kbb.com/{brand}/{model}/{year}/consumer-reviews/`; reviews are in the page JSON; structure in [3.9](#39-all-pages-page-structure-and-pagination), slugs in [3.10](#310-all-competitors-slug-per-site) | B | US | model | Scraping | Pattern OK | 6 |
| `carwow` | Carwow owner and expert reviews | `carwow.co.uk/{brand}/{model}`: `bmw/1-series`, `bmw/5-series`, `bmw/7-series`, `mercedes/e-class`, `audi/a3`. Mercedes slug is `mercedes`. German site `carwow.de` | B, D | GB, DE | model | Scraping | Pattern OK | 6 |
| `autoscout24` | AutoScout24 model pages and owner ratings | `autoscout24.de/auto/{brand}/{brand}-{model}/`: `bmw/bmw-1er`, `bmw/bmw-5er`, `bmw/bmw-7er`, `mercedes-benz/mercedes-benz-e-klasse` | B | DE | model | Scraping | Pattern OK | 6 |
| `caradisiac` | Caradisiac owner "avis" | `caradisiac.com` | B, D | FR | model | Scraping, French | Page OK | 10 |
| `largus` | L'argus | `largus.fr` | B | FR | model | Scraping, French | Page OK | 10 |
| `quattroruote` | Quattroruote | `quattroruote.it/listino/{brand}/{model}`: `bmw/serie-5` | B, D | IT | model | Scraping, Italian | Page OK | 10 |
| `alvolante` | AlVolante | `alvolante.it` | B | IT | model | Scraping, Italian | Page OK | 10 |
| `km77` | km77 | `km77.com/coches/{brand}/{model}`: `bmw/serie-5` | B, D | ES | model | Scraping, Spanish | Page OK | 10 |
| `coches-net` | coches.net | `coches.net` | B | ES | model | Scraping, Spanish | Page OK | 10 |
| `elbilforum` | Elbilforum, Norwegian EV owners | `elbilforum.no` | B, C | NO | model | Scraping, Norwegian | Page OK | 10 |
| `autohome` | Autohome owner reviews (koubei) | `k.autohome.com.cn/{series id}/`; the series ID of each model is found through the site search | B | CN | model | Scraping, Chinese | Page OK | 10 |
| `dongchedi` | Dongchedi owner reviews and rankings | `dongchedi.com/auto/series/{series id}` | B | CN | model | Scraping, Chinese | Page OK | 10 |
| `yiche` | Yiche | `yiche.com` | B | CN | model | Scraping, Chinese | Page OK | 10 |
| `pcauto` | PCauto | `pcauto.com.cn` | B | CN | model | Scraping, Chinese | Page OK | 10 |
| `xcar` | Xcar | `xcar.com.cn` | B | CN | model | Scraping, Chinese | Page OK | 10 |
| `cars-com` | Cars.com consumer reviews | `cars.com/research/{brand}-{variant}-{year}/consumer-reviews/`: `bmw-530-2024` | B | US | model | Browser | Blocked (403) | 11 |
| `edmunds` | Edmunds consumer and expert reviews | `edmunds.com/{brand}/{model}/{year}/consumer-reviews/`: `bmw/5-series/2024` | B, D | US | model | Browser | Blocked (403) | 11 |
| `cargurus` | CarGurus owner reviews | `cargurus.com` | B | US | model | Browser | Blocked (406) | 11 |
| `autotrader-uk` | Auto Trader UK owner reviews | `autotrader.co.uk` | B | GB | model | Browser | Blocked (403) | 11 |
| `mobile-de` | mobile.de owner ratings | `mobile.de` | B | DE | model | Browser | Blocked (403) | 11 |
| `autoweek-nl` | AutoWeek.nl owner reviews | `autoweek.nl` | B, D | NL | model | Browser, Dutch | Blocked (403) | 11 |

### 3.4 Community discussion (C)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `reddit` | Reddit: `r/BMW`, `r/cars`, `r/electricvehicles`, `r/whatcarshouldIbuy`, `r/mercedes_benz`, `r/Audi`, `r/TeslaLounge`, `r/CarTalkUK`; model subreddits are found with the API's subreddit search (`/subreddits/search?q=BMW i5`) | `oauth.reddit.com/r/{subreddit}/search?q={term}&restrict_sr=1` | C, H | Global, US-heavy | model | API | Not tested | 2 |
| `youtube-comments` | YouTube comments on videos of the channels in section 3.5 | `googleapis.com/youtube/v3/commentThreads?videoId={video id}` | C, D | Global | model | API | Not tested | 2 |
| `motor-talk` | Motor-Talk, largest German car forum | BMW index `motor-talk.de/forum/bmw-b4.html`. F70: `/forum/bmw-1er-f70-b1196.html`; F40: `/forum/bmw-1er-f40-b1079.html`; G60, G61 and M5: `/forum/bmw-5er-g60-g61-g90-g99-b1172.html`; G30: `/forum/bmw-5er-g30-g31-f90-b1004.html`; 7 Series: `/forum/bmw-6er-7er-8er-b167.html`; i5: `/forum/bmw-i5-b1188.html`; other BMW i models under `/forum/bmw-i-b867.html`. Rival brand forums are linked from `motor-talk.de/forum/auto-b3.html` (`audi-b40`, `cupra-b1104`, `byd-b1208`, `chinesische-pkw-b433`) | C | DE | model | Scraping, German | Pattern OK | 5 |
| `tmc` | Tesla Motors Club, Model S forum | `teslamotorsclub.com/tmc/forums/model-s.73/` | C | US | model | Scraping | Pattern OK | 5 |
| `genesis-owners` | Genesis Owners | G80: `genesisowners.com/genesis-forum/forums/genesis-g80-forum-g80-ev-forum-g80forum-com.107/`; G90 from 2023: `.../forums/genesis-g90-2023-second-generation.161/` | C | US | model | Scraping | Pattern OK | 5 |
| `lucid-owners` | Lucid Owners, Air forums | `lucidowners.com/forums/`, feed `lucidowners.com/forums/-/index.rss` | C | US | model | Scraping, RSS | Pattern OK | 5 |
| `pistonheads` | PistonHeads, "BMW General" forum | `pistonheads.com/gassing/forum.asp?h=0&f=72` | C | GB | model | Scraping | Pattern OK | 5 |
| `bimmerpost-g60` | Bimmerpost 5 Series G60 forum | `g60.bimmerpost.com/forums/` | C, H | Global, US-heavy | model | Browser | Blocked (403) | 11 |
| `bimmerpost-g70` | Bimmerpost 7 Series G70 forum | `g70.bimmerpost.com/forums/` | C, H | Global, US-heavy | model | Browser | No response | 11 |
| `bimmerpost-f70` | Bimmerpost 1 Series F70 forum | `f70.bimmerpost.com/forums/`; the address answers but is blocked, so the forum itself is unconfirmed. All model forums are linked from `bimmerpost.com` | C, H | Global | model | Browser | Blocked (403) | 11 |
| `mbworld` | MBWorld (E-Class, S-Class, EQE, EQS) | `mbworld.org/forums/` | C | US | model | Browser | Blocked (403) | 11 |
| `audiworld` | AudiWorld (A6, A8, A3) | `audiworld.com/forums/` | C | US | model | Browser | Blocked (403) | 11 |
| `clublexus` | ClubLexus (ES, LS) | `clublexus.com/forums/` | C | US | model | Browser | Blocked (403) | 11 |
| `bimmerfest` | Bimmerfest | `bimmerfest.com` | C | US | model | Browser | Challenge (202) | 11 |
| `speakev` | SpeakEV (i5, i7 and electric rivals) | `speakev.com` | C | GB | model | Browser | Challenge (202) | 11 |
| `weibo` | Weibo | `weibo.com` | C | CN | model | Login, Chinese | Page OK | 13 |
| `xiaohongshu` | Xiaohongshu | `xiaohongshu.com` | C | CN | model | Login, Chinese | Page OK | 13 |
| `bilibili` | Bilibili | `bilibili.com` | C, D | CN | model | Login, Chinese | Page OK | 13 |
| `douyin` | Douyin | `douyin.com` | C | CN | model | Login, Chinese | Page OK | 13 |
| `zhihu` | Zhihu | `zhihu.com` | C | CN | model | Login, Chinese | Page OK | 13 |

### 3.5 Expert and video reviews (D)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `youtube-transcripts` | YouTube transcripts of the channels below | Video list per channel: `googleapis.com/youtube/v3/search?channelId={channel id}&q={term}`; transcript through a transcript library | D | Global | model | API, library | Not tested | 7 |
| `caranddriver` | Car and Driver | `caranddriver.com/{brand}/{model}`: `bmw/5-series`, `bmw/7-series`, `bmw/i5`, `mercedes-benz/e-class`, `genesis/g80` | D | US | model | Scraping | Pattern OK | 7 |
| `motortrend` | MotorTrend | `motortrend.com/cars/{brand}/{model}/`: `bmw/5-series`, `bmw/7-series`, `mercedes-benz/e-class` | D | US | model | Scraping | Pattern OK | 7 |
| `autocar` | Autocar | `autocar.co.uk/car-review/{brand}/{model}`: `bmw/1-series`, `bmw/5-series`, `bmw/7-series`, `mercedes-benz/e-class`, `audi/a3` | D | GB | model | Scraping | Pattern OK | 7 |
| `autoexpress` | Auto Express, incl. Driver Power owner survey | `autoexpress.co.uk/{brand}/{model}`: `bmw/1-series`, `bmw/5-series`, `bmw/7-series`, `mercedes/e-class`, `audi/a3`. Mercedes slug is `mercedes` | D, G | GB | model | Scraping | Pattern OK | 7 |
| `topgear` | Top Gear | `topgear.com/car-reviews/{brand}/{model}`: `bmw/1-series`, `bmw/5-series`, `bmw/7-series`, `mercedes-benz/e-class` | D | GB | model | Scraping | Pattern OK | 7 |
| `drive-uk` | Drive (drive.co.uk), the successor of Honest John: every `honestjohn.co.uk` address now redirects here | `drive.co.uk/cars/{brand}/{model}/review`: `bmw/1-series`, `bmw/5-series`, `bmw/i5`, `bmw/7-series`, `mercedes-benz/e-class`, `audi/a3` | D | GB | model | Scraping | Pattern OK | 7 |
| `ams` | auto motor und sport | `auto-motor-und-sport.de/marken-modelle/{brand}/{model}/`; slugs in [3.9](#39-all-pages-page-structure-and-pagination) | D | DE | model | Scraping, German, partly paywalled | Pattern OK | 7 |
| `autobild` | Auto Bild | `autobild.de/marken-modelle/{brand}/{model}/`; slugs in [3.9](#39-all-pages-page-structure-and-pagination) | D | DE | model | Scraping, German | Pattern OK | 7 |
| `adac-autotest` | ADAC Autotest scored tests | `adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/{brand}/{model}/`; slugs in [3.9](#39-all-pages-page-structure-and-pagination) | D, G | DE | model | Scraping, German | Pattern OK | 7 |
| `automobile-magazine` | L'Automobile Magazine | `automobile-magazine.fr` | D | FR | model | Scraping, French | Page OK | 7 |
| `teknikens-varld` | Teknikens Värld | `teknikensvarld.expressen.se` | D | SE | model | Scraping, Swedish | Page OK | 7 |
| `podcasts` | The Smoking Tire and Autocar podcasts, through their YouTube channels below | Same as `youtube-transcripts` | D | Global | model | API, library | Not tested | 12 |

YouTube channels, with channel IDs read from each channel page on 2026-10-10 ✓:

| Channel | Handle | Channel ID | Country |
|---|---|---|---|
| Carwow | `@carwow` | `UCcftUjNsimynCrKGFolLRKQ` | GB |
| Doug DeMuro | `@DougDeMuro` | `UCG72WbiCvdB6JKU-3YRP8Kg` | US |
| Throttle House | `@ThrottleHouse` | `UCyXiDU5qjfOPxgOPeFWGwKw` | CA |
| Savagegeese | `@savagegeese` | `UCgUvk6jVaf-1uKOqG8XNcaQ` | US |
| Out of Spec Reviews | `@OutofSpecReviews` | `UCyIzTVZNIAMY9JhzKc-rriQ` | US |
| Autogefühl | `@Autogefuehl` | `UCoNMyBdrXe8ueYEXhusMyIw` | DE |
| Wheelsboy (Chinese cars) | `@Wheelsboy` | `UC9QHoTXvd3xwgUK991aP4RA` | CN |
| Inside China Auto | `@InsideChinaAuto` | `UCZTkJpxZkNEuTnDqU12-kiQ` | CN |
| Autocar | `@Autocar` | `UCjWs7BxyjO5SLqevxSmp4vQ` | GB |
| The Smoking Tire | `@thesmokingtire` | `UC-4H50_RIqgXol2GlEdhxQQ` | US |
| Auto Trader UK | handle not found | found through the API channel search | GB |

### 3.6 Competitor equipment (E)

Launch news and specs are in section 3.1.

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `price-lists` | Competitor price and option lists. German editions first, to match our German option-list PDFs | German OEM sites: `mercedes-benz.de`, `audi.de`, `tesla.com/de_de`, `genesis.com/de`, `lexus.de`, `porsche.com/germany`, `volkswagen.de`, `cupraofficial.de`, `mgmotor.de`, `byd.com/de` | E | DE, then GB, US | model | Download (PDF) | Not tested | 8 |
| `configurators` | Online configurators and US "build and price" pages | Same OEM sites as `price-lists`; US: `bmwusa.com`, `mbusa.com`, `audiusa.com`, `genesis.com/us`, `lexus.com`, `lucidmotors.com` | E | per market | model | Browser (JS apps) | Not tested | 12 |
| `euro-ncap` | Euro NCAP assistance-system ratings | `euroncap.com/en/results/` | E, G | EU | model | Scraping | Not tested | 12 |
| `iihs` | IIHS ratings | `iihs.org/ratings/vehicle/{brand}/{model-body}/{year}`: `bmw/5-series-4-door-sedan/2024` | E, G | US | model | Scraping | Pattern OK | 12 |

### 3.7 Digital services and apps (H)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `app-store` | Apple App Store reviews | `itunes.apple.com/{country}/rss/customerreviews/page={1..10}/id={app id}/sortby=mostrecent/json`. Up to 10 pages of 50 = 500 newest reviews per country; an empty page is requested again | H | per country | brand | RSS | Data OK | 4 |
| `google-play` | Google Play reviews. Not available in China | `play.google.com/store/apps/details?id={package}&hl={language}&gl={country}`, reviews through a scraper library | H | per country | brand | Library | Page OK | 4 |
| `huawei-appgallery` | Huawei AppGallery, the main Chinese Android store | `appgallery.huawei.com` | H | CN | brand | Scraping, Chinese | Page OK | 13 |

App IDs, looked up on 2026-10-10 ✓:

| App | App Store ID | Google Play package |
|---|---|---|
| My BMW, USA | `1519457734` | `de.bmw.connected.mobile20.na` |
| My BMW, Europe and rest of world | `1519034860` | `de.bmw.connected.mobile20.row` |
| My BMW, China | `1527576076` | none (no Google Play in China) |
| Mercedes-Benz, USA / Canada | `1397873833` | found through the store search |
| Mercedes-Benz, Europe | found through `itunes.apple.com/search?term=Mercedes-Benz&entity=software&country=de` | `com.daimler.ris.mercedesme.ece.android` |
| myAudi | `440464115` | `de.myaudi.mobile.assistant` |
| Tesla | `582007913` | `com.teslamotors.tesla` |
| Genesis Intelligent Assistant, USA | `867941329` | found through the store search |
| Lexus, USA | `1468484450` | found through the store search |

My BMW is three separate apps (USA, rest of world, China), each with its own ID. App Store IDs for any app and country come from `itunes.apple.com/search?term={app name}&entity=software&country={country}` ✓.

### 3.8 Market, studies and trends (F, G, I)

| ID | Source | URL or pattern | Cat | Country | Level | Access | Check | Step |
|---|---|---|---|---|---|---|---|---|
| `kba` | KBA new registrations | Monthly: `kba.de/DE/Statistik/Fahrzeuge/Neuzulassungen/MonatlicheNeuzulassungen/monatl_neuzulassungen_node.html`; by segment and model: `.../Neuzulassungen/Segmente/n_segmente_node.html` | F | DE | market | Download (Excel, PDF) | Pattern OK | 9 |
| `smmt` | SMMT car registrations | `smmt.co.uk/vehicle-data/car-registrations/` | F | GB | market | Scraping | Page OK | 9 |
| `goodcarbadcar` | GoodCarBadCar US sales by model | `goodcarbadcar.net/{brand}-{model}-sales-figures/`: `bmw-5-series`, `bmw-7-series`, `mercedes-benz-e-class` | F | US | market | Scraping | Pattern OK | 9 |
| `carfigures` | CarFigures US sales | `carfigures.com` | F | US | market | Scraping | Page OK | 9 |
| `cox-automotive` | Cox Automotive sales reports | `coxautoinc.com` | F | US | market | Scraping | Page OK | 9 |
| `pfa` | PFA, French registrations | `pfa-auto.fr` | F | FR | market | Scraping | Page OK | 9 |
| `unrae` | UNRAE, Italian registrations | `unrae.it` | F | IT | market | Scraping | Page OK | 9 |
| `anfac` | ANFAC, Spanish registrations | `anfac.com` | F | ES | market | Scraping | Page OK | 9 |
| `ofv` | OFV, Norwegian registrations | `ofv.no` | F | NO | market | Scraping | Page OK | 9 |
| `mobility-sweden` | Mobility Sweden registrations | `mobilitysweden.se` | F | SE | market | Scraping | Page OK | 9 |
| `rai-bovag` | RAI Vereniging and BOVAG, Dutch registrations | `raivereniging.nl`, `bovag.nl` | F | NL | market | Scraping | Page OK | 9 |
| `iea-ev-outlook` | IEA Global EV Outlook | `iea.org/reports/global-ev-outlook-{year}`: `2025`, `2026` | I | Global | market | Download (PDF, data) | Pattern OK | 9 |
| `deloitte` | Deloitte Global Automotive Consumer Study | `deloitte.com/global/en/Industries/automotive/perspectives/global-automotive-consumer-study.html` | I | Global | market | Download (PDF) | Page OK | 9 |
| `capgemini` | Capgemini Research Institute | `capgemini.com/insights/research-library/` | I | Global | market | Download (PDF) | Page OK | 9 |
| `ey` | EY automotive insights | `ey.com/en_gl/industries/automotive` | I | Global | market | Scraping | Page OK | 9 |
| `google-trends` | Google Trends search interest by country. Not usable for China | `trends.google.com/trends/explore?q={term}&geo={country}`, through a library; plain requests are rate-limited (HTTP 429) | F | Global | market | Library | Not tested | 9 |
| `acea` | ACEA registrations by brand and powertrain | `acea.auto` | F | EU | market | Browser, Download | Blocked (403) | 11 |
| `jdpower` | J.D. Power press releases (IQS, APEAL, TXI, VDS), separate US and China studies | `jdpower.com/business/press-releases` | G | US, CN | brand | Browser | Blocked (403) | 11 |
| `pwc` | PwC automotive insights | `pwc.com/gx/en/industries/automotive.html` | I | Global | market | Browser | Blocked (403) | 11 |
| `mckinsey` | McKinsey Center for Future Mobility | `mckinsey.com/features/mckinsey-center-for-future-mobility/our-insights` | I | Global | market | Browser | No response | 11 |
| `baidu-index` | Baidu Index, the China replacement for Google Trends | `index.baidu.com` | F | CN | market | Login, Chinese | Page OK | 13 |

### 3.9 All pages: page structure and pagination

How to reach every page of the sources in steps 5 to 7. All patterns were read from the live pages on 2026-10-10.

**Forums**

| Source ID | Thread list, all pages | Thread, all pages | Size on 2026-10-10 |
|---|---|---|---|
| `tmc` | `teslamotorsclub.com/tmc/forums/model-s.73/page-{n}` | `teslamotorsclub.com/tmc/threads/{slug}.{id}/page-{n}` | 1,346 list pages |
| `genesis-owners` | `{forum url}page-{n}`, for example `.../genesis-g80-forum-g80-ev-forum-g80forum-com.107/page-{n}` | `genesisowners.com/genesis-forum/threads/{slug}.{id}/page-{n}` | 171 list pages (G80) |
| `lucid-owners` | `lucidowners.com/forums/{forum}.{id}/page-{n}`, for example `air-bugs-issues-support.134`; all Air forums are linked from `lucidowners.com/forums/` | `lucidowners.com/threads/{slug}.{id}/page-{n}` | 10 list pages (bugs forum) |
| `pistonheads` | `pistonheads.com/gassing/forum.asp?h=0&f=72&i={offset}`, offset in steps of 20 | `pistonheads.com/gassing/topic.asp?h=0&f=72&t={topic id}&i={offset}` | not counted |
| `motor-talk` | `motor-talk.de/forum/{forum}-b{id}.html?page={n}`, for example `bmw-5er-g60-g61-g90-g99-b1172.html?page={n}` | `motor-talk.de/forum/{slug}-t{thread id}.html?page={n}` | 8 list pages (G60 forum) |

On `tmc`, `genesis-owners` and `lucid-owners` every list and thread page carries a `<link rel="next">` tag pointing to the next page; the last page has none.

**Owner review and complaint sites**

| Source ID | Listing, all pages | Single item | Notes from 2026-10-10 |
|---|---|---|---|
| `parkers` | Generations of a model are linked from `parkers.co.uk/{brand}/{model}/owner-reviews/`. Each generation: `parkers.co.uk/{brand}/{model}/{body}-{launch year}/owner-reviews/?page={n}` | `parkers.co.uk/{brand}/{model}/{body}-{year}/{trim}/owner-reviews/{uuid}/` | Owner reviews exist for the F70 (`bmw/1-series/hatchback-2024`). The newest 5 Series generation listed is `saloon-2017` and the newest 7 Series is `saloon-2015`, so there are no G60 or G70 owner reviews yet. Expert review: `parkers.co.uk/{brand}/{model}/reviews/` with sections `/review/engines/`, `/review/interior/`, `/review/practicality/`, `/review/mpg-running-costs/`, `/review/verdict/` |
| `whatcar` | One page per model and body: `whatcar.com/{brand}/{model}/{body}/review/n{id}`; the address without the ID redirects to it. Used-car review: `.../{body}/used-review/n{id}`. Versions: `.../{body}/versions` | same page | All models of a brand, with their IDs, are linked from `whatcar.com/{brand}/` |
| `carwow` | One page per model: `carwow.co.uk/{brand}/{model}`, plus `/specifications` | same page | All models of a brand are linked from `carwow.co.uk/{brand}` |
| `kbb` | `kbb.com/{brand}/{model}/{year}/consumer-reviews/`. All reviews are inside the page's `__NEXT_DATA__` JSON block | same page | Very few reviews: 2 for the 5 Series, 3 for the i5, 4 for the 7 Series. The year must be one the model was sold in; valid years are linked from `kbb.com/{brand}/` |
| `carcomplaints` | Variant pages are linked from `carcomplaints.com/{Brand}/`. BMW: `530`, `530E`, `540`, `540i`, `550`, `M550`, `M5`, `740`, `740i`, `750`, `760`, `760i`, `i7`. Rivals: `Audi/A3`, `Audi/A6`, `Audi/A8`, `Tesla/Model_S`, `Genesis/G80`, `Genesis/G90`, `Lexus/ES_350`, `Lexus/ES_300h`, `Lexus/LS_500`, `Lexus/LS_500h`, `Porsche/Panamera`, `Lucid/AIR`, `Volkswagen/Golf` | Year page `carcomplaints.com/{Brand}/{variant}/{year}/`; problem page `carcomplaints.com/{Brand}/{variant}/{year}/{category}/{problem}.shtml`; category page `carcomplaints.com/{Brand}/{variant}/{category}/`. Only years and categories that have complaints exist; they are linked from the variant page | No BMW i5 page. Mercedes variants: `E350`, `E450`, `S-Class`, `S560`, `EQS_450`, `A220`. Examples: `Mercedes-Benz/E350/2012/body_paint/bubbles_under_clear_coat.shtml`, `Mercedes-Benz/S-Class/2021/electrical/`. Newest years on 2026-10-10: E350 has 2020, S-Class has 2021, BMW `530i` and `740i` have no complaints yet |

**Magazines**

| Source ID | Model page | Further pages of the same model |
|---|---|---|
| `caranddriver` | `caranddriver.com/{brand}/{model}` | Earlier model years `caranddriver.com/{brand}/{model}-{year}`; specs `/specs` |
| `motortrend` | `motortrend.com/cars/{brand}/{model}` | One page per model year: `motortrend.com/cars/{brand}/{model}/{year}` |
| `autocar` | `autocar.co.uk/car-review/{brand}/{model}` | Specs `/specs`; first drives `autocar.co.uk/car-review/{brand}/{model}/first-drives/{slug}` |
| `autoexpress` | `autoexpress.co.uk/{brand}/{model}` | Articles `autoexpress.co.uk/{brand}/{model}/{article id}/{slug}`; body variants `autoexpress.co.uk/{brand}/{model}/{variant}` |
| `topgear` | `topgear.com/car-reviews/{brand}/{model}` | Sections `/driving`, `/interior`, `/buying`, `/specs` |
| `drive-uk` | `drive.co.uk/cars/{brand}/{model}/review` | Body variants `drive.co.uk/cars/{brand}/{model}/{body}/review` (`audi/a6/avant`, `mercedes-benz/eqe/estate`); all models of a brand are linked from `drive.co.uk/cars/{brand}/reviews` |
| `autobild` | `autobild.de/marken-modelle/{brand}/{model}/`: `bmw/1er`, `bmw/5er`, `bmw/7er`, `mercedes-benz/e-klasse` | Tests and articles are linked from the model page |
| `ams` | `auto-motor-und-sport.de/marken-modelle/{brand}/{model}/`: `bmw/1er`, `bmw/5er`, `bmw/7er`, `mercedes/e-klasse` (brand slug `mercedes`) | Tests and articles are linked from the model page |
| `adac-autotest` | `adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/{brand}/{model}/`: `bmw/1er-reihe`, `bmw/5er-reihe`, `bmw/7er-reihe`, `mercedes-benz/e-klasse` | Generations and test reports are linked from the model page |

### 3.10 All competitors: slug per site

Result of requesting every BMW model and every competitor on each of the 10 sites on 2026-10-10. ✓ = the standard slug from section 2 works. A value = the slug that site uses instead. – = the site has no page for that car.

Brand slug is `mercedes-benz`, except on `carwow` and `autoexpress`, where it is `mercedes`.

| Vehicle (standard slug) | `parkers` | `whatcar` (body) | `carwow` | `kbb` | `caranddriver` | `motortrend` | `autocar` | `autoexpress` | `topgear` | `drive-uk` |
|---|---|---|---|---|---|---|---|---|---|---|
| BMW 1 Series (`bmw/1-series`) | ✓ owner reviews | ✓ hatchback | ✓ | – (not sold in the USA) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BMW 5 Series (`bmw/5-series`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BMW i5 (`bmw/i5`) | expert only: `bmw/i5/reviews/` | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BMW M5 (`bmw/m5`) | under `bmw/5-series/m5-{year}` | ✓ saloon | ✓ | year 2026: `bmw/m5/2026` | ✓ | ✓ | ✓ | `bmw/5-series/m5` | ✓ | ✓ |
| BMW 7 Series (`bmw/7-series`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BMW i7 (`bmw/i7`) | expert only: `bmw/i7/reviews/` | – | ✓ | year 2026: `bmw/i7/2026` | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Audi A3 (`audi/a3`) | ✓ | ✓ hatchback, saloon | ✓ | ✓ | ✓ | ✓ | `audi/a3-sportback` | ✓ | ✓ | ✓ |
| Mercedes A-Class (`mercedes-benz/a-class`) | ✓ | ✓ hatchback, saloon | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VW Golf (`volkswagen/golf`) | ✓ | ✓ hatchback | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `volkswagen/golf-mk8` | ✓ |
| Cupra Leon (`cupra/leon`) | expert only: `cupra/leon/reviews/` | ✓ hatchback | ✓ | – | – | – | ✓ | ✓ | ✓ | ✓ |
| MG4 (`mg/mg4`) | expert only: `mg/mg4/reviews/` | – | `mg/mg-4` | – | – | – | – | ✓ | – | ✓ |
| BYD Dolphin (`byd/dolphin`) | expert only: `byd/dolphin/reviews/` | ✓ hatchback | ✓ | – | – | – | ✓ | ✓ | ✓ | ✓ |
| Mercedes E-Class (`mercedes-benz/e-class`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mercedes EQE (`mercedes-benz/eqe`) | expert only: `mercedes-benz/eqe/reviews/` | – | ✓ | year 2026: `mercedes-benz/eqe/2026` | ✓ | `mercedes-benz/eqe-class` | ✓ | ✓ | ✓ | ✓ |
| Audi A6 (`audi/a6`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audi A6 e-tron (`audi/a6-e-tron`) | expert only: `audi/a6-e-tron/reviews/` | – | `audi/a6-sportback-e-tron` | – | ✓ | ✓ | ✓ | `audi/a6/avant/e-tron` | ✓ | ✓ |
| Tesla Model S (`tesla/model-s`) | ✓ | ✓ hatchback | ✓ | ✓ | ✓ | ✓ | `tesla/model-s-plaid` | ✓ | ✓ | – |
| Genesis G80 (`genesis/g80`) | expert only: `genesis/g80/reviews/` | saloon, with ID: `genesis/g80/saloon/review/n23156` | ✓ | ✓ | ✓ | ✓ | `genesis/electrified-g80` | ✓ | `genesis/g80-electrified` | ✓ |
| Lexus ES (`lexus/es`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| NIO ET7 (`nio/et7`) | – | – | – | – | – | – | ✓ | – | – | – |
| Zeekr 001 (`zeekr/001`) | – | – | – | – | – | – | – | ✓ | – | – |
| Xiaomi SU7 (`xiaomi/su7`) | – | – | – | – | – | – | – | – | – | – |
| BYD Han (`byd/han`) | – | – | – | – | – | – | – | – | – | – |
| Mercedes S-Class (`mercedes-benz/s-class`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mercedes EQS (`mercedes-benz/eqs`) | expert only: `mercedes-benz/eqs/reviews/` | – | ✓ | – for 2024 | ✓ | `mercedes-benz/eqs-class` | ✓ | ✓ | ✓ | ✓ |
| Audi A8 (`audi/a8`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | with year: `audi/a8/2026` | ✓ | ✓ | ✓ | ✓ |
| Lexus LS (`lexus/ls`) | ✓ | ✓ saloon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Genesis G90 (`genesis/g90`) | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | `usa/genesis/g90` | – |
| Porsche Panamera (`porsche/panamera`) | ✓ | ✓ hatchback | ✓ | – for 2024 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lucid Air (`lucid/air`) | – | – | – | ✓ | `lucid-motors/air` | ✓ | ✓ | ✓ | ✓ | – |
| NIO ET9 (`nio/et9`) | – | – | – | – | – | – | – | – | – | – |
| Maextro S800 (`maextro/s800`) | – | – | – | – | – | – | – | – | – | – |
| Hongqi H9 (`hongqi/h9`) | – | – | – | – | – | – | – | – | – | – |

The Chinese-market cars (Xiaomi SU7, BYD Han, NIO ET9, Maextro S800, Hongqi H9, and mostly NIO ET7 and Zeekr 001) have no pages on these UK and US sites. Their sources are the Chinese sites in steps 3 and 10 (`carnewschina`, `cnevpost`, `autohome`, `dongchedi`) and the YouTube channels Wheelsboy and Inside China Auto.

Forum coverage of competitors: `tmc` covers the Tesla Model S, `genesis-owners` the G80 and G90, `lucid-owners` the Lucid Air. The Mercedes, Audi and Lexus forums (`mbworld`, `audiworld`, `clublexus`) are in step 11.

---

## 4. Markets covered by shared platforms

Sources marked `Global` cover several markets in one fetch. This table shows which markets each really covers and what in the data tells the market apart.

| Source ID | Markets covered | What identifies the market |
|---|---|---|
| `reddit` | USA strong, Europe partial, China none | Subreddit (`r/CarTalkUK`, `r/de`), post language, country named in the text |
| `youtube-comments`, `youtube-transcripts` | USA, Europe; China through English channels | Channel country (table in section 3.5), video language |
| `bimmerpost-g60`, `bimmerpost-g70`, `bimmerpost-f70` | USA strong, Europe partial | Member location field, regional sub-forums |
| `app-store`, `google-play` | USA, Europe; China through the App Store | Country of the fetch |
| `google-trends` | USA, Europe | Country parameter |
| News feeds (`motor1`, `insideevs`, `electrek`, `carscoops`, `autoevolution-feed`, `bmwblog`) | All three | Market named in the text |
| Press portals (`press-bmw`, `press-mercedes`, `press-audi`, `press-porsche`) | All three | Regional press site, market named in the text |
| `wikipedia`, `wikidata`, `auto-data` | All three | Market named in the article; language edition |
| `jdpower` | USA and China | Study name |
| `iea-ev-outlook`, `deloitte`, `capgemini`, `ey`, `pwc`, `mckinsey` | All three | Country tables inside the report |

---

## 5. Coverage per model and market

What the BMW data already holds and which sources add to it, for each of the 7 combinations.

| Combination | Already in the BMW data | API and feed sources (steps 1 to 4) | Scraped sources (steps 5 to 7) | Later sources (steps 10 to 13) | Gap |
|---|---|---|---|---|---|
| **G60, USA** | Feedback (about 4,400 rows), US study | `nhtsa-complaints`, `reddit`, `youtube-comments`, `nhtsa-vpic`, `fueleconomy`, news feeds | `kbb`, `carcomplaints`, `caranddriver`, `motortrend`, `tmc`, `genesis-owners` | `bimmerpost-g60`, `cars-com`, `edmunds`, `mbworld`, `audiworld`, `clublexus` | `kbb` holds only 2 to 4 reviews per model |
| **G70, USA** | Feedback (about 4,400 rows), US study | Same as G60, USA | `kbb`, `carcomplaints`, `caranddriver`, `motortrend`, `lucid-owners`, `genesis-owners` | `bimmerpost-g70`, `cars-com`, `edmunds`, `mbworld`, `audiworld`, `clublexus` | Low sales volume, fewer posts |
| **F70, Europe** | Feedback (GB about 2,800 rows, ICE only), EU study | `youtube-comments`, `reddit`, `bmwblog`, `bimmertoday` | `parkers`, `whatcar`, `carwow`, `motor-talk`, `pistonheads`, `autocar`, `autoexpress`, `topgear`, `drive-uk` | `bimmerpost-f70`, `autotrader-uk`, `caradisiac`, `quattroruote`, `km77` | No API owner source; on sale since 2024, low volume |
| **G60, Europe** | Feedback (GB 89 rows), EU study | `reddit`, `youtube-comments`, `ev-database`, `bimmertoday` | `parkers`, `whatcar`, `carwow`, `motor-talk`, `autocar`, `autoexpress`, `topgear`, `drive-uk`, `ams`, `autobild` | `speakev`, `mobile-de`, `caradisiac`, `quattroruote`, `km77`, `elbilforum` | No API owner source; `parkers` has no G60 owner reviews yet (expert review only) |
| **G70, Europe** | EU study | `youtube-comments`, `ev-database` | `parkers`, `whatcar`, `motor-talk`, `autocar`, `autoexpress`, `topgear`, `drive-uk` | `speakev`, `mobile-de` | Low volume (about 13,000 units a year); `parkers` has no G70 owner reviews yet |
| **G68, China** | China study | `carnewschina`, `cnevpost`, `autohome-new`, `dongchedi-new` | None | `autohome`, `dongchedi`, `yiche`, `pcauto`, `xcar`, `12365auto`, `weibo`, `xiaohongshu`, `bilibili`, `douyin`, `zhihu` | Owner voice only from step 10 |
| **G70, China** | China study | Same as G68, China | None | Same as G68, China | Owner voice only from step 10 |

`app-store` and `google-play` cover every market in step 4 at brand level. The reference sources `wikipedia`, `wikidata` and `auto-data` cover every combination.

---

## 6. Fetch order

Every source in section 3 belongs to exactly one step.

| Step | What | Source IDs | Why at this point |
|---|---|---|---|
| **1** | Model and generation reference | `wikipedia`, `wikidata`, `nhtsa-vpic`, `fueleconomy`, `auto-data`, `ev-database` | Fixes the list of models, generations, years and variants that every later step searches for |
| **2** | Structured APIs | `nhtsa-complaints`, `nhtsa-recalls`, `reddit`, `youtube-comments` | Official access, dated records |
| **3** | Launches, news and press | `motor1`, `insideevs`, `electrek`, `thedrive`, `carscoops`, `autoevolution-feed`, `bmwblog`, `bimmertoday`, `carnewschina`, `cnevpost`, `press-bmw`, `press-mercedes`, `press-audi`, `press-genesis`, `press-lexus`, `press-porsche`, `autocar-new-cars`, `caranddriver-future`, `autoexpress-news`, `autohome-new`, `dongchedi-new`, `byd-site`, `nio-site`, `xiaomi-ev-site`, `zeekr-site`, `iaa`, `ces`, `auto-china` | New launches and competitor moves, mostly through feeds; gives the China view in English |
| **4** | App reviews | `app-store`, `google-play` | Dated, per country, comparable across brands |
| **5** | Forums that answer plain requests | `motor-talk`, `tmc`, `genesis-owners`, `lucid-owners`, `pistonheads` | Detailed owner problems |
| **6** | Owner review and complaint sites | `parkers`, `whatcar`, `carwow`, `kbb`, `carcomplaints`, `autoscout24` | Ratings, the UK, and the first F70 owner data |
| **7** | Expert reviews | `youtube-transcripts`, `caranddriver`, `motortrend`, `autocar`, `autoexpress`, `topgear`, `drive-uk`, `ams`, `autobild`, `adac-autotest`, `automobile-magazine`, `teknikens-varld` | Comparison tests and verdicts |
| **8** | Equipment comparison | `price-lists` | Equipment gaps against our option-list PDFs |
| **9** | Market, studies and trends | `kba`, `smmt`, `goodcarbadcar`, `carfigures`, `cox-automotive`, `pfa`, `unrae`, `anfac`, `ofv`, `mobility-sweden`, `rai-bovag`, `iea-ev-outlook`, `deloitte`, `capgemini`, `ey`, `google-trends`, `adac-breakdown`, `tuv-report` | Market size, reliability statistics and trend context |
| **10** | Native Chinese and other EU-language owner sources | `autohome`, `dongchedi`, `yiche`, `pcauto`, `xcar`, `12365auto`, `caradisiac`, `largus`, `quattroruote`, `alvolante`, `km77`, `coches-net`, `elbilforum` | Chinese and local-language owner voice |
| **11** | Sources that need a browser session | `bimmerpost-g60`, `bimmerpost-g70`, `bimmerpost-f70`, `mbworld`, `audiworld`, `clublexus`, `bimmerfest`, `speakev`, `cars-com`, `edmunds`, `cargurus`, `autotrader-uk`, `mobile-de`, `autoweek-nl`, `autoblog`, `autoevolution-pages`, `gasgoo`, `tesla-ir`, `acea`, `jdpower`, `pwc`, `mckinsey` | Blocked or unanswered for plain requests on 2026-10-10 |
| **12** | Remaining open sources | `eu-safety-gate`, `samr-recalls`, `configurators`, `euro-ncap`, `iihs`, `podcasts` | Safety-related data, JS apps and audio |
| **13** | Sources that need a login | `weibo`, `xiaohongshu`, `bilibili`, `douyin`, `zhihu`, `baidu-index`, `huawei-appgallery` | Chinese accounts |

---

## 7. What to save with every record

Everything fetched is saved, and every saved item keeps the source it came from. The untouched raw response is stored first; the fields below are then filled from it. This is what lets any later statement be traced back to the exact page, post or document.

### 7.1 What one record is

| Source type | One record is |
|---|---|
| Forums, Reddit | One post or one comment (the thread is linked through `thread_id`) |
| YouTube comments | One comment |
| YouTube transcripts, articles, press releases, expert reviews | One video or one article |
| Owner review sites, app stores | One review |
| NHTSA complaints and recalls | One complaint or one recall |
| Statistics, sales, specs, reference data | One value: one metric for one model, market and period (format in 7.3) |

### 7.2 Text records

| Field | Example | Purpose |
|---|---|---|
| `record_id` | `reddit-1abc23-c4` | Source ID plus the source's own ID |
| `source_id` | `reddit` | ID from [section 3](#3-source-list); one ID is one site |
| `category` | `C` | The one category this record belongs to. For a source with several categories it follows the page type: a What Car? owner review is `B`, its Reliability Survey is `G` |
| `content_type` | `owner` / `expert` / `press` / `news` | Kind of content |
| `level` | `model` / `brand` | What the record is about |
| `url` | permalink | Link back to the original |
| `raw_ref` | path to the saved raw file | The untouched original response |
| `fetched_at` | `2026-10-10T16:02:00Z` | When it was fetched |
| `published_at` | `2025-11-03` or empty | When the source published it |
| `search_term` | `BMW i5` | The query or URL slug that found it |
| `thread_id` | Reddit post ID, video ID, forum thread ID | The thread, video or article it belongs to |
| `author_hash` | hash of the username | Distinguishes authors without storing names |
| `brand`, `model`, `chassis_code`, `model_year` | `BMW`, `5 Series`, `G60`, `2024` | The vehicle; empty for brand level |
| `vehicle_role` | `current` / `predecessor` / `competitor` / `unknown` | Position of the vehicle relative to our three models |
| `powertrain` | `ICE` / `PHEV` / `BEV` / `unknown` | Same values as the BMW feedback files (`BEVE` there = `BEV`) |
| `country` | `US`, `GB`, `DE`, `CN` or empty | ISO code, as in the BMW feedback `Country` column |
| `market` | `USA` / `China` / `Europe` / `Rest of World` / `unknown` | From `country`, mapping in 7.4 |
| `language` | `en` | Language of the original |
| `title` | thread or article title | Title of the original |
| `text_original` | raw text | The original wording |
| `text_en` | translated text | English version |
| `rating_value`, `rating_scale` | `4`, `5` | Rating in the source's own scale |
| `engagement` | upvotes, likes, replies | Reach of the item |

### 7.3 Data records

For statistics, sales figures, specs and reference data (sections 3.1 reference sources and 3.8).

| Field | Example | Purpose |
|---|---|---|
| `record_id` | `kba-2026-09-bmw-5er-registrations` | Source ID plus period, model and metric |
| `source_id`, `category`, `url`, `raw_ref`, `fetched_at` | as in 7.2 | Link back to the original file or page |
| `brand`, `model`, `chassis_code`, `powertrain` | `BMW`, `5 Series`, `G60`, `BEV` | The vehicle; empty for whole-market figures |
| `country`, `market` | `DE`, `Europe` | Where the figure applies |
| `period` | `2026-09`, `2025`, `2030 forecast` | Month, year or forecast horizon |
| `metric` | `new registrations`, `launch date`, `battery capacity` | What is measured |
| `value`, `unit` | `3120`, `units` | The figure in the source's own unit |
| `source_location` | sheet and cell, table name, or PDF page | Exact place inside the document |

### 7.4 Country to market

| `country` | `market` |
|---|---|
| `US` | `USA` |
| `CN` | `China` |
| `GB`, `DE`, `FR`, `IT`, `ES`, `NL`, `SE`, `NO` and every other European country | `Europe` |
| Any other country | `Rest of World` |
| Empty | `unknown` |

---

## 8. Sources not fetched

No usable access:

| Source | Reason |
|---|---|
| X (Twitter) | Paid API, short low-detail posts |
| TikTok, Instagram | No usable API, mostly visual content |
| Facebook owner groups | Login required, private data |
| Consumer Reports, JATO, MarkLines, S&P Global Mobility | Paid; their free press releases appear in the news feeds |
| Trustpilot, Google Maps dealer reviews | About dealers and service, not the product |

Markets out of scope:

| Market | Sources |
|---|---|
| Japan | Minkara, Kakaku.com |
| South Korea | Bobaedream, Naver cafés |
| Middle East | YallaMotor, DubiCars, ArabGT |
| India | Team-BHP, CarWale, CarDekho |
| Australia, Canada | ProductReview.com.au, Transport Canada |
