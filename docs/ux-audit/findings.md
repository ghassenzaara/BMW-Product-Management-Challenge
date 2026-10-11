# UX intuitiveness pass · merged findings (Step 3)

Six read-only auditors ran against the baseline (`docs/ux-audit/baseline/`), the code and read-only API calls. Every one gave a **glance score of 3 / 5**: the app looks calm and consistent, but it doesn't say what to do first, it names the same things differently, and several honesty signals sit behind a hover or click.

Full reports, with every row, evidence path and line number, are in the agent transcripts:
- [desk + inbox](fed3a6ec-5bac-4350-9ce1-6d47f75a2a8b): 25 findings
- [cases](9f4ecb73-3349-4eda-b8e3-71cc4fef1ea6): 20
- [plan, requirement, replay, ripple](f1e645a3-9f62-4840-8c0a-ef50532402a8): 24
- [signals, innovation, settings, audit, brief, login](a290b724-78f7-4136-8c4c-640104bb38b1): 34
- [consistency](e5ae0814-c98f-4802-9bb8-d32e57b2e104): 7 patterns, about 45 places
- [walkthrough of demo script 1](d57935a3-e91c-4367-a43e-f1b1f9848369): 7

The IDs below are the auditors' own. Duplicates found by several auditors are merged into one line. The boundary column uses the pass's rules: copy and microcopy changes are allowed **with your approval**; anything that changes data, the workflow or the nav needs a product decision.

## Proposed batches (status: awaiting approval)

### Batch 1 · Accessibility root causes (clears most axe nodes)

| IDs | Fix | Sev |
|---|---|---|
| A1, DI-20 | Bell: `aria-label="Notifications, N unread"`, badge `aria-hidden`, readable badge contrast. Fails on 20 of 24 states. | 2 |
| A2, SET-03, SIG-12, BRF-03 | `Label htmlFor`/`id` on 31 labels; `aria-label` on SelectTriggers. Fixes all critical `label` and `button-name` violations. | 3 |
| A3 | Avatar initials contrast (9px white on user colour). | 2 |
| A4, C17 | Cases board: `role=button` drag wrapper around a Link (`nested-interactive`, 13 nodes); no keyboard sensor. | 2 |
| Y3, A7 | Replay: Speed/Play names match the visible text; focusable timeline; no second `<header>`. | 2 |
| LOG-01, A5, DI-19, A8 | Login `<main>`; Inbox rows as `<Link>`; audit ID input label. | 1–2 |
| C20 | Evidence-bars trigger focusable; heading order h1 → h2. | 1 |

### Batch 2 · Honesty signals at a glance (no new data)

| IDs | Fix | Sev |
|---|---|---|
| C3 | Case header: market counts on the chips ("US 30 · EU 5 · RoW 1"), plus the conflict / "no Chinese verbatims" note as one muted line. | 3 |
| SIG-01 | Signals: one coverage line ("319 signals · 81% USA · 3% Rest of World"). | 3 |
| INN-01 | Innovation cards: evidence badge + origin series (Vehicle-to-load is assumption-only). | 3 |
| R2 | Requirement side panel: evidence badge and `synthetic` tag in the header, as on the page. | 3 |
| DI-07 | Desk: a watch-list alert (trust E) shows "Watch list", not "Bar raised". | 3 |
| W1 | Ripple: a green "still ahead" cell names its hidden behind case ("· 1 case behind"). | 3 |
| C12 | Stance: "no China evidence in this case" hint on the inherited China 25% chip. | 2 |
| R8 | Spec: "drafted by Requirement writer (AI) · v2 by Lena" (AI vs. human). | 2 |
| K1, K2 | China chip no longer in "error red"; one tone for "Assumption". | 3 / 2 |

### Batch 3 · One vocabulary (copy only; contracts untouched)

| IDs | Fix | Sev |
|---|---|---|
| C1 (consistency) | One name for the AI chat ("AI colleague") and one for background agents. | 3 |
| C2 (consistency) | "Confirm case" everywhere (4 labels today). | 3 |
| C3 (consistency) | Evidence: one scale (High / Medium / Low) for pills and bars. | 3 |
| C4, C18 | "Awaiting answers" everywhere; verbs on status buttons. | 2 |
| R1 (consistency) | Raw enums ("pending", "pm approved", "bodyMd", "ai estimate") go through label maps. | 2 |
| C5, C9, C10, C11, B7, C8 | Release, cost and export labels; dialog buttons repeat the trigger verb; "Specification" tab name. | 1–2 |
| C11 (cases), R7, DI-18, SET-04, AUD-01 | "Add source" → "Find more sources (AI)"; "from PM context"; "Waiting for Jonas"; trust scale text; readable audit verbs. | 2–3 |

### Batch 4 · Hierarchy: one primary per screen, next action visible

