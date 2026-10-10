# BMW Challenge: AI for Product Decision Making

An AI-powered application that helps BMW product managers derive, justify and prioritize customer requirements for a successor vehicle, with the product manager in control of every decision. This folder holds the challenge material, provided data, meeting notes and team ideas.

## Structure

```
data/
├── 01-challenge/          What we are asked to build
├── 02-data/               Provided BMW data (raw/) and its documentation
├── 03-meetings/           Summaries (raw/ holds the transcripts)
└── 04-team-notes/         Our own brainstorming
```

### 01-challenge: the task
| File | Content |
|---|---|
| [`hackathon-briefing.md`](01-challenge/hackathon-briefing.md) / [`.pdf`](01-challenge/hackathon-briefing.pdf) | The challenge, why it matters, mission, what to demonstrate |
| [`mission-and-deliverables.md`](01-challenge/mission-and-deliverables.md) | Mission sheet: scope, in/out of scope, expected deliverables, audit trail |
| [`process-cycle.md`](01-challenge/process-cycle.md) | BMW's process slide: situation analysis → documentation |
| [`findings-to-requirements.md`](01-challenge/findings-to-requirements.md) | 1 billion findings → 1,000 requirements → one car |
| [`provided-data-overview.md`](01-challenge/provided-data-overview.md) | What each provided dataset is good for |
| `assets/` | The source slide images |

### 02-data: the data
Start with [`02-data/README.md`](02-data/README.md) (columns, counts, caveats). Files in `raw/`: customer feedback (F70, G60, G70), customer study 2025, sales volumes 2024 to 2030, and option lists (PDF).

### 03-meetings: what was said
Files are named `date_time_topic_type`.

| Meeting | Transcript | Summary |
|---|---|---|
| Team discussion, 14:24 (German) | [transcript](03-meetings/raw/2026-10-10_1424_team-discussion-de_transcript.md) | [summary](03-meetings/2026-10-10_1424_team-discussion-de_summary.md) |
| Team discussion, 14:39 (English) | [transcript](03-meetings/raw/2026-10-10_1439_team-discussion-en_transcript.md) | [summary](03-meetings/2026-10-10_1439_team-discussion-en_summary.md) |
| Product manager interview (about 24 min) | [transcript](03-meetings/raw/2026-10-10_pm-interview_transcript.md) | [summary](03-meetings/2026-10-10_pm-interview_summary.md) |
| Lifecycle voice note, 18:04 (about 1.5 min) | [transcript](03-meetings/raw/2026-10-10_1804_lifecycle-voice-note_transcript.md) | [summary](03-meetings/2026-10-10_1804_lifecycle-voice-note_summary.md) |

Raw transcripts are in `03-meetings/raw/`; read the summaries first. The PM interview is the most important user input.

### 04-team-notes: our thinking
[`brainstorm-ideas.md`](04-team-notes/brainstorm-ideas.md): data sources, markets, architecture layers, agents, perspectives.

## Recurring themes across the material
- **Human in the loop, no black box:** every recommendation shows its source, market and evidence. The product manager accepts, edits or rejects.
- **Traceability and audit trail:** from finding, to requirement, to score, to decision, including who changed what, when and why.
- **Evidence vs. assumption:** make clear which conclusions rest on data and which on forward-looking assumptions.
- **Continuous loop:** competitor and feedback agents re-check requirements and flag outdated ones. They do not overwrite.
- **Brand fit and market differences:** volume of mentions is not relevance. China, the US and the Middle East need separate treatment.
- **Prioritization signals:** count distinct customers, not reach or rows. Treat functional complaints and removed features as serious.
- **Output is a shortlist:** PMs hand roughly the top 10 requirements to engineering (codebeamer), each with its arguments.
- **Scope:** customer value only. No regulatory, engineering or business-case work.
