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
After Thomas's feedback (10.10.2026, "less is more") the demo has six screens: **My desk** (agent flags · my cases · review · follow up) · **Inbox** · **Cases** (kanban, ranked toggle) · **Vehicle plan** (requirements as a list by car area, merged with today's equipment) · **Signals** (one Sankey: sources → car areas → cases) · **Innovation pool**. Settings, the audit trail and **My series brief** sit in the persona menu.

The **case page** leads with a Sankey of its evidence (sources → topic × type → case, every node opens its quotes) and three steps: ① Evidence → ② Your stance (what you inherit from the brief, your take on the evidence, what you know that the data can't show, how far to go; plus open questions) → ③ Requirements (up to three shape questions, then the draft in a side panel with provenance, versions and engineering feedback).

## 5a. PM context layers: requirements that read like the PM wrote them
A draft is only as good as what the AI knows about the PM's intent. Five layers feed it, each asked once at the moment it matters, never as a long form:

| Layer | Asked when | Questions | Where it lives |
|---|---|---|---|
| 0 Brand | Once, by the head | brand profile (existing) | Settings |
| 1 Series brief | First login of a vehicle PM | at most 8: thesis, target customer, market weights, evolution vs. revolution, protect list, don't fight on, already decided, cost envelope. Pre-filled from data (sales shares, plan, brand profile); "paste your strategy doc" proposes values | `/brief`, shared per car + one regional overlay per market PM |
| 2 Case stance | Step ② of a case | 3: your take on the evidence, inside knowledge, ambition. Inherited brief values show as chips and can be overridden with a reason | per PM per case |
| 3 Shape questions | Step ③, before drafting | at most 3, only those the data and the brief can't decide (scope, benchmark, release, solution, offer). Each has a default and "why I'm asking"; mirrored in the case chat | per draft |
| 4 Feedback | After the draft | engineering or finance said X; accept, compromise or push back, with a reason | per requirement version |

Rules:
- **Provenance on every part.** Every sentence, target, criterion, assumption, release, scope and cost carries its source: *evidence* (with signal IDs), *your context* (which layer and field) or *assumption*. Shown inline as chips; hover for the signals.
- **Solution-neutral by default.** "How it is reached is open to engineering" unless the PM answers the solution question; then the prescription is tagged as a PM decision.
- **Honest gaps.** Missing evidence is said out loud ("No customer records from China yet, although the brief weights it 25%").
- **Never silent.** A brief change lists the affected requirements first; saving creates a *new version* proposal per requirement for its owner. Feedback creates a version proposal too. Versions stay on the same requirement ID.
- **Learning is proposed, never applied.** E.g. three cost-L rejects propose "set cost sensitivity to high?".
- **Regional overlay.** Wei (China) inherits Lena's shared brief and overrides only what differs, each with a reason. Differences show on both briefs and in Katrin's Review card; she accepts each as a regional variant or aligns it. On a shared case Wei co-drafts a China variant next to Lena's global requirement, and the requirement view compares the two.

## 5b. Trace replay: one click, the whole chain (criterion 3)
*Replay* on any requirement plays its life in about 15 seconds. It opens on the requirement, rewinds to the first customer quote, and plays forward:

| Beat | What the PM sees | Where it comes from |
|---|---|---|
| Voices | Real BMW quotes with market and source; sample of 12, all counted | Signals of the case, each with its stored source record |
| Signals | Topic × type nodes, each with how it was classified | BMW VFC label (lookup) or model + prompt version |
| Case and score | The score built factor by factor, with "today" next to it | Score snapshot frozen on the decision event, under the weight profile active then |
| Decisions | Timeline: agents dashed with a bot icon, people solid with avatar and quoted reason | Append-only audit log |
| Planned | The vehicle-plan slot | Vehicle plan |

**End state: Chain intact.** Four checks are recomputed on every call; a failure is shown in red with its reason, never hidden:
- every quote is found in its source record
- every record's SHA-256 matches its text
- the audit log has no sequence gaps for the chain
- every status change carries a rationale

A scrubber shows version, score and evidence as of any date. *Export dossier* writes the same sections as the backend's audit-chain report. The static Sankey with highlights is the base and the motion is layered on top; with reduced motion the beats step instead of animate.

## 5c. World changed: the competitor ripple (criterion 5 + honesty)
A competitor fact arrives through the agent run (Signals → Refresh) and is judged against every target that uses the same metric, across series, market variants and Baukasten.

- **Machine-comparable targets.** Each metric carries a `targetSpec` (key, comparator, value, unit, cycle, market). The text stays for people.
- **Normalization is visible.** "800 km CLTC ≈ 680 km WLTP · factor 0.85 · range 0.80–0.90 · assumption". There is no published conversion, so the factor is a labelled team assumption. The PM can try another factor live; only the head saves a new team value, with a reason.
- **Verdicts:** behind, at par (±3%), still ahead, not comparable (with the reason: different segment, other market, no conversion). China targets compare in CLTC.
- **One screen:** series × car area, cells pulse from the source and are colored by verdict. Your cells are outlined; colleagues' show their avatar. The impact list shows ours vs. theirs, rank before → after with "moved because", and who was notified.
- **The right people:** owners and co-owners get an alert, watchers an FYI, the head when a signed-off target is affected.
- **Never an auto-edit.** *Raise target* and *Create market variant* are proposals. Changing a signed-off target resets it to PM-approved. *Keep, with reason* and *Reopen case* are audited decisions. All of them show up in the requirement's replay.
- **Against alarm fatigue:**
  - low-trust facts (D, E) only go on the watch list
  - a kept target stays muted until the gap grows by more than a threshold (Settings, change logged)
  - the PM's reason goes into the monitor's context

## 6. AI in the loop (all proposals, never silent edits)
- Answers with citations to signal IDs.
- Proposes field and page edits as diffs.
- Drafts open questions, SMART requirements (from the context layers above, with provenance) and argument sheets.
- Proposes brief values from a pasted strategy doc and new requirement versions after feedback or a brief change.
- Runs on-demand research that adds signals.
- Extracts answers from pasted meeting notes.
- The monitor raises alerts (competitor raises the bar, contradicts) and assesses a competitor fact across the portfolio (ripple), with proposals per affected target.
