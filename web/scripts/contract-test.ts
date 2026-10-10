/**
 * Contract test: calls every endpoint of src/contracts/api.ts against a running
 * backend and validates each response with its Zod schema. Then walks the demo
 * storyline (refer, accept, meeting note, escalation, sign-off, plan, export).
 *
 *   npm run dev            # in another terminal (or the real backend)
 *   npm run contract-test  # API_BASE=http://localhost:3000/api by default
 *
 * The real backend must pass this unchanged.
 */
import { endpoints, type EndpointName } from "../src/contracts/api";

const BASE = process.env.API_BASE ?? "http://localhost:3000/api";
let failures = 0;
let calls = 0;

async function call(name: EndpointName, opts: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown; as?: string; expect?: number } = {}) {
  const def = endpoints[name];
  const path = def.path.replace(/:([a-zA-Z]+)/g, (_, k) => encodeURIComponent(opts.params?.[k] ?? ""));
  const qs = opts.query ? "?" + new URLSearchParams(opts.query).toString() : "";
  const res = await fetch(`${BASE}${path}${qs}`, {
    method: def.method,
    headers: { "content-type": "application/json", "x-user-id": opts.as ?? "u-lena" },
    body: "body" in def ? JSON.stringify(opts.body ?? {}) : undefined,
  });
  calls++;
  const json = await res.json().catch(() => null);
  const expected = opts.expect ?? 200;
  if (res.status !== expected) {
    failures++;
    console.error(`✗ ${name} ${def.method} ${path}: HTTP ${res.status} (expected ${expected})`, json);
    return json;
  }
  if (expected === 200) {
    const parsed = def.response.safeParse(json);
    if (!parsed.success) {
      failures++;
      console.error(`✗ ${name}: response breaks the contract`, parsed.error.issues.slice(0, 3));
    } else console.log(`✓ ${name}${opts.as && opts.as !== "u-lena" ? ` (${opts.as})` : ""}`);
  } else console.log(`✓ ${name} → ${expected} as expected`);
  return json;
}

