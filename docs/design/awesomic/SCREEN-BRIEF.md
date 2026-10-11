# Screen polish brief (Phase 2 of the Awesomic restyle)

You restyle one group of screens of the Next.js app in `web/` in the Awesomic visual language. The foundation (tokens, font, radius scale, `components/ui/*`, `components/common/{badges,page,people}.tsx`) is already done and committed. Your job is the **screen-level touch-ups** in your own files only.

Read first (absolute paths, in the foundation worktree):
- `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-awesomic\docs\design\awesomic\style-reference.md`: the visual language.
- `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-awesomic\docs\design\awesomic\decisions.md`: what the foundation already decided (do not re-decide).
- `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-awesomic\web\src\app\globals.css`: the tokens you can use.
- `web/AGENTS.md` in your worktree: this is Next.js 16; read `node_modules/next/dist/docs` before touching anything framework-related (you shouldn't need to).

The style reference always wins over any skill's aesthetic opinion (including the web-design-guidelines skill).

## THE BOUNDARY (verbatim from the user; non-negotiable)

**Allowed: visual changes only.**
- Colours, fonts, font sizes and weights, line heights
- Borders, radii, shadows
- Spacing, padding, gaps, max-widths, alignment, grid and column proportions within a screen
- Visual styling of existing components: buttons, badges, cards, inputs, tabs, tables, kanban cards, sidebar/nav, dialogs, sheets, toasts, the Sankey and chart colours
- Icon size and stroke
- Hover and focus states, subtle transitions

**Forbidden:**
- New pages, routes, nav items, features, components that add functionality, or new UI sections
- Removing anything, or moving content between screens
- Changing copy or labels, the workflow, or the state/status logic
- Changing `web/src/contracts`, `web/src/mock`, the seed data, the API or the AI behaviour
- Hiding or toning down **honesty signals** until they're hard to see: data-coverage warnings ("no China verbatims", "90% US"), evidence level, assumption vs. evidence labels, "no evidence" answers, quality-check issues, AI-vs-human marking, verdicts (behind / at par / ahead), market-conflict flags. They must stay clearly readable.
- Breaking the README demo script. Every step must still work exactly as written.

Practical consequences:
- Only edit `className` strings, `style` colour/size values, SVG `fill`/`stroke`/`strokeWidth`, icon `size`/`strokeWidth`, and Tailwind tokens. Do not change JSX structure, text, conditions, handlers, props, hooks or data. Wrapping is not allowed either; if a layout needs a wrapper, skip it and log it. A `className` on an existing element is fine.
- Never touch `web/src/contracts/**`, `web/src/mock/**`, `web/scripts/**`, `web/src/lib/api/**`, `web/src/components/ui/**` or the foundation files listed above. If a primitive looks wrong on your screen, override with a `className` on your usage, or log it for the orchestrator.
- Only edit the files in your assignment. Another agent owns every other file.

## Translation rules (from the brief, condensed)

- **Type:**
  - DM Sans is already global; Geist Mono (`font-mono`) only for IDs and table numbers.
  - Body 14–15px / 400. Metadata and badges 12–13px; bump `text-[10px]`/`text-[11px]` to `text-xs` (12px) where it fits, and keep `text-[11px]` only where 12px breaks a compact kanban/table row.
  - Page titles 28–32px / 600 (`text-title` = 28px with tight leading). Section headings 18–20px / 600 (`text-lg font-semibold`).
  - Display 56–64px / 600 / 1.12 (`text-heading-lg` 56, `text-display` 64) only on login and any big hero number.
  - Remove `tracking-tight`, `tracking-wide`, `tracking-wider` and `tracking-widest`, including on `uppercase` labels.
- **Colour:**
  - Canvas `bg-background` (#f4f4f5), cards `bg-card` (#fff), recessed areas inside cards `bg-recessed` (#fafafa).
  - Text: `text-foreground` (#09090b), `text-muted-foreground` (#66666f), placeholder `text-ash`.
  - Hairline `border` (#ececee); stronger dividers `border-border-strong` (#d4d4d8).
  - Primary is now obsidian. Review every `primary` usage in your files:
    - It stays obsidian (`primary`/`foreground`) for selection, current step, active state and primary actions.
    - "New / alert / needs-you / unread" highlights and the replay/ripple accent move to **ember** (`ember`), but only as punctuation: a dot, a 2px bar, a count chip, a thin ring or border, a small icon. Never body text, links or large fills.
    - Soft tints like `bg-primary/5`, `bg-primary/10` or `border-primary/30` that marked an area as special become `bg-recessed` + `border-border-strong`, or a tone token if it carries meaning.
  - Count chips on ember use **obsidian text** (`bg-ember text-obsidian`); white on ember fails contrast.
  - Magenta spark: do not use.
  - Hard-coded Tailwind palette classes (`amber-*`, `emerald-*`, `sky-*`, `violet-*`, `red-*`, `blue-*`, `teal-*`, `fuchsia-*`, `slate-*`) become tokens:
    - status tones: `bg-tone-<hue>-bg`, `text-tone-<hue>-fg`, `border-tone-<hue>-bd`, `bg-tone-<hue>-dot`, with hue one of slate, sky, violet, amber, emerald, red, fuchsia, blue, teal
    - semantic: `text-positive`/`text-negative`/`text-warning`/`text-destructive`, with soft backgrounds `bg-positive-soft`/`bg-negative-soft`/`bg-warning-soft`
  - **Keep the hue.** A warning stays amber, a behind stays red, an ahead stays green; only the saturation drops.
  - All tokens have dark-mode values, so drop the `dark:` palette pairs when you switch to a token.
  - Charts and Sankey: a zinc ramp (`foreground`, `iron`, `fog`, `ash`, `mist`) for neutral flows, `ember` for the highlighted path, functional colours only where they carry meaning; categorical series stay distinguishable in muted tones (`chart-1…5`, tone dots).
- **Radii:** the foundation scale is already applied: `rounded-sm` 8, `rounded-md` 12, `rounded-lg` 14, `rounded-xl` 20, `rounded-2xl` 24, `rounded-3xl` 28.
  - Cards and panels on the canvas: `rounded-xl`.
  - Large page panels: `rounded-2xl`.
  - Kanban cards, list rows, popovers and inner boxes: `rounded-lg`.
  - Buttons and inputs: already done.
  - Status chips: `rounded-full`.
  - Nothing under 12px except table cells and tight inline chips (`rounded-sm`, 8px). Plain `rounded` (4px) becomes `rounded-sm` or larger.
- **Elevation:** no drop shadows on cards; remove `shadow-xs`/`shadow-sm` on cards and boxes, because the 1px border does the elevation. Popovers, dialogs and sheets may use `shadow-md`.
- **Layout:**
  - Content max-width 1200–1280px (`max-w-[1280px] mx-auto`) on pages with full-bleed text content (not boards, tables or Sankey).
  - Card padding 20–28px (`p-5`…`p-7`); 8px element gap; 24–32px (`gap-6`/`space-y-6`…`8`) between sections; 4px grid.
  - Tables and the kanban stay compact.
- **Components:**
  - Primary = dark filled button; secondary = `variant="outline"` (white + hairline); ghost = no border, zinc text. These are already done in the primitives; don't override them per screen unless needed.
  - Tags = outlined hairline pills (`Pill` default). Filled tag = `Badge` default (#3f3f46).
  - Inputs: already done.
- **Dark mode:** all tokens switch automatically (canvas #09090b, cards #18181b, raised `bg-raised` #27272a, borders white at 9%). Check both themes. Both must pass contrast.
- **Motion:** subtle transitions only (`transition-colors duration-150`); respect `prefers-reduced-motion` where you add any animation.

## Honesty signals: how they must look after your pass

Each one must stay **at least as visible as before**:
- coverage warnings
- evidence bars and labels
- assumption vs. evidence tags
- "no evidence" answers
- quality-check issues
- AI-vs-human marking
- verdict pills
- market-conflict flags
- "synthetic" tags

Keep their tone (amber/red/green…) via tokens, keep their icon, and never shrink them below 12px or fade them below 4.5:1. Ember may be used to draw attention to an alert, but don't replace a red/amber meaning with ember.

## How to work and verify

- **Worktree:** you work in `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-aw-<x>` on branch `ui/aw-<x>`. Dependencies are installed in `web/`.
  - Run your own dev server: `npx next dev -p <port>` in `web/`, in the background.
  - Never use ports 3000–3003; never run anything against them.
- **Screenshots:** use the gate script in the foundation worktree (it has its `node_modules`). From `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-awesomic\.cursor\ux-gate` run:
  ```
  $env:BASE_URL="http://localhost:<port>"; $env:WIDTHS="1440,390"; $env:CDP_PORT="<cdp>"; node gate.mjs --out C:\Users\Mohamed\projects\harissa-ehl-final\aw-shots-<x> --only <targets> --no-lighthouse
  ```
  The target names are in `targets.json` next to it. It resets the demo store of *your* server only.
  - Compare with the before shots in `C:\Users\Mohamed\projects\harissa-ehl-final\bmw-awesomic\docs\design\awesomic\before\screens\<target>_<width>_<theme>.png`.
  - Look at your screenshots (read the PNGs) in light and dark, at 1440 and 390, before you finish.
  - The axe numbers it prints must not go up versus `before/index.md`.
- **Checks:** `npx tsc --noEmit` (it must pass) and `npx eslint <your files>` (it must pass) in `web/`. Do not run `npm run build` (the orchestrator does).
- **Commit** in your worktree on your branch: `git add <your files> docs/design/awesomic/screens-<x>.md` and `git commit -m "Restyle screens (<x>): <scope>"`.
  - Never push. Never commit screenshots or anything outside your files.
  - Stop your dev server when done.
- **Log:** write `docs/design/awesomic/screens-<x>.md` in your worktree, with:
  - per file, the main changes (one line each)
  - every judgement call, especially each `primary` → obsidian/ember decision and each honesty-signal styling decision
  - anything you wanted to change but didn't because of the boundary
  - the axe counts before and after for your targets

## Assignments (disjoint files)

| Agent | Worktree / branch | Ports (dev / CDP) | Files you own | Gate targets |
|---|---|---|---|---|
| a · shell, sidebar, persona menu, login | `bmw-aw-a` / `ui/aw-a` | 3011 / 9611 | `web/src/components/shell/**`, `web/src/app/login/**`, `web/src/app/(app)/layout.tsx`, `web/src/components/providers.tsx` | login, desk-lena, notifications, persona-menu, onboarding-wei |
| b · desk, inbox, innovation, signals | `bmw-aw-b` / `ui/aw-b` | 3012 / 9612 | `web/src/app/(app)/desk-view.tsx`, `web/src/app/(app)/page.tsx`, `web/src/app/(app)/inbox/**`, `web/src/app/(app)/innovation/**`, `web/src/app/(app)/radar/**`, `web/src/components/signals/**`, `web/src/components/common/{activity,proposal-card,rationale-dialog,markdown}.tsx` | desk-lena, desk-katrin, desk-katrin-after-refresh, inbox-lena, inbox-empty-sofia, inbox-after-refresh, innovation, radar |
| c · cases board, case page, Sankey, chat | `bmw-aw-c` / `ui/aw-c` | 3013 / 9613 | `web/src/app/(app)/cases/**`, `web/src/components/cases/**`, `web/src/components/sankey/**`, `web/src/components/chat/**`, `web/src/lib/sankey.ts` (colour constants only, if any) | cases-board, case-evidence, case-stance, case-requirements |
| d · plan, requirements, replay, ripple, brief, settings, audit | `bmw-aw-d` / `ui/aw-d` | 3014 / 9614 | `web/src/app/(app)/plan/**`, `web/src/app/(app)/requirements/**`, `web/src/components/requirements/**`, `web/src/components/replay/**`, `web/src/app/(app)/ripple/**`, `web/src/app/(app)/brief/**`, `web/src/app/(app)/settings/**`, `web/src/app/(app)/audit/**` | plan, requirement-panel, requirement-page, replay-score, replay-chain, feedback-dialog, ripple, ripple-drawer, brief-lena, settings, audit |

Notes per agent:
- **a:**
  - **Sidebar:** quiet, on the canvas (`bg-sidebar`), with a hairline right border. The active item is a white chip (`bg-card`) with a hairline, `font-medium` and a small ember indicator (a 6px dot or a 2px bar). Nav count badges use `bg-ember text-obsidian`.
  - **Header:** on the canvas with a hairline bottom border. Make `<main>` `bg-background`; the old `bg-muted/30` goes.
  - **Logo mark:** obsidian.
  - **Notification bell:** the unread count `bg-red-500` becomes `bg-ember text-obsidian`.
  - **Login:** the one place for display type (56–64px); persona cards are `rounded-xl` hairline cards.
  - **Mobile (<768px):** the 224px sidebar squeezes the content to ~166px, and the header overflows (pre-existing).
    - Make the sidebar a 56px icon rail below `md`: `w-14 md:w-56`, labels `sr-only md:not-sr-only` or `max-md:sr-only`, and the badge as a small ember dot/count on the icon.
    - Keep the demo-data footer note **fully readable**: below `md`, reposition the same element with CSS (`max-md:fixed max-md:inset-x-0 max-md:bottom-0 …`) as a thin strip, and give `<main>` matching bottom padding.
    - Make the header fit 390px: hide the series label as already done (`hidden md:flex`), and let the search trigger shrink. Persona names are already `hidden lg:block`.
    - Every nav item must stay reachable and labelled (`aria-label`/`title`).
- **b:**
  - The desk "My cases" stacked bar and the state dots use the tone dots (`bg-tone-*-dot`), not vivid colours.
  - The desk agent-flag "Bar raised / Contradicts" text stays amber via `text-tone-amber-fg`.
  - Empty states (Sofia's inbox) use the restyled `Empty`.
  - The radar Refresh toast and RunSteps keep their meaning.
- **c:**
  - **Kanban:** columns are recessed (`bg-recessed`/`bg-muted/60` with a hairline) and cards are white `rounded-lg` with a hairline, compact.
  - **Sankey** (`sankey-chart.tsx`): a zinc ramp for neutral flows (`fill`/`stroke` via tokens or CSS variables), ember for the highlighted/selected path, and functional colours only where they carry meaning (e.g. complaint vs. wish type colours, muted).
  - **Chat panel:** the AI vs. human message distinction must stay obvious.
  - **Case stepper:** the current step is obsidian; done steps are muted with a check.
- **d:**
  - **Replay overlay and ripple:** ember is the accent (beats, scrubber progress, ripple pulse, alert strip). Verdict pills keep red/amber/green via tones.
  - **SMART spec:** the provenance underlines/colours (from evidence / your context / assumptions) must stay distinguishable. Use muted tones with clear contrast and keep the legend matching.
  - **Quality-check issues** stay clearly visible.
  - **Plan:** a compact table.
  - **Brief and settings:** full-bleed text pages, so `max-w-[1280px] mx-auto` (or keep their existing narrower max-width if smaller).

When you finish, reply with: the files changed, the main decisions, the axe before/after for your targets, anything you left unchanged because of the boundary, and your commit hash.
