// Writes .cursor/agents/ux-*.md: one self-contained brief per auditor (shared brief pasted verbatim).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const brief = readFileSync(resolve(root, "docs/ux-audit/BRIEF.md"), "utf8");
const readOnly = `You are a **read-only auditor**. Do not edit, create or delete any file and do not run any command that changes the repo, the app or the demo store (no Reset demo data, no clicks that save, decide, refresh or post). Do not run the gate script against port 3000. Observe and report only; your final message is your report.`;

const agents = [
  {
    name: "ux-audit-desk-inbox",
    description: "Read-only UX auditor for My desk and Inbox (personas Lena, Katrin).",
    scope: `## Your area: My desk and Inbox
Personas: Lena (\`u-lena\`), then Katrin (\`u-katrin\`, head of product line).
Question: **can a first-time PM tell in 5 seconds what needs attention and what to do first?**
Evidence: baseline screens \`desk-lena_*\`, \`desk-katrin_*\`, \`desk-katrin-after-refresh_*\`, \`inbox-lena_*\`, \`inbox-after-refresh_*\`, \`inbox-empty-sofia_*\`. Code: \`web/src/app/(app)/desk-view.tsx\`, \`web/src/app/(app)/inbox/*\`, \`web/src/components/shell/*\` (nav, notification bell, persona menu).
Check: card titles and counts, what is primary, how agent flags vs. reviews vs. follow-ups read, empty and "+N more" states, the notification popover, whether the head sees what only she can do.`,
  },
  {
    name: "ux-audit-cases",
    description: "Read-only UX auditor for the Cases board and the case page (3 steps, Sankey, case stance).",
    scope: `## Your area: Cases board and case page
Persona: Lena (\`u-lena\`).
Question: **is it obvious where you are in the case and what the next step is?**
Evidence: baseline screens \`cases-board_*\`, \`case-evidence_*\`, \`case-stance_*\`, \`case-requirements_*\`. Code: \`web/src/app/(app)/cases/cases-view.tsx\`, \`web/src/app/(app)/cases/[id]/case-view.tsx\`, \`web/src/components/cases/*\` (stance-form, shape-form, case-action-dialog, weight panel), \`web/src/components/sankey/sankey-chart.tsx\`, \`web/src/lib/sankey.ts\`.
Check: the step indicator and the "Next" buttons, the alert banner, the many header buttons (Watch, Details, Comments, More, AI colleague, Decide), the evidence bullets vs. "Read full analysis", the stance form density, open questions, the honesty signals (evidence level, market coverage) that must stay visible.`,
  },
  {
    name: "ux-audit-plan-req-replay-ripple",
    description: "Read-only UX auditor for the vehicle plan, requirement panel/page, trace replay and the competitor ripple.",
    scope: `## Your area: Vehicle plan, requirement side panel and page, Replay, ripple
Personas: Lena (\`u-lena\`), Wei (\`u-wei\`), Katrin (\`u-katrin\`).
Question: **is the density right? What can collapse into a one-line summary?**
Evidence: baseline screens \`plan_*\`, \`requirement-panel_*\`, \`requirement-page_*\`, \`replay-score_*\`, \`replay-chain_*\`, \`ripple_*\`, \`ripple-drawer_*\`. Code: \`web/src/app/(app)/plan/*\`, \`web/src/components/requirements/*\` (requirement-sheet, requirement-parts with Spec and TraceChain, provenance, quality-check, versions-panel, variants-compare, feedback-dialog), \`web/src/app/(app)/requirements/[id]/requirement-view.tsx\`, \`web/src/components/replay/*\`, \`web/src/app/(app)/ripple/[id]/ripple-view.tsx\`.
Check: the provenance chips (they are honesty signals: keep visible, may be more compact), the quality-check strip, tabs and their counts, what is primary on the requirement, the replay header controls and beat panel, the ripple band/grid/drawer and its row actions.`,
  },
  {
    name: "ux-audit-signals-misc",
    description: "Read-only UX auditor for Signals, Innovation pool, Settings, Audit and the onboarding / series brief.",
    scope: `## Your area: Signals, Innovation pool, Settings, Audit, onboarding / series brief
Personas: Jonas (\`u-jonas\`), Lena (\`u-lena\`); onboarding as Wei (\`u-wei\`).
Question: on each screen, where am I, what needs attention, what is the one next thing to do?
Evidence: baseline screens \`radar_*\`, \`innovation_*\`, \`settings_*\`, \`audit_*\`, \`brief-lena_*\`, \`onboarding-wei_*\`, \`login_*\`. Code: \`web/src/app/(app)/radar/*\`, \`web/src/app/(app)/innovation/*\`, \`web/src/app/(app)/settings/*\`, \`web/src/app/(app)/audit/*\`, \`web/src/app/(app)/brief/*\`, \`web/src/app/login/*\`.
Check: the radar Sankey and the run panel after Refresh (code only; don't click Refresh), the 8-question brief density, onboarding framing, settings sections, audit table readability and filters.`,
  },
  {
    name: "ux-audit-consistency",
    description: "Read-only cross-cutting consistency auditor (terms, button hierarchy, badges/colours, spacing, states) using the web-design-guidelines skill.",
    scope: `## Your area: cross-cutting consistency (code + screens)
Question: same term for the same concept everywhere, button hierarchy, badge and colour meaning, spacing scale, empty/loading/error state patterns, accessibility rules.
Method: read \`.cursor/skills/web-design-guidelines/SKILL.md\` and apply \`.cursor/skills/web-design-guidelines/guidelines.md\` to \`web/src/app\` and \`web/src/components\` (report as \`file:line\`). Compare terms across screens (e.g. "Signals" vs "radar", "Your stance" vs "knowledge", "Decide", "Confirm", "Approve", "Sign off"; "Vehicle plan"), the use of \`Pill\`/badges and their tones (\`web/src/components/common/badges.tsx\`), primary vs outline vs ghost buttons per screen, spacing classes, \`PageHeader\`/\`Section\`/\`Empty\` usage, toasts, skeletons. Use all baseline screenshots and \`docs/ux-audit/baseline/results.json\` (axe + Lighthouse) for the a11y part.
Group findings by pattern, not by file, and say how many places each pattern touches.`,
  },
  {
    name: "ux-audit-walkthrough",
    description: "UX cognitive-walkthrough auditor that drives real flows in a browser on its own server (port 3001).",
    scope: `## Your area: cognitive walkthroughs (real flows)
You drive the app in a real browser against **your own server at http://localhost:3001** (a separate in-memory store; other auditors read port 3000, never touch it). Use the Playwright MCP if it is available to you, otherwise Cursor's browser tools (\`cursor-ide-browser\` namespace). Log in at \`/login\` by clicking a persona; switch personas via the persona menu or \`/login\`. Reset the store before each walkthrough: \`POST http://localhost:3001/api/admin/reset\` with header \`x-user-id: u-katrin\` and body \`{}\` (or persona menu → Reset demo data). You may click through the flows (that is the point), but do not edit any file.
Run, step by step, every step of the three demo scripts in \`web/README.md\` ("world changed + trace replay", "context layers", "the rest"), then 3 cold tasks as a first-time user who has not read the README:
1. "find your most urgent case" (as Lena)
2. "turn a confirmed case into a requirement" (as Lena)
3. "find out why a requirement exists" (as Katrin)
For every step answer the 4 NN/g walkthrough questions, count clicks and dead ends, and note where the README wording and the UI wording differ. Save evidence screenshots only via the browser tool's own screenshot output (do not write files yourself); cite the paths it returns.
Report a table per walkthrough (step | 4 questions yes/no + note | clicks | dead end?) before the findings table.`,
  },
];

mkdirSync(resolve(root, ".cursor/agents"), { recursive: true });
for (const a of agents) {
  const text = [
    "---",
    `name: ${a.name}`,
    `description: ${a.description}`,
    "readonly: true",
    "---",
    "",
    `# ${a.name}`,
    "",
    a.name === "ux-audit-walkthrough" ? "" : readOnly,
    "",
    a.scope,
    "",
    "---",
    "",
    brief,
  ].join("\n");
  writeFileSync(resolve(root, `.cursor/agents/${a.name}.md`), text);
}
console.log(`wrote ${agents.length} agents`);
