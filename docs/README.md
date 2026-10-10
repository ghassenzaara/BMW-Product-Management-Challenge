# BMW Challenge: AI for Product Decision Making

An AI-powered application that helps BMW product managers (PMs) derive, justify and prioritize customer requirements for a **successor vehicle**, with the PM in control of every decision. This folder is the knowledge base: the challenge, the provided data (raw and processed), what BMW people told us, and our own notes.

> **Agents:** start with [`CLAUDE.md`](CLAUDE.md). It has the reading order, ground rules and where each kind of fact lives.

## Quick facts
- **Task:** concept + working prototype that turns heterogeneous inputs into prioritized, evidence-backed, customer-facing requirements, with human review and a full audit trail.
- **Vehicles:** 1 Series (F70), 5 Series (G60, China G68), 7 Series (G70). **Markets:** Europe, China, US (any subset). **Horizon:** 3 to 5 years.
- **Must deliver:** (1) prototype, (2) sample requirement list with ID, description, findings and sources, score, rationale, evidence level, assumptions and status, (3) end-to-end workflow with AI and human boundaries, (4) audit trail.
- **Judged on:** scoring logic, workflow and human decisions, traceability, usability and feasibility, innovation and scalability. **Honesty about uncertainty is rewarded.**
- **Out of scope:** regulation and homologation, engineering specs, pricing and business case (cost only as a rough factor).
- **Biggest data caveat:** no customer feedback from China; G60/G70 feedback is 90 to 95% US; F70 is UK/Japan and ICE only.

## Map

```
BMW-Challenge/
├── CLAUDE.md                 Agent entry point: reading order, rules, where to find what
├── GLOSSARY.md               Model codes, BMW/process terms, German option-list terms
├── 01-challenge/             What we are asked to build, and what BMW wants
├── 02-data/                  Provided BMW data: raw/, processed/ (CSV), insights, equipment
├── 03-meetings/              Meeting summaries (raw/ holds the transcripts)
├── 04-team-notes/            Our own brainstorming
└── 05-solution/              Our solution design: scope/focus, end-to-end flow, UX decisions
```

### 01-challenge: the task
| File | Content |
|---|---|
| [`hackathon-briefing.md`](01-challenge/hackathon-briefing.md) / [`.pdf`](01-challenge/hackathon-briefing.pdf) | Official brief: challenge, mission, what to demonstrate (the .md matches the 2-page PDF) |
| [`mission-and-deliverables.md`](01-challenge/mission-and-deliverables.md) | Mission sheet: scope, in/out of scope, the 4 deliverables, audit trail |
| [`evaluation-criteria.md`](01-challenge/evaluation-criteria.md) | **The 5 judging criteria** + "we reward honesty" + what to show for each |
| [`stakeholder-needs.md`](01-challenge/stakeholder-needs.md) | **Consolidated needs** from all documents and interviews, with source tags: functional needs, principles, prioritization signals, open questions |
| [`process-cycle.md`](01-challenge/process-cycle.md) | BMW's process slide: situation analysis → structure → definition → prioritization → documentation |
| [`findings-to-requirements.md`](01-challenge/findings-to-requirements.md) | 1 billion findings → 1,000 requirements → one car (example verbatims and requirements) |
| [`smart-requirements.md`](01-challenge/smart-requirements.md) | How to write a requirement (SMART), good and bad examples, the requirement record template |
| [`product-development-process.md`](01-challenge/product-development-process.md) | Generic 13-phase automotive process with gates, and where our tool sits (phases 1 and 2) |
| [`provided-data-overview.md`](01-challenge/provided-data-overview.md) | What each provided dataset is good for |
| `assets/` | Source slide images |

### 02-data: the data
| File | Content |
|---|---|
| [`README.md`](02-data/README.md) | **Start here:** files, columns, counts, caveats, processed CSVs |
| [`insights.md`](02-data/insights.md) | **Pre-computed findings:** coverage, cross-model themes (T1–T10), per-model tables, conflicting signals |
| [`equipment-baseline.md`](02-data/equipment-baseline.md) | English summary of the option lists: line-ups, prices, standard and optional equipment, gaps vs. feedback |
| [`external-sources.md`](02-data/external-sources.md) | Competitors named, suggested benchmarks, web source types, **evidence trust levels**, annual-report tip |
| `raw/` | 8 original files (feedback ×3, customer study, sales, option lists ×3) |
| `processed/` | Agent-readable CSV and text built by `scripts/build_processed.py` |

### 03-meetings: what was said (all on 10.10.2026)
Thomas's demo feedback (last row) is the most recent input; where it conflicts with older notes on UI scope, it wins.

| Meeting | Summary | Transcript |
|---|---|---|
| Team discussion, 14:24 (German): continuous loop, competitor agent, brand fit | [summary](03-meetings/2026-10-10_1424_team-discussion-de_summary.md) | [raw](03-meetings/raw/2026-10-10_1424_team-discussion-de_transcript.md) |
| Team discussion with BMW contact, 14:39 (English): no black box, graph data layer, exploration setting | [summary](03-meetings/2026-10-10_1439_team-discussion-en_summary.md) | [raw](03-meetings/raw/2026-10-10_1439_team-discussion-en_transcript.md) |
| Group PM interview, 16:05–16:46: workflow, weighting, traceability, source filtering | [summary + cleaned transcript](03-meetings/2026-10-10_1605_pm-interview-group_summary.md) | (included in the summary) |
| Interview with Patrick (PM, about 24 min): prioritization signals, China PM, Codebeamer top 10, shared platform | [summary](03-meetings/2026-10-10_pm-interview-patrick_summary.md) | [raw](03-meetings/raw/2026-10-10_pm-interview-patrick_transcript.md) |
| Demo feedback from Thomas (BMW AI engineer, about 26 min): one kanban for cases, fixed taxonomy, less is more, no colleague chat, pitch as collaboration platform | [summary + cleaned transcript](03-meetings/2026-10-10_2308_thomas-demo-feedback_summary.md) | [raw](03-meetings/raw/2026-10-10_2308_thomas-demo-feedback_transcript.md) |

