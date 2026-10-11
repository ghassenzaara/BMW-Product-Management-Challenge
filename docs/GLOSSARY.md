# Glossary

Terms, codes and names that appear across the material. German terms come from the option lists.

## Vehicles and model codes
| Term | Meaning |
|---|---|
| **F70** | BMW 1 Series (current generation), compact hatchback, entry model. ICE and 48 V mild hybrid only |
| **G60** | BMW 5 Series Sedan, incl. **i5** (BEV) and 530e/550e (PHEV) |
| **G68** | BMW 5 Series long-wheelbase variant for **China**. Shares a sales sheet with G60 (`G60_G68`) |
| **G70** | BMW 7 Series Sedan, incl. **i7** (BEV) and 750e/M760e (PHEV) |
| Derivative (Derivat, "e-code") | A specific vehicle body or model code such as F70 or G60. Column `Derivate (e-code)` in the feedback |
| Successor / next generation | The vehicle our requirements are for, on the road in about 3 to 5 years |
| **Neue Klasse** | BMW's next-generation EV platform and design language (iX3 and upcoming models): OS X, Panoramic Vision, new electronics architecture |
| xDrive | BMW all-wheel drive |
| M Sport package / M Sport package Pro | Sporty trim packages (M Sportpaket / M Sportpaket Pro) |

## Powertrain
| Term | Meaning |
|---|---|
| ICE | Internal combustion engine (petrol / diesel) |
| MHEV | 48 V mild hybrid (still counted as ICE in the feedback) |
| PHEV | Plug-in hybrid |
| BEV / **BEVE** | Battery-electric vehicle (`BEVE` in the raw feedback files) |
| MSA | Motor-Start-Stopp-Automatik, i.e. **auto start-stop**. A frequent "permanent off" want |
| WLTP | EU test cycle for consumption and range (the range figures in the option lists) |
| AC / DC charging | Home or slow charging (11 to 22 kW) vs. fast charging (i5 205 kW, i7 250 kW) |
| Frunk | Front trunk (storage under the bonnet of an EV) |

## Data and research terms
| Term | Meaning |
|---|---|
| Verbatim | A single free-text customer statement (one `id` in the feedback) |
| Signal (older notes: Finding) | One statement about one topic from one source record (complaint, wish, like, competitor fact, trend), with the exact quote. One finding = one signal |
| Case (older notes: Theme) | A problem: the group of signals about one topic and one aspect group. The PM confirms or rejects it |
| Requirement | The answer to a confirmed case: what BMW will build or change |
| Topic | One of 219 fixed labels (BMW VFC level 2) every signal is classified into; `other` goes to a review queue. See [`../taxonomy/`](../taxonomy/README.md) |
| Aspect group | What a statement is about: one of 11 groups built from BMW's VFC level 3 labels (function, usability, reliability, performance, efficiency_range, design, comfort, space, quality, sound, price) |
| Car area | One of 11 areas the PM filters by; always derived from the topic |
| VFC level 2 / level 3 | BMW's feedback topic taxonomy: level 2 = topic (e.g. *Seats*), level 3 = aspect or sentiment (e.g. *Not user-friendly*) |
| Feedback types | `Likes`, `Difficult to Use` (**DTU**), `Defect`, `Wants`, or empty |
| DTU | "Difficult to use". Also appears inside Source C texts ("…/DTU") |
| Source A–D | Anonymized feedback channels (see [02-bmw-data/insights.md](02-bmw-data/insights.md) for what each looks like) |
| Top-2 box / bottom-3 box | Share of US study respondents choosing the two best levels (Delightful, I Love It) / the three worst (I Hate It, A Failure, Unsatisfactory) |
| Social listening | Monitoring what people post online (YouTube, forums, social media) |
| Car clinic | BMW event where owners react to concepts, up to 10 years before SOP |
| Benchmarking | Systematic comparison with competitor vehicles |
| RoW | Rest of World (sales sheet) |
| Evidence level | How strongly a requirement is backed by data vs. assumption (see the trust levels in [02-bmw-data/external-sources.md](02-bmw-data/external-sources.md)) |

## Process and organisation
| Term | Meaning |
|---|---|
| PM | Product manager, the user of our tool. Part of **Sales** at BMW |
| Model project | Developing a new vehicle generation |
| Option project | Developing scalable options shared across models (e.g. 3 seat variants) |
| Market requirement | Need specific to a country (Norway: heated steering wheel; Italy: A/C; China: fridge) |
| **Baukasten** | "Toolbox": modular components and software shared across series at different levels |
| LCI | Life-cycle impulse / mid-cycle update around year 3 of a 5 to 7 year model life (small changes, e.g. new colours) |
| SOP | Start of production |
| Design freeze | Point after which the design no longer changes. Requirements can be revisited until then |
| Gate (G0, G1 …) | Decision milestones in the development process ([01-challenge/product-development-process.md](01-challenge/product-development-process.md)) |
| **Codebeamer** | Requirements tool used for the hand-off from PM to engineering (top ~10 requirements) |
| Jira / Confluence / SharePoint | PM ticketing, documentation and file sharing today |
| Audit trail | Complete, chronological record of all actions, changes and access events |
| SMART | Specific, Measurable, Attainable, Relevant, Timely ([01-challenge/smart-requirements.md](01-challenge/smart-requirements.md)) |

## Option-list German
| German | English |
|---|---|
| Serienausstattung (■) | Standard equipment |
| Sonderausstattung (□) | Optional equipment |
| SA-Nr. | Option code |
| Fahrzeuggrundpreis | Base vehicle price (EUR incl. 19% VAT, net price in brackets) |
| Paket | Package |
| Sitzbelüftung / Massagefunktion / Sitzheizung | Seat ventilation / massage / seat heating |
| Lenkradheizung | Heated steering wheel |
| Panorama-Glasdach | Panorama glass roof |
| Klimaautomatik (2-/4-Zonen) | Automatic climate control (2/4 zones) |
| Standheizung / Standklimatisierung | Auxiliary heating / parked climatisation |
| Automatische Heckklappenbetätigung | Automatic tailgate |
| Komfortzugang | Comfort access (keyless) |
| Anhängerkupplung | Trailer hitch |
| Reifenpannenset | Tire repair kit (no spare wheel) |
| Reichweite / Ladeleistung | Range / charging power |
| Gepäckraumvolumen | Boot volume |

## People
| Name | Role |
|---|---|
| Patrick | BMW product manager interviewed on 10.10.2026; 25 years at BMW, 8 in China |
| Dirk | BMW product manager (ex-MINI) expected the day after for feedback |
| Hervisa | Our team's name |
