# Meeting Summary: Product Manager Interview, 10.10.2026 (about 24 min)

**Who:** Patrick, BMW product manager (25 years at BMW, 8 of them in China), interviewed by our team.
**Source:** [`2026-10-10_pm-interview_transcript.md`](raw/2026-10-10_pm-interview_transcript.md) (English, machine transcription, speakers not labelled).

This is the most direct statement of user needs we have. Treat it as the primary user research.

## Key points

### 1. Inputs a PM uses today
- Benchmarking, customer studies, **social listening** (what people post online, incl. big YouTube reviewers such as CarWow), sentiment reports from internal media/communication departments, and **car clinics** (early-phase sessions with long-time BMW owners, up to 10 years before start of production).
- No dedicated software: "brain and hands". Documentation in **Confluence and Jira**, management decisions in memos and minutes.
- The PM collects and filters this alone; nobody watches all the videos. They look for "the most important or most significant" items.

### 2. Reach is not relevance
- One reviewer with 10 million followers disliking the interior is still **one opinion**. The PM must balance "is this important for everyone or just one guy?"
- Market scale differs: 10 million is large in Europe, small in China.

### 3. Markets need separate treatment
- **China has its own product management**, plus separate PMs for the US and specific markets such as the Middle East. Criteria for a good product differ by culture.
- Example: a fridge/cooler matters in China (people carry many drinks) and may not matter in Europe.

### 4. How PMs work
- PMs sit together, each owning one or more cars, and share a lot because of the **Baukasten** (modular toolbox): seats, materials, driver-assistance software are shared across series, with more sophistication in the 7 Series than the 1 Series.
- Each PM has specialists (UI/UX, seats, materials, steering wheel and buttons) and assembles results "like Lego".
- The PM must understand and confirm specialists' conclusions: **"we always need the arguments, why and why not."**

### 5. Funnel and prioritization signals (the core of the challenge)
1. First, **see all requirements** that were found.
2. Then **narrow down**, because there will be too many. A prioritization logic is explicitly part of the challenge.

Signals he named:
- **Number of mentions** (one possible reason, not sufficient alone).
- **Functional complaints are serious:** "if people say this doesn't work, I have to take it seriously."
- **Missing / removed features:** e.g. the new X5 lost the split tailgate the old one had, and US customers complain. Regressions against the predecessor matter.
- **Budget and cost:** money always plays a role (e.g. an 8-cylinder in a 1 Series is nice but nobody would pay for it).
- **Competition:** what do rivals offer? Example: every Chinese competitor has lighting everywhere, our trunk is dark.
- **Segment fit:** is a feature base, premium, or luxury (Rolls-Royce rather than 7 Series)?

### 6. Budget and business
- The budget is fixed by **management circles**, not the PM. Rough development costs are known from experience, but software-defined cars make many figures new.
- Product management is part of sales: sale price vs. manufacturing cost vs. required contribution margin (finance).

### 7. Interaction with engineering
- Arguments to engineering are always **customer complaint, customer wish, competition**, then "for how much could I sell it".
- Engineering decides feasibility and cost. The PM can suggest technology or materials, but **engineering decides**.
- Handover: the **top 10 requirements** go into **codebeamer** (the requirements tool shared with engineering). Real engineering interaction starts after that. Ideas outside the top 10 may go to engineering informally for a quick feasibility check.
- About **30 to 40%** of daily work is exchange with engineering. Early phases involve more the BMW strategy department (market needs, what the car should look like).

### 8. Use cases the tool should cover
- Improve an existing product, **optimize it for different markets**, or develop a new one.

### 9. Target vision: one shared platform
- Wanted: a **single platform** for all product managers, so everybody uses the **same baseline, the same prioritization logic and the same argumentation**. Today each PM works differently.
- He contrasted this with personal agent builders: the goal is process alignment across PMs, not individual productivity.
- It is a **product-manager tool**, not an engineering tool. Output is handed over afterwards.

## Takeaways for the prototype

| Theme | Implication |
|---|---|
| Two-step funnel | Show all findings and candidate requirements first, then a prioritized shortlist |
| Top 10 handover | Final output is a top-10 list ready to export (codebeamer-style), with arguments |
| Argument structure | Each requirement carries: customer complaint, customer wish, competition, then rough sellability/cost |
| Severity weighting | "Doesn't work" (defect, difficult to use) outweighs plain mention counts |
| Regression check | Compare with the predecessor and flag removed or worse features |
| Reach is not relevance | Weight by number of distinct customers and markets, not by influencer reach |
| Market separation | Market is a first-class filter; China, US and Middle East are separate contexts |
| Segment fit | Tag each requirement as base, premium or luxury and check fit with the series |
| Shared baseline | Same scoring logic for all PMs; Baukasten features link across series |
| Workflow fit | Integrate with existing tools (Confluence, Jira, codebeamer) rather than replace them |

## Follow-up
- A MINI product-management colleague (Dirk) visits the next morning (around 8 to 9 am) and can give feedback on the prototype.
