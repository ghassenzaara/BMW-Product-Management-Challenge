# Meeting Summary: Lifecycle Voice Note, 10.10.2026, 18:04 (about 1.5 min)

**Topic:** A BMW-side speaker on the first questions to ask before deriving requirements (market, new car or mid-life update), and which changes are possible in each case. Ends with a referral to a second product manager.
**Source:** [`2026-10-10_1804_lifecycle-voice-note_transcript.md`](raw/2026-10-10_1804_lifecycle-voice-note_transcript.md) (English, machine transcription, speakers not labelled, starts mid-sentence).

This adds to the [PM interview](2026-10-10_pm-interview_summary.md) without repeating it. Its main new idea is that **where the car is in its lifecycle limits which requirements are possible**.

## Key points

### 1. Start with the market
> "I would see which market, which region the car is sold mostly"

- The first input is where the car mostly sells. This belongs in the situation analysis, with sales volume as part of the baseline.

### 2. Is it a new car or a mid-life update?
> "if it's a new car, so completely new development, or if it's just an impulse, so mid of the life cycle"

| Project type | What it means | Room for change |
|---|---|---|
| **New generation** | A completely new development | "I can change everything" |
| **Mid-life update** (the "impulse") | An existing car, mid-way through its lifecycle | "the changes that I could do in the car are much less" |

### 3. Some changes are easy, some are not
| Easy and quick (fits a mid-life update) | Hard (needs a new generation) |
|---|---|
| New paint, new colours, new rims, "new whatever" | A different engine, bigger or smaller |
| | A new powertrain, e.g. "a hydrogen engine or whatever" |

- A major change like a new engine "is very difficult to change … within two, three years".

### 4. Too deep for an update means "next car", not "no"
> "there are changes I cannot [do], and then I need to just have a new car"

- A requirement that is valid but too big for a mid-life update should move to the next generation, not be rejected.

### 5. Contacts
| Person | Role (as heard) | Why they matter |
|---|---|---|
| **Zinnia** (spelling uncertain), "the lady on the very right" | Vehicle product manager, "very familiar with the car" | At the event; a second PM to validate the prototype with |
| **Elena** (spelling uncertain) | Linked to customer support and something that sounds like "connected company" (most likely connected-car) | Possible person to ask about customer feedback and connected-car data |

## Takeaways for the prototype

| Theme | Implication |
|---|---|
| Market first | Use [`sales-volumes_2024-2030.xlsx`](../02-bmw-data/raw/sales-volumes_2024-2030.xlsx) to find the vehicle's main markets; weight requirements from them higher or use the top market as the default demo market |
| Project type as a setting | At the start, choose vehicle, market **and** project type (new generation or mid-life update); the project type limits which requirements are possible |
| Change-depth tag | Tag each requirement as trim/option, part, or platform/powertrain; this can be the rough cost/effort factor the mission sheet allows in prioritization |
| Quick wins from option lists | Easy items (paints, rims) map to the option lists (`option-list_*.pdf`) |
| New decision status | Add **"Deferred to next generation"**, recorded in the audit trail with the reason; it also shows the "future-facing assumptions" the deliverables ask for |
| Scope check | Engine and powertrain specs are engineering requirements, so out of scope. Here they only explain why a change might wait for a new car. Customer-facing points like range or a hydrogen option are still in scope |