Read the summaries first. Transcripts are machine-generated, noisy and not speaker-labelled.

### 04-team-notes: our thinking
| File | Content |
|---|---|
| [`brainstorm-ideas.md`](04-team-notes/brainstorm-ideas.md) | Cleaned brainstorm: data sources, markets, architecture layers, agents, perspectives |
| [`notes.md`](04-team-notes/notes.md) | Raw version of the brainstorm (adds: RAG knowledge base of past decisions, "understand BMW identity") |
| [`prompts.md`](04-team-notes/prompts.md) | Open design questions: model vs. requirement projects, one global car vs. market variants, PM-selected tags (market, requirement type, sources) |

### 05-solution: what we build
| File | Content |
|---|---|
| [`scope-and-focus.md`](05-solution/scope-and-focus.md) | Scope boundaries, demo focus (recommended: G60, US + EU/China contrast), workstreams W1–W10 with priority, depth profile, team split, definition of done |
| [`end-to-end-flow.md`](05-solution/end-to-end-flow.md) | Data → PM decision across BMW's 5 stages: diagram, gates A–D, data objects, scoring logic, screens, AI/human boundaries, worked example |
| [`web-intelligence-loop.md`](05-solution/web-intelligence-loop.md) | **Our differentiator:** the agent loop that fetches reviews, YouTube, Reddit, Chinese sites and competitor facts (Exa + YouTube API + OpenAI), traceability, monitoring alerts, per-PM workspaces (China PM / RoW PM) on one data layer, build plan |
| [`ux-and-collaboration.md`](05-solution/ux-and-collaboration.md) | **UX decisions of the demo (`web/`):** personas and org model, Signals → Case → Requirement → Planned feature lifecycles, case outcomes (refer, innovation pool, park, merge…), taxonomy, context pack, screens, AI-as-proposals |

## Recurring themes across the material
- **Human in the loop, no black box:** every recommendation shows its source, market and evidence. The PM accepts, edits or rejects.
- **Traceability and audit trail:** from finding to requirement, score, decision, including who changed what, when and why.
- **Evidence vs. assumption:** clear labels; conflicting signals are shown, not averaged away.
- **Explainable, adjustable prioritization:** PM-set weights, what-if re-ranking, signals such as severity, regressions, competitor parity, brand fit and market volume.
- **Continuous loop:** competitor and feedback agents re-check requirements and flag outdated ones. They do not overwrite.
- **Brand fit and market differences:** volume of mentions is not relevance. China, the US and the Middle East have their own PMs.
- **Shared platform:** one prioritization baseline for all PMs, collaboration, hand-off of the top ~10 to engineering (Codebeamer). A China PM and a rest-of-world PM each get a workspace on the same data layer.
- **Scope:** customer value only. No regulatory, engineering or business-case work.

## Housekeeping
- `knowledge-base.zip` is an **older snapshot** of this folder from 10.10.2026 15:13. It lacks the later meeting notes, team notes and images and has older versions of some files. Don't use it as a source. It can be deleted once nobody needs it.

### Renamed files (old → new)
| Old name | New location |
|---|---|
| `BMW_Hackathon_Briefing_Short.pdf` / `.md` | `01-challenge/hackathon-briefing.pdf` / `.md` |
| `Mission.md` | `01-challenge/mission-and-deliverables.md` |
| `BMW_Process_Cycle.md` | `01-challenge/process-cycle.md` |
| `BMW_Findings_to_Vehicle.md` | `01-challenge/findings-to-requirements.md` |
| `BMW_Data_and_Sources.md` | `01-challenge/provided-data-overview.md` |
| `bmw1.png` / `bmw2.png` / `imagee.png` | `01-challenge/assets/findings-to-requirements.png` / `process-cycle.png` / `provided-data-overview.png` |
| `01-challenge/Evaluation Criteria.png` | `01-challenge/assets/evaluation-criteria.png` (transcribed in `evaluation-criteria.md`) |
| `01-challenge/SMART Decisions.png` + `SMART.md` | `01-challenge/assets/smart-goals.png` + `smart-requirements.md` |
| `01-challenge/automotive-product-development-process.png` | `01-challenge/assets/…` (described in `product-development-process.md`) |
| `README_DATA.md` | `02-data/README.md` |
| `02-data/BMW Annual Report.md` | merged into `02-data/external-sources.md` |
| `BMW-Data-…/BMW-Data/*` | `02-data/raw/*` (renamed, see the table in `02-data/README.md`) |
| `Bmw recording .m4a.mp4` | removed (transcript kept) |
| `BMW Recording Transcript.md` → `03-meetings/raw/2026-10-10_pm-interview_transcript.md` | `03-meetings/raw/2026-10-10_pm-interview-patrick_transcript.md` |
| `03-meetings/meeting-notes-2026-10-10.md` | `03-meetings/2026-10-10_1605_pm-interview-group_summary.md` |
| `transcript.final.md` / `transcript.summary.md` | `03-meetings/raw/…1424_team-discussion-de_transcript.md` / `03-meetings/…_summary.md` |
| `transcript.final2.md` / `transcript.summary2.md` | `03-meetings/raw/…1439_team-discussion-en_transcript.md` / `03-meetings/…_summary.md` |
| `idea.md` | `04-team-notes/brainstorm-ideas.md` |
