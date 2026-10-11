# Screens (a) · shell, sidebar, persona menu, login

Agent a, branch `ui/aw-a`. Only `className` strings, icon `strokeWidth` and Tailwind tokens were edited; no JSX structure, text, conditions, handlers or props changed.

## Changes per file

- `web/src/components/shell/app-shell.tsx`
  - Sidebar: `bg-sidebar` (canvas) with a hairline right border (`border-sidebar-border`); nav items are `rounded-lg` with a transparent 1px border so the active chip doesn't shift.
  - Active nav item: white chip (`bg-sidebar-accent` = `#fff` light / `#18181b` dark) + hairline + `font-medium` + a 2px × 16px **ember bar** drawn with a `before:` pseudo-element, flush with the sidebar's left edge.
  - Nav count badges: `bg-ember text-obsidian`, 12px, `h-5 min-w-5` (were `bg-primary`, 10px).
  - Logo mark: `bg-primary` (obsidian in light, white in dark), `rounded-sm` (8px) for a 28px mark, `font-semibold`.
  - Footer note: 10px → 12px (`text-xs`).
  - Header: on the canvas (`bg-background`), hairline bottom border, `px-6` / `gap-3` from `md`, `px-3` / `gap-2` below.
  - `<main>`: `bg-muted/30` → `bg-background`.
  - Nav icons: stroke 1.75 (lucide default 2), consistent with the thinner Awesomic line weight.
  - Visible focus ring on nav items and the logo link (`focus-visible:ring-3 ring-ring/40`, same as the button primitive).
  - Mobile rail and footer strip: see below.
- `web/src/components/shell/notification-bell.tsx`
  - Unread count: `bg-red-500 text-white` 9px → `bg-ember text-obsidian` 10px, `ring-2 ring-background`, `min-w-4` so 2-digit counts fit.
  - Unread row: `bg-primary/5` (was a blue tint) → `bg-recessed` in light, `bg-white/5` in dark. On the dark raised popover, recessed is darker than the popover, which made read rows look highlighted; `white/5` lifts unread rows instead.
  - Unread dot: `bg-primary` → `bg-ember`.
  - Alert icon: `text-amber-500` → `text-warning` (amber hue kept, ≥4.5:1).
  - Timestamp 10px → 12px; rows `px-4 py-3`; hover/focus `bg-muted` with a 150ms colour transition; popover `max-w-[calc(100vw-1.5rem)]` so it fits at 390px.
- `web/src/components/shell/persona-menu.tsx`
  - Trigger: `hover:bg-muted` was invisible on the canvas (muted = canvas). It's now `hover:bg-card` + hairline, the same in the open state (`aria-expanded:`), `rounded-lg`, with a focus ring.
  - User title 11px → 12px. Its `max-w-56` became `max-w-64` so "Product Manager 5 Series · Rest of World" doesn't truncate at 12px.
  - Menu: item subtitles 11px → 12px, `gap-2.5`, `max-w-[calc(100vw-1.5rem)]`.
- `web/src/components/shell/search-command.tsx`
  - Trigger: `font-normal`, `w-56` → `w-64`, so the placeholder and the 12px `Ctrl K` hint fit without truncating; `min-w-0 shrink`, text `truncate`.
  - `kbd`: `rounded` (4px) → `rounded-sm` (8px), `bg-recessed`, 10px → 12px.
  - Icon stroke 1.75.
- `web/src/components/shell/theme-toggle.tsx`: icon stroke 1.75.
- `web/src/app/login/login-view.tsx`
  - Title: `text-2xl tracking-tight` → display type: 40px on phones, `text-heading-lg` (56) from `sm`, `text-display` (64) from `lg`, line height 1.12, 600 weight; `tracking-tight` removed.
  - Intro 14px → 16px / 18px (`text-body-lg`); `max-w-2xl`; generous vertical rhythm (`space-y-10`, `space-y-5`).
  - The "synthetic data" note (honesty signal) is now 14px instead of 12px, so it's more visible than before.
  - Canvas `bg-muted/40` → `bg-background`; container `max-w-3xl` → `max-w-4xl`.
  - Persona cards: `rounded-xl` hairline white cards; shadows removed; `p-5`; hover `border-border-strong` (was `border-primary/60`, which would now be near-black); focus ring; the arrow goes `text-foreground` on hover (was `text-primary`) and respects `prefers-reduced-motion`.
  - Card text: name `font-semibold`, title 12px → 13px, story 12px → 14px.
  - "Also" chips: `px-3 py-1.5`, name in `text-foreground`, role in muted, hairline hover.
  - Logo mark `size-11 rounded-md` obsidian.
- `web/src/app/(app)/layout.tsx`, `web/src/components/providers.tsx`: unchanged (see the boundary notes below).

## Ember usage (all punctuation, never text or fills)