async function main() {
  await call("reset", { body: {} });

  // --- Read endpoints ---
  await call("me");
  await call("users");
  await call("search", { query: { q: "button" } });
  await call("signals", { query: { series: "G60", limit: "20" } });
  await call("clusters", { query: { series: "G60" } });
  await call("agentRuns");
  await call("quarantine");
  await call("cases", { query: { series: "G60" } });
  await call("caseBundle", { params: { id: "CASE-G60-0001" } });
  await call("exportCaseMd", { params: { id: "CASE-G60-0001" } });
  await call("questions");
  await call("requirements");
  await call("requirementBundle", { params: { id: "REQ-G60-0004" } });
  await call("scores", { query: { series: "G60" } });
  await call("previewScores", { body: { weights: { brand_fit: 1, customers: 0.1 } } });
  await call("weightProfiles");
  await call("brandProfile");
  await call("referrals", { as: "u-katrin" });
  await call("innovation");
  await call("plan", { params: { series: "G60" } });
  await call("messages", { params: { type: "case", id: "CASE-G60-0001" } });
  await call("comments", { query: { objectType: "case", objectId: "CASE-G60-0001" } });
  await call("notifications");
  await call("alerts");
  await call("audit", { query: { objectId: "CASE-G60-0001" } });
  await call("portfolio", { as: "u-katrin" });

  // --- Permissions ---
  await call("transitionCase", { params: { id: "CASE-G60-0001" }, body: { action: "park", rationale: "test" }, as: "u-wei", expect: 403 });
  await call("transitionRequirement", { params: { id: "REQ-G60-0004" }, body: { action: "sign_off", rationale: "test" }, as: "u-lena", expect: 409 });
  await call("transitionCase", { params: { id: "CASE-G60-0001" }, body: { action: "park", rationale: "" }, expect: 400 });

  // --- Demo storyline ---
  // 1. Lena refers the shortcut case to the HMI attribute PM.
  await call("transitionCase", { params: { id: "CASE-G60-0001" }, body: { action: "refer", toUserId: "u-jonas", rationale: "Baukasten topic shared with F70 and G70" } });
  const refs = (await call("referrals", { as: "u-jonas" })) as { id: string; caseId: string; status: string }[];
  const ref = refs.find((r) => r.caseId === "CASE-G60-0001" && r.status === "pending")!;
  // 2. Jonas accepts: a linked case appears.
  const accepted = (await call("decideReferral", { params: { id: ref.id }, body: { decision: "accept", rationale: "Taking it into the HMI Baukasten case" }, as: "u-jonas" })) as { linkedCaseId: string };
  await call("caseBundle", { params: { id: accepted.linkedCaseId }, as: "u-jonas" });
  // 3. Lena pastes the climate meeting note; accepts every proposal.
  const note = (await call("addMeetingNote", {
    params: { id: "CASE-G60-0005" },
    body: {
      title: "Climate sync",
      date: "2026-10-10",
      attendees: ["Lena", "Engineering", "Design", "Controlling"],
      text: "- Engineering: today the G60 needs about 9 minutes to cool the cabin from 45 °C to 22 °C. The Mercedes E-Class does it in roughly 6 minutes.\n- Design: a slim physical climate bar below the display is possible.\n- Controlling: the climate bar costs about €18-25 per car.\n- Next: Lena to update the case.",
    },
  })) as { proposals: { id: string }[] };
  if (!note.proposals.length) {
    failures++;
    console.error("✗ meeting note produced no proposals");
  }
  for (const p of note.proposals) await call("decideProposal", { params: { id: p.id }, body: { decision: "accept" } });
  // 4. Chat: ask, draft a requirement via proposal, research.
  await call("postMessage", { params: { type: "case", id: "CASE-G60-0005" }, body: { content: "Why is this ranked so high?" } });
  const chat = (await call("postMessage", { params: { type: "case", id: "CASE-G60-0005" }, body: { content: "Draft a SMART requirement" } })) as { proposals: { id: string }[] };
  await call("decideProposal", { params: { id: chat.proposals[0].id }, body: { decision: "accept" } });
  await call("postMessage", { params: { type: "case", id: "CASE-G60-0003" }, body: { content: "Research what owners in Europe say" } });
  // 5. Wei escalates the China equipment conflict; Katrin resolves.
  await call("transitionCase", { params: { id: "CASE-G60-CN-0001" }, body: { action: "refer", escalate: true, rationale: "China vs RoW: China trim or global standard?" }, as: "u-wei" });
  const esc = ((await call("referrals", { as: "u-katrin" })) as { id: string; caseId: string; kind: string; status: string }[]).find((r) => r.caseId === "CASE-G60-CN-0001" && r.kind === "escalation")!;
  await call("decideReferral", { params: { id: esc.id }, body: { decision: "resolve", resolution: "variant", rationale: "China-specific trim; Europe keeps packages" }, as: "u-katrin" });
  // 6. Katrin signs off, Lena plans, export.
  await call("transitionRequirement", { params: { id: "REQ-G60-0004" }, body: { action: "sign_off", rationale: "Quality baseline in place" }, as: "u-katrin" });
  await call("transitionRequirement", { params: { id: "REQ-G60-0004" }, body: { action: "plan", rationale: "Into the LCI plan" } });
  await call("exportRequirements", { body: { series: "G60", format: "codebeamer_csv" } });
  // 7. Refresh run + alert resolution + misc mutations.
  await call("refresh", { body: { series: "G60" } });
  await call("refresh", { body: { series: "G60" } }); // second run: dedupe, no new signals
  await call("resolveAlert", { params: { id: "AL-0001" }, body: { status: "rework", rationale: "Range options need the new benchmark" } });
  await call("createQuestion", { params: { id: "CASE-G60-0006" }, body: { addressee: "engineering", question: "Space for a compact spare in the US?", why: "US-only option" } });
  await call("patchQuestion", { params: { id: "Q-0002" }, body: { answer: "About €14 per car" } });
  await call("patchCase", { params: { id: "CASE-G60-0011" }, body: { patch: { watcherIds: ["u-wei"] } }, as: "u-wei" });
  await call("patchRequirement", { params: { id: "REQ-G60-CN-0003" }, body: { patch: { metrics: [{ id: "m1", question: "CLTC range", target: "800 km", basis: "assumption" }] }, rationale: "Parity with Xiaomi SU7 Max" }, as: "u-wei" });
  await call("addComment", { body: { objectType: "case", objectId: "CASE-G60-0001", body: "@Jonas thanks, linked." } });
  await call("voteInnovation", { params: { caseId: "CASE-INNO-0001" }, body: {} });
  await call("pullInnovation", { params: { caseId: "CASE-INNO-0002" }, body: { series: "G60", rationale: "Sun protection wishes in G60 too" } });
  const created = (await call("createCase", {
    body: { title: "Head-up display hard to read", series: "G60", scope: "RoW", carArea: "infotainment_hmi", type: "fix_improve", changeDepth: "part_module", summary: "HUD complaints from the radar", signalIds: ["G60-0209", "G60-0576"], rationale: "Cluster of HUD complaints" },
  })) as { id: string };
  await call("transitionCase", { params: { id: created.id }, body: { action: "merge", mergeIntoId: "CASE-G60-0001", rationale: "Same operating-concept problem" } });
  await call("updateWorkspace", { body: { projectType: "lci" } });
  const wp = (await call("createWeightProfile", { body: { name: "My test", description: "test", weights: { customers: 1, severity: 1, satisfaction_gap: 1, competitor_gap: 1, market_volume: 1, regression: 1, trend: 1, brand_fit: 1 }, costMultiplier: { S: 1, M: 0.8, L: 0.5 } } })) as { id: string };
  await call("saveWeightProfile", { params: { id: wp.id }, body: { name: "My test 2" } });
  await call("saveBrandProfile", { body: { pillars: [{ name: "Driving dynamics", description: "x" }], doNot: [], notesMd: "" }, as: "u-katrin" });
  await call("patchPlanFeature", { params: { series: "G60", featureId: "pf-g60-hud" }, body: { patch: { action: "improve" }, rationale: "HUD readability" } });
  await call("generateRequirements", { params: { id: "CASE-G60-0002" }, body: {} });
  await call("readNotifications", { body: {} });
  await call("audit", { query: { limit: "20" } });

  await call("reset", { body: {} });
  console.log(`\n${calls} calls, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
