# Screen polish · agent c (cases board, case page, Sankey, chat)

Branch `ui/aw-c`. Only `className` strings, Tailwind tokens and icon stroke were changed; no JSX structure, copy, handlers, props or data.

## Per file

- `components/sankey/sankey-chart.tsx`: source colours moved to a zinc ramp plus two muted functional hues; hovered/selected bands and selected nodes are ember; the say-type labels use tokens; card shadows removed; hover and focus are zinc; the hero number is 40px (`text-heading`).
- `components/cases/case-card.tsx`: no shadow, zinc hover border; the new-signals count is an ember chip with obsidian text; the market-conflict icon uses `text-warning`; the dragged card gets `shadow-md` and a strong border.
- `app/(app)/cases/cases-view.tsx`: kanban columns are `rounded-xl` hairline boxes on `bg-recessed`, with state dots from the tone tokens; the drop target is a zinc ring; the board and ranked padding (`px-6`) aligns with the page header; active filter/weights buttons use an obsidian border; the ranked table has no shadow, a `bg-recessed` 12px header, and rank deltas in `text-positive`/`text-negative` at 12px.
- `app/(app)/cases/[id]/case-view.tsx`: the title is `text-title` (28px), 24px below `md`, with no `tracking-tight`; the step tabs use an obsidian underline and number for the current step, a muted circle with a check for done steps, and an outlined circle for todo steps; the AI-proposals count is an ember chip; pill buttons lose their shadow; the alert banner uses amber tone tokens; Sankey, highlights and the requirements list lose their shadows (highlights get `p-6`, 15px text and obsidian bullets); links are obsidian with an underline; the chat aside is `bg-card`; the "Open questions" heading is 18px.
- `components/cases/case-details.tsx`: block titles are 12px uppercase with no tracking and `px-5 py-4`; the market-conflict box uses amber tone tokens and `text-warning`; sentiment dots use tone dots; factor bars are `bg-foreground/80` (matching `ScoreBar`); all 10/11px text is now 12px; context items are `rounded-lg bg-recessed`.
- `components/cases/stance-form.tsx`: no shadow, `p-6`; toggle overrides removed so selection uses the foundation's obsidian fill; the overridden chip uses violet tone tokens and inherited chips use `bg-recessed`; the provenance pill is 12px (was 10px); "Every override needs a reason." is `text-warning font-medium`; the brief link is obsidian and underlined.
- `components/cases/shape-form.tsx`: the `bg-primary/5` + `border-primary/30` panel became `bg-recessed` + `border-border-strong`, `p-6`; toggle overrides removed; the "default" hint and the default line are 12px.
- `components/cases/questions-panel.tsx`: the group header is `bg-recessed`; rows have `px-4 py-3`; answered answers sit on `bg-positive-soft` with the green left rule; the add form is `rounded-xl p-5`.
- `components/cases/weight-panel.tsx`: 11px text is now 12px.
- `components/chat/chat-panel.tsx`: AI messages get a 2px `border-border-strong` left rule (human messages keep the grey bubble); timestamps 12px (was 10px); segment and suggestion chips are 12px with zinc hover; segments with verbatims are solid hairline chips, segments without stay dashed and muted; padding 16px.
- `lib/sankey.ts`: unchanged (it has no colour constants).

## Judgement calls

### Sankey palette
- **Neutral flows are a zinc ramp:**
  - Customer feedback (the main voice) is `foreground`: obsidian in light, white in dark.
  - Web sources (reviews, videos, forums, news) are `muted-foreground`.
  - Facts (option list) are `ash` in light and `fog` in dark, the lightest step in each theme.
- **Functional hues kept, muted, where they carry meaning:**
  - Customer study is `chart-2` (teal): quantitative BMW study, not verbatims.
  - Competitor web is `chart-5` (violet): competitor evidence never counts as BMW customers.
  - Source type is an honesty signal (every proposal must show its source type), so these two stay distinguishable from the voices.
- **Highlight:**
  - When a node is hovered or selected, the bands touching it switch to `fill-ember` at 0.45 opacity; the others drop to 0.07, as before.
  - A selected node, or a node in the replay `highlight` list, gets `border-ember ring-1 ring-ember`.
  - The selected hero gets a 2px ember ring with an offset.
  - Ember appears only on interaction or in the replay beat, never at rest.
- **Hero node** stays `bg-foreground text-background`: obsidian in light, white in dark, which mirrors the primary button. Its shadow is removed and the number is 40px.
- **Say-type labels:**
  - defect and complaint: `text-negative`
  - hard to use: `text-warning` (was `amber-700`)
  - like: `text-positive`
  - wish: `text-tone-blue-fg` (it was primary blue; keeping the hue keeps it distinct from body text now that primary is obsidian)
  - trend: `text-tone-violet-fg` (was `chart-5`, which is too light as text)
- **Behaviour untouched:** `reveal`, `revealMs`, `highlight`, the clip path and the inline reveal transitions are unchanged.
  - The class transition now lists the animated properties explicitly (opacity, transform, border, box-shadow, fill), and both node kinds got `motion-reduce:transition-none`. Reduced motion is respected at least as well as before.
- **Phone list:** the value bar is `bg-muted-foreground/40` (was `bg-primary/30`); the selected row is ember, matching the chart.

