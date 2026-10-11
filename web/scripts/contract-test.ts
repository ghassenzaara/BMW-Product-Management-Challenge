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

function expectTrue(ok: boolean, what: string) {
  if (ok) console.log(`✓ ${what}`);
  else {
    failures++;
    console.error(`✗ ${what}`);
  }
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
  await call("taxonomy");
  await call("saveCaseStance", {
    params: { id: "CASE-G60-0003" },
    body: { overrides: {}, overrideReasons: {}, evidenceTakes: [], inside: [{ id: "IN-1", kind: "engineering_on_it", text: "Battery team is sampling next-gen cells" }], ambition: null },
  });
  await call("saveCaseStance", { params: { id: "CASE-G60-0003" }, body: { overrides: {}, overrideReasons: {}, evidenceTakes: [], inside: [], ambition: "fix" }, as: "u-sofia", expect: 403 });
  await call("questions");
  await call("requirements");
  await call("requirementBundle", { params: { id: "REQ-G60-0004" } });
  // Quality check: the seeded wireless-projection requirement uses vague wording; the CLTC one mentions homologation.
  const vague = (await call("runRequirementCheck", { params: { id: "REQ-G60-0019" }, body: {} })) as { issues: { kind: string }[] };
  expectTrue(vague.issues.some((i) => i.kind === "vague_word"), "quality check flags vague wording on REQ-G60-0019");
  const scope = (await call("runRequirementCheck", { params: { id: "REQ-G60-CN-0003" }, body: {} })) as { issues: { kind: string }[] };
  expectTrue(scope.issues.some((i) => i.kind === "out_of_scope"), "quality check flags homologation on REQ-G60-CN-0003");
  // Ask the segment: real verbatims only; a segment without data gets a proposal instead of a guess.
  const segs = (await call("caseSegments", { params: { id: "CASE-G60-0012" } })) as { key: string; verbatims: number }[];
  const full = segs.find((s) => s.verbatims > 0);
  const empty = segs.find((s) => s.verbatims === 0);
  if (full) {
    const r = (await call("postMessage", { params: { type: "case", id: "CASE-G60-0012" }, body: { content: "What do they say?", segment: full.key } })) as { messages: { content: string; citations: unknown[] }[] };
    expectTrue(r.messages[1].content.includes("Grounded in") && r.messages[1].citations.length > 0, "segment answer is grounded and cited");
  }
  if (empty) {
    const r = (await call("postMessage", { params: { type: "case", id: "CASE-G60-0012" }, body: { content: "What do they say?", segment: empty.key } })) as { proposals: unknown[] };
    expectTrue(r.proposals.length === 1, "segment without verbatims proposes an open question");
  }
  await call("postMessage", { params: { type: "case", id: "CASE-G60-0012" }, body: { content: "x", segment: "nowhere" }, expect: 400 });
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
  // Drafting asks the shape questions first; a reply with an option label pre-fills the step-3 form.
  const chat = (await call("postMessage", { params: { type: "case", id: "CASE-G60-0005" }, body: { content: "Draft a SMART requirement" } })) as { messages: { content: string }[] };
  expectTrue(chat.messages[1].content.startsWith("Before I draft"), "the chat asks the shape questions before drafting");
  const reply = (await call("postMessage", { params: { type: "case", id: "CASE-G60-0005" }, body: { content: "beat it, and prescribe the climate bar" } })) as { messages: { content: string }[] };
  expectTrue(reply.messages[1].content.startsWith("Noted:"), "a chat answer is stored as a pending shape answer");
  await call("postMessage", { params: { type: "case", id: "CASE-G60-0003" }, body: { content: "Research what owners in Europe say" } });
  // 5. Wei escalates the China equipment conflict; Katrin resolves.
  await call("transitionCase", { params: { id: "CASE-G60-CN-0001" }, body: { action: "refer", escalate: true, rationale: "China vs RoW: China trim or global standard?" }, as: "u-wei" });
  const esc = ((await call("referrals", { as: "u-katrin" })) as { id: string; caseId: string; kind: string; status: string }[]).find((r) => r.caseId === "CASE-G60-CN-0001" && r.kind === "escalation")!;
  await call("decideReferral", { params: { id: esc.id }, body: { decision: "resolve", resolution: "variant", rationale: "China-specific trim; Europe keeps packages" }, as: "u-katrin" });
  // 6. Katrin signs off, Lena plans, export.
  await call("transitionRequirement", { params: { id: "REQ-G60-0004" }, body: { action: "sign_off", rationale: "Quality baseline in place" }, as: "u-katrin" });
  await call("transitionRequirement", { params: { id: "REQ-G60-0004" }, body: { action: "plan", rationale: "Into the LCI plan" } });
  const deck = (await call("requirementDeck", { params: { series: "G60" }, body: {} })) as { slides: { requirementId: string }[] };
  expectTrue(deck.slides.some((s) => s.requirementId === "REQ-G60-0004"), "deck contains the newly planned REQ-G60-0004");
  await call("exportRequirements", { body: { series: "G60", format: "codebeamer_csv" } });
  // 7. Refresh run + alert resolution + misc mutations.
  await call("refresh", { body: { series: "G60" } });
  await call("refresh", { body: { series: "G60" } }); // second run: dedupe, no new signals
  const lenaAlerts = (await call("alerts")) as { id: string; status: string; rippleId?: string; requirementId: string | null }[];
  const rippleAlert = lenaAlerts.find((a) => a.status === "open" && a.rippleId);
  expectTrue(!!rippleAlert && !!rippleAlert.requirementId, "the competitor alert from the run sits on a requirement");
  await call("resolveAlert", { params: { id: rippleAlert!.id }, body: { status: "rework", rationale: "Range options need the new benchmark" } });
  await call("createQuestion", { params: { id: "CASE-G60-0006" }, body: { addressee: "engineering", question: "Space for a compact spare in the US?", why: "US-only option" } });
  await call("patchQuestion", { params: { id: "Q-0002" }, body: { answer: "About €14 per car" } });
  await call("patchCase", { params: { id: "CASE-G60-0011" }, body: { patch: { watcherIds: ["u-wei"] } }, as: "u-wei" });
  await call("patchRequirement", { params: { id: "REQ-G60-CN-0003" }, body: { patch: { metrics: [{ id: "m1", question: "CLTC range", target: "800 km", basis: "assumption" }] }, rationale: "Parity with Xiaomi SU7 Max" }, as: "u-wei" });
  await call("addComment", { body: { objectType: "case", objectId: "CASE-G60-0001", body: "@Jonas thanks, linked." } });
  await call("voteInnovation", { params: { caseId: "CASE-INNO-0001" }, body: {} });
  await call("pullInnovation", { params: { caseId: "CASE-INNO-0002" }, body: { series: "G60", rationale: "Sun protection wishes in G60 too" } });
  const created = (await call("createCase", {
    body: { title: "Head-up display hard to read", series: "G60", scope: "RoW", type: "fix_improve", changeDepth: "part_module", summary: "HUD complaints from the radar", signalIds: ["G60-0209", "G60-0576"], rationale: "Cluster of HUD complaints" },
  })) as { id: string };

  // A case started by hand: one topic and one aspect of the fixed taxonomy; the car area follows from the topic.
  const byHand = { title: "Rear passengers can't charge their phones", series: "G60", scope: "RoW", type: "new_feature", changeDepth: "part_module", summary: "No USB-C in the rear", signalIds: [], rationale: "Started by hand" };
  await call("createCase", { body: byHand, expect: 400 });
  const taxonomy = (await call("taxonomy")) as { topics: { id: string; carArea: string }[] };
  const topic = taxonomy.topics.find((t) => t.id !== "other")!;
  const hand = (await call("createCase", { body: { ...byHand, topicId: topic.id, aspectGroup: "function" } })) as { id: string; topicId: string; carArea: string };
  expectTrue(hand.topicId === topic.id && hand.carArea === topic.carArea, "a hand-made case takes its car area from its topic");
  const evidence = (await call("addCaseEvidence", {
    params: { id: hand.id },
    body: {
      items: [
        { type: "note", text: "Dealers say rear passengers ask for charging on long trips.", kind: "complaint", market: "US" },
        { type: "csv_row", text: "My kids cannot charge their tablets in the back.", source: "clinic.csv", kind: "complaint", market: "US" },
      ],
      rationale: "Dealer feedback and a clinic file",
    },
  })) as { added: { recordRef?: string }[]; case: { figures: { perMarket: { market: string; customers: number }[] } } };
  expectTrue(evidence.added.length === 2 && evidence.added.every((s) => !!s.recordRef), "PM evidence becomes signals with a stored source record");
  expectTrue(evidence.case.figures.perMarket.find((m) => m.market === "US")?.customers === 1, "a PM note is evidence, not a customer; a file row counts");
  await call("transitionCase", { params: { id: created.id }, body: { action: "merge", mergeIntoId: "CASE-G60-0001", rationale: "Same operating-concept problem" } });
  await call("updateWorkspace", { body: { projectType: "lci" } });
  const wp = (await call("createWeightProfile", { body: { name: "My test", description: "test", weights: { customers: 1, severity: 1, satisfaction_gap: 1, competitor_gap: 1, market_volume: 1, regression: 1, trend: 1, brand_fit: 1 }, costMultiplier: { S: 1, M: 0.8, L: 0.5 } } })) as { id: string };
  await call("saveWeightProfile", { params: { id: wp.id }, body: { name: "My test 2" } });
  await call("saveBrandProfile", { body: { pillars: [{ name: "Driving dynamics", description: "x" }], doNot: [], notesMd: "" }, as: "u-katrin" });
  await call("patchPlanFeature", { params: { series: "G60", featureId: "pf-g60-hud" }, body: { patch: { action: "improve" }, rationale: "HUD readability" } });
  await call("generateRequirements", { params: { id: "CASE-G60-0002" }, body: {} });
  await call("readNotifications", { body: {} });
  await call("audit", { query: { limit: "20" } });

  await contextLayersStory();
  await traceAndRippleStory();

  await call("reset", { body: {} });
  console.log(`\n${calls} calls, ${failures} failures`);
  process.exit(failures ? 1 : 0);
}

