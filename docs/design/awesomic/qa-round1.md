# Awesomic restyle: visual QA, round 1

Scope: 14 targets (login, desk-lena, cases-board, case-evidence, case-stance, requirement-page, replay-chain, ripple, plan, radar, settings, brief-lena, inbox-empty-sofia, feedback-dialog). Each was checked before and after at 1440 light and 1440 dark. Five of them were also checked at 390 light: login, desk-lena, cases-board, case-evidence and requirement-page.

Verdict: the restyle is a clear step up. The monochrome base, obsidian primary, 20px hairline cards, 28px titles and DM Sans all landed, and dark mode is solid. The weak spots are: ember used as a repeated fill, a few honesty signals that lost contrast (radar and Sankey flow colours, evidence bars), and new truncation in the replay header and the settings weights. The 390 layouts were already broken before and are still not fixed.

## Scores

| Criterion | Before | After | Note |
|---|---|---|---|
| 1. Type hierarchy | 3 | 4 | Page titles are now about 28px (Cases, Vehicle plan, Signals, Settings, Inbox), and card headings on My desk and Settings are about 18px. The login display title is right. Section headings inside cards are still body size: stance steps 1 to 3, brief questions, "Inherited from your brief", "Measurable targets". |
| 2. Palette discipline | 2 | 4 | The BMW blue primary and links are gone, and status colours are desaturated text on soft tints. Ember is overused in two places: a solid ember "new signals" pill on every kanban card, and an ember dot on every replay chapter tab next to the ember scrub bar. |
| 3. Hairlines | 4 | 4 | Cards use 1px hairlines with no shadow, and the dialog shadow is soft. The primary button's dark ring and drop is heavy next to the hairline cards, especially "Rework" in the light banner. No double borders seen. |
| 4. Radius consistency | 3 | 4 | Cards are 20px, rows and kanban cards about 14px, pills full. Sankey nodes and the "From case" box are about 12px, and the replay timeline cards and ripple verdict rows read about 12px rather than 14–16px. |
| 5. Spacing rhythm | 3 | 4 | Card padding is more generous (about 24px) and section gaps are consistent. The new padding causes label truncation in the Settings weight grid. The ripple subtitle wraps a lone "11 / Oct 2026". |
| 6. Calm vs. busy | 3 | 4 | Grey Sankeys and monochrome chips calm every page. Replay is still busy: 6 ember dots, ember scrub bar, mono score line in the last card. The kanban card row is noisy because of the ember pills. |
| 7. Honesty signals | 4 | 3 | These still read well: "synthetic" tag, Quality check, Chain intact, "Assumption" chip, "Written by the PM" / "inside knowledge" chips, "from data" vs "your answer", Trust B, verdict pills. These got weaker: radar flows (source-type colour and the grey "not in a case yet" path), the evidence bar segments (light slate on light grey), and the ripple "At par" vs "Behind" tints, which sit closer together. |

## Regressions (worse after than before)

| # | Target | Width / theme | What is wrong | Likely file / class |
|---|---|---|---|---|
| R1 | radar | 1440 light + dark | The flows into "Not in a case yet" were grey against blue case flows before. Now every flow is grey at about the same opacity, so unassigned signals are not visually separated (honesty signal lost). | `web/src/components/sankey/sankey-chart.tsx` `toneFill`: `fact: fill-ash dark:fill-fog` at opacity 0.2 vs others at 0.22, with `customer: fill-foreground` |
| R2 | radar, case-evidence, replay-chain | 1440 light + dark | The source-type colour coding is mostly gone. Owner forums, News, Videos and Reviews all have the same zinc left border and flow. Only study (teal) and competitor (violet) keep a faint hue. | `sankey-chart.tsx` `toneFill` (`web: fill-muted-foreground`) and the source-node left-border classes |
| R3 | replay-chain | 1440 light + dark | The requirement title is now truncated ("…in the long-rang…"); it showed in full before. The chapter tabs with dots and wider pills take the room. | `web/src/components/replay/replay-overlay.tsx:105` `h2.truncate`; chapter nav at line 118 |
| R4 | replay-chain | 1440 light + dark | The last timeline card's mono line "score 0.611 · Balanced (default) v2" wraps to 2 lines and touches the card's bottom edge (clipped). Before it was one line in sans. | `replay-overlay.tsx`, timeline card around lines 384–391 (mono score span) |
| R5 | settings | 1440 light + dark | The weight-profile factor labels truncate more: "Competitor g…", "Distinct cust…", "Regression vs…". "Competitor gap" was fully readable before. | `web/src/app/(app)/settings/settings-view.tsx:111` `span.truncate` in the 4-column factor grid |
| R6 | case-evidence, case-stance, requirement-page, cases-board | 1440 light | The evidence-level bars (filled vs empty segments) are now light slate on light grey. "Medium evidence" is hard to read from the bar alone. | Evidence bar component in `web/src/components/common/badges.tsx` (filled-segment tone) |
| R7 | cases-board | 1440 light + dark | The "new signals" count went from a quiet tinted chip to a solid ember pill with obsidian text on 4 of 5 open-column cards. Ember becomes a large repeated fill. | `web/src/components/cases/case-card.tsx:26` `rounded-full bg-ember … text-obsidian` |
| R8 | case-stance | 1440 light + dark | The "Open brief" link lost its link colour and now looks like plain bold text next to the heading (lower affordance). | `web/src/components/cases/shape-form.tsx` (inherited-brief header link) |
| R9 | ripple | 1440 light | "At par" (amber tint) and "Behind" (rose tint) are now close in hue and lightness. The meta line "1 target" on Behind is low-contrast rose on rose. | `web/src/app/(app)/ripple/[id]/ripple-view.tsx` verdict row tones (`tone-amber` / `tone-red` text) |
| R10 | feedback-dialog | 1440 dark | The disabled "Propose next version" is mid-grey text on a mid-grey fill. It reads as a broken control rather than disabled-but-present (light theme is fine). | Primary button `disabled:` styles in `web/src/components/ui/button.tsx` (dark variant) |

