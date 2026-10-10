# Scope and Focus: What We Build

How we cut the challenge into buildable pieces and where we put our effort. It builds on [stakeholder-needs.md](../01-challenge/stakeholder-needs.md) (what BMW asked for), [evaluation-criteria.md](../01-challenge/evaluation-criteria.md) (how we're judged) and [insights.md](../02-data/insights.md) (what the data supports).

**Status:** proposal for the team to confirm. Items marked *decision* still need a team call.

---

## 1. The three scope boundaries

| Layer                                  | In scope                                                                                                                                                                                                                       | Out of scope                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Challenge scope** (set by BMW)       | Customer-facing requirements: features, equipment, comfort, space, usability, infotainment and digital services, design and quality perception, driving experience, range and charging *as experienced*, variants and packages | Regulation and homologation, engineering and component specs, pricing and business case (cost only as a rough factor), the engineering feasibility loop |
| **Product scope** (our tool)           | PM-side process from data to a ranked, justified shortlist (~top 10) ready to hand to engineering                                                                                                                              | Engineering evaluation (happens in Codebeamer after us), budget decisions (management), final feasibility                                               |
| **Demo scope** (what we show on stage) | 1 derivative × 1 primary market in depth, plus a second market as a contrast view; pipeline built so other models and markets are a config change                                                                              | All 3 models × all markets at full depth                                                                                                                |

### Demo focus recommendation (*decision*)

| Option | Why it's strong | Weakness |
|---|---|---|
| **A. G60 (5 Series), US primary, EU + China as contrast** (recommended) | Richest data: 4,000 verbatims, all 3 powertrains (BEV pain points on range and charging), 4 source types, US study distributions, EU and China study means, sales in all markets. Volume model. Real market conflicts to show (EU styling 9.83 vs China 8.19; China rates equipment low at 7.49) | US is not the largest G60 market (EU is), so we must say so: honesty points |
| B. F70 (1 Series), Europe | Clear strategic story from the PMs: "#3 → #1 in Europe" vs cheap Chinese rivals; 1,430 European verbatims | ICE only, a single source, no US study; Japan-heavy feedback; thin on EV topics |
| C. G70 (7 Series), China vs EU | The most dramatic conflict (China 9.64 vs EU 7.98, "roomy vs cramped") | Small volumes; no Chinese verbatims, so China evidence is study-only |

Whatever we pick, the **same pipeline runs for all three models** (it is already one dataset in `02-data/processed/`). Show a model and market switcher in the UI even if only one path is polished.

**Two PMs, one car.** BMW runs a separate product management for China. In practice the same car line has a **China PM** and a **rest-of-world (RoW) PM**, with mostly similar but sometimes different requirements `[PM2]`. Option A fits this well: the G60/G68 sells in both (CN 75k, EU + US + RoW 221k in 2025). The demo therefore uses **two logins on the same data**, "PM China" and "PM Rest of World". Each has its own workspace (model + region, goals, watchlist). See [web-intelligence-loop.md §4](web-intelligence-loop.md#4-one-data-layer-a-workspace-per-pm).

**Our differentiator: the web intelligence loop.** An agent loop that fetches professional reviews, YouTube, Reddit and forums, Chinese platforms and competitor facts, turns them into traceable findings, and alerts the owning PM when a requirement looks outdated. Full design: [web-intelligence-loop.md](web-intelligence-loop.md).

---

## 2. Focus areas (workstreams)

Each area maps to a part of the [end-to-end flow](end-to-end-flow.md) and to the judging criteria.

| #       | Workstream                                            | What it does                                                                                                                                                  | Judging criteria it serves                                | Priority                                                       |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| **W1**  | **Data layer and findings store**                     | Load provided data into one model: `Source → Finding → Theme → Requirement → Decision`. Every object has an ID and source pointers                            | Traceability                                              | **Must**                                                       |
| **W2**  | **Insight engine** (classify, cluster, contextualize) | Classify the ~1,200 unlabelled verbatims, cluster findings into themes, attach market, powertrain, severity and sentiment, merge with study and sales signals | Scoring logic, solution quality                           | **Must**                                                       |
| **W3**  | **Requirement drafting**                              | Turn a theme into a SMART candidate requirement with linked findings, a gap check against the equipment baseline, metric questions and assumptions            | Solution quality, deliverable 2                           | **Must**                                                       |
| **W4**  | **Scoring and prioritization**                        | Transparent formula (customer and business perspectives), PM-adjustable weights, live re-rank, what-if comparison, evidence level shown separately from score | **Scoring logic** (criterion #1)                          | **Must**                                                       |
| **W5** | **PM workspaces and review UI** (human in the loop) | Login per PM (China PM, RoW PM) with a personal workspace (model + region, goals, source filter, watchlist) on the shared data layer; project setup, theme map, triage (implement 0/1), requirement detail with evidence drill-down, approve, edit, reject, postpone, conflict view (incl. China vs. RoW) | Workflow and human decisions, usability | **Must** |
| **W6**  | **Audit trail**                                       | Append-only event log: who or what, when, what changed (before/after), why. Visible per requirement                                                           | **Traceability** (criterion #3), deliverable 4            | **Must**                                                       |
| **W7** | **Web intelligence: fetching and extraction** | Watchlist-driven fetching of pro reviews, YouTube (comments + transcripts), Reddit and forums, Chinese platforms and competitor facts via Exa + YouTube API; filter, translate, extract into traceable Findings (deep link, snapshot, quote) and CompetitorFacts. See [web-intelligence-loop.md](web-intelligence-loop.md) | Combines BMW and external data; traceability; covers the China and future gaps | **Must** (our differentiator) |
| **W8** | **Monitoring loop and alerts** | Scheduler re-runs watchlists; new findings vs. approved requirements, giving a verdict (supports / contradicts / raises the bar) and an alert to the owning PM. Never auto-edits. Plus an on-demand research agent for PM questions | Innovation, scalability, workflow | **Must** (one real alert end to end; research agent = Should) |
| **W9** | **Collaboration and hand-off** | Global vs. regional requirements and variants, cross-workspace conflict cards, comments and challenges between PMs; export top 10 to Codebeamer, Jira or CSV | Feasibility in the enterprise | **Should** (conflict card + export; comments are Could) |
| **W10** | **Story, pitch and honesty layer**                    | Demo script, architecture slide, limitations slide (coverage gaps, assumptions)                                                                               | All, especially "we reward honesty"                       | **Must**                                                       |

### Explicitly *not* building (hackathon "won't")
- A 24/7 production crawler or paid anti-bot scraping (e.g. bypassing Weibo or Xiaohongshu login walls). We build the loop with a scheduler and a watchlist, run it for the snapshot, and show one live refresh.
- Cost estimation or business cases. A t-shirt-size effort guess (S/M/L) as a rough factor is the maximum.
- Engineering feasibility decisions. Only a "feasibility: unknown / flagged" field.
- Auto-generated "new car strategy" black boxes. The PM initiates; AI proposes.
- Fine-tuned models or complex graph databases. A relational store with typed links is enough; call it a graph in the concept.

---

## 3. Where to go deep vs. shallow

The brief says: "You do not need to develop every capability to the same level of maturity." Our depth profile:

| Capability                                                                 | Depth    | Why                                                                                              |
| -------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| Evidence → requirement traceability                                        | ★★★ deep | Criteria #1 and #3; every PM in the interviews asked for it                                      |
| Explainable, adjustable scoring                                            | ★★★ deep | Criterion #1; Patrick: "prioritization logic is one part of the challenge"                       |
| PM decision UX (review, conflicts, what-if)                                | ★★★ deep | Criterion #2; the visible part of the demo                                                       |
| Clustering and insight quality on provided data                            | ★★ solid | Must be credible, not perfect                                                                    |
| Audit trail                                                                | ★★ solid | Simple event log, shown well                                                                     |
| Web intelligence (fetching, extraction, traceability of external evidence) | ★★★ deep | Our differentiator; fills the China/EU and future gaps; deep links + snapshots make it auditable |
| Monitoring loop and alerts                                                 | ★★ solid | One real alert end to end, scheduler in place                                                    |
| Multi-PM workspaces (China / RoW)                                          | ★★ solid | Two logins, regional requirements, one conflict card                                             |
| Research agent, comments, export                                           | ★ light  | One working example each, the rest as concept                                                    |

---

## 4. Team split (adapt to team size)

| Role | Owns | Hand-offs |
|---|---|---|
| **Data and insights** | W1, W2 (pipeline from `02-data/processed/` to findings and themes JSON; shared store schema) | Finding and theme JSON for everyone |
| **Web intelligence** | W7, W8 (watchlists, Exa and YouTube connectors, extraction, monitor, alerts, snapshot) | External Findings, CompetitorFacts and Alerts in the same schema |
| **Requirements and scoring** | W3, W4, W6 (SMART drafting, gap check, formula, weights per workspace, audit log) | Requirement and Score JSON, API → UI |
| **UI and story** | W5, W9, W10 (workspaces and logins, screens, conflict card, export, demo script, pitch) | Needs the JSON contracts early; mock them first |

Agree the **JSON contracts** (User, Workspace, Finding incl. external fields, CompetitorFact, Theme, Requirement with scope, Score, Alert, AuditEvent; see [end-to-end-flow.md §3](end-to-end-flow.md#3-data-objects-the-traceability-chain)) in the first hour, so all four tracks can work in parallel with mock data.

---

## 5. Definition of done for the demo

- [ ] Two PMs log in (China PM, RoW PM) and each lands in their own workspace for the same car (model + region, goals, watchlist).
- [ ] Sees a situation dashboard (sales, study strengths and weaknesses, top themes, data coverage warnings).
- [ ] Triages candidate requirements (implement yes/no) with evidence counts.
- [ ] Opens one requirement and drills down to the original verbatims, study rows and a competitor source.
- [ ] Edits a metric target; the change appears in the audit log with a rationale.
- [ ] Moves a weight slider (e.g. comfort ↑, cost ↓); the ranking changes and the UI explains why.
- [ ] Sees at least one **conflict** (market A vs market B) and one **low-evidence / assumption** warning.
- [ ] Approves the top N and exports them (CSV in a Codebeamer-like format).
- [ ] Evidence panel shows external findings (review, YouTube, Reddit, Chinese source) with a deep link to the exact quote and the stored snapshot; social media can be toggled off.
- [ ] A watchlist refresh runs live (one run) and adds new, deduplicated findings; a coverage meter shows findings per region and source.
- [ ] One monitoring alert ("competitor now raises the bar") reaches the owning PM, who dismisses or reworks it; the audit trail shows `agent:monitor`.
- [ ] One China-only requirement exists as a variant of a global one, and one conflict card shows China vs. RoW.
- [ ] Sample list of 10 to 15 requirements with all mandatory fields ([smart-requirements.md](../01-challenge/smart-requirements.md)).
