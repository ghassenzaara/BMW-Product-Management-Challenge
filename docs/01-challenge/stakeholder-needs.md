# What BMW Wants From the Tool: Consolidated Needs

One page that merges the official challenge documents with everything BMW people told us on 10.10.2026. Use it as the design checklist. Each point is tagged with its source so it can be checked.

**Source tags**
- `[BRIEF]` [hackathon-briefing.md](hackathon-briefing.md)
- `[MISSION]` [mission-and-deliverables.md](mission-and-deliverables.md)
- `[EVAL]` [evaluation-criteria.md](evaluation-criteria.md)
- `[PROC]` [process-cycle.md](process-cycle.md)
- `[DE]` [team discussion 14:24](../03-meetings/2026-10-10_1424_team-discussion-de_summary.md)
- `[EN]` [team discussion 14:39 with BMW contact](../03-meetings/2026-10-10_1439_team-discussion-en_summary.md)
- `[PM1]` [group PM interview 16:05](../03-meetings/2026-10-10_1605_pm-interview-2_notes.md)
- `[PM2]` [interview with Patrick](../03-meetings/2026-10-10_pm-interview_summary.md)

Statements from official documents are **requirements**. Statements from conversations are **user research**: strong signals, but from a handful of people, partly via noisy transcripts.

---

