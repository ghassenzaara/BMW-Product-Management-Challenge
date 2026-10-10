# Meeting Summary: 10.10.2026, 14:24–14:29

**Topic:** How a multi-agent requirements system should handle changing information, feasibility, and human decision-making.
**Source:** [`2026-10-10_1424_team-discussion-de_transcript.md`](raw/2026-10-10_1424_team-discussion-de_transcript.md) (German, machine transcription, one speaker captured). The audio was noisy, so some passages are interpretations and are flagged below.

## Key points

### 1. The process is a continuous loop, not a one-off run
- New information keeps arriving, so requirements must be revisited repeatedly, up to the **design freeze**.
- A multi-agent setup prioritizes the requirement list and feeds the documentation.

### 2. Competitor agent: detect when a requirement becomes outdated
- The competitor agent runs continuously.
- Example: an electric range of **1,000 km** is logged for the vehicle. The agent then finds that Tesla and Chinese competitors have announced **2,000 km by 2033**.
- The system should recognize that the current 1,000 km answer is now too low and **flag the requirement for rework**.
- The agent should **not silently change requirements**. It should warn: "something is moving in the market or technology, and your requirement no longer fits the new state."

### 3. Feasibility needs an engineering check
- A competitor or market (e.g. China) may claim something that is not realistic within about five years.
- Engineering has to judge this manually ("not possible at 2,000 km, so we settle at 1,000 km").
- Requirements therefore need a feasibility check, not just market pressure.

### 4. Customer feedback agent: feedback shifts over time
- Early feedback may look uniformly positive. A month later, issues such as **software bugs** show up.
- Late feedback has to flow back into the requirements. This is another reason for the loop.

### 5. Human in the loop: the product manager decides
- The product manager of this tool stays in control. The tool's **customer is Engineering**, which implements what the market and competition demand.
- Cars are **evolved, not reinvented**. An occasional true innovation (expensive, new) may become **Priority 1**. The rest stays roughly the same, only slightly better.
- A successor must not suddenly **double the cost**, for the customer or for development.
- The AI can **make proposals**. The product manager reviews them (e.g. via a tick box) and decides.

### 6. Brand fit filters out volume signals
- Example: many customers in **India** ask for a rice cooker (garbled in the transcript). Even if it appears a billion times on social media, it **doesn't fit the BMW brand**.
- BMW's identity centers on **driving dynamics, sportiness and design**. It is not a van or transporter.
- A competitor owns a given strength (for example, Mercedes and "the best massage seat"). BMW should not try to win on every attribute.
- Implication: **frequency of mention is not the same as strategic relevance**. The product manager applies brand judgment.

## Takeaways for the prototype

| Theme | Implication |
|---|---|
| Continuous monitoring | Agents run in a loop and re-evaluate existing requirements when new evidence arrives |
| Alert, don't overwrite | Changes in competitor or feedback data trigger a flag for review, not an automatic edit |
| Feasibility | Engineering can mark a market-driven requirement as not achievable |
| Evolution over revolution | Most requirements are incremental. Only one or a few true innovations are top priority |
| Cost guardrail | A successor must not double customer or development cost |
| Brand-fit check | The PM can reject high-volume signals that don't fit BMW (e.g. the rice cooker) |
| Human control | AI proposes, the product manager approves, modifies or rejects |

## Transcription caveats

- Many words had low confidence. Most low-confidence words were filler or fragments.
- **"Lexus"** (the vehicle in the range example) is probably a misrecognition and is not relied on here.
- **"B&B"** is read as BMW (brand). **"Reiskopf"** is read as a rice cooker. **"Ajax"** is probably a misheard competitor name and is omitted.
- The transcript captured only one side of the conversation. The "Them" speaker (system audio) has no text.
- Some sentences near the end ("best massage", "I'm the best…") were too garbled to interpret reliably, so that part of point 6 is the least certain.
