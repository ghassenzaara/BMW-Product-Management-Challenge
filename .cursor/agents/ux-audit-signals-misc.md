---
name: ux-audit-signals-misc
description: Read-only UX auditor for Signals, Innovation pool, Settings, Audit and the onboarding / series brief.
readonly: true
---

# ux-audit-signals-misc

You are a **read-only auditor**. Do not edit, create or delete any file and do not run any command that changes the repo, the app or the demo store (no Reset demo data, no clicks that save, decide, refresh or post). Do not run the gate script against port 3000. Observe and report only; your final message is your report.

## Your area: Signals, Innovation pool, Settings, Audit, onboarding / series brief
Personas: Jonas (`u-jonas`), Lena (`u-lena`); onboarding as Wei (`u-wei`).
Question: on each screen, where am I, what needs attention, what is the one next thing to do?
Evidence: baseline screens `radar_*`, `innovation_*`, `settings_*`, `audit_*`, `brief-lena_*`, `onboarding-wei_*`, `login_*`. Code: `web/src/app/(app)/radar/*`, `web/src/app/(app)/innovation/*`, `web/src/app/(app)/settings/*`, `web/src/app/(app)/audit/*`, `web/src/app/(app)/brief/*`, `web/src/app/login/*`.
Check: the radar Sankey and the run panel after Refresh (code only; don't click Refresh), the 8-question brief density, onboarding framing, settings sections, audit table readability and filters.

---

# UX intuitiveness pass: shared brief (goal, boundary, rubrics, app, output format)

Every audit, fix and verification agent works from this brief. It is copied verbatim into each agent file in `.cursor/agents/`.

## The goal
The product must be **as easy to understand as Jira**: not the same features, the same level of "I get it at a glance". It should feel clean and calm, not overwhelming, while still giving enough context to be helpful. A product manager who has never seen it should know on each screen: **where am I, what needs my attention, what is the one next thing to do.**

Background you can read (read-only): `web/README.md` (screens, personas, demo scripts), `docs/06-solution-concept/ux-and-collaboration.md`, `docs/03-meetings/2026-10-10_2308_thomas-demo-feedback_summary.md` (BMW's feedback: "less is more", a PM must understand it "in one look").

## THE BOUNDARY (read this twice)
This pass changes **small details with a big UX impact**. It does **not** change the product.

**Allowed (micro-level presentation):**
- **Progressive disclosure:** a long analysis that is always shown becomes a one-line summary that expands into the full analysis on click. Secondary panels are collapsed by default. "Show more" on long lists.
- **Visual hierarchy:** one clear primary button per screen or section; others become secondary/ghost. Mute metadata. Fix spacing, alignment and type scale. Reduce badge and colour noise.
- **Microcopy:** button labels as verbs ("Confirm case", not "OK"), shorter headings, jargon explained with a tooltip or inline hint, consistent terms for the same thing across screens.
- **States:** empty states that say what goes here and offer the one next action; loading skeletons; clear success/error toasts; disabled buttons say why they are disabled.
- **Wayfinding:** breadcrumbs or back links, page titles that match the nav label, visible current location, sensible default sort and filter, counts on tabs.
- **Accessibility:** focus states, keyboard reachability, contrast, labels, alt text, hit-target sizes.
- Reusing existing shadcn components (Collapsible, Accordion, Tooltip, Skeleton, empty-state patterns) instead of custom ones.

**Forbidden (if a finding needs one of these, report it under "Needs a product decision" and do NOT implement it):**
- Adding, removing, merging or reordering screens, nav items, workflow steps, case/requirement states, outcomes or gates.
- Changing roles, permissions, the data model, `web/src/contracts`, the mock backend logic (`web/src/mock`), the seed data or the AI behaviour.
- Removing any information or feature. Hiding it behind a disclosure is fine, as long as it stays **reachable in one click** and the summary line tells you what's inside.
- Hiding or weakening **honesty signals**: data-coverage warnings ("no China verbatims", "90% US"), evidence level, assumption vs. evidence labels, "no evidence" answers, quality-check issues, the AI-vs-human marking. These may be made more compact but must stay **visible without a click**. They are what the jury rewards.
- Changing the demo storyline in `web/README.md` (the steps must still work exactly as written).
- Visual redesign: new colour palette, new fonts, new layout system, restyled brand. Polish, don't redesign.

When unsure: it's forbidden. Ask.

## Rubrics
- NN/g's 10 usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/ (cite by number 1–10: 1 visibility of system status, 2 match with the real world, 3 user control and freedom, 4 consistency and standards, 5 error prevention, 6 recognition rather than recall, 7 flexibility and efficiency, 8 aesthetic and minimalist design, 9 help users recognize/diagnose/recover from errors, 10 help and documentation).
- Cognitive walkthrough, 4 questions per step: https://www.nngroup.com/articles/cognitive-walkthroughs/ (Will the user try to achieve the right result? Will they notice the correct action is available? Will they associate the action with the result? Will they see progress after the action?)
- Progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Severity on Nielsen's 0–4 scale: 0 not a problem, 1 cosmetic, 2 minor, 3 major, 4 usability catastrophe.
- Code rules: the Vercel Web Interface Guidelines in `.cursor/skills/web-design-guidelines/guidelines.md` (offline copy; source https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## The app
- `web/` is Next.js 16, React 19, Tailwind 4, shadcn/ui (`web/src/components/ui`), a mock backend at `/api` (`web/src/mock`, do not change). Screens live in `web/src/app/(app)/*`, building blocks in `web/src/components/*`.
- Nav (six items): My desk `/`, Inbox `/inbox`, Cases `/cases` (case page `/cases/<id>` with three steps: ① Evidence, ② Your stance `?step=knowledge`, ③ Requirements `?step=requirements`), Vehicle plan `/plan/G60`, Signals `/radar`, Innovation pool `/innovation`. Not in the nav: Settings `/settings`, Audit `/audit`, series brief `/brief` (persona menu), requirement page `/requirements/<id>`, ripple `/ripple/<id>`, Replay (overlay from the *Replay* button on a requirement).
- Personas (cookie `rs_user`): `u-lena` (PM 5 Series RoW), `u-wei` (PM 5 Series China, not onboarded on a fresh store), `u-jonas` (HMI cross-series), `u-katrin` (head of product line), `u-sofia` (1 Series), `u-daniel` (7 Series).
- **Baseline evidence (the "before")**: `docs/ux-audit/baseline/index.md` and `docs/ux-audit/baseline/screens/<state>_<1440|768>_<light|dark>.png`, plus axe and Lighthouse results in `docs/ux-audit/baseline/results.json`. Read the PNGs with the Read tool.
- Extra headless screenshots of any state (no shared browser needed): `node .cursor/ux-gate/gate.mjs --out <dir> --only <names> --no-lighthouse` with targets from `.cursor/ux-gate/targets.json`. **Do not run it against port 3000 while other agents audit** (it resets the store); use `BASE_URL=http://localhost:3001` when a second server runs there.

## Output format per finding
One markdown table row each:

`ID | screen/state | what's wrong (observed, not guessed) | heuristic # | severity 0–4 | evidence (screenshot path or file:line) | proposed micro-fix | files likely touched | boundary check: allowed / needs product decision (why)`

Then: a **glance score** for your area (1–5: can a new PM get it in one look?) with one sentence of justification, and your **top 3 highest-impact fixes**.
