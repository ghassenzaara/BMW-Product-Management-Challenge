# Meeting Summary 2: 10.10.2026, 14:39–14:53

**Topic:** Design discussion between the hackathon team and a BMW-side contact on how an AI requirements tool should work for product managers (PMs): output format, human control, data structure, and where AI should and shouldn't decide.
**Source:** [`2026-10-10_1439_team-discussion-en_transcript.md`](raw/2026-10-10_1439_team-discussion-en_transcript.md) (English, machine transcription). All speech is labeled "You", so individual speakers can't be told apart. Garbled passages are flagged at the bottom.

## Key points

### 1. How PMs work today, and where the tool fits
- PMs spend their days reading customer feedback on the web and weighing it mentally (e.g. "this trend is hot, but maybe it doesn't fit the portfolio").
- There is **no system** that structures all this data. It is unstructured: published features, market-trend reports, customer wishes ("I wish I had twice the horsepower").
- The goal is to bring this into a **structure**, not to revolutionize the workflow. The tool should **fit the existing workflow** as an extension of it and act as a **companion**, at least at first.

### 2. No black box: human in the loop with traceability
- A "press a button, get a new requirement card" black box was explicitly rejected.
- PMs will ask: *Where does this recommendation come from?* Social media? Competitors? Which market?
- **Provenance must be visible** (source type, market, evidence), and the PM can accept or reject.
- PMs don't want to approve every single input. They want a **map or context** of what is happening, so social media should be **clustered and summarized automatically**, with the PM deciding what matters for BMW.
- Asking the LLM to freely "come up with a requirement" is **not traceable**, and an LLM may suggest things no car has (the joke: "add a wing"). Decisions should be **data-based, not probability-driven**.

### 3. PM and engineering interaction
- PMs pitch requirements to the large engineering department before anything is built.
- There is a lot of **back and forth** on feasibility (e.g. engineering says range and light weight can't both be had) and then on prioritization. Talking with engineers is a big part of the PM's job.
- Suggested scope: the tool **ends at what the PM needs to tell engineering** (the input needed from them). The engineering feedback loop is the **next scope**.
- Rather than one button, the better design is **traceability**, so that requirements engineering rejects as infeasible come back into the process.

### 4. Data structure: a graph
- Proposed technical foundation: a **graph**. Options and features are **nodes**, related to every car they apply to (e.g. i3 and i5 share some options and differ in others).
- Reasons:
  - Cars **overlap heavily** with each other and partly with **competitors**, on specific features or on abstract ones (e.g. a head-up display, as Porsche has).
  - New information can be **classified into a category** (e.g. aerodynamics, lighting) and attached to the right nodes.
- Every piece of information should land under a category, so the output stays **logical and relevant**.
- Presentation is separate: the PM doesn't see the raw graph. They get a **dashboard, table or agent view**. A table was suggested as a fine output format.
- Pure semantic/LLM processing risks "slop". A structured data layer is a good engineering foundation, and tables or other views can sit on top.

### 5. Exploration vs. data-driven decisions
- Question raised: should the agent be strictly quantitative, or allowed to explore completely new ideas?
- Conclusion: **ask the PM**. Implement it as a **setting** for how much exploration (intake of new things) is allowed.
- Suggested follow-up for user research: ask PMs how much they copy from existing things versus create new ones.
- The BMW-side view: they **mix and match** a lot. "A competitor did this, then we look at the numbers and customer feedback." Almost nothing is built from scratch.

### 6. Competition
- BMW has a big **benchmarking** practice plus competitor reports on what rivals built.
- Main competitors named:
  - **German premium brands**, above all **Mercedes**, because the products are very similar.
  - **Chinese manufacturers**, with China as an interesting and fast-moving market. Xiaomi was named.

## Takeaways for the prototype

| Theme | Implication |
|---|---|
| Transparency | Every recommendation shows its source type, market and evidence |
| No black box | No one-click "generate requirement". PM reviews, accepts or rejects |
| Context over volume | Cluster and summarize social media instead of listing every input |
| Data layer | Graph of features and options linked to cars and competitors, with new findings classified into categories |
| Presentation | Dashboard, table or agent view for the PM, not the raw graph |
| Exploration control | A setting for how much the agent may propose genuinely new ideas |
| Scope | Stop at what the PM needs to bring to engineering. Feasibility loop is the next step |
| Competitor focus | German premium (Mercedes) and Chinese brands (e.g. Xiaomi) |

## Transcription caveats

- The audio was noisy. Most low-confidence words were filler. Several passages in the 14:40–14:46 range are fragmentary.
- Garbled and **left out**: a venue announcement (removed from the transcript) and a "34%" figure about time spent with engineers (the PM interview gives 30 to 40%).
- Interpretations: "BNW" and "B&B" are read as BMW. "L&M" is read as LLM. "iEngine" is read as AI engineer.
- Single-speaker labeling means attributions like "the BMW-side view" are inferred from context, not confirmed.