1. The active nav indicator: a 2px bar at the sidebar edge.
2. Nav count badges (My desk: alerts + referrals; Inbox: unread) as `bg-ember text-obsidian`, 6.3:1.
3. The notification bell's unread count: `bg-ember text-obsidian`.
4. Unread dots in the notifications popover.

Selection, current state and primary actions stay obsidian (`primary`): the logo mark, the active chip's text and the persona check mark. No magenta.

## Mobile (<768px): icon rail and footer strip

- **Sidebar → 56px rail:** `w-14 md:w-56`. Nav labels and the "Argon" wordmark are `max-md:sr-only`, so every link keeps its accessible name ("My desk 1", "Inbox 3", …) and stays in the tab order. Items centre their icon (`max-md:justify-center`, 40px hit area).
- **Badges on the rail:** the same element is repositioned with `max-md:absolute top-0.5 right-0.5` as a 16px ember count on the icon's corner, with a 2px ring in the sidebar colour to separate it from the icon.
- **Active indicator on the rail:** the same 2px ember bar at the rail edge, plus the white chip.
- **Footer note:** the same `<div>` becomes a fixed full-width strip below `md` (`max-md:fixed inset-x-0 bottom-0 z-40 bg-sidebar border-t`, 12px, centred, 16px line height, 33px tall). The full text stays readable at 390px on one line. `<main>` gets `max-md:mb-[33px]`. A margin rather than padding shrinks main's scrollport, so sticky-bottom bars on pages (e.g. the brief's action bar) sit above the strip instead of under it.
- **Header at 390px:** the empty spacer is `max-md:hidden` and the search trigger is `max-md:flex-1 w-auto`, so it takes the free width and truncates its placeholder. The `Ctrl K` hint is `max-md:hidden` (a desktop keyboard hint; no touch use). Theme, bell and avatar keep their size. Before, the header overflowed off-screen.

## Judgement calls

- **The persona menu trigger** has a hairline + white hover/open state, matching the "white chip" active nav. A grey hover would equal the canvas.
- **The notification unread row tint** is very light (`#fafafa` on white) in light mode. The ember dot carries the "unread" meaning; this is still more salient than the old blue dot on a blue tint.
- **Logo mark radius:** `rounded-sm` (8px) on 28px, `rounded-md` (12px) on the 44px login mark. 12px on 28px would read as a circle.
- **Nav badges at 12px** fit in a 20px chip on desktop. On the rail they are 10px in a 16px chip (obsidian on ember, 6.3:1). The 12px floor is for honesty signals, and counts aren't one.
- **The `before:` pseudo-element** for the ember bar is CSS only, so there's no new element or wrapper.
- **No honesty signals live in these files** except the demo-data notes (sidebar footer and login note). Both got bigger (10px → 12px and 12px → 14px), and the sidebar footer stays fully visible on mobile as a strip.

## Left unchanged because of the boundary

- **The bell's `label-content-name-mismatch` axe issue** (aria-label "Notifications" vs visible count) needs an `aria-hidden` on the count or a label change. Those are prop/copy changes, so they were left.
- **The notifications popover's `aria-dialog-name`** needs an `aria-label` prop; left as is.
- **Login `landmark-one-main` / `region`** need the root `div` to become `<main>`, a structure change; left as is.
- **Avatar colour contrast** (login "Also" chips, persona menu): the avatar is in `components/common/people.tsx`, a foundation file. Logged for the orchestrator.
- **Persona menu `aria-hidden-focus`, `landmark-one-main`, `page-has-heading-one`, `region`:** Radix/menu structure; not visual.
- **`providers.tsx` → `<Toaster richColors>`:** sonner's rich colours use its own saturated green/red palette, not the Awesomic semantic tokens. Removing `richColors` or passing token colours would be a prop change, so it was left. Suggestion for the orchestrator: override `[data-sonner-toast][data-rich-colors]` in `globals.css` with `--positive-soft` / `--negative-soft` / `--warning-soft`, or drop `richColors`.
- **`aria-current="page"` and `title` on nav links** were not added (prop changes). The `sr-only` labels give each rail icon its accessible name.
- **`(app)/layout.tsx`** has no visual classes.

## axe (rules / nodes)

| Target | Before | After |
|---|---|---|
| login | 3 (5) | 3 (5) |
| desk-lena | 1 (1) | 1 (1) |
| notifications | 3 (8) | 2 (2) |
| persona-menu | 5 (6) | 5 (6) |
| onboarding-wei | 1 (1) | 1 (1) |

Notifications improved because the muted text on the blue unread tint and the white-on-red count were the six contrast failures. All remaining issues are listed above as structural or foundation-owned.

## Checks

- `npx tsc --noEmit`: passes.
- `npx eslint` on the owned files: passes.
- Screens checked at 1440 and 390, light and dark.