### primary → obsidian / ember
| Where | Before | After | Why |
|---|---|---|---|
| Case card new-signals count | `bg-primary/10 text-primary` | `bg-ember text-obsidian` chip | "new" count = ember punctuation; obsidian text for contrast |
| Step tab "AI proposals waiting" | `bg-primary text-primary-foreground` | `bg-ember text-obsidian` | needs-you count |
| Step tab current step (underline + number) | primary | obsidian (`border-foreground`, `bg-primary`) | current step = obsidian |
| Done step number | `bg-positive/15 text-positive` | `bg-border-strong text-foreground` + check | brief: done steps muted with a check |
| Filters / Weights / filter select active | `border-primary/60 text-primary` | `border-foreground` | active state = obsidian |
| Kanban drop target | `bg-primary/10 ring-primary/40` | `bg-muted ring-foreground/15` | active state, zinc |
| Sankey hover / selected / highlight | primary border, ring and fill | ember | brief: ember for the highlighted path |
| Sankey and chart focus rings | `ring-primary` | `ring-ring` (zinc) | foundation ring |
| Toggle `data-[state=on]` overrides (stance, shape) | `bg-primary/10 text-primary` | removed, so foundation obsidian fill | selection = obsidian; the tint override would have made it weaker |
| Shape form panel | `bg-primary/5 border-primary/30` | `bg-recessed border-border-strong` | special-area tint rule |
| Chat segment chips with data | `bg-primary/5 border-primary/30` | `bg-card border-border-strong` (no-data chips stay dashed) | special-area tint rule; the data/no-data distinction is kept |
| Links (Read full analysis, Open brief, case links) | `text-primary` | obsidian with an underline | ember never on links |
| What-if "moved because" line | `text-primary` 11px | `text-muted-foreground` 12px | explanatory text; ember not allowed on text |
| Factor bars | `bg-primary/70` | `bg-foreground/80` | neutral data, matches `ScoreBar` |
| Bot icons, highlight bullets | `text-primary` / `bg-primary` | unchanged / `bg-foreground` | obsidian identity, no meaning lost |

### Honesty signals
- **Evidence level:**
  - `EvidenceBars` and `EvidenceBadge` (foundation) are untouched on the card, header and details.
  - The "No cost here" note next to the badge went from 11px to 12px.
- **Coverage warning** ("No Chinese verbatims exist in BMW's feedback data…"): 11px became 12px; the colour stays `muted-foreground` (5.6:1). It is more visible than before.
- **Market-conflict flags:**
  - The card icon is `text-warning`; this token is a darker amber than `amber-500`, so the icon is more visible.
  - The details-drawer box is `bg-tone-amber-bg border-tone-amber-bd` with a `text-warning` icon and foreground text.
  - The Markets popover icon stays `text-warning`.
  - Amber is not replaced by ember anywhere.
- **Competitor alert banner** (bar raised): amber tone tokens with a `text-warning` icon; the title stays foreground.
- **AI vs. human:**
  - Brand fit keeps "AI proposal" (amber pill) vs "PM-confirmed" (emerald pill).
  - In the chat, human messages keep the grey bubble next to their initials avatar. AI messages now also carry a 2px left rule next to the bot avatar. That restores the distinction the old blue AI avatar used to give (the foundation made that avatar zinc).
- **Assumptions:** the "2 facts, 1 assumptions" pill is unchanged.
  - The inherited-chip provenance pill ("this case / brief / from data / brand") went from 10px to 12px.
  - An overridden value keeps its violet tint via tokens.
- **Quality / validation:** "Every override needs a reason." is now `text-warning font-medium`, a stronger weight than before.
- **Chat segments without verbatims** stay dashed and muted, so "no real data here" stays visible.

### Other
- **Case page max-width:** not applied. The page holds the Sankey (excluded by the brief), and the content is already about 1200px at 1440.
- **Kanban column background:** `bg-recessed` (#fafafa) with a hairline on the `#f4f4f5` canvas, white cards inside. In dark: `#141417` columns, `#18181b` cards.

## Not changed because of the boundary
- **Case stance:** `heading-order` (`h3` "Inherited from your brief" directly under the `h1`). Fixing it needs a tag change (JSX).
- **Cases board:** `nested-interactive` (13 nodes). The dnd-kit draggable wrapper (`role=button`) contains the card `<Link>`; fixing it needs a structural change.
- **Cases board avatar contrast** (`UserAvatar` initials): foundation `components/common/people.tsx`, not my file.
- **`label-content-name-mismatch`** on the header bell / `.relative`: shell, agent a.
- **Mobile 390:** the case page and board are squeezed by the 224px sidebar (pre-existing). Agent a owns the rail fix. I only let the case title step down to 24px below `md`.
- **Chat aside at 390:** it stays `w-[360px]`. Making it an overlay on mobile would be a layout/behaviour change.

## axe (gate, 1440 + 390, light + dark)
| Target | Before | After |
|---|---|---|
| cases-board | 3 rules (15 nodes) | 3 (15) |
| case-evidence | 2 (2) | 1 (1): the `text-positive` contrast failure is gone |
| case-stance | 2 (2) | 2 (2) |
| case-requirements | 1 (1) | 1 (1) |

Checks: `npx tsc --noEmit` passes; `npx eslint` on my folders passes. Extra visual checks: hovering a Sankey node (ember path) and the chat with one exchange, both themes.
