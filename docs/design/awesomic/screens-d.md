# Screens (d): plan, requirements, replay, ripple, brief, settings, audit

Agent d, branch `ui/aw-d`. Visual changes only: `className` strings, colour values in style records, icon sizes. No JSX structure, copy, conditions, handlers or data changed.

## Per file

- `app/(app)/plan/[series]/plan-view.tsx`: area cards lose `shadow-xs`; area heading 15px; rows `px-5`, hover `bg-muted/60`; plan-action text on tone tokens (`text-tone-{emerald,sky,red}-fg`, was `text-positive`/`sky-600`/`text-negative`); filter chips: active stays obsidian, inactive white with `border-input` and zinc hover; "Today's equipment" list on `bg-recessed`; row grid is `minmax(0,1fr) auto` below `md` (title + action, then release + status) and the original 4 columns from `md`.
- `app/(app)/requirements/[id]/requirement-view.tsx`: title `text-title` (28px), no `tracking-tight`; more header and tab spacing; sent-back and alert banners on amber tone tokens (`border-tone-amber-bd bg-tone-amber-bg`, icon `text-warning`); side-panel labels 13px sentence case (no `uppercase tracking-wide`); hints 11px → 12px; the "From case" link is a `rounded-lg` card with a zinc hover; inline links are obsidian, underlined in `border-strong` and turn darker on hover.
- `components/requirements/requirement-parts.tsx`: TraceChain steps `rounded-lg`, zinc hover; the current step (Requirement) has an obsidian border (was `primary/5` tint); **ripple alert strip in ember** (see below); SMART spec and argument sheet are `rounded-xl p-6` cards with 18px headings, 15px / leading-8 description, 13px sub-headings without uppercase or tracking; argument text block is `bg-recessed` with a hairline.
- `components/requirements/provenance.tsx`: chip, bar and underline colours moved to tone tokens (evidence emerald, your context blue, assumption amber with a dashed underline); chips 10px → 12px with 12px icons; legend 12px, legend icons coloured like their chips; 1px gaps between legend bar segments; hover-card signal ID buttons 12px obsidian.
- `components/requirements/quality-check.tsx`: red / amber frame on the tone dot colour (`border-tone-red-dot/70`, `border-tone-amber-dot/80`); icons `text-negative` / `text-warning` / `text-positive`; the issue summary ("2 to fix · 1 to review") is now red / amber `font-medium` instead of muted; 11px → 12px; roomier padding.
- `components/requirements/requirement-sheet.tsx`: title 20px semibold; header wraps its chips; sent-back banner on amber tone tokens; the "Full page" link is underlined obsidian; chat tab framed `rounded-xl bg-card`.
- `components/requirements/feedback-dialog.tsx`: response toggle drops its `primary/10` override so it uses the foundation's obsidian on state; a bit more spacing.
- `components/requirements/requirement-action-dialog.tsx`: quality-check warning box on amber tone tokens, `rounded-lg`.
- `components/requirements/requirement-card.tsx`: no shadow, zinc hover border, 11px → 12px.
- `components/requirements/variants-compare.tsx`: differing rows `bg-tone-violet-bg`; header 13px; the other requirement's ID is underlined obsidian, the current one semibold.
- `components/requirements/versions-panel.tsx`: word diff on tone tokens (`bg-tone-emerald-bd text-tone-emerald-fg` for added, `bg-tone-red-bd text-tone-red-fg line-through` for removed); version rows get a hover; the feedback quote is a recessed box.
- `components/replay/replay-overlay.tsx`: **ember accent** (see below); panels white `rounded-xl p-5` (were `bg-card/50 p-3`); 15px panel titles, lead line 13px obsidian (was blue `text-primary`); score bars obsidian; ChainBadge on emerald / red tone tokens with an 18px title; timeline cards 12px, no shadow; requirement card `shadow-md`; quotes and signals `rounded-lg`.
- `app/(app)/ripple/[id]/ripple-view.tsx`: **verdict cells** on tone tokens with a 4px left bar in the verdict's dot colour; **ember pulse**, ember Waves icon (24px), ember factor slider; cards lose `shadow-xs` and get `p-5`; "mine" ring offset on card colour; focused drawer item `bg-recessed` with a 3px ember inset bar (was an amber tint); decision box recessed; links underlined; 11px → 12px in the drawer.
- `app/(app)/brief/brief-view.tsx`: keeps its `max-w-4xl` (narrower than 1280); `py-8`, `space-y-6`; cards `p-5`; section headings 18px, field titles 15px, questions 13px; conflict frame `border-tone-fuchsia-dot/70`; missing-reason warning `text-tone-amber-fg font-medium`; toggle chips use the foundation's obsidian on state (the `primary/10` override is dropped); impact links underlined.
- `app/(app)/settings/settings-view.tsx`: content `mx-auto max-w-[1280px]`, `gap-6`; weight-profile cards `p-4`; brand pillars `bg-recessed p-4` with semibold names; 11px → 12px.
- `app/(app)/audit/audit-view.tsx`: timeline `mx-auto max-w-[1280px]`; the object-ID input is full width below `sm` (still `w-80` from `sm`).