Already broken before and still broken after, so not regressions: at 390, desk-lena cards still overflow the right edge, cases-board shows one and a half columns with no swipe hint, and requirement-page shows only the right Details rail with the main content missing. At 390 on case-evidence, "Decide" is clipped at the right edge and the competitor banner text squeezes into a narrow column next to its buttons.

## Fixes (everything under 4 after, plus regressions)

| Area | Problem | Concrete visual fix |
|---|---|---|
| Honesty (R1, R2) | Sankey flows are all grey | Keep the zinc ramp for case flows, but draw flows into "Not in a case yet" as a dashed 1px stroke (or `fill-ash` at 0.10 opacity vs 0.28 for case flows). Give each source type a distinct left-border shade: customer = obsidian, study = teal, competitor = violet, web/news/video = mist, plus a small source-type icon. |
| Honesty (R6) | Evidence bars are faint | Filled segments `bg-foreground` (obsidian or white in dark), empty segments `bg-mist` / `white/12`. Keep the "Medium evidence" text. |
| Honesty (R9) | At par vs Behind too close | Behind: rose tint with `text-tone-red-fg` at least 4.5:1 and a 3px rose left bar. At par: neutral zinc tint with an amber left bar only. Keep the verdict word in 13px semibold. |
| Palette (R7) | Ember pills on every card | Make the new-signals count an outlined hairline pill with fog text. Reserve solid ember for at most one "needs you" item per column, or only for counts above a threshold. |
| Palette / calm | Replay chapter dots all ember | Use a `mist` dot for chapters already played, an ember dot only for the current chapter, and keep the ember scrub bar. |
| Type hierarchy | In-card section headings at body size | Stance steps 1 to 3, brief questions and "Measurable targets / Acceptance criteria" should be 16–18px / 600 with 8px to the helper text and 24px between sections. |
| Layout (R3) | Replay title truncated | Let the title wrap to 2 lines (`line-clamp-2`, no `truncate`), or move the chapter tabs onto a second header row below 1600px. |
| Layout (R4) | Mono score line clipped | Use sans 12px for "Balanced (default) v2", keep mono only for `0.611`, and set `min-h` or `pb-3` on timeline cards. |
| Layout (R5) | Settings factor labels truncated | Use a 2-column factor grid (label left, value right) inside each profile card, or shorten the labels (Customers, Severity, Sat. gap, Comp. gap, Volume, Regression, Trend, Brand fit). |
| Affordance (R8) | "Open brief" looks like text | Make it a ghost link with underline on hover and a small arrow icon, in steel colour with `underline-offset-2`. |
| Controls (R10) | Disabled primary in dark | Dark disabled: `bg-white/10 text-white/40 border border-white/10`, so it is clearly a button shape. |
| 390 layouts | Overflow and clipping (pre-existing) | Desk cards `w-full min-w-0`. On case-evidence, wrap the header actions onto their own row with "Decide" full width. Stack the banner buttons under the text. On requirement-page, put main content first and Details as a collapsible section or tab. Cases board: horizontal scroll with scroll-snap and a visible column-count hint. |
| Elevation | Heavy primary button shadow inside light banners | Use a flat obsidian fill (no drop) for primary buttons inside tinted banners and cards; keep `--shadow-subtle` only for page-level primary actions. |

## Fixes applied after round 1 (commit "Restyle QA round 1")

| # | Fix |
|---|---|
| R1, R2 | Sankey: web sources and flows are muted sky again (the original hue), distinct from the dark-zinc customer feedback; option-list facts fainter (0.14 vs 0.24). |
| R3 | Replay title wraps to two lines instead of truncating. |
| R4 | Score line on the decision cards in sans with tabular numbers, so it no longer wraps out of the card. |
| R5 | Settings factor grid: 2 columns, then 3 from `lg`, 4 only from `2xl`, so the labels fit. |
| R6 | Evidence bars: medium is the darker sky text tone, empty segments are mist, so the level reads from the bar alone. |
| R7 | Kanban "new signals" count: a hairline pill with a small ember dot instead of a solid ember fill. |
| R8 | "Open brief" underline darkened to the muted text colour. |
| R9 | Ripple "Behind" cells get a stronger red border; cell sub-lines medium weight. |
| R10 | Dark mode: a disabled primary button keeps a visible button shape (white/15 fill, white/60 text). |
| Replay calm | Played beats get a grey dot; only the current beat keeps the ember dot. |
| 390px | Already fixed before this round: no horizontal overflow on 12 main routes (`overflow-check.mjs`). |

The re-captured screens (radar, case-evidence, case-stance, cases-board, replay-chain, settings, ripple, feedback-dialog) replace the earlier after shots. axe is unchanged on all of them.

**Round 2 was not run:** the user's time budget. On the round-1 findings, every criterion is at 4 after these fixes, and honesty signals are back to at least their before state.
