# Scope and Focus: What We Build

How we cut the challenge into buildable pieces and where we put our effort. It builds on [stakeholder-needs.md](../../01-challenge/stakeholder-needs.md) (what BMW asked for), [evaluation-criteria.md](../../01-challenge/evaluation-criteria.md) (how we are judged) and [insights.md](../../02-bmw-data/insights.md) (what the data supports).

Rewritten on 2026-10-11 to match the decided design (Signal → Case → Requirement, fixed taxonomy, one config per vehicle and market). The binding sources are [`CLAUDE.md`](../../../CLAUDE.md), [`architecture.mmd`](../../../architecture.mmd) and [`plan.md`](../../../plan.md) (progress per phase).

---

## 1. The three scope boundaries

| Layer | In scope | Out of scope |
|---|---|---|
| **Challenge scope** (set by BMW) | Customer-facing requirements: features, equipment, comfort, space, usability, infotainment and digital services, design and quality perception, driving experience, range and charging as experienced, variants and packages | Regulation and homologation, engineering and component specs, pricing and business case (cost only as a rough factor) |
| **Product scope** (our tool) | The PM-side process from data to a ranked, justified shortlist (about the top 10) ready to hand to engineering | Engineering evaluation (happens in codebeamer after us), budget decisions, final feasibility |
| **Demo scope** (what we show) | One derivative in one market in depth, a second market as a contrast; other vehicles and markets are a config change | All three models in all markets at full depth |

### Demo focus

| Option | Why it is strong | Weakness |
|---|---|---|
| **A. G60 (5 Series), USA primary, Europe and China as contrast** (recommended) | Richest data: 4,000 verbatims, all three powertrains, four source types, US study distributions, EU and China study means, sales in all markets. Real market differences to show (EU styling 9.83 vs China 8.19) | The US is not the largest G60 market, so we say so |
| B. F70 (1 Series), Europe | Clear story against cheap Chinese rivals; 1,430 European verbatims | ICE only, a single source, no US study, thin on EV topics |
| C. G70 (7 Series), China vs Europe | The most dramatic conflict (China 9.64 vs EU 7.98) | Small volumes; no Chinese verbatims, so China evidence is study-only |

Whatever we pick, the same pipeline runs for all three models. The second end-to-end run planned for hardening is F70 / Europe with only a config change.

**Several PMs, one platform.** Markets are separate worlds: China, the US and the Middle East have their own PMs. Each PM works a **config** (vehicle + market) with their own weight profiles on the same shared data and logic. A case is not tied to one vehicle; its state, rank and release fit are per line, because each line has its own PM. Market conflicts are shown with statistics and never decided by the AI.

**Our differentiator: the daily fetch loop.** Agents fetch competitor facts, public feedback, trends and innovations, turn them into traceable signals in the same taxonomy as BMW's own feedback, and flag new evidence to the PM. Design and status: [web-intelligence-loop.md](web-intelligence-loop.md).

---

## 2. Workstreams

Each maps to a part of the [end-to-end flow](end-to-end-flow.md) and to the judging criteria. Status per phase is in [`plan.md`](../../../plan.md).