| IDs | Fix | Sev |
|---|---|---|
| B1, C6 | Case step 2: 5 filled primaries → 1; Decide is primary only when the case is ready. | 3 |
| W3, B2 | Ripple rows: "Keep, with reason" is no longer the default primary. | 2 |
| R5 | Reject becomes a quiet secondary that passes contrast. | 2 |
| DI-01, DI-03 | Desk: an accent where action waits; "2 answers back" big, "10 waiting on others" muted. | 3 |
| DI-02, DI-10, DI-11 | Head's Review card never hides escalations behind "+N more" (README step 7); series/owner on sign-off rows. | 3 |
| C1 (cases), C10 | Case: "Status:" label + one "Next:" line from existing data; honest step checkmarks; "4 open questions". | 3 |
| SIG-02, F007 | Signals: "Review 46 signals not in a case yet →" as the next action. | 2 |
| B3, B4, B6 | Plan filter chip, innovation vote, settings save buttons. | 1–2 |

### Batch 5 · Show the row meaning without hover (density)

| IDs | Fix | Sev |
|---|---|---|
| DI-05, DI-13, DI-14, A6 | Desk/Inbox: a muted second line (who/what, notification body). This ends the four identical "New signal" rows. | 3 |
| C4 (cases) | Case step 3: full requirement title, not "The 5 Series successor". | 3 |
| R1 | Requirement page: the ripple alert shows once, not twice with two different links. | 3 |
| R3, W2 | Trace strip as one breadcrumb line; ripple drawer row summary line (the Assumption pill stays visible). | 3 |
| C2 (cases) | Case step 1: summary bullets above the full-height Sankey (order within the step). | 3 |
| C13, C14, SIG-03, P1, Y1, SET-02, L5 | Visible "Why"; tooltips for card symbols; Sankey units/hint; plan column headers; untruncated factor labels. | 2 |

### Batch 6 · Empty, loading, error and safety states

| IDs | Fix | Sev |
|---|---|---|
| S1, S2, DI-17, INN-05, P2, AUD-04 | Use the existing `Empty` with "what lands here" + one action. | 2 |
| S3, SIG-13, F002 | Skeletons while loading (no "Nothing yet" while fetching); progress on Refresh. | 2 |
| S7 | Confirm for "Reset demo data"; undo toast for proposal Reject / question Drop. | 3 |
| S4, S5 | Say why a button is disabled; recovery line on error toasts. | 2 |

### Batch 7 · Layout and responsive

| IDs | Fix | Sev |
|---|---|---|
| R4, DI-23 | Requirement page at 768px: aside from `lg` only; workspace label `whitespace-nowrap`. | 3 |
| L1, DI-12, DI-22 | One page shell: full-width `PageHeader`, constrained body. | 2 |
| L3 | Text floor of 12px (67 uses of 9–11px). | 2 |
| C16, SIG-08, SIG-09, Y2 | Board column widths and scroll cue; run panel grid at tablet width; Sankey narrow list keeps cases; replay beat name below `lg`. | 2 |

### Walkthrough dead end (verify first)

- **F001 (not a bug):** the ripple factor slider was reported as read-only. Driven with real input (`.cursor/ux-gate/slider-check.mjs`: ArrowRight ×5, and a mouse drag), it moves to 0.90, the text reads "800 km CLTC ≈ 720 km WLTP" and the 5 Series cell turns *Behind*; *Team value* resets it. The browser tool the auditors used can't operate native range inputs.

## Needs a product decision (not in any batch)

- **The desk:**
  - What the "My desk" nav badge counts (DI-04).
  - Where @mentions live (DI-08).
  - A coverage line on the desk (DI-25).
  - An explicit "Next up" item (DI/consistency 7).
- **Watch-list marker:** a proper contract field for watch-list alerts (DI-07 beyond the title prefix).
- **Notification content in the mock:** identical "New signal" titles, raw IDs, "FYI" used inconsistently (DI-16).
- **Ripple:**
  - The cell colour rule (W1/N2).
  - A verdict-based primary action (N5).
- **Requirements:**
  - Reject after sign-off (N6).
  - Merging page and panel tabs (N8, consistency 5).
  - An "AI drafted" provenance type (N9).
  - Seed short titles such as "The 5 Series successor" (N1).
- **Plan:**
  - A confirm step or permission check for Export to Codebeamer (N3).
  - The rank in plan rows (N7).
  - Quality-check re-run permissions (N4).
- **Settings, nav and onboarding:**
  - The Project type setting, which CLAUDE.md lists as rejected (consistency 2).
  - Instant saves without a reason (SET-01/consistency 3).
  - Settings, Audit and Brief live only in the persona menu.
  - Onboarding "skip for now".
  - The Signals route `/radar` vs. the label "Signals".
  - A collapsible sidebar at tablet width.
- **Cases:**
  - Owner-only question editing.
  - The rank on decided cases.
  - An escalate button next to the conflict note.
  - Three ways to change a case's state.
- **Other:**
  - Audit filters by action/date.
  - Quarantine delete.
  - "Generation after" wording (lives in `contracts/labels.ts`).
  - The "Refresh" label (the README uses it).
  - Collapsing confirmed brief answers (adds a click to README step 5).

## Overlap with the Awesomic restyle (running now, visual-only)

The restyle fixes these **under its own colour and contrast rules**, without touching copy or structure:
- the bell badge contrast (A1 part)
- avatar contrast (A3)
- `text-positive` / `bg-destructive/10` / `primary/5` contrast failures
- the 9–11px floor where it fits (L3)
- shadow vs. no-shadow card inconsistency (L2)
- vivid tones toned down

Its toggle-group change makes the selected choice chip clearer. Everything else above still waits for your batch selection.
