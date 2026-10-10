# UX and Collaboration Design (demo v1)

The decisions behind the clickable demo in [`web/`](../../web/README.md). Agreed with Amine on 10.10.2026; the code follows this page. Related: [end-to-end-flow.md](end-to-end-flow.md), [web-intelligence-loop.md](web-intelligence-loop.md), Ghassen's `architecture.mmd` and `data-model.mmd` at the repo root.

## 1. Who works in the tool

Research on how OEM product management is organized (sources in the session notes):
- At BMW, product roles sit in two lines. **Sales/brand product management** includes market PMs, who define market requirements per series. **Development product lines** have an overall project lead per derivative.
- Platform and cross-model features are owned by a module or attribute owner. The series that request them stay linked to the decision.
- BMW standardized requirements management on **Codebeamer** in 2026. We hand off to it rather than duplicate it.

| Persona | Role | Can |
|---|---|---|
| Vehicle PM (e.g. 5 Series RoW, 5 Series China) | Owns cases and requirements for one series and region | Everything on own items; read, comment, watch and escalate on others' items |
| Attribute / option PM (e.g. operating concept & HMI) | Owns one attribute across series (Baukasten) | Receives referrals; one case for all series |
| Head of product line | Manager of the PMs | Portfolio, sign-off of requirements, resolves escalations, owns the brand profile and default weights |
| Engineering, finance, design, quality | Don't log in | Their answers come in as logged answers or pasted meeting notes |

Visibility is **open**: everyone reads everything, but only the owner or a co-owner changes status.

## 2. Objects and lifecycles

**Signal → Case → Requirement → Planned feature**, every step traceable.

| Object | Lifecycle |
|---|---|
| Signal (= Finding) | new → clustered / unclustered / quarantined |
| Case (the problem) | Observed → New → Investigating → Awaiting answers → Ready to decide → **Decided**, with outcome: **confirmed** (→ requirements), **referred** (another PM), **innovation pool**, **parked** (keep watching), **merged**, **rejected** (reason kept) |
| Referral | pending → accepted (linked case for the receiver) / declined (back to sender) / escalated (to the head) |
| Requirement (the solution) | Draft → In discussion → PM approved → **Signed off** (head) → **Planned** (vehicle plan) → Exported (Codebeamer); rejected / restore. Release: next generation, mid-life update (LCI) or OTA |
| Planned feature | keep / new / improve / remove vs. today's equipment; protect list for strengths |

Every status change needs a reason and writes an audit event. The AI only creates **proposals**.

## 3. Taxonomy on every case and requirement
- **Car area:** exterior & design, interior & comfort, seats, climate, infotainment & HMI, connectivity & digital (incl. AI assistant), driver assistance, dynamics & powertrain, range & charging, practicality, quality & materials
- **Type:** new feature, fix/improve, performance target, quality perception, market variant, brand differentiator, regression
- **Change depth (rough effort proxy):** trim/option, part/module, platform/powertrain, software/OTA
- **Scope:** global, Rest of World, China
- **Signal topic:** every signal carries one of 219 fixed topics (BMW VFC level 2) that maps to exactly one car area. Agents classify into this list and never invent themes; see [`taxonomy/`](../../taxonomy/README.md).

## 4. The case as "markdown + JSON"
Each case has structured fields plus a page with fixed sections: problem, who is affected, evidence, today's car, competitors, brand fit, options, decision log. The **context pack** shows what the AI and the PM work from:
1. **Preset context:** brand profile, series baseline, past decisions.
2. **Fetched signals:** grouped by agent.
3. **PM inputs:** notes, meetings, answers, accepted AI edits.

A case can be exported as `.md` with YAML front matter.

## 5. Screens
My desk · Inbox · Signal radar · Cases (kanban + ranked with what-if weights) · Case page (doc, signals, open questions, requirements, activity, AI assistant) · Requirements (kanban + ranked) · Requirement page (SMART spec, trace chain, argument sheet) · Vehicle plan · Innovation pool · Meeting prep · Portfolio and Approvals (head) · Settings · Audit trail.

## 6. AI in the loop (all proposals, never silent edits)
- Answers with citations to signal IDs.
- Proposes field and page edits as diffs.
- Drafts open questions, SMART requirements and argument sheets.
- Runs on-demand research that adds signals.
- Extracts answers from pasted meeting notes.
- The monitor raises alerts (competitor raises the bar, contradicts).
