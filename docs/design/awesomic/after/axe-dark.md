# UX gate · 2026-10-11 06:00

| Screen / state | Persona | axe rules (nodes) | Lighthouse a11y | Best practices | Screenshots |
|---|---|---|---|---|---|
| Login (persona picker) | u-lena | 3 (5) | — | — | [1440 light](screens/login_1440_light.png) · [1440 dark](screens/login_1440_dark.png) |
| My desk · Lena | u-lena | 1 (1) | — | — | [1440 light](screens/desk-lena_1440_light.png) · [1440 dark](screens/desk-lena_1440_dark.png) |
| Cases board · Lena | u-lena | 3 (15) | — | — | [1440 light](screens/cases-board_1440_light.png) · [1440 dark](screens/cases-board_1440_dark.png) |
| Case · step 1 Evidence (CASE-G60-0003) | u-lena | 1 (1) | — | — | [1440 light](screens/case-evidence_1440_light.png) · [1440 dark](screens/case-evidence_1440_dark.png) |
| Case · step 2 Your stance (CASE-G60-0003) | u-lena | 2 (2) | — | — | [1440 light](screens/case-stance_1440_light.png) · [1440 dark](screens/case-stance_1440_dark.png) |
| Requirement page (REQ-G60-0010) | u-lena | 3 (3) | — | — | [1440 light](screens/requirement-page_1440_light.png) · [1440 dark](screens/requirement-page_1440_dark.png) |
| Vehicle plan G60 | u-lena | 1 (1) | — | — | [1440 light](screens/plan_1440_light.png) · [1440 dark](screens/plan_1440_dark.png) |
| Signals (radar) | u-lena | 2 (2) | — | — | [1440 light](screens/radar_1440_light.png) · [1440 dark](screens/radar_1440_dark.png) |
| Innovation pool · Jonas | u-jonas | 2 (3) | — | — | [1440 light](screens/innovation_1440_light.png) · [1440 dark](screens/innovation_1440_dark.png) |
| Settings · Lena | u-lena | 3 (8) | — | — | [1440 light](screens/settings_1440_light.png) · [1440 dark](screens/settings_1440_dark.png) |
| Audit trail · Lena | u-lena | 2 (3) | — | — | [1440 light](screens/audit_1440_light.png) · [1440 dark](screens/audit_1440_dark.png) |
| Series brief · Lena (shared) | u-lena | 3 (3) | — | — | [1440 light](screens/brief-lena_1440_light.png) · [1440 dark](screens/brief-lena_1440_dark.png) |
| Inbox · Lena after Refresh (with items) | u-lena | 1 (1) | — | — | [1440 light](screens/inbox-after-refresh_1440_light.png) · [1440 dark](screens/inbox-after-refresh_1440_dark.png) |
| Ripple screen (RIP-0001) | u-lena | 3 (9) | — | — | [1440 light](screens/ripple_1440_light.png) · [1440 dark](screens/ripple_1440_dark.png) |

## axe violations

### Login (persona picker)
- **color-contrast** (serious, 2 nodes): Elements must meet minimum color contrast ratio thresholds · e.g. `.gap-1\.5.px-3.py-1\.5:nth-child(1) > .size-5.text-\[9px\].text-white`
- **landmark-one-main** (moderate, 1 nodes): Document should have one main landmark · e.g. `html`
- **region** (moderate, 2 nodes): All page content should be contained by landmarks · e.g. `.space-y-5`

### My desk · Lena
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`

### Cases board · Lena
- **color-contrast** (serious, 1 nodes): Elements must meet minimum color contrast ratio thresholds · e.g. `a[href$="CASE-G70-0005"] > .mt-2\.5.gap-2\.5.text-xs > .size-5.text-\[9px\].text-white`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[aria-label="Notifications"]`
- **nested-interactive** (serious, 13 nodes): Interactive controls must not be nested · e.g. `.w-60.rounded-xl.bg-recessed:nth-child(1) > .space-y-2.pb-2.overflow-y-auto > div[role="button"][aria-roledescription="draggable"][aria-describedby="DndDescribedBy-0"]`

### Case · step 1 Evidence (CASE-G60-0003)
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[aria-label="Notifications"]`

### Case · step 2 Your stance (CASE-G60-0003)
- **heading-order** (moderate, 1 nodes): Heading levels should only increase by one · e.g. `.mb-2 > h3`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[aria-label="Notifications"]`

### Requirement page (REQ-G60-0010)
- **heading-order** (moderate, 1 nodes): Heading levels should only increase by one · e.g. `h3`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`
- **landmark-unique** (moderate, 1 nodes): Landmarks should have a unique role or role/label/title (i.e. accessible name) combination · e.g. `.w-14`

### Vehicle plan G60
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`

### Signals (radar)
- **button-name** (critical, 1 nodes): Buttons must have discernible text · e.g. `.gap-1\.5`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[aria-label="Notifications"]`

### Innovation pool · Jonas
- **color-contrast** (serious, 2 nodes): Elements must meet minimum color contrast ratio thresholds · e.g. `.rounded-xl.p-5.flex-col:nth-child(2) > .mt-auto.pt-5.gap-2 > .-space-x-1\.5.flex > .size-5.text-\[9px\].text-white:nth-child(2)`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`

### Settings · Lena
- **button-name** (critical, 3 nodes): Buttons must have discernible text · e.g. `.space-y-1\.5:nth-child(1) > .gap-1\.5.pr-2.pl-2\.5`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`
- **label** (critical, 4 nodes): Form elements must have labels · e.g. `.space-y-1:nth-child(2) > input`

### Audit trail · Lena
- **color-contrast** (serious, 2 nodes): Elements must meet minimum color contrast ratio thresholds · e.g. `li:nth-child(4) > .-left-\[27px\].absolute.top-0\.5 > .text-\[9px\].text-white.ring-card`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`

### Series brief · Lena (shared)
- **heading-order** (moderate, 1 nodes): Heading levels should only increase by one · e.g. `.rounded-xl.p-5:nth-child(1) > .mb-2.gap-2.flex-wrap > h3`
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`
- **label** (critical, 1 nodes): Form elements must have labels · e.g. `.rounded-xl.p-5:nth-child(1) > textarea[rows="2"]`

### Inbox · Lena after Refresh (with items)
- **label-content-name-mismatch** (serious, 1 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`

### Ripple screen (RIP-0001)
- **color-contrast** (serious, 3 nodes): Elements must meet minimum color contrast ratio thresholds · e.g. `.border-l-tone-amber-dot > .text-\[11px\].gap-1.flex > .-space-x-1.ml-auto.flex > .size-5.text-\[9px\].text-white`
- **empty-table-header** (minor, 1 nodes): Table header text should not be empty · e.g. `.w-44`
- **label-content-name-mismatch** (serious, 5 nodes): Elements must have their visible text as part of their accessible name · e.g. `button[data-slot="popover-trigger"]`
