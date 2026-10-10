# Team Brainstorm: Ideas and Architecture Notes

Informal team notes, cleaned up and grouped by theme. Content is unchanged in substance.

## Data and sources
- Fetch from many places: YouTube and other review sources, car specs, customer feedback (by country), social media, and the Excel sheets provided by the hackathon.
- Get reviews from everywhere (YouTube etc.).
- Analyze sales to find why a model worked or failed (a separate use case).

## Scope and markets
- Scope options: new model lines, new variants, new country lines. Users can choose a **specific market** or an **international view**.
- China and Chinese cars are mentioned a lot, so they are effectively the biggest competitor.
- Other markets (US, Middle East) have different tastes and needs, and sometimes must be treated separately.
- Rank competitors.

## Requirements and decisions
- **Explaining a requirement is critical:** the decision, how things are weighted, and why they matter.
- The hackathon criteria are open, so the aim is feedback turning into actions.
- Document decisions so that in the future you can tell whether something was declined years ago, and why.
- Focus on the customer side and product-management optimization, not engineering. Help PMs stay in the loop with the latest changes.
- Idea: use a scoring/ranking model for decision making, and a distributed collaborative app for the product-management team.

## Architecture layers
1. **Data layer:** where the data comes from and how it is stored.
2. **Clustering, weighting and prioritization layer.**
3. **Thinking and decision layer.**
4. **Presentation layer:** AI interaction with the user (human in the loop).

## Agents
- **Competitor agent:** fetches information about competitors.
- **Data classifier:** classifies incoming data.

## Perspectives and needs
| Perspective | Needs |
|---|---|
| Engineering side | Traceability, data-driven decisions, transparency |
| Product management | Usability, integration into the workflow, **teamwork** (PMs spend about 90% of their time in meetings and talks), traceability, data-driven decisions, transparency |
| UX | PM-to-agent/platform interaction, PM-to-PM interaction, interaction between employees in the app |

## Related
- Mission and deliverables: [`../01-challenge/mission-and-deliverables.md`](../01-challenge/mission-and-deliverables.md)
- Meeting notes: [`../03-meetings/`](../03-meetings/)
