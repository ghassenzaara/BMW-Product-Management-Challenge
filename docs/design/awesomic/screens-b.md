# Screen polish · agent b (desk, inbox, innovation pool, signals)

Branch `ui/aw-b`. Only `className` strings and icon classes were edited; no JSX structure, copy, handlers, hooks or data changed.

## Changes per file

- **`app/(app)/desk-view.tsx`**
  - Page: `max-w-6xl p-6` → `max-w-[1280px] px-6 pt-7 pb-10`; greeting `text-2xl tracking-tight` → `text-title` (28px / 600), no tracking; card grid `gap-4` → `gap-6`.
  - Cards: shadow removed (hairline only); padding 16 → 20px; card titles `text-sm` → `text-lg` (18px section heading); the icon chip went from a blue tint to a hairline zinc chip (`border bg-recessed text-foreground`, stroke 1.75).
  - Rows: hover `bg-muted`, `transition-colors duration-150`, zinc focus ring (`ring-ring`).
  - "My cases" stacked bar and legend dots: vivid `bg-*-500` → tone dots (`bg-tone-*-dot`); legend dots 6 → 8px, the same size as `StatusDot`.
  - Choice chips in the brief-conflict and escalation dialogs: the selected state went from a blue tint to an obsidian fill (`bg-primary text-primary-foreground`), matching the foundation's toggle groups. Unselected chips get an `input` border and a hover state.
- **`app/(app)/inbox/inbox-view.tsx`**
  - "Waiting for you" referrals card: `border-primary/30` → `border-border-strong` plus a 2px ember bar on the left (inset shadow, so the border geometry is unchanged).
  - Unread dot: `bg-primary` → `bg-ember`.
  - Rows: padding 16 → 20px, hover `bg-muted`, visible inset focus ring.
  - Empty state ("Nothing yet", Sofia): styled like the restyled `Empty` (dashed `border-strong`, `bg-card/60`, py-12, 15px semibold) purely through `has-[>p]:` classes on the existing section and classes on the existing `<p>`.
  - Shadows removed; "Sent by me" toggle gets a focus ring and a transform-only chevron transition.
- **`app/(app)/innovation/innovation-view.tsx`**
  - Cards: shadow removed, padding 16 → 20px, grid gap 16 → 20px.
  - Lightbulb chip: `fuchsia-500/10` + `fuchsia-600/400` → `bg-tone-fuchsia-bg text-tone-fuchsia-fg border-tone-fuchsia-bd`, so the hue is kept and the `dark:` pair is gone.
  - Title 16 → 17px.
