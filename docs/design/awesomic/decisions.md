# Awesomic restyle · decision log

Autonomous run; every judgement call is logged here and summarised in `report.md`.

## Process

- **Work happened in a separate worktree** (`../bmw-awesomic`, branch `ui/awesomic-work`, fast-forwarded into `ui/awesomic-restyle` at the end). Six read-only UX-audit subagents were still reading the main checkout; restyling under them would have changed what they saw.
- **The checkpoint commit** `f5031d7` ("Checkpoint before restyle") on `ui/awesomic-restyle` holds the UX-audit baseline, agent briefs and gate tooling. The untracked `app/` folder (not part of this project's history) was left out.
- **`npm ci` failed** because `package-lock.json` is out of sync with `package.json` (pre-existing: `@emnapi/*`). `npm install` was used in the worktree and the lockfile restored with `git checkout`, so no dependency change is committed.
- **Build fixes: none needed.** The two `LayoutProps` typecheck errors in a fresh worktree are Next's generated route types; they disappear after `next build` / `next typegen`.
- **The before screenshots** came from a production build of the untouched code on port 3002. That port was used so the store resets wouldn't hit other agents' servers (3000/3001).
- **The gate script** (`.cursor/ux-gate/gate.mjs`) got `WIDTHS` and `CDP_PORT` env vars and a `sel` action (a real mouse click for Radix menus). Three overlay targets were added: the feedback dialog, the notifications popover and the persona menu.
- **`style-reference.md` was not attached** to the brief; it was reconstructed from `tokens.json`, `variables.css`, `theme.css` and the brief's rules.

## Foundation (tokens, type, primitives)

- **Fonts:** DM Sans (300–700) via `next/font/google` as `--font-dm-sans`, mapped to Tailwind `--font-sans`/`--font-heading`. Geist Mono stays `--font-mono`.
- **Body:** 15px / 1.45 by default. Existing `text-sm` (14px) stays for dense UI.
- **Palette:**
  - Added as static `@theme` colours: `obsidian … snow`, `subtle-card`, `ember`, `magenta-spark`.
  - Awesomic's `slate` is registered as **`slate-ink`**, so it doesn't collide with Tailwind's `slate-*` scale.
- **shadcn roles:**
  - Canvas `--background #f4f4f5`; `--card`/`--popover #fff`; `--recessed #fafafa` (new); `--primary #09090b`, replacing the blue.
  - Rings are zinc: `--ring #71717a`.
  - Borders: `--border #ececee` (hairline); `--border-strong #d4d4d8` (new).
- **`--muted-foreground` is `#66666f`, not fog `#71717a`.** Fog measures 4.4:1 on the paper canvas, below AA. One step darker gives 5.2:1 on the canvas and 5.6:1 on white; the colour is otherwise indistinguishable.
- **`--input` is `#e4e4e7`** (between cloud and mist), so field outlines stay visible on white cards. Hairline `#ececee` is kept for card borders.
- **Semantic colours** (`--positive`, `--negative`, `--warning`, `--destructive`): hue kept, chroma lowered, lightness chosen for ≥4.5:1 as text. Each has a `*-soft` tint for "text on tint".
- **Status tones** (the `Pill`/`StatusDot` tones, which carry case state, outcome, requirement status, evidence, trust, market, release and verdicts):
  - They became CSS tokens `--tone-{slate,sky,violet,amber,emerald,red,fuchsia,blue,teal}-{bg,fg,bd,dot}`.
  - Every hue is kept, so categories stay distinguishable; chroma is roughly halved.
  - Text is oklch L≈0.45, which is ≥6:1 on its tint; dark-mode text is L≈0.83 on a dark tint.
- **Charts:** chart-1 is zinc (iron); chart-2…5 are muted teal, amber, rose and violet. Ember is reserved for the highlighted path.
- **Radius:**
  - shadcn names are kept, with explicit values: `sm 8`, `md 12`, `lg 14`, `xl 20`, `2xl 24`, `3xl 28`, `4xl 36`.
  - Existing `rounded-lg` (buttons, inputs, list rows) therefore becomes 14px and `rounded-xl` (cards) 20px.
  - Awesomic's own names are imported as `--aw-radius-*`.
  - `rounded-xs` is untouched, so checkboxes keep a 4px corner (a form control, not a surface).
- **Elevation:**
  - Card ring and shadow are replaced by a 1px border.
  - Popover, menu, select, hover-card, dialog and sheet use `--shadow-md`.
  - The primary button uses `--shadow-primary`: `--shadow-subtle` in light; in dark, a 1px white/10 ring, because the inset sheen and dark ring don't read on a white fill.
- **Buttons:**
  - The `outline` variant is Awesomic's "secondary": white, hairline.
  - shadcn's `secondary` is a soft zinc fill.
  - Ghost buttons use iron text.
  - The `lg` size went from h-9 to h-10.
  - `xs`/`sm` radius is 12 (was 10).
- **Badge:** the default variant is the filled tag (`#3f3f46` with light text); the outline variant is a hairline pill.
- **Toggle groups** (choice chips in the stance, brief and feedback forms): the on state was a barely visible `bg-muted` and is now an obsidian fill. The selection reads more clearly than before.
- **Tabs:** the active trigger was `bg-background`, which now equals the grey track. It became a white chip with a hairline border.
- **Switch:**
  - The thumb was `bg-background` (now grey) and is now white with a 1px shadow.
  - The unchecked track is mist, so the off state is visible.
- **Skeleton:** `bg-muted` would equal the canvas, so it uses obsidian at 6%.
- **Avatars:**
  - The AI avatar was primary-tinted, which would have become a near-black tint. It is now a hairline zinc chip with the bot icon, still clearly distinct from the human initials.
  - Human persona colours come from mock data, which is not editable. They are shown at `saturate(.75)` to sit in the palette.
- **Ember** is defined as a token only; screens use it for the active nav indicator, the unread / "needs you" counts, the one alert/new chip and the replay/ripple accent.
- **Count chips** use **obsidian text on ember**. White on ember is 3.1:1, which fails AA at 10–12px; obsidian on ember is 6.3:1.
- **Magenta spark:** not used.
- **Ripple pulse:** the default colour went from amber to ember (it is the ripple accent).
- **Page header:** title 28px / 600, description 15px. **Section headings** are 18px / 600. **Section, Stat and Empty** have a 20px radius and 20px padding.
- **Letter-spacing:** `tracking-tight` / `tracking-widest` were removed in the primitives touched.
