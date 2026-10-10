# Meeting Summary: Interview with Patrick (BMW Product Manager), 10.10.2026

**Who:** Patrick, BMW product manager (25 years at BMW, 8 of them in China: Beijing around 2010, Shanghai 2019 to 2024; started in MINI product management), and our team (*Hervisa*).
**Length:** about 24 minutes (English, with a short French and German exchange at the end).
**Source:** [`raw/2026-10-10_pm-interview-patrick_transcript.md`](raw/2026-10-10_pm-interview-patrick_transcript.md) (Whisper transcription, speakers not labelled, so attribution is inferred from context). Timestamps `[mm:ss]` point into the transcript.
**Not the same meeting as** [`2026-10-10_1605_pm-interview-group_summary.md`](2026-10-10_1605_pm-interview-group_summary.md). That earlier conversation ended with "I'll send you Patrick", so this interview probably followed it.

## Key points

### 1. Inputs PMs use today [00:00–03:35]
- **Benchmarking, customer studies and social listening** (what people post online). Then a balance: what fits in the new car, what is too expensive, what is too niche ("too special to some customers, not for everyone").
- YouTube reviewers count as social listening (Carwow, >10M subscribers). Reach is relative by market: "10 million is a city" in China.
- **Reach is not relevance:** one influencer disliking the interior, seen by 10M people, is still one opinion. The PM must judge whether it applies to everyone.
- AI is already used "quite a lot", but has limits (e.g. listening to videos). Other departments deliver **sentiment reports** (positive, negative, neutral per car and feature), and the PM scrolls through them. Nobody systematically watches and sorts all the videos ("millions of hours").

### 2. Markets have their own product management [03:35–04:16]
- **China has a separate product management.** "It's nothing that we can solve from Munich." The US and specific markets such as the Middle East also have their own PMs, because each market has different criteria for a good product.
- Example: an in-car **fridge** matters in China (people carry many drinks) and may not work in Europe.
- Implication: market is a first-class dimension. Requirements can be market-specific variants.

### 3. How the PM team works [04:16–07:52]
- PMs sit together, each responsible for a car or cars, with a broad exchange between them.
- **Baukasten (modular toolbox):** seats, materials and driver assistance software are shared across series. The 7 Series gets more sophisticated versions than the 1 Series. Requirements should therefore be reusable across vehicle lines.
- One PM owns the overview of a car. Specialists cover UI/UX, seats, materials, steering wheel and buttons. They "put it together like Lego".
- Close, almost daily contact with engineers in project rooms (e.g. a full-day interior meeting on "zero-gravity seats"). Engineering may say "possible, but costly", and the PM must judge whether customers would pay.
- Example of a price-fit judgement: an 8-cylinder in a 1 Series would be nice, but nobody would pay for it.
- The team lead always needs **the arguments, why and why not.** Delegated findings are not trusted blindly.

### 4. What he wants from the tool, and the prioritization signals [07:52–10:06]
- Step 1, where help is needed most: **research**, made quicker, faster and more precise with AI. "First I want to see all the requirements that were found."
- Step 2: **narrow down**, because there will be too many. A prioritization logic is "one part of the challenge". He named these signals:
  1. **Number of mentions**, as one indicator.
  2. **Functional complaints are serious.** "If people say this doesn't work, then I have to take it seriously", ranked above taste.
  3. **Missing features that customers had before.** Example: the new **X5 dropped the split tailgate**, and many US customers complain. This is a market-specific regression.
  4. **Budget:** money "always plays a role".
  5. **Competition:** what do they offer, and should we?
  6. **Positioning tier:** is it a premium topic, a base-car topic, or a luxury topic (Rolls-Royce rather than 7 Series)?
- Engineering comes **in the next step**. It is a PM tool, not an engineering tool.

