# Awesomic restyle · report

**Outcome:**
- Every screen now uses the Awesomic language: paper canvas, white hairline cards, DM Sans, obsidian primary and ember punctuation.
- The changes are visual only:
  - nothing under `web/src/contracts`, `web/src/mock`, `web/scripts`, `web/src/lib/api` or `web/src/components/ui` APIs changed in the restyle commits
  - no copy, structure, handler or logic changes (verified by a diff scan: every changed line is a `className`/style value)
- axe violations dropped from **133 to 101 nodes**. No screen got worse; Lighthouse accessibility is equal or higher on every screen.
- The contract test is unchanged: **129 calls, 0 failures**.

Files:
- reference files: `tokens.json`, `variables.css`, `theme.css`, plus `style-reference.md` (reconstructed; the brief's version wasn't attached)
- foundation decisions: [`decisions.md`](decisions.md)
- per-screen logs: [`screens-a.md`](screens-a.md) (shell, login), [`screens-b.md`](screens-b.md) (desk, inbox, innovation, signals), [`screens-c.md`](screens-c.md) (cases, case page, Sankey, chat), [`screens-d.md`](screens-d.md) (plan, requirements, replay, ripple, brief, settings, audit)
- QA: [`qa-round1.md`](qa-round1.md)

## Token mapping

| Awesomic token | Value | Where it lives in the app |
|---|---|---|
| paper (canvas) | `#f4f4f5` | `--background`, `--sidebar`, header, main |
| snow (card) | `#fff` | `--card`, `--popover`, `--secondary` |
| subtle card | `#fafafa` | `--recessed` (new): inner boxes, kanban columns, dialog footers |
| obsidian | `#09090b` | `--primary`, `--foreground`, sidebar primary; dark mode: `--background` |
| graphite / slate | `#18181b` / `#27272a` | dark `--card` / `--popover` + `--muted` (`--raised`) |
| iron | `#3f3f46` | ghost button text, filled tag (`--filled-tag`), chart-1 |
| steel / fog | `#52525b` / `#71717a` | `--muted-foreground` = `#66666f`; fog was 4.4:1 on the canvas, so one step darker for AA |
| ash | `#a1a1aa` | placeholder, dark `--muted-foreground`, dark ring |
| mist | `#d4d4d8` | `--border-strong` (new): stronger dividers, switch off-track |
| cloud | `#ececee` | `--border` (hairline); `--input` is `#e4e4e7` so fields stay visible |
| ember | `#ff5a00` | `--color-ember`: active-nav bar, count chips (obsidian text), replay beats, ripple strip/pulse, Sankey highlight path |
| magenta spark | `#fe45e2` | not used |
| radius md / xl / 2xl … | 6 / 12 / 16 / 20 / 24 / 28 / 36 | imported as `--aw-radius-*`; shadcn's scale set to sm 8 · md 12 · lg 14 · xl 20 · 2xl 24 · 3xl 28 |
| shadow-subtle | inset sheen + 1.5px `#2c2e34` ring | primary button (`--shadow-primary`); dark: 1px white/10 ring |
| shadow-md | `rgba(0,0,0,.04) 0 4px 12px` | popover, menu, select, dialog, sheet |
| type scale | caption 12 · body 15 · body-lg 18 · subheading 20 · title 28 · heading-sm 32 · heading 40 · heading-lg 56 · display 64 | `--text-*` utilities; body 15/1.45; page titles `text-title` (28/600); section headings 18/600; display only on login |
| status tones | — | `--tone-{slate,sky,violet,amber,emerald,red,fuchsia,blue,teal}-{bg,fg,bd,dot}`: the same hues at about half the chroma, text ≥6:1 on its tint, dark variants |
| semantic | — | `--positive/negative/warning/destructive` desaturated, plus `*-soft` tints |

## Translation decisions (summary; full list in `decisions.md` and `screens-*.md`)

- **Primary blue → obsidian everywhere.**
  - Selection, current step and primary actions stay obsidian.
  - New/alert/needs-you counts and the replay/ripple accent moved to ember, as punctuation only.
  - Links that were `text-primary` got an underline; otherwise they'd read as body text.