| # | Workstream | What it does | Criteria it serves |
|---|---|---|---|
| **W1** | Data layer | One model: source record → signal → case → requirement → decision. Every object has an ID and source pointers | Traceability |
| **W2** | Signals and cases | Validation gate; classification into the fixed taxonomy (topic, aspect group, derived car area); cases per topic + aspect group; figures per market and powertrain; study, equipment and sales context | Scoring logic, solution quality |
| **W3** | Requirement drafting | From a confirmed case: description, metric and target, acceptance criteria, release target, assumptions, evidence level, cost | Solution quality, deliverable 2 |
| **W4** | Scoring and prioritization | Case score from visible factors and the PM's weight profile, brand-fit multiplier, requirement rank with a cost multiplier, profile compare, manual rank override with a reason | **Scoring logic** |
| **W5** | PM workspace (UI) | Config, case board and case page, requirement board and page, RAG sidebar that cites sources and proposes edits as diffs, notifications | Workflow and human decisions, usability |
| **W6** | Audit trail | Append-only event log enforced in the database: actor, timestamp, before/after, rationale | **Traceability**, deliverable 4 |
| **W7** | Daily fetch loop | Source adapters (APIs, feeds, scraping, downloads), four agents, signals through the same gate | Combines BMW and external data; covers the China and future gaps |
| **W8** | Tracking | New evidence on a confirmed case raises a flag and a notification; the case never changes by itself | Workflow, scalability |
| **W9** | Hand-off | Approved top 10 to engineering; export format (codebeamer / Jira) is a later feature | Feasibility in the enterprise |
| **W10** | Story, pitch and honesty | Demo script, architecture slide, limitations slide (coverage gaps, assumptions) | All, especially "we reward honesty" |

### Explicitly not building
- A 24/7 production crawler, paid anti-bot scraping or login-wall bypassing. Native Chinese sites come after v1.
- Cost estimation or business cases. A rough S / M / L cost on the requirement is the maximum.
- Engineering feasibility decisions.
- Auto-generated "new car strategy" black boxes. The PM initiates; the AI proposes.
- A graph database, a separate confidence axis in the score, free-text themes, an "exploration level" or "project type" setting (all rejected, see `CLAUDE.md`).

---

## 3. Where to go deep and where shallow

The brief says: "You do not need to develop every capability to the same level of maturity."

| Capability | Depth | Why |
|---|---|---|
| Evidence → requirement traceability | deep | Every PM in the interviews asked for it |
| Explainable, adjustable scoring | deep | "Prioritization logic is one part of the challenge" |
| PM decision workflow (confirm, edit, approve, conflicts, profile compare) | deep | The visible part of the demo |
| Classification and case quality on the provided data | solid | Fixed taxonomy from BMW's own labels; measured against BMW's labels |
| Audit trail | solid | Simple event log, shown well |
| Daily fetch loop | solid | Steps 1 to 9; honest about what is not fetched |
| Several PMs on one platform | solid | Configs per vehicle and market, market conflicts shown |
| Export, verdict monitor | concept | Later features |

---

## 4. Team split

| Role | Owns |
|---|---|
| Backend ("the brain") | W1 to W4, W6 to W8: data model, seed, gate, cases, scoring, requirements, RAG agent, fetch loop, API |
| UI | W5, W9: boards, Notion-like pages, sidebar, on the API contract |
| Web sources | The source list and record format in [`fetching-sources.md`](../../05-web-sources/fetching-sources.md) |
| Taxonomy | The fixed lists and the classifier eval in [`taxonomy/`](../../../taxonomy/README.md) |
| Story | W10 |

---

## 5. Definition of done for the demo

- [ ] The PM picks a config (vehicle + market) and sees the case board with filters (market, car area, state, source type, release fit).
- [ ] Opens a case and drills down to the original verbatims, the study rows, today's equipment and a competitor source.
- [ ] Confirms a case; a requirement is generated with metric, target, assumptions, evidence level and cost.
- [ ] Edits a target; the change appears in the audit trail with a rationale.
- [ ] Switches the weight profile; the ranking changes, the rationale explains why, and the compare view shows what stays on top under every profile.
- [ ] Sees at least one market conflict with statistics and one assumption-level warning.
- [ ] Asks the sidebar a question and gets an answer that cites signal IDs; accepts a proposed edit as a diff.
- [ ] Sees external signals next to BMW signals in a case, each with its exact quote and source.
- [ ] New evidence on a confirmed case raises a flag; the case itself is unchanged.
- [ ] Approves the top 10; the sample requirement list has all mandatory fields ([smart-requirements.md](../../01-challenge/smart-requirements.md)).
