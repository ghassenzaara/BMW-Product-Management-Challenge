# External Sources: What to Add Beyond the Provided Data

The provided files describe **today's** cars and customers. The brief asks us to think **3 to 5 years ahead** and allows enrichment with "competitor information, reviews, and market or technology trends" `[BRIEF]`. This page lists what to fetch, why, and how much to trust it. Nothing here is fetched yet. Each item is a pointer or a suggestion. The fetching design (Exa + YouTube API, watchlists per PM workspace, traceability) is in [06-solution-concept/web-intelligence-loop.md](../06-solution-concept/web-intelligence-loop.md).

## 1. BMW Annual Report (tip from the organisers' material)
You don't need the whole financial breakdown. Extract two areas:
- **Market and sales data:** regional growth trends, deliveries by model series (e.g. X models vs. sedans), latest EV adoption rates. Use it for target personas, market demand and where a feature has the biggest impact.
- **Product strategy and R&D:** R&D investment priorities, ConnectedDrive and My BMW App metrics, and the **"Neue Klasse"** platform strategy. Tying requirements to these shows they fit current engineering investment and the future vehicle architecture.

(Previously stored as `BMW Annual Report.md`.)

## 2. Competitors named in our sources

| Competitor | Mentioned where | Context |
|---|---|---|
| **Mercedes-Benz** | `[EN][PM1][DE]` | Main German premium rival; "products are very similar"; bigger screens; seen as owning massage seats; better A/C (G70 verbatim) |
| Audi | `[PM1]` | Same big-screen trend |
| Porsche | `[EN]` | Example of a shared abstract feature (head-up display) |
| **Chinese brands** (general) | `[EN][PM1][PM2]` | Fast-moving; entry-level feature baseline; "lights everywhere in the car"; 800 km range |
| **Xiaomi** | `[EN]` | Named as a key Chinese competitor |
| **XPeng** | `[challenge slide]` | Verbatim "The NEW XPENG" |
| **Tesla** | `[challenge slide][DE]` | Verbatim "Tesla and GROK"; range announcements; charging network (G60 verbatims) |
| Rolls-Royce | `[PM2]` | Marks the luxury tier above the 7 Series |
| Lexus | `[DE]` | Likely an ASR error in the range example, so don't rely on it |

**Suggested benchmark sets** (our assumption, verify before use):
- **1 Series (F70):** Mercedes A-Class, Audi A3 Sportback, VW Golf; Chinese and other entry-level challengers sold in Europe (e.g. BYD, MG, XPeng, Volvo EX30).
- **5 Series (G60/G68):** Mercedes E-Class / EQE, Audi A6 (incl. e-tron), Tesla Model S/3; China: Xiaomi SU7, NIO ET7, XPeng P7, BYD Han, Li Auto, AITO.
- **7 Series (G70):** Mercedes S-Class / EQS / Maybach, Audi A8, Porsche Panamera / Taycan, Lexus LS; China: NIO ET9, Maextro S800, Yangwang, Hongqi.

## 3. Other source types the PMs use
| Source | Why | From |
|---|---|---|
| **Social listening** (YouTube reviewers such as Carwow, forums, Chinese platforms) | Volume of opinion and early signals. Weight by **audience fit**, not reach ("10 million is a city in China") | `[PM2]` |
| Sentiment reports from BMW departments | Positive, negative or neutral per feature (internal, not available to us) | `[PM2]` |
| **Trade fairs / other industries** (e.g. CES Las Vegas: foldable displays) | Innovation candidates | `[PM1]` |
| **Supplier innovations** | e.g. the iX3 Panoramic Vision HUD came from a supplier | `[PM1]` |
| Luxury brands and adjacent industries | Trends for premium features | `[PM1]` |
| Car clinics | Owner reactions to concepts, up to 10 years before SOP (internal) | `[PM2]` |
| Benchmarking and competitor reports | BMW has a big benchmarking practice (internal) | `[EN]` |
| BMW Neue Klasse (iX3, upcoming i3 sedan) | Shows where BMW's next architecture is going: OS X, Panoramic Vision, 800 V charging | public press material |

## 4. Concrete source list and access method (for the web intelligence loop)
Keys: **OpenAI** (LLM), **Exa** (search + contents), a free **YouTube Data API v3** key. No Reddit API; Reddit goes through Exa.

| Source | Workspace | Access | Trust | Feasibility |
|---|---|---|---|---|
| Car and Driver, Edmunds, MotorTrend | RoW (US) | Exa `include_domains` | C | High |
| Autocar, What Car, Top Gear, Carwow (site) | RoW (UK/EU) | Exa | C | High |
| auto motor und sport, AutoBild | RoW (DE) | Exa (German queries) | C | High |
| CarExpert, Drive | RoW (AU/RoW) | Exa | C | High |
| Manufacturer press sites and spec pages (Mercedes, Audi, Tesla, BYD, Xiaomi, NIO, XPeng) | both | Exa | B | High (headline specs) |
| Reddit: r/BMW, r/BMWi5, r/electricvehicles, r/cars | RoW | Exa `include_domains: reddit.com` (fallback: thread `.json`) | D | Medium-high |
| bimmerpost, bimmerfest, Motor-Talk.de | RoW | Exa | D (owners) | Medium |
| YouTube: Carwow, Autocar, EV channels, Chinese review channels | both | YouTube Data API (search, stats, comments) + `youtube-transcript-api` | C (reviewer) / D (comments) | Medium-high |
| Autohome 汽车之家 (口碑 owner reviews), Dongchedi 懂车帝, Yiche 易车 | CN | Exa with Chinese queries + `include_domains` | D (owners) / C (editorial) | Medium-low (anti-bot) |
| Bilibili video pages | CN | Exa (page text, descriptions) | C/D | Low-medium |
| CarNewsChina, CnEVPost (English coverage of China) | CN | Exa | C | High |
| Weibo, Xiaohongshu, Douyin | CN | Not accessible without login. **Out**, and listed as a known gap | – | – |

## 5. Trust levels for evidence
Use these when assigning an **evidence level** to a finding:

| Level | Source examples | Treat as |
|---|---|---|
| A: BMW first-party data | Provided feedback, customer study, sales, option lists | Evidence, with the coverage caveats in [insights.md](insights.md) |
| B: Official third-party facts | Competitor price lists and spec sheets, homologation (WLTP) data, annual reports | Evidence, dated |
| C: Expert reviews and press tests | Automotive press, established reviewers | Evidence about perception, one opinion each |
| D: Social media and forums | Comments, posts, videos | Signal only. Cluster, count, check audience |
| E: Forecasts and announcements | "2,000 km by 2033", market reports, trend pieces | **Assumption.** Label as forward-looking |
| F: LLM general knowledge | Model's own recall | Never cite as evidence. Use only to suggest where to look |

Always store the URL, retrieval date and quoted passage, so the finding stays traceable `[MISSION]`.