- **Count chips:** obsidian text on ember. White on ember is 3.1:1.
- **Toggle groups:** the "on" state became an obsidian fill (it was a faint grey). Choices read more clearly.
- **Active tab:** a white chip with a hairline. The old `bg-background` would equal the grey track.
- **Sidebar:** quiet, on the canvas. The active item is a white chip, `font-medium`, with a 2×16px ember bar.
- **Mobile (<768px):** the sidebar is a 56px icon rail with labels kept for assistive tech. The demo-data footer is the same element, repositioned as a fixed bottom strip so it stays fully readable. The header fits 390px. This was overflowing before.
- **Kanban:** recessed columns, white `rounded-lg` cards, still compact.
- **Sankey:** neutral flows on a zinc ramp, ember for the hovered/selected path, functional type colours muted.
- **Verdicts, evidence, trust, market chips:** same hue, desaturated tint with readable text. No meaning moved to ember.
- **Quality check and coverage notes:** equal or stronger weight than before (12px floor, tone colours).
- **AI vs. human:** the AI avatar is a hairline zinc chip with a bot icon; humans keep their initials circles (persona colours at `saturate(.75)`). Audit "AI" pills unchanged.
- **Cards:** all shadows removed; the 1px border does the elevation.
- **Letter-spacing:** `tracking-*` removed everywhere it was touched.
- **9–11px text** raised to 12px wherever it fit compact rows.

## Before / after

Every target exists at 1440 / 390, light and dark, in `before/screens/` and `after/screens/`. A selection is below; the full table is in [`_shots-table.md`](_shots-table.md).

| Screen | Before | After |
|---|---|---|
| Login | ![](before/screens/login_1440_light.png) | ![](after/screens/login_1440_light.png) |
| My desk · Lena | ![](before/screens/desk-lena_1440_light.png) | ![](after/screens/desk-lena_1440_light.png) |
| Cases board | ![](before/screens/cases-board_1440_light.png) | ![](after/screens/cases-board_1440_light.png) |
| Case · evidence (Sankey) | ![](before/screens/case-evidence_1440_light.png) | ![](after/screens/case-evidence_1440_light.png) |
| Case · stance | ![](before/screens/case-stance_1440_light.png) | ![](after/screens/case-stance_1440_light.png) |
| Requirement page | ![](before/screens/requirement-page_1440_light.png) | ![](after/screens/requirement-page_1440_light.png) |
| Replay · chain check | ![](before/screens/replay-chain_1440_light.png) | ![](after/screens/replay-chain_1440_light.png) |
| Ripple | ![](before/screens/ripple_1440_light.png) | ![](after/screens/ripple_1440_light.png) |
| Vehicle plan · dark | ![](before/screens/plan_1440_dark.png) | ![](after/screens/plan_1440_dark.png) |
| My desk · 390 | ![](before/screens/desk-lena_390_light.png) | ![](after/screens/desk-lena_390_light.png) |

## Accessibility (axe + Lighthouse, 1440 light; dark checked separately)

| Target | axe rules (nodes) before | after | Lighthouse a11y before | after |
|---|---|---|---|---|
| login | 3 (5) | 3 (5) | 95 | 95 |
| desk-lena | 1 (1) | 1 (1) | 100 | 100 |
| desk-katrin | 1 (1) | 1 (1) | 100 | 100 |
| inbox-lena | 1 (1) | 1 (1) | 100 | 100 |
| inbox-empty-sofia | 1 (1) | 1 (1) | 95 | 95 |
| cases-board | 3 (15) | 3 (15) | 96 | 96 |
| case-evidence | 2 (2) | 1 (1) | 96 | **100** |
| case-stance | 2 (2) | 2 (2) | 98 | 98 |
| case-requirements | 1 (1) | 1 (1) | 100 | 100 |
| requirement-panel | 1 (2) | **0** | — | — |
| requirement-page | 4 (5) | 3 (3) | 95 | **98** |
| replay-score | 6 (19) | 6 (17) | — | — |
| replay-chain | 6 (11) | 5 (8) | — | — |
| feedback-dialog | 2 (3) | 1 (1) | — | — |
| notifications | 3 (8) | 2 (2) | — | — |
| persona-menu | 5 (6) | 5 (6) | — | — |
| plan | 2 (7) | 1 (1) | 96 | **100** |
| radar | 2 (2) | 2 (2) | 93 | 93 |
| innovation | 2 (3) | 2 (3) | 95 | 95 |
| settings | 3 (8) | 3 (8) | 90 | 90 |
| audit | 2 (3) | 2 (2) | 96 | 96 |
| brief-lena | 3 (3) | 3 (3) | 94 | 94 |
| onboarding-wei | 1 (1) | 1 (1) | 100 | 100 |
| inbox-after-refresh | 2 (2) | 1 (1) | 95 | **100** |
| ripple | 3 (12) | 3 (9) | 96 | 96 |
| ripple-drawer | 1 (8) | 1 (5) | — | — |
| desk-katrin-after-refresh | 1 (1) | 1 (1) | 100 | 100 |
| **Total nodes** | **133** | **101** | | |