## Judgement calls

### Ember (replay and ripple accent, punctuation only)
- **Replay beats:** each beat chip gets a 6px dot via a CSS `before:` pseudo-element (no new element). The current beat is an obsidian chip with an ember dot, played beats have an ember dot at 60%, and future beats a `border-strong` grey dot.
- **Scrubber progress:** `accent-ember` on the range input.
- **Score build:** while factors are still appearing, the bar being added is ember and all earlier bars are obsidian. Once all factors are shown, every bar is obsidian, so ember never becomes a large fill.
- **Timeline:** `ripple.*` and `alert.raised` cards have an ember border (was amber-400).
- **Decision-beat alerts:** they stay amber (warning meaning) and get a 3px ember inset bar as the replay accent.
- **TraceChain ripple strip:** a white card with an ember hairline (`border-ember/60`), a 3px ember inset bar, an ember warning icon and an ember underline under "View ripple →". The text stays obsidian / muted, never ember. It was an amber-filled strip. With the ember frame and icon it stays at least as visible as before.
- **Ripple:** the pulse colour is ember for every verdict, with alpha falling from behind (0.45) to not comparable (0.2). The Waves header icon and the what-if factor slider are ember. The focused drawer item shows a 3px ember bar.
- **Reduced motion:** untouched. `.ripple-cell` still has `animation: none` under reduced motion, and the replay's `motion-reduce:*` classes and the `clock.reduced` logic are unchanged. I added `motion-reduce:transition-none` to the score rows' opacity transition.

### `primary` → obsidian / ember
- Plan filter chips (active), toggle groups, the Play button and the current TraceChain step stay obsidian (selection, current, primary action).
- All `text-primary` links (case, plan, siblings, proposal, quality-check IDs, brief impact list) became obsidian with an underline. Primary is now the same colour as the body text, so without an underline they would read as plain text (axe `link-in-text-block`).
- The replay `text-primary` lead lines and timeline score lines became obsidian (13px medium / mono). They were blue only to stand out, and ember is not allowed as body text.
- The `bg-primary/5 border-primary/50` "current step" tint became an obsidian border, and the `hover:border-primary/50` hovers became `hover:border-border-strong` (+ `bg-recessed`).