## 1. Who the user is and how they work today
- The **product manager (PM)** is the user. Engineering receives the output; it is not the user. `[DE][PM2]`
- PMs own a whole car, or a set of attributes (comfort, speed, seats, UI/UX ...) supported by specialists. Several PMs work on one vehicle. `[PM1][PM2]`
- Separate product management exists for **China**, the **US** and the **Middle East**. "It's nothing that we can solve from Munich." `[PM2]` In practice one car line has a **China PM** and a **rest-of-world PM**. Their requirements are mostly similar, but China has its own (e.g. the fridge). Our design: each PM logs in to a **personal workspace** (model + region) on **one shared data layer** ([web-intelligence-loop.md §4](../06-solution-concept/web-intelligence-loop.md#4-one-data-layer-a-workspace-per-pm)).
- Two project types: **model projects** (a new generation) and **option projects** (scalable options, "Lego"/Baukasten shared across series). Plus **market requirements** (Norway: heated steering wheel; Italy: A/C). `[PM1][PM2]`
- Tools today: Excel, PowerPoint, **Jira**, **Confluence**, SharePoint; **Codebeamer** for the hand-off to engineering. "Brain and hands." `[PM1][PM2]`
- Biggest pain: **research**, i.e. combining customer feedback, social media, reviews and competitor data, and redoing it every time they are challenged. `[PM1][PM2]`
- PMs spend about 30 to 40% of their time with engineering, and a lot of time in meetings. `[PM2]` `[team notes]`

## 2. What the tool must do (functional)
| # | Need | Sources |
|---|---|---|
| F1 | Ingest the provided data and enrich it with web research (competitors, reviews, social listening, trends) | `[BRIEF][MISSION][PM1][PM2]` |
| F2 | Extract signals (recurring complaints, unmet needs, competitor advantages, trends), each linked to its sources | `[MISSION]` |
| F3 | **Cluster and summarize** high-volume inputs (social media) into a map of what's happening, so the PM doesn't approve each input | `[EN][PROC]` |
| F4 | Derive requirements that are clear, actionable, customer-facing and realistic ([SMART](smart-requirements.md)) | `[MISSION]` |
| F5 | Show *all* found candidates first, then help **narrow down** to a shortlist (top ~10 for engineering) | `[PM2]` |
| F6 | **Prioritize with an explainable logic**, and let PMs set weights (e.g. speed vs. comfort vs. budget), with the list re-ranking live | `[MISSION][EVAL][PM1]` |
| F7 | **What-if / sensitivity:** "whatever I choose, this feature stays on top", but with budget focus comfort drops | `[PM1]` |
| F8 | PM can **approve, reject, edit, challenge, postpone** each requirement | `[BRIEF][MISSION][EVAL]` |
| F9 | **Audit trail:** who or what changed what, when and why, across content, score, priority, evidence and status | `[MISSION][EVAL]` |
| F10 | **Source filtering:** exclude sources, e.g. social media users who aren't the target customer, or current owners only | `[PM1]` |
| F11 | Support use cases: new model, improve an existing model, optimize for a market | `[PM2]` |
| F12 | **Continuous monitoring:** competitor and feedback agents re-check requirements and **flag** outdated ones (e.g. range targets overtaken). No silent edits | `[DE][PROC]` |
| F13 | Remember past decisions: "was this declined years ago, and why?" | `[team notes]` |
| F14 | Export or hand off to the existing tools (Codebeamer, Jira, Confluence) | `[PM1][PM2]` (implied) |
| F15 | **Per-PM workspaces** on one shared data layer (China PM, RoW PM, …): own goals, filters, watchlist; global vs. regional requirements; cross-region conflicts visible to both | `[PM2]` + team design |
| F16 | **Social listening at scale:** YouTube reviewers, forums, social media, Chinese platforms, weighted by audience fit, not reach | `[PM2]` |

## 3. How it must behave (principles)
- **No black box.** No one-click "generate requirement card". Every recommendation shows source type, market and evidence. `[EN][BRIEF]`
- **Data-based, not probability-driven.** LLM free invention ("add a wing") is not traceable. Ground every claim in data. `[EN]`
- **Evidence vs. assumption** clearly separated. Surface **uncertainty and conflicting evidence**, because honesty is rewarded. `[BRIEF][EVAL]`
- **Don't hide, don't decide.** Show controversial findings (China wants X, US hates X) with statistics per market and segment. The PM picks a market or builds two variants. `[PM1]`
- **PM-initiated.** The PM states the goal ("a new model focused on speed"). AI suggestions are input, not decisions. `[PM1]`
- **Exploration is a setting.** The PM controls how far the agent may propose genuinely new ideas versus mixing and matching known ones. `[EN]`
- **Innovation is a human job.** The AI can surface innovation candidates (competitors, other industries, CES, suppliers), but the PM decides. `[PM1]`
- **Arguments for engineering.** The PM must defend every requirement to engineers: why we need it (complaint, wish, competition) and what it is worth. `[PM1][PM2]`
- **Shared baseline.** One platform with the same logic for all PMs, plus collaboration (several PMs challenging the same list). `[PM1][PM2]`
- **Fits the workflow.** A companion to existing work, not a revolution. `[EN]`

## 4. Prioritization signals BMW people named
| Signal | Note | Source |
|---|---|---|
| Frequency of mentions | One indicator, never the only one | `[PM2]` |
| Severity | Functional failure ("doesn't work") weighs more than taste | `[PM2]` |
| Regression vs. predecessor | Features taken away (X5 split tailgate in the US) cause strong complaints | `[PM2]` |
| Competitor parity | Minimum feature set to stay competitive (e.g. Chinese entry-level baseline for the 1 Series) | `[PM1][PM2]` |
| Brand fit / BMW-ness | Sporty, fast, efficient, premium, design. Rejects off-brand volume (the "rice cooker"). Don't fight on every attribute (Mercedes owns massage seats) | `[DE][PM1]` |
| "Best in category" differentiators | Iconic features (e.g. rear-wheel drive) | `[PM1]` |
| Market importance | Sales volume of the market. A loud but tiny market is flagged, not followed | `[PM1]` |
| Target audience | Current or target customers vs. general social media | `[PM1][PM2]` |
| Positioning tier | Base vs. premium vs. luxury (Rolls-Royce, not 7 Series) | `[PM2]` |
| Cost / budget | Only a **rough** factor. A successor must not double cost | `[MISSION][DE][PM2]` |
| Evolution vs. revolution | Most requirements are incremental; only one or a few innovations get priority 1 | `[DE]` |
| Customer and business perspectives | The two prioritization axes on BMW's process slide | `[PROC]` |

## 5. Explicitly out of scope
Regulatory and homologation requirements, technical and engineering specs, pricing and business-case calculations (cost only as a rough factor), and the engineering feasibility loop (next scope). `[MISSION][EN][PM2]`

## 6. Open questions (not answered by any source)
- How many requirements should one cycle end with? Patrick said "top 10" for the hand-off; the mission says "a representative set".
- Which roles may approve? Is there a lead PM, or can any PM approve?
- How do market PMs (China, US) and the central PM merge conflicting lists?
- Exact Codebeamer, Jira and Confluence formats.
- Dirk (PM) was expected the next morning, so these could be asked then.