type Req = { id: string; title: string; marketScope: string; variantOf: string | null; version: number; metrics: { id: string; target: string }[]; descriptionParts: string[]; acceptanceCriteria: string[]; assumptions: string[]; provenance: { path: string; source: string }[] };

/** Every part of a drafted requirement must carry provenance (the brain seam's contract). */
function fullyTagged(r: Req) {
  const paths = new Set(r.provenance.map((p) => p.path));
  const need = [
    "title",
    "marketScope",
    "releaseTarget",
    "cost",
    ...r.descriptionParts.map((_, i) => `description#${i}`),
    ...r.metrics.map((m) => `metrics.${m.id}.target`),
    ...r.acceptanceCriteria.map((_, i) => `acceptanceCriteria#${i}`),
    ...r.assumptions.map((_, i) => `assumptions#${i}`),
  ];
  return need.filter((p) => !paths.has(p));
}

/** Layers: brief → stance → shape answers → draft with provenance → feedback → brief change → Wei's overlay and variant. */
async function contextLayersStory() {
  await call("reset", { body: {} });
  const me = (await call("me")) as { brief: { sharedId: string } | null; needsOnboarding: boolean };
  expectTrue(!!me.brief && !me.needsOnboarding, "Lena is onboarded with the shared G60 brief");
  const wei = (await call("me", { as: "u-wei" })) as { needsOnboarding: boolean };
  expectTrue(wei.needsOnboarding, "Wei needs onboarding (no regional overlay yet)");
  await call("briefs", { query: { series: "G60" } });
  await call("myBrief");

  // Lena: stance, confirm, shape questions, draft with defaults vs. with answers.
  await call("saveCaseStance", { params: { id: "CASE-G60-0003" }, body: { overrides: {}, overrideReasons: {}, evidenceTakes: [], inside: [{ id: "IN-1", kind: "engineering_on_it", text: "Battery team is sampling next-gen cells" }], ambition: null } });
  await call("transitionCase", { params: { id: "CASE-G60-0003" }, body: { action: "confirm", rationale: "Range is the top BEV complaint" } });
  const shape = (await call("shapeQuestions", { params: { id: "CASE-G60-0003" } })) as { questions: { key: string }[] };
  expectTrue(shape.questions.length > 0 && shape.questions.length <= 3, `at most 3 adaptive questions (${shape.questions.map((q) => q.key).join(", ")})`);
  await call("askShapeQuestions", { params: { id: "CASE-G60-0003" }, body: {} });
  const [lena] = (await call("generateRequirements", { params: { id: "CASE-G60-0003" }, body: { answers: [] } })) as Req[];
  expectTrue(fullyTagged(lena).length === 0, `every part of ${lena.id} has provenance (${fullyTagged(lena).join(", ") || "all tagged"})`);
  expectTrue(lena.assumptions.some((a) => a.includes("next-gen cells")), "the stance's inside knowledge shows up as an assumption");
  const [beat] = (await call("generateRequirements", { params: { id: "CASE-G60-0003" }, body: { answers: [{ key: "benchmark", value: "beat" }] } })) as Req[];
  expectTrue(beat.metrics[0]?.target !== lena.metrics[0]?.target, `the shape answer changes the target (${lena.metrics[0]?.target} → ${beat.metrics[0]?.target})`);
  await call("transitionRequirement", { params: { id: beat.id }, body: { action: "reject", rationale: "Keep only one draft" } });

  // Feedback → proposal → new version.
  const fb = (await call("addFeedback", { params: { id: lena.id }, body: { from: "engineering", text: "760 km only with next-gen cells; 720 km is the maximum for the current pack.", response: "compromise", rationale: "Customers compare with the A6 e-tron" } })) as { proposal: { id: string } };
  await call("decideProposal", { params: { id: fb.proposal.id }, body: { decision: "accept" } });
  const v2 = (await call("requirementBundle", { params: { id: lena.id } })) as { requirement: Req; versions: unknown[] };
  expectTrue(v2.requirement.version === 2 && v2.versions.length === 2, `feedback creates version 2 (target ${v2.requirement.metrics[0]?.target})`);
  expectTrue(v2.requirement.descriptionParts.some((p) => /km behind Audi A6 e-tron/.test(p)), "a compromise below the benchmark is not called 'matching' or 'beating'");

  // Brief change → impact proposal (never a silent edit).
  const impact = (await call("previewBriefImpact", { params: { id: "BRIEF-G60" }, body: { values: { costEnvelope: { sensitivity: "high", perCarBand: "≤ +1% material cost vs. today" } } } })) as { requirementId: string }[];
  expectTrue(impact.some((i) => i.requirementId === lena.id), "a cost-envelope change affects the composed requirement");
  const saved = (await call("saveBrief", { params: { id: "BRIEF-G60" }, body: { values: { costEnvelope: { sensitivity: "high", perCarBand: "≤ +1% material cost vs. today" } }, reasons: { costEnvelope: "Budget cut" } } })) as { impact: { proposalId: string | null }[] };
  const after = (await call("requirementBundle", { params: { id: lena.id } })) as { requirement: Req; proposals: { kind: string; status: string }[] };
  expectTrue(after.requirement.version === 2 && after.proposals.some((p) => p.kind === "new_version" && p.status === "pending") && saved.impact.some((i) => i.proposalId), "the brief change is a pending proposal, the requirement is unchanged");

  // Wei: overlay from a strategy doc, then his China variant of the same case.
  const overlay = (await call("createOverlay", { body: { series: "G60" }, as: "u-wei" })) as { id: string };
  const doc =
    "Thesis: In China the 5 Series Li must win buyers from NIO and Xiaomi.\nTarget customer: conquest buyers from local EV brands. Tier stays premium.\nAmbition: a revolution, 4 real innovations.\nGivens: range targets are set in CLTC. The mid-life update is still open for China content.\nCost: low sensitivity, local sourcing.";
  const props = (await call("extractBrief", { params: { id: overlay.id }, body: { text: doc }, as: "u-wei" })) as { id: string }[];
  expectTrue(props.length >= 4, `the strategy doc becomes ${props.length} field proposals`);
  for (const p of props) await call("decideProposal", { params: { id: p.id }, body: { decision: "accept" }, as: "u-wei" });
  await call("saveBrief", { params: { id: overlay.id }, body: { values: {}, reasons: {}, confirm: ["marketWeights"] }, as: "u-wei" });
  const [weiReq] = (await call("generateRequirements", { params: { id: "CASE-G60-0003" }, body: { answers: [] }, as: "u-wei" })) as Req[];
  expectTrue(weiReq.marketScope === "CN" && weiReq.variantOf === lena.id && weiReq.metrics[0]?.target !== v2.requirement.metrics[0]?.target, `Wei's brief gives a different requirement: ${weiReq.metrics[0]?.target} (CN variant of ${weiReq.variantOf})`);
  const conflicts = (await call("briefConflicts", { as: "u-katrin" })) as { overlayId: string; field: string; status: string }[];
  const open = conflicts.find((c) => c.status === "open");
  expectTrue(!!open, `the overlay's differences are brief conflicts (${conflicts.length})`);
  if (open) await call("resolveBriefConflict", { params: { id: open.overlayId, field: open.field }, body: { resolution: "regional_variant", rationale: "China plans in CLTC" }, as: "u-katrin" });
  await call("resolveBriefConflict", { params: { id: overlay.id, field: "thesis" }, body: { resolution: "align", rationale: "x" }, as: "u-lena", expect: 403 });
}