**Dark mode:** axe on 14 key screens gives exactly the same results as light ([`after/axe-dark.md`](after/axe-dark.md)), so there are no dark-only contrast failures.

**What remains** is all pre-existing, and needs copy, structure or data changes that this restyle may not make. These are listed in `docs/ux-audit/findings.md` Batch 1:
- The bell's accessible name doesn't match its visible count.
- Avatar initials (9px white on the persona colour, which comes from mock data).
- The draggable kanban wrapper around a link (`nested-interactive`).
- Unlabelled selects and inputs in Settings, Signals and Brief.
- Heading order.
- Replay landmarks and the focusable timeline.
- Dimmed, not-yet-played replay cards (intentional state).

## QA scores and fixes

Scores (before / after, 1–5 on type hierarchy, palette discipline, hairlines, radius consistency, spacing rhythm, calm vs. busy, honesty signals) are in [`qa-round1.md`](qa-round1.md).

Fixes from the QA round (commit "Restyle QA fixes"):
- **390px overflow:**
  - The desk and settings grids got `minmax(0,1fr)` columns and shrinkable children.
  - The case header actions and every toggle group now wrap.
  - The requirement tab bar and the measurable-targets table scroll sideways.
  - The requirement side panel is capped at full width.

## Verification

- `tsc --noEmit`, `eslint`, `next build`: pass, on the restyle branch and on the integration branch with `origin/main`.
- `npm run contract-test` against a dev server: **129 calls, 0 failures**, the same as before the restyle.
- `npm run map-test` (backend adapter mapping): 8/8 pass.
- **README demo script:**
  - **Walked in a browser** (script A, steps 1–4, on the restyled dev build): Refresh → five steps → toast → *View ripple*; verdict colours distinguishable; *Keep, with reason* recorded.
  - **Factor slider**, driven with real input (`.cursor/ux-gate/slider-check.mjs`, keyboard and mouse drag): 0.85 → 0.90 gives "800 km CLTC ≈ 720 km WLTP" and the 5 Series turns *Behind*; *Team value* resets it. The browser tool's "read-only" report is a tool limitation: it can't operate native range inputs.
  - **The remaining steps:**
    - Wei's market variant and Katrin's notification are covered by the contract test.
    - The replay's *Chain intact*, the ripple drawer, the notifications popover, the side panel and the feedback dialog are covered by the gate captures.
- **Console:** 0 errors on `/login`, `/`, a case, the ripple and onboarding with several personas (`console-check.mjs`).
- **390px:** no horizontal overflow on 12 main routes after the QA fixes (`overflow-check.mjs`). Before the restyle, every screen overflowed at 390px.
- `git diff --stat` for the restyle commits: nothing under `web/src/contracts`, `web/src/mock`, `web/scripts`, `web/src/lib/api`. No build fixes were needed.

## Deliberately left unchanged

- **Copy, labels, structure:** all forbidden in the restyle. The UX audit's copy, hierarchy and flow fixes wait for batch approval (`docs/ux-audit/findings.md`).
- **Persona avatar colours:** mock data. They are only shown slightly desaturated.
- **The bell label and the remaining axe items:** they need prop or copy changes (see above).
- **Magenta spark:** not used. Its allowance was "at most once", and nothing needed it.
- **China and red market chips:** colour meaning per market was left as is (desaturated); re-mapping it is UX finding K1, awaiting approval.
- **Checkbox corner (4px):** a form control, not a surface.
- **`lib/deck.ts`** (the exported PowerPoint): a document output, not the app UI.