### Honesty signals
- **Verdicts (ripple cells):** `bg-tone-*-bg` + `text-tone-*-fg` (≥6:1) + a 4px left bar in `tone-*-dot`. The fill is softer than the old red-50 / amber-50 / emerald-50 cells, but each cell now has a saturated hue bar, so the red / amber / green read is at least as strong. The verdict word ("Behind", "At par", "Still ahead") is unchanged. I removed `opacity-80`/`opacity-70` from the cell sub-lines so they keep full contrast. Drawer verdict pills use the foundation `Pill` tones (red / amber / emerald).
- **SMART provenance:** three hues (emerald = from evidence, blue = your context, amber = assumption) as tone tokens. The underline uses each tone's dot colour, and assumptions keep the dashed underline, so they are told apart by more than colour. Chips went 10px → 12px (the brief's minimum for honesty signals). The legend bar segments use the same dot colours and the legend icons use the same text colours as the chips, so legend, chips and underlines match.
- **Quality check:** the frame went from red-300 / amber-300 to the stronger tone dot colours, and the summary text went from muted to red / amber medium weight. It is more visible than before. Issue pills are unchanged foundation tones.
- **AI vs human (replay timeline):** agent cards are dashed with `border-border-strong` on `bg-recessed`, human cards solid on `bg-card`. The dashed border is now stronger than the old hairline, so the difference is clearer.
- **Evidence level, assumption pills, the "synthetic" tag, trust badges:** all foundation `Pill`/`EvidenceBadge`, untouched.
- **Brief "differs from shared" (overlay conflict):** the frame went fuchsia-300 → `tone-fuchsia-dot/70`, and the fuchsia pill is untouched.
- **Chain intact / broken:** emerald / red tone tokens. The broken state uses a stronger `tone-red-dot` frame.

## Left unchanged because of the boundary
- **`heading-order`** on the requirement page, replay and brief: the `h3`s (SMART specification, brief questions) follow the `h1` with no `h2`. Fixing this means changing the tag, which is JSX structure.
- **`label` / `button-name`:** Select triggers in the feedback dialog and settings, the watchlist inputs and the brief textareas have no associated label. The fix needs `id`/`htmlFor`/`aria-label` props.
- **`scrollable-region-focusable`** on the replay timeline `<ol>`: needs `tabIndex`.
- **`landmark-*`** (the replay header as a second banner, duplicate `aside`) and **`empty-table-header`** (ripple grid corner): structural.
- **`label-content-name-mismatch`** on the header persona / notification buttons: shell files (agent a).
- **TraceChain on mobile:** at 390px the four steps plus arrows stay on one row and truncate. Wrapping them so the arrows line up would need a wrapper.
- **Ripple grid cells keep `text-[11px]`** for the sub-line ("2 targets · Baukasten …"). At 12px it wraps in the 144px cells.
- **Brief and settings page headers** stay full width (`PageHeader` is a foundation file). Only the content area is capped.

## axe (rules / nodes)

Gate run on port 3014, widths 1440 and 390, light and dark, `--no-lighthouse`. Screenshots are in `../aw-shots-d/` (not committed). Before = `before/index.md` (the untouched app).

| Target | Before | After | What remains |
|---|---|---|---|
| plan | 2 (7) | 1 (1) | shell `label-content-name-mismatch` |
| requirement-panel | 1 (2) | 0 (0) | none |
| requirement-page | 4 (5) | 3 (3) | heading-order, shell mismatch, landmark-unique |
| replay-score | 6 (19) | 6 (17) | contrast on the timeline cards not yet played (30% opacity by design), heading-order, landmarks, scrollable `ol` |
| replay-chain | 6 (11) | 5 (8) | the same, minus contrast |
| feedback-dialog | 2 (3) | 1 (1) | `button-name` on the unlabelled Select trigger |
| ripple | 3 (12) | 3 (10) | avatar / notification badge contrast (shell), empty-table-header, shell mismatch |
| ripple-drawer | 1 (8) | 1 (6) | avatar contrast (foundation `people.tsx`) |
| brief-lena | 3 (3) | 3 (3) | heading-order, label (textarea), shell mismatch |
| settings | 3 (8) | 3 (8) | button-name (Select triggers), label (watchlist inputs), shell mismatch |
| audit | 2 (3) | 2 (2) | avatar contrast in the timeline (foundation), shell mismatch |

No target went up. The contrast failures removed came from the old `bg-destructive/10` reject button, the `text-positive` plan action and the faded cell sub-lines (`opacity-70`/`opacity-80`) in the ripple grid.