type Replay = {
  events: { action: string; actorType: string; rationale: string | null; scoreSnapshot: { score: number; profileVersion: number; weights: Record<string, number>; at: string } | null }[];
  integrity: { id: string; ok: boolean; failures: string[] }[];
  quoteIds: string[];
  counts: { customers: number };
};
type RippleT = {
  id: string;
  status: string;
  items: { id: string; kind: string; objectId: string; row: string; alsoRows: string[]; verdict: string; gapPct: number | null; muted: boolean; notified: { userId: string; kind: string }[]; rankBefore: number | null; rankAfter: number | null; movedBecause: string | null }[];
};

/** Trace replay of the hero + the competitor ripple across the portfolio, and the decision showing up in the replay. */
async function traceAndRippleStory() {
  await call("reset", { body: {} });
  const hero = "REQ-G60-0010";
  const replay = (await call("requirementReplay", { params: { id: hero } })) as Replay;
  expectTrue(replay.integrity.every((c) => c.ok), `replay integrity: ${replay.integrity.map((c) => `${c.id} ${c.ok ? "ok" : `FAIL ${c.failures[0]}`}`).join(", ")}`);
  const snaps = replay.events.filter((e) => e.scoreSnapshot).map((e) => e.scoreSnapshot!);
  expectTrue(snaps.length >= 2 && snaps[0].profileVersion === 1 && snaps[0].weights.competitor_gap !== snaps.at(-1)!.weights.competitor_gap, `score snapshots use the profile of the decision date (v${snaps[0]?.profileVersion} then, v${snaps.at(-1)?.profileVersion} at sign-off)`);
  expectTrue(replay.events.some((e) => e.actorType === "agent") && replay.events.some((e) => e.actorType === "human"), "replay separates agent steps from human decisions");
  expectTrue(replay.quoteIds.length > 0 && replay.counts.customers >= replay.quoteIds.length, `replay samples ${replay.quoteIds.length} quotes of ${replay.counts.customers} customers`);

  const run = (await call("refresh", { body: { series: "G60" } })) as { run: { steps?: unknown[]; rippleId?: string | null }; ripples: { id: string; status: string }[] };
  expectTrue((run.run.steps?.length ?? 0) === 5 && !!run.run.rippleId, "refresh shows 5 agent-run steps and links the ripple");
  expectTrue(run.ripples.some((r) => r.status === "watch"), "a low-trust fact only goes on the watch list");
  const active = run.ripples.find((r) => r.status === "active")!;
  const bundle = (await call("ripple", { params: { id: active.id } })) as { ripple: RippleT };
  const items = bundle.ripple.items;
  const item = (id: string) => items.find((i) => i.objectId === id)!;
  const rows = new Set(items.flatMap((i) => [i.row, ...i.alsoRows]));
  expectTrue(new Set([...rows].map((r) => (r === "G60_CN" ? "G60" : r))).size >= 3, `the ripple spans ${rows.size} rows in 3+ series`);
  expectTrue(item(hero).verdict === "at_par" && item("REQ-G60-CN-0003").verdict === "behind" && item("REQ-G70-0002").verdict === "still_ahead" && item("REQ-F70-0002").verdict === "not_comparable", "verdicts: hero at par, China behind, Baukasten ahead, F70 not comparable");
  expectTrue(item(hero).notified.some((n) => n.userId === "u-katrin" && n.kind === "head"), "the head is notified because the hero is signed off");
  expectTrue(items.every((i) => i.kind === "requirement"), "a competitor update affects requirements only, not target-less cases");
  const seeded = (await call("alerts", { query: { all: "true" }, as: "u-katrin" })) as { status: string; rippleId?: string }[];
  expectTrue(seeded.filter((a) => a.status === "open").every((a) => a.rippleId), "every open competitor alert comes from a ripple");

  const raise = (await call("decideRippleItem", { params: { id: active.id, itemId: item("REQ-G60-CN-0003").id }, body: { kind: "raise_target", rationale: "Beat Xiaomi" }, as: "u-wei" })) as { proposal: { kind: string; status: string } };
  const cn = (await call("requirementBundle", { params: { id: "REQ-G60-CN-0003" } })) as { requirement: { metrics: { target: string }[] } };
  expectTrue(raise.proposal.kind === "new_version" && raise.proposal.status === "pending" && cn.requirement.metrics[0].target === "750 km", "raise target is a proposal only: the requirement is unchanged");
  const variant = (await call("decideRippleItem", { params: { id: active.id, itemId: item(hero).id }, body: { kind: "market_variant", rationale: "China buyers compare CLTC" }, as: "u-wei" })) as { proposal: { objectId: string } };
  expectTrue(variant.proposal.objectId === "REQ-G60-CN-0003", "Wei's market variant links the existing China requirement instead of duplicating it");
  await call("decideRippleItem", { params: { id: active.id, itemId: item(hero).id }, body: { kind: "keep", rationale: "At par; we win on charging speed" }, as: "u-sofia", expect: 403 });
  await call("decideRippleItem", { params: { id: active.id, itemId: item(hero).id }, body: { kind: "keep", rationale: "At par; we win on charging speed" } });
  const after = (await call("requirementReplay", { params: { id: hero } })) as Replay;
  expectTrue(after.events.some((e) => e.action === "ripple.kept" && e.rationale === "At par; we win on charging speed") && after.events.some((e) => e.action === "alert.raised"), "the alert and Lena's decision show up in the hero's replay");
  expectTrue(after.integrity.every((c) => c.ok), "the chain stays intact after the ripple");

  const run2 = (await call("refresh", { body: { series: "G60" } })) as { ripples: { id: string; status: string }[] };
  const second = (await call("ripple", { params: { id: run2.ripples[0].id } })) as { ripple: RippleT };
  const h2 = second.ripple.items.find((i) => i.objectId === hero)!;
  expectTrue(h2.muted && h2.notified.length === 0, `a repeat fact stays muted for the kept target (gap ${h2.gapPct}%)`);
  const weiAlerts = ((await call("alerts", { as: "u-wei" })) as { status: string; rippleId?: string; requirementId: string | null }[]).filter((a) => a.status === "open" && a.requirementId === "REQ-G60-CN-0003" && a.rippleId);
  expectTrue(weiAlerts.length === 1 && weiAlerts[0].rippleId === second.ripple.id, `a newer fact from the same competitor replaces the older alert (${weiAlerts.map((a) => a.rippleId).join(", ")})`);

  await call("saveConversion", { params: { id: "CONV-CLTC-WLTP" }, body: { factor: 0.9, rationale: "x" }, expect: 403 });
  await call("saveConversion", { params: { id: "CONV-CLTC-WLTP" }, body: { factor: 0.9, rationale: "Long-range trims read closer to 0.9" }, as: "u-katrin" });
  const re = (await call("ripple", { params: { id: active.id } })) as { ripple: RippleT };
  expectTrue(re.ripple.items.find((i) => i.objectId === hero)!.verdict === "behind", "factor 0.90 turns the hero behind (the verdict hinges on the assumption)");
  await call("conversions");
  await call("ripples");
  await call("monitorSettings");
  await call("saveMonitorSettings", { body: { muteThresholdPct: 4, rationale: "Fewer repeats for small moves" }, as: "u-katrin" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