### 5. Current tools and documentation [10:06–11:34]
- "Brain and hands." There is no dedicated software for prioritization or research.
- A large network: agencies, studies, and **car clinics**, where long-time BMW owners react to concepts, up to **10 years before SOP**.
- Documentation in **Confluence and Jira** (ticketing everything until a decision), plus memos, notes and minutes from management circles. "Very hands-on, almost a little traditional."

### 6. Budget and cost [11:34–14:23]
- The PM does **not** set the budget. Management circles fix it at the start for a new car or a change.
- Experience gives rough development costs per part. In the new software-heavy generation many figures are new, so alignment with engineering (and their suppliers) matters.
- **Product management is part of Sales.** There is a target selling price, and Finance requires a margin contribution.
- The PM's argument to engineering is always: **customer complaint, customer wish, competition**, then "how much could I sell it for". Example: every Chinese competitor has lights everywhere in the car while BMW has a very dark trunk, so this needs improving.
- Engineering decides on the solution and its cost. Then the PM decides: spend more and charge more, or drop it.

### 7. Use cases the platform must support [14:23–15:59]
- Find requirements for a **new product**, **improve** an existing product, **optimize for different markets**.

### 8. One shared platform [15:07–16:43, 18:49–19:31]
- Target scenario: **a single platform for all PMs**, so everyone works with the **same level of argumentation, the same prioritization and the same logic**. Today every PM works differently, depending on experience and preferences.
- He contrasted this with "build your own agent" tools (Adhero). Those are personal productivity tools, while BMW wants to **align processes to one baseline**. That supports the team's "multiplayer" idea.

### 9. Hand-off to engineering: Codebeamer, top 10 [19:31–20:58]
- After the PM process, the **top 10 requirements** are handed to engineering in **Codebeamer** (the requirements tool used for the engineering exchange). Engineering then evaluates them.
- Ideas outside the top 10 (likely infeasible or too expensive) may go to engineering directly for a quick check.
- The early phase is led more by the **BMW strategy department** (market needs, what the car should look like). In daily work, **30 to 40%** of a PM's time is exchange with engineering.

### 10. Cost-reducing ideas are welcome, but engineering decides [20:58–22:21]
- The team asked whether the tool could propose technologies or materials that make an expensive requirement cheaper. Answer: yes, PMs pass on specific ideas, but "it's not our responsibility, and we cannot decide. Engineering must decide."

### Logistics [16:43, 23:07–24:04]
- Patrick was on site until about 18:00. A colleague, **Dirk** (product management, from Patrick's MINI days), was expected the next morning around 8 to 9. Patrick offered to check the time. The team planned to be about 80% done by 9 the next day and wanted Dirk's feedback.

## Takeaways for the prototype

| Theme | Implication |
|---|---|
| Research is the bottleneck | Automate collection and clustering (feedback, reviews, social, competitors). Show *all* found candidates first, then narrow down. |
| Prioritization signals | Mentions; severity (functional failure > dislike); regressions vs. predecessor; competitor parity; market importance; positioning tier; budget/cost as a rough factor. |
| Reach vs. relevance | Weight by target audience and market volume, not by views or follower counts. Keep the outlier visible but low-weighted. |
| Market dimension | Market-specific requirements and PM views (China, US, Middle East, EU). Conflicts between markets are surfaced, not averaged. |
| Baukasten | Requirements reusable across series, with a level (base, premium, luxury) per series. |
| Shared platform | One baseline logic for all PMs, plus multi-user collaboration. |
| Output | A ranked shortlist (around the top 10) with arguments, exportable to Codebeamer, Jira and Confluence. |
| Boundaries | No cost or feasibility decisions. Cost ideas may be attached as suggestions for engineering. |

## Transcription caveats
- "BMV" and "bmv" are read as BMW. "gold beamer" and "code beamer" are read as **Codebeamer**. "Adhero" is reproduced as heard and is probably another hackathon team or tool.
- A Whisper repetition loop and a hallucinated line were removed during cleanup (see the transcript footer).