- **`app/(app)/radar/radar-view.tsx`**
  - Sankey panel: `rounded-xl p-5 shadow-xs` → `rounded-2xl p-6`, no shadow (it's a large page panel).
  - Section spacing 16 → 24px.
  - "N not in a case yet" chip: shadow removed, `font-medium`, hover went from a blue border to `border-strong` + `bg-recessed`, plus a focus ring.
  - RunSteps panel: no shadow, p-5, title 15px. Step tiles are recessed (`bg-recessed`); the pending circle uses `border-strong`. The step animation already respects `motion-reduce`.
  - Ripple buttons after Refresh: the active ripple's Waves icon is ember (the ripple accent).
- **`components/signals/signal-card.tsx`**
  - Kind border colours:
    - wish: `primary` (was blue) → `tone-blue-dot`
    - trend: `sky-500` → `tone-sky-dot`
    - innovation: `fuchsia-500` → `tone-fuchsia-dot`
    - complaint, like and competitor: unchanged (already tokens).
  - Selected: `bg-primary/5` → `bg-muted`. The sheet is white, so `bg-recessed` would be invisible.
  - Trust letter chip: 10px → 12px, `rounded` → `rounded-sm`, `border-strong`.
  - Source link: zinc with a hover state and a focus ring.
- **`components/common/activity.tsx`**
  - Audit before/after lines 11 → 12px.
  - @mention highlight: blue tint → `bg-muted` + foreground, `rounded-sm`.
  - Comment bubble padding 12/8 → 14/10; Discussion / Audit trail headings 14 → 15px.
- **`components/common/proposal-card.tsx`**
  - Pending card: `border-primary/40 bg-primary/5` → `border-border-strong bg-recessed`.
  - Sparkles icon: `text-primary` → `text-ember`.
  - Diff box: `bg-muted/50 rounded-md` → a white `rounded-lg` hairline box.
  - Added and removed words: emerald/red palette + `dark:` pairs → `bg-tone-emerald-bd text-tone-emerald-fg` and `bg-tone-red-bd text-tone-red-fg line-through`.
  - New-content block: `bg-emerald-50` → `bg-tone-emerald-bg` + `border-tone-emerald-bd`.
  - 11px meta text → 12px.
- **`components/common/markdown.tsx`**: citation chips `[SIG-…]` went from blue tinted (`primary/5`, `primary/30`, `text-primary`, 11px) to a hairline zinc chip: `border-strong`, `bg-recessed`, foreground, 12px mono, hover, focus ring.
- **`components/common/rationale-dialog.tsx`**, **`app/(app)/page.tsx`**: unchanged. The dialog is fully styled by the foundation `Dialog`/`Textarea`/`Button` primitives; the page is a one-line wrapper.

## Judgement calls

### `primary` → obsidian or ember

| Where | Before | After | Why |
|---|---|---|---|
| Desk card icon chips | `bg-primary/10 text-primary` | hairline zinc chip | Decoration, not state; a near-black tint would be heavy |
| Desk "+N more" | `text-primary` link | `text-foreground font-medium` | Link → obsidian; ember is never for links |
| Desk focus rings | `ring-primary` | `ring-ring` (zinc) | Matches the foundation focus ring |
| Desk @mention flag icon | `text-primary` | **ember** | An unread mention = "needs you"; a small icon is allowed punctuation (3.1:1 on white, 5.6:1 on dark cards, which passes the 3:1 non-text rule) |
| Brief-conflict / escalation choice chips | `primary/10` tint | **obsidian fill** | Selection state; matches the foundation toggle groups |
| Inbox referrals card border | `border-primary/30` | `border-strong` + **2px ember bar** | "Waiting for you" = needs-you area |
| Inbox unread dot | `bg-primary` | **ember** | Unread, as the brief says |
| Radar "not in a case" hover | `hover:border-primary/60` | `hover:border-border-strong` | Neutral hover |
| Radar active ripple button | `variant="default"` | unchanged (obsidian) + **ember Waves icon** | Primary action stays obsidian; ember marks the ripple accent. The "watch" (low-trust) ripples stay plain outline with no ember, so they don't read as alerts |
| Radar Refresh, Accept, Sign off, voted 👍 | default button | unchanged (obsidian) | Primary action / active state |
| Signal card wish border | `border-l-primary` (blue) | `tone-blue-dot` | Categorical colour: the hue is kept. Obsidian would read as "selected" |
| Signal card highlighted | `ring-2 ring-primary` | unchanged (now obsidian) | It's the selection / jump-to-citation state |
| Signal card source link | `text-primary` | `text-foreground` | Link |
| @mention in comments | `primary/10` tint | `bg-muted`, foreground | Inline body text, so no ember allowed |
| Proposal card (pending) | `primary/5` tint, `primary/40` border | `bg-recessed` + `border-strong`, **ember Sparkles** | Soft special-area tint → recessed; the pending AI proposal is a "needs you", and the ember icon is the only accent |
| Markdown citation chips | blue tint | zinc hairline chip | Links/citations, never ember |

### Honesty signals

- **Desk agent flags (verdicts "N behind" / "At par", "Bar raised" / "Contradicts"):** `amber-700/400` → `text-tone-amber-fg` (≥6:1 on white), now `font-medium` and `shrink-0` so they never truncate. Their icons (`AlertTriangle`, `Waves`, `CornerUpLeft` sent back) went from `amber-500/600` to `text-warning` (≈5:1). That's more visible than before (amber-500 was ~2.1:1). Amber stays amber; ember is not used for them.
- **AI vs. human in the audit timeline:** unchanged (foundation `Pill` sky with the bot icon vs. an outline pill); the before/after lines grew from 11 to 12px.
- **AI proposals:** keep the Sparkles marker (now ember) and the "from chat / learned from your decisions" source pill; accepted/rejected pills keep emerald/red.
- **Synthetic tag and trust letter on signal cards:** the synthetic tag is untouched (foundation). The trust letter went 10 → 12px with a stronger border, so it's more legible than before.
- **Quarantine (validation-gate rejects) on the radar:** unchanged content, slightly more row spacing.
- **RunSteps failed step:** keeps `XCircle text-negative`; ok steps keep `text-positive`. The runs popover keeps `text-warning` for failed runs.
- **Proposal diffs:** the added and removed colours moved from the light tint to the tone *border* step as background, so they stay as visible as emerald-100/red-100. Text contrast: emerald-fg on emerald-bd ≈5.6:1, red-fg on red-bd ≈4.9:1; dark mode fg L0.83 on bd L0.38–0.40.

### Other calls

- **Signal kind colours:** wish (blue) and trend (sky) are close hues, as they were before (blue-600 vs sky-500). I kept the hues rather than re-mapping trend to teal. The Sankey (agent c) may use its own type colours; not coordinated.
- **Desk card titles at 18px** (the section-heading rule). The counts stay 24px (not display size; the display size is login-only).
- **Innovation cards** got no hover state, because the card itself isn't clickable (only its title link and buttons are).
- **Desk width:** the desk is a card grid but still text-led, so it uses the 1280px content max-width. The inbox keeps its narrower `max-w-4xl`.

## Left unchanged because of the boundary

- **Sofia's empty inbox:** the brief asks for the restyled `Empty`. Swapping `<p>` for `<Empty>` changes JSX, so the existing elements were styled to look like it instead (same border, padding, type).
- **Radar `button-name` (critical):** the remaining violation is a button without an accessible name. Fixing it needs an `aria-label` (not visual) and it lives in the Sankey/select markup, not in my files. Left for the orchestrator.
- **Innovation `color-contrast` (2 nodes):** voter avatars in `AvatarStack` (`people.tsx`, foundation; persona colours come from mock data). Not mine.
- **`label-content-name-mismatch` on every screen:** the header notification bell (shell, agent a).
- **`color-contrast` on Sofia's inbox and inbox-after-refresh:** the header avatar and the bell count badge (shell, agent a).
- **390px layout:** content is squeezed by the 224px sidebar; agent a owns the icon-rail fix. My screens already stack to one column below `lg`/`md`.
- **Desk mention rows:** they pick a case ID out of the link with a regex. Behaviour, not visual; untouched.

## axe (rules / nodes)

| Target | Before (`before/index.md`) | Foundation state (this worktree, pre-edit) | After |
|---|---|---|---|
| desk-lena | 1 (1) | 1 (1) | 1 (1) |
| desk-katrin | 1 (1) | 1 (1) | 1 (1) |
| desk-katrin-after-refresh | 1 (1) | 1 (1) | 1 (1) |
| inbox-lena | 1 (1) | 1 (1) | 1 (1) |
| inbox-empty-sofia | 1 (1) | 1 (1) | 1 (1) |
| inbox-after-refresh | 2 (2) | 2 (2) | 2 (2) |
| innovation | 2 (3) | 2 (3) | 2 (3) |
| radar | 2 (2) | 2 (2) | 2 (2) |

No increase on any target. Every remaining violation is the same node as before: the header bell (label-content-name-mismatch), header avatar / bell count (colour contrast), AvatarStack voters (colour contrast) and the unnamed radar button. Note: Lena's seed has no pending referral, so the ember-barred referrals card is not in any gate screenshot.
