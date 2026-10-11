import { stringify as toYaml } from "yaml";
import type { z } from "zod";
import type {
  BriefFieldKey,
  BriefValues,
  Case,
  CaseState,
  ChatMessage,
  Dataset,
  EndpointName,
  endpoints,
  FeedbackEntry,
  Market,
  OpenQuestion,
  Proposal,
  Referral,
  Requirement,
  RequirementCheck,
  RequirementStatus,
  SeriesBrief,
  Signal,
  TaxonomyResponse,
  User,
} from "@/contracts";
import { BriefFieldKey as BriefFieldKeys, RequirementSnapshot, addresseeLabel, briefFieldLabel, feedbackResponseLabel, shapeKeyLabel } from "@/contracts";
import { ApiError, audit, checks, db, must, nextId, notify, now, resetStore } from "./store";
import { computeScores } from "./scoring";
import { scoreSnapshotNow } from "./snapshot";
import { getDrafter, type Draft } from "./ai/drafter";
import { buildInput, changeSummary, feedbackPatch, redraft, regionOf, retagEdits, snapshotOf, snapshotsDiffer, stanceOf } from "./ai/drafting";
import { briefFieldsUsed, provenanceCounts, provenanceLine, sentences } from "./ai/provenance";
import { conflictsOf, extractFromDoc, needsOnboarding, overlayOf, overlayPrefill, resolveBrief, sharedBrief } from "./briefs";
import { checkRequirement, ruleCheck } from "./ai/quality";
import { caseSegments, segmentReply } from "./ai/segment";
import { cite, followUpQuestions, scriptedReply, shapeQuestionsMessage, type ProposalDraft } from "./ai/chat";
import { extractFromNote } from "./ai/notes";
import { liveChatEnabled, liveReply } from "./ai/live";
import { argusReply } from "./ai/argus";
import { refreshPool } from "./authored/world";
import { WEB_CLASSIFIER, sha256, webSnapshotRecord, webSpecToSignal } from "./convert";
import { buildReplay } from "./replay";
import { assessFact, decideItem, reassess, SIGNED_STATUSES } from "./ripple";
import taxonomyData from "./fixtures/taxonomy.json";
import { FactorKey as FactorKeys } from "@/contracts";
import { shortFromTitle } from "./authored/short-names";

type Ep = typeof endpoints;
type In<T> = T extends z.ZodType ? z.output<T> : undefined;
export interface Ctx<K extends EndpointName> {
  params: Record<string, string>;
  query: Ep[K] extends { query: infer Q } ? In<Q> : Record<string, never>;
  body: Ep[K] extends { body: infer B } ? In<B> : undefined;
  user: User;
}
type Out<K extends EndpointName> = z.input<Ep[K]["response"]>;
export type Handlers = { [K in EndpointName]: (ctx: Ctx<K>) => Out<K> | Promise<Out<K>> };

// ---------- helpers ----------
const findCase = (d: Dataset, id: string) => must(d.cases.find((c) => c.id === id), `Case ${id}`);
const findReq = (d: Dataset, id: string) => must(d.requirements.find((r) => r.id === id), `Requirement ${id}`);
const head = (d: Dataset) => d.users.find((u) => u.role === "head")!;
const userName = (d: Dataset, id: string) => d.users.find((u) => u.id === id)?.name ?? id;

function canEditCase(u: User, c: Case) {
  return u.id === c.ownerId || c.coOwnerIds.includes(u.id) || u.role === "head";
}
function assertCaseEditor(u: User, c: Case) {
  if (!canEditCase(u, c)) throw new ApiError(403, `Only the owner (${c.ownerId}) or a co-owner can change ${c.id}. You can comment or watch.`);
}
function assertReqEditor(u: User, r: Requirement) {
  if (u.id !== r.ownerId && u.role !== "head") throw new ApiError(403, `Only the owner can change ${r.id}.`);
}

function workspaceOf(d: Dataset, userId: string) {
  return must(d.workspaces.find((w) => w.userId === userId), "Workspace");
}
function profileOf(d: Dataset, userId: string) {
  const ws = workspaceOf(d, userId);
  return d.weightProfiles.find((p) => p.id === ws.weightProfileId) ?? d.weightProfiles[0];
}

function touch<T extends { updatedAt: string }>(o: T) {
  o.updatedAt = now();
  return o;
}

function caseSignals(d: Dataset, c: Case) {
  return c.signalIds.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s);
}

/** A link or a note a PM added is market evidence or an assumption; only rows of an uploaded file count as customers. */
const isPmOpinion = (s: Signal) => s.sourceType === "pm_link" || s.sourceType === "pm_note";

function recomputeFigures(d: Dataset, c: Case) {
  const sigs = caseSignals(d, c);
  const markets = new Set<Market>(c.markets);
  sigs.forEach((s) => s.market !== "unknown" && markets.add(s.market));
  const old = new Map(c.figures.perMarket.map((m) => [m.market, m]));
  c.markets = [...markets];
  c.figures.perMarket = [...markets].map((m) => {
    const inM = sigs.filter((s) => s.market === m && s.sourceType !== "bmw_study" && s.kind !== "competitor_fact" && !isPmOpinion(s));
    const complaints = inM.filter((s) => s.kind === "complaint").length;
    const wishes = inM.filter((s) => s.kind === "wish").length;
    const likes = inM.filter((s) => s.kind === "like").length;
    const total = complaints + wishes + likes;
    const prev = old.get(m);
    return {
      market: m,
      customers: inM.length,
      complaints,
      wishes,
      likes,
      studyLabel: prev?.studyLabel,
      studyScore: prev?.studyScore,
      salesShare2030: prev?.salesShare2030,
      sentiment: total ? Math.round(Math.max(-1, Math.min(1, (likes - complaints - 0.5 * wishes) / total)) * 100) / 100 : (prev?.sentiment ?? 0),
    };
  });
  const customers = sigs.filter((s) => s.sourceType !== "bmw_study" && !["competitor_fact", "trend"].includes(s.kind) && !isPmOpinion(s)).length;
  c.factors.customers = Math.round(Math.min(1, Math.log10(1 + customers) / Math.log10(61)) * 100) / 100;
}

function createRequirement(
  d: Dataset,
  c: Case,
  draft: Draft,
  actorId: string,
  opts: { ownerId?: string; briefId?: string | null; drafter?: string; variantOf?: string | null } = {},
): Requirement {
  const prefix = `REQ-${c.series}-${draft.marketScope === "CN" ? "CN-" : ""}`;
  const r: Requirement = {
    id: nextId(prefix, d.requirements),
    caseId: c.id,
    series: c.series,
    variantOf: opts.variantOf ?? null,
    status: "draft",
    carArea: c.carArea,
    changeDepth: c.changeDepth,
    ownerId: opts.ownerId ?? c.ownerId,
    manualRank: null,
    plannedFeatureId: null,
    version: 1,
    briefId: opts.briefId ?? null,
    drafter: opts.drafter ?? null,
    createdAt: now(),
    updatedAt: now(),
    synthetic: true,
    ...draft,
  };
  d.requirements.push(r);
  c.requirementIds.push(r.id);
  d.requirementVersions.push({ requirementId: r.id, version: 1, snapshot: snapshotOf(r), cause: "draft", rationale: `Drafted from ${c.id}`, createdAt: now(), createdBy: actorId });
  const layers = [...new Set(r.provenance.map((p) => p.layer ?? p.source))];
  audit({
    actorId,
    action: "requirement.drafted",
    objectType: "requirement",
    objectId: r.id,
    after: { title: r.title, drafter: r.drafter, briefId: r.briefId, layers, shape: r.shapeAnswers.map((a) => `${a.key}=${a.value}${a.byDefault ? " (default)" : ""}`) },
    rationale: `Generated from ${c.id}`,
  });
  saveCheck(ruleCheck(d, r, now()), "After drafting");
  return r;
}

/** Apply a new version (feedback, brief change or edit): bump the version, keep the history, re-run the quality check. */
function applyVersion(d: Dataset, r: Requirement, snapshot: RequirementSnapshot, cause: "feedback" | "brief_change" | "edit" | "ripple", actorId: string, rationale: string, feedbackId?: string) {
  const before = snapshotOf(r);
  Object.assign(r, snapshot);
  r.version += 1;
  touch(r);
  d.requirementVersions.push({ requirementId: r.id, version: r.version, snapshot: snapshotOf(r), cause, feedbackId, rationale, createdAt: now(), createdBy: actorId });
  audit({ actorId, action: "requirement.version_created", objectType: "requirement", objectId: r.id, before: { version: r.version - 1 }, after: { version: r.version, cause, change: changeSummary(before, snapshot) }, rationale });
  saveCheck(ruleCheck(d, r, now()), `After version ${r.version}`);
}

/** Changing a signed-off target drops it back to PM-approved: the head signs off again. */
function resetSignOff(d: Dataset, r: Requirement, user: User, why: string) {
  if (!SIGNED_STATUSES.includes(r.status)) return;
  const before = r.status;
  r.status = "pm_approved";
  audit({ actorId: user.id, action: "requirement.signoff_reset", objectType: "requirement", objectId: r.id, before: { status: before }, after: { status: r.status }, rationale: `Target changed after sign-off: ${why}` });
  notify({ userId: head(d).id, kind: "sign_off_request", title: "New sign-off needed", body: `${r.id}: ${why}`, link: `/requirements/${r.id}`, actorId: user.id });
}

/** PMs of the case's series may draft their own (regional) requirement on it, under their own brief. */
function assertCanDraft(u: User, c: Case) {
  if (canEditCase(u, c)) return;
  if (u.role === "vehicle_pm" && u.series.includes(c.series)) return;
  throw new ApiError(403, `Only the owner or a PM of the ${c.series} can draft requirements on ${c.id}.`);
}

function briefById(d: Dataset, id: string) {
  return must(d.briefs.find((b) => b.id === id), `Product specs ${id}`);
}

function assertBriefEditor(u: User, b: SeriesBrief) {
  if (u.id !== b.ownerId && u.role !== "head") throw new ApiError(403, `Only ${b.ownerId} (or the head of product line) edits ${b.id}.`);
}

/**
 * Requirements a brief change touches: their provenance references a changed field and they were
 * composed with this brief (or, for a shared brief, an overlay that does not override the field).
 * Composer-made requirements get a new-version proposal; hand-written ones are listed for review.
 */
async function briefImpact(d: Dataset, brief: SeriesBrief, values: Partial<BriefValues>) {
  const changed = BriefFieldKeys.options.filter((k) => values[k] !== undefined && JSON.stringify(values[k]) !== JSON.stringify(brief.values[k]));
  if (!changed.length) return [];
  const overlays = d.briefs.filter((b) => b.parentId === brief.id);
  const out = [];
  for (const r of d.requirements) {
    if (["rejected", "exported"].includes(r.status) || r.series !== brief.series) continue;
    const viaOverlay = overlays.find((o) => o.id === r.briefId);
    const usesThis = r.briefId === brief.id || (viaOverlay && brief.kind === "shared");
    if (!usesThis) continue;
    const live = changed.filter((k) => !(viaOverlay && viaOverlay.values[k] !== undefined));
    if (!live.length) continue;
    const tagged = briefFieldsUsed(r).filter((k) => live.includes(k));
    if (!r.drafter?.startsWith("composer")) {
      // Hand-written: only its provenance tells what it depends on; no automatic redraft.
      if (tagged.length) out.push({ requirementId: r.id, title: r.title, fields: tagged, summary: "Written by hand: review it yourself (no automatic redraft).", changes: [], proposalId: null });
      continue;
    }
    // Composer-made: redraft with the new values; a default the brief decided (e.g. ambition) may change too.
    const baseResolved = resolveBrief(d, r.series, r.ownerId)!;
    const nextResolved = { ...baseResolved, values: { ...baseResolved.values, ...Object.fromEntries(live.map((k) => [k, values[k]])) } };
    const { draft } = await redraft(d, r, { brief: nextResolved });
    const current = snapshotOf(r);
    if (!snapshotsDiffer(current, draft)) continue;
    const fields = tagged.length ? tagged : live;
    const summary = `v${r.version + 1}: ${changeSummary(current, draft)} (product specs: ${fields.map((k) => briefFieldLabel[k].toLowerCase()).join(", ")})`;
    out.push({ requirementId: r.id, title: r.title, fields, summary, changes: [{ field: "version", before: current, after: draft }], proposalId: null as string | null });
  }
  return out;
}

/** Learning is proposed, never silent: after 3 expensive drafts were rejected or cut, suggest a stricter cost envelope. */
function maybeLearnCost(d: Dataset, user: User) {
  const expensive = new Set(d.requirements.filter((r) => r.ownerId === user.id).map((r) => r.id));
  const signals = d.audit.filter(
    (e) =>
      expensive.has(e.objectId) &&
      e.actorId === user.id &&
      ((e.action === "requirement.status_changed" && (e.after as { status?: string })?.status === "rejected" && (e.before as { costSize?: string })?.costSize === "L") ||
        (e.action === "requirement.edited" && (e.before as { cost?: { size?: string } })?.cost?.size === "L" && (e.after as { cost?: { size?: string } })?.cost?.size !== "L")),
  ).length;
  if (signals < 3) return;
  const brief = overlayOf(d, user.series[0], user.id) ?? sharedBrief(d, user.series[0]);
  if (!brief || (brief.ownerId !== user.id && user.role !== "head")) return;
  const current = resolveBrief(d, brief.series, user.id)?.values.costEnvelope;
  if (!current || current.sensitivity === "high") return;
  if (d.proposals.some((p) => p.objectId === brief.id && p.source === "learning" && p.status === "pending")) return;
  saveProposals(d, [
    {
      objectType: "brief",
      objectId: brief.id,
      source: "learning",
      kind: "brief_field",
      summary: `You rejected or cut ${signals} expensive (size L) drafts. Set cost sensitivity to high?`,
      changes: [{ field: "costEnvelope", before: current, after: { ...current, sensitivity: "high" } }],
      citations: [],
    },
  ]);
  audit({ actorId: "agent:learning", action: "proposal.created", objectType: "brief", objectId: brief.id, after: { field: "costEnvelope" }, rationale: `${signals} expensive drafts rejected or cut` });
  notify({ userId: user.id, kind: "alert", title: "Learned from your decisions", body: "Set cost sensitivity to high? See your product specs.", link: "/brief", actorId: "agent:learning" });
}

function saveCheck(check: RequirementCheck, trigger: string) {
  checks().set(check.requirementId, check);
  const red = check.issues.filter((i) => i.severity === "red").length;
  audit({
    actorId: "agent:quality_check",
    action: "requirement.checked",
    objectType: "requirement",
    objectId: check.requirementId,
    after: { engine: check.engine, red, amber: check.issues.length - red, kinds: [...new Set(check.issues.map((i) => i.kind))] },
    rationale: trigger,
  });
  return check;
}

/** Latest check, or a rules-only check computed now (seeded requirements were never checked). Not audited. */
function currentCheck(d: Dataset, r: Requirement) {
  const known = checks().get(r.id);
  if (known) return known;
  const fresh = ruleCheck(d, r, now());
  checks().set(r.id, fresh);
  return fresh;
}

const reqOrder: RequirementStatus[] = ["draft", "in_discussion", "pm_approved", "signed_off", "planned", "exported"];

function saveProposals(d: Dataset, drafts: ProposalDraft[]): Proposal[] {
  return drafts.map((p) => {
    const full: Proposal = { ...p, id: nextId("P-", d.proposals), status: "pending", createdAt: now() };
    d.proposals.push(full);
    return full;
  });
}

function mostFrequentTopic(signals: Signal[]): string | null {
  const count = new Map<string, number>();
  signals.forEach((s) => s.topicId && count.set(s.topicId, (count.get(s.topicId) ?? 0) + 1));
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function linkedCaseFor(d: Dataset, source: Case, owner: User, series = owner.series[0], rationale: string): Case {
  const id = nextId(`CASE-${series}-`, d.cases.filter((c) => c.id.startsWith(`CASE-${series}-`) && !c.id.includes("-CN-")));
  const linked: Case = {
    ...structuredClone(source),
    id,
    series,
    relatedSeries: [...new Set([source.series, ...source.relatedSeries])].filter((s) => s !== series),
    ownerId: owner.id,
    coOwnerIds: [],
    watcherIds: [source.ownerId],
    state: "investigating",
    outcome: null,
    outcomeNote: undefined,
    stances: [],
    originCaseId: source.id,
    mergedInto: null,
    requirementIds: [],
    manualRank: null,
    newSignalCount: 0,
    createdAt: now(),
    createdBy: owner.id,
    updatedAt: now(),
    bodyVersion: 1,
    bodyMd: source.bodyMd.replace("## Decision log", `## Decision log\n\n- ${now().slice(0, 10)} · Linked from ${source.id} (${userName(d, source.ownerId)}): ${rationale}`),
  };
  d.cases.push(linked);
  d.clusters.push({ id: `CL-${id}`, label: linked.featureName, series, carArea: linked.carArea, size: linked.signalIds.length, sentiment: 0, markets: {}, caseId: id, signalIds: linked.signalIds });
  audit({ actorId: owner.id, action: "case.created", objectType: "case", objectId: id, after: { originCaseId: source.id }, rationale });
  return linked;
}

// ---------- handlers ----------
export const handlers: Handlers = {
  // Identity
  me: ({ user }) => {
    const d = db();
    const brief = user.role === "vehicle_pm" ? resolveBrief(d, user.series[0], user.id) : null;
    return { user, workspace: workspaceOf(d, user.id), weightProfile: profileOf(d, user.id), brief, needsOnboarding: needsOnboarding(d, user), features: { agentRefresh: true, competitorRipple: true } };
  },

  // Series briefs (layer 1)
  briefs: ({ query }) => db().briefs.filter((b) => !query.series || b.series === query.series),
  myBrief: ({ user }) => {
    const d = db();
    const series = user.series[0];
    const shared = sharedBrief(d, series) ?? null;
    const overlay = overlayOf(d, series, user.id) ?? null;
    const ids = new Set([shared?.id, overlay?.id].filter(Boolean));
    return {
      resolved: user.role === "vehicle_pm" ? resolveBrief(d, series, user.id) : null,
      shared,
      overlay,
      proposals: d.proposals.filter((p) => p.objectType === "brief" && ids.has(p.objectId)),
    };
  },
  createOverlay: ({ body, user }) => {
    const d = db();
    const shared = must(sharedBrief(d, body.series), `Shared product specs of ${body.series}`);
    if (user.role !== "vehicle_pm" || !user.series.includes(body.series)) throw new ApiError(403, `Only a PM of the ${body.series} creates a regional overlay.`);
    if (shared.ownerId === user.id) throw new ApiError(409, "You own the shared product specs; edit them directly.");
    const existing = overlayOf(d, body.series, user.id);
    if (existing) return existing;
    const pre = overlayPrefill(user);
    const at = now();
    const overlay: SeriesBrief = {
      id: `BRIEF-${body.series}-${user.region}`,
      series: body.series,
      kind: "overlay",
      region: user.region,
      parentId: shared.id,
      ownerId: user.id,
      values: pre.values,
      meta: Object.fromEntries(Object.keys(pre.values).map((k) => [k, { source: "data", confirmed: false, reason: pre.reasons[k as BriefFieldKey], updatedAt: at, updatedBy: user.id }])),
      version: 1,
      createdAt: at,
      updatedAt: at,
      synthetic: true,
    };
    d.briefs.push(overlay);
    audit({ actorId: user.id, action: "brief.created", objectType: "brief", objectId: overlay.id, after: { series: overlay.series, kind: "overlay", region: overlay.region, parentId: shared.id }, rationale: "Onboarding: regional overlay on the shared product specs" });
    return overlay;
  },
  saveBrief: async ({ params, body, user }) => {
    const d = db();
    const b = briefById(d, params.id);
    assertBriefEditor(user, b);
    const shared = b.kind === "overlay" ? briefById(d, b.parentId!) : b;
    const values: Partial<BriefValues> = Object.fromEntries(Object.entries(body.values).filter(([, v]) => v !== undefined));
    // An overlay holds only what differs from the shared brief, each difference with a reason.
    if (b.kind === "overlay") {
      for (const k of Object.keys(values) as BriefFieldKey[]) {
        if (JSON.stringify(values[k]) === JSON.stringify(shared.values[k])) delete values[k];
        else if (!body.reasons[k] && !b.meta[k]?.reason) throw new ApiError(400, `Say why ${briefFieldLabel[k].toLowerCase()} differs from the shared product specs.`);
      }
    }
    const current = resolveBrief(d, b.series, b.ownerId);
    const impact = current ? await briefImpact(d, b, values) : [];
    const before: Record<string, unknown> = {};
    const at = now();
    for (const k of Object.keys(values) as BriefFieldKey[]) {
      before[k] = b.values[k];
      (b.values as Record<string, unknown>)[k] = values[k];
      b.meta[k] = { source: "pm", confirmed: true, reason: body.reasons[k] ?? b.meta[k]?.reason, updatedAt: at, updatedBy: user.id };
    }
    for (const k of body.confirm ?? []) {
      const m = b.meta[k];
      if (m) b.meta[k] = { ...m, confirmed: true, updatedAt: at, updatedBy: user.id };
      else if (b.values[k] !== undefined) b.meta[k] = { source: "pm", confirmed: true, updatedAt: at, updatedBy: user.id };
    }
    for (const k of body.clear ?? []) {
      if (b.kind !== "overlay") continue;
      before[k] = b.values[k];
      delete b.values[k];
      delete b.meta[k];
    }
    const changedFields = [...Object.keys(values), ...(body.clear ?? [])];
    if (changedFields.length || body.confirm?.length) {
      b.version += 1;
      touch(b);
      audit({
        actorId: user.id,
        action: "brief.updated",
        objectType: "brief",
        objectId: b.id,
        before,
        after: { ...Object.fromEntries(changedFields.map((k) => [k, b.values[k as BriefFieldKey] ?? "(shared value)"])), confirmed: body.confirm ?? [] },
        rationale: Object.values(body.reasons).filter(Boolean).join(" · ") || (body.confirm?.length ? "Confirmed pre-filled answers" : "Product specs edited"),
      });
    }
    // Impact: one new-version proposal per affected requirement, never a silent edit.
    const created = [];
    for (const i of impact) {
      if (i.proposalId === null && i.changes.length) {
        const r = d.requirements.find((x) => x.id === i.requirementId)!;
        const [p] = saveProposals(d, [{ objectType: "requirement", objectId: r.id, source: "brief_change", kind: "new_version", summary: i.summary, changes: i.changes, citations: [] }]);
        audit({ actorId: "agent:impact", action: "proposal.created", objectType: "requirement", objectId: r.id, after: { proposalId: p.id, fields: i.fields }, rationale: `Product specs ${b.id} changed` });
        if (r.ownerId !== user.id) notify({ userId: r.ownerId, kind: "alert", title: "A product specs change affects your requirement", body: `${r.id}: ${i.summary}`, link: `/requirements/${r.id}`, actorId: "agent:impact" });
        created.push({ ...i, proposalId: p.id });
      } else created.push(i);
    }
    return { brief: b, impact: created };
  },
  previewBriefImpact: async ({ params, body, user }) => {
    const d = db();
    const b = briefById(d, params.id);
    assertBriefEditor(user, b);
    return briefImpact(d, b, body.values);
  },
  extractBrief: ({ params, body, user }) => {
    const d = db();
    const b = briefById(d, params.id);
    assertBriefEditor(user, b);
    const current = resolveBrief(d, b.series, b.ownerId);
    if (!current) throw new ApiError(409, "The shared product specs are incomplete; fill them in before extracting a regional overlay.");
    const drafts = extractFromDoc(body.text, current.values, b.id);
    const proposals = saveProposals(d, drafts);
    audit({ actorId: "agent:brief_extractor", action: "proposal.created", objectType: "brief", objectId: b.id, after: { count: proposals.length, fields: drafts.map((p) => p.changes[0].field) }, rationale: "Extracted from a pasted strategy doc" });
    return proposals;
  },
  briefConflicts: () => {
    const d = db();
    return d.briefs
      .filter((b) => b.kind === "overlay" && b.parentId)
      .flatMap((o) => conflictsOf(briefById(d, o.parentId!), o).map((c) => ({ ...c, series: o.series, ownerId: o.ownerId })))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1));
  },
  resolveBriefConflict: ({ params, body, user }) => {
    const d = db();
    if (user.role !== "head") throw new ApiError(403, "Only the head of product line resolves product specs conflicts.");
    const o = briefById(d, params.id);
    const field = BriefFieldKeys.parse(params.field);
    if (o.kind !== "overlay" || o.values[field] === undefined) throw new ApiError(404, `No regional difference on ${field}.`);
    const before = o.values[field];
    if (body.resolution === "align") {
      delete o.values[field];
      delete o.meta[field];
    } else {
      o.meta[field] = { ...o.meta[field]!, resolution: { status: "regional_variant", by: user.id, at: now(), note: body.rationale } };
    }
    o.version += 1;
    touch(o);
    audit({ actorId: user.id, action: "brief.conflict_resolved", objectType: "brief", objectId: o.id, before: { [field]: before }, after: { resolution: body.resolution, field }, rationale: body.rationale });
    notify({ userId: o.ownerId, kind: "escalation", title: `Product specs difference ${body.resolution === "align" ? "aligned" : "accepted as regional"}`, body: `${briefFieldLabel[field]}: ${body.rationale}`, link: "/brief", actorId: user.id });
    return o;
  },
  users: () => db().users,
  updateWorkspace: ({ user, body }) => {
    const d = db();
    const ws = workspaceOf(d, user.id);
    const before = structuredClone(ws);
    Object.assign(ws, body);
    audit({ actorId: user.id, action: "workspace.updated", objectType: "workspace", objectId: ws.id, before, after: ws });
    return ws;
  },
  search: ({ query }) => {
    const d = db();
    const q = query.q.toLowerCase().trim();
    if (!q) return [];
    const hit = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(q));
    return [
      ...d.cases.filter((c) => hit(c.id, c.title, c.featureName)).map((c) => ({ type: "case" as const, id: c.id, title: c.title, subtitle: `${c.id} · ${c.series}`, href: `/cases/${c.id}` })),
      ...d.requirements.filter((r) => hit(r.id, r.title)).map((r) => ({ type: "requirement" as const, id: r.id, title: r.title, subtitle: `${r.id} · ${r.status}`, href: `/requirements/${r.id}` })),
      ...d.users.filter((u) => hit(u.name, u.title)).map((u) => ({ type: "user" as const, id: u.id, title: u.name, subtitle: u.title, href: `/cases?owner=${u.id}` })),
      ...d.signals
        .filter((s) => s.id.toLowerCase() === q || (q.length > 3 && hit(s.summary)))
        .slice(0, 8)
        .map((s) => ({ type: "signal" as const, id: s.id, title: s.summary, subtitle: `${s.id} · ${s.sourceName}`, href: s.caseId ? `/cases/${s.caseId}?signal=${s.id}` : `/radar?signal=${s.id}` })),
    ].slice(0, 25);
  },

  // Signals and agents
  signals: ({ query }) => {
    const d = db();
    const q = query.q?.toLowerCase();
    const list = d.signals.filter(
      (s) =>
        (!query.series || s.series === query.series) &&
        (!query.caseId || s.caseId === query.caseId) &&
        (!query.agent || s.agent === query.agent) &&
        (!query.market || s.market === query.market) &&
        (!query.kind || s.kind === query.kind) &&
        (!query.status || s.status === query.status) &&
        (!q || s.summary.toLowerCase().includes(q) || s.quote.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)),
    );
    list.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
    return query.limit ? list.slice(0, query.limit) : list;
  },
  clusters: ({ query }) => db().clusters.filter((c) => !query.series || c.series === query.series),
  agentRuns: () => [...db().agentRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  refresh: ({ body, user }) => {
    const d = db();
    const startedAt = now();
    const pending = refreshPool.map((spec, i) => ({ spec, i })).filter(({ i }) => !d.signals.some((s) => s.id === `SIG-REFRESH-${i}`));
    const batch = Math.min(...pending.map(({ spec }) => spec.batch ?? 1));
    const fresh = pending.filter(({ spec }) => (spec.batch ?? 1) === batch);
    const added: Signal[] = [];
    let notes = 0;
    for (const { spec, i } of fresh) {
      const c = spec.caseId ? d.cases.find((x) => x.id === spec.caseId) : undefined;
      const s = webSpecToSignal(spec, {
        id: `SIG-REFRESH-${i}`,
        series: c?.series ?? body.series,
        carArea: c?.carArea ?? "range_charging",
        featureHint: c?.featureName ?? "Charging speed",
        caseId: c?.id ?? null,
        topicId: c?.topicId ?? null,
        fetchedAt: startedAt,
      });
      s.status = c ? "clustered" : "new";
      d.signals.push(s);
      d.sourceRecords.push(webSnapshotRecord(s));
      added.push(s);
      if (c) {
        c.signalIds.push(s.id);
        c.newSignalCount += 1;
        recomputeFigures(d, c);
        d.clusters.find((cl) => cl.caseId === c.id)?.signalIds.push(s.id);
        for (const uid of new Set([c.ownerId, ...c.watcherIds])) {
          notify({ userId: uid, kind: "new_signals", title: "New signal", body: `${s.summary} → ${c.id}`, link: `/cases/${c.id}`, actorId: "agent:clusterer" });
          notes++;
        }
      }
    }
    const runId = nextId("RUN-live-", d.agentRuns, 2);
    audit({ actorId: "agent:fetcher", action: "signals.fetched", objectType: "signal", objectId: runId, after: { newSignals: added.length }, rationale: `Refresh by ${user.id}` });

    // Impact: every competitor fact with a metric is matched against targets across the portfolio.
    const facts = added.filter((s) => s.kind === "competitor_fact" && s.metric);
    const notesBefore = d.notifications.length;
    const ripples = facts.map((s) => assessFact(d, s, runId)).filter((r): r is NonNullable<typeof r> => !!r);
    notes += d.notifications.length - notesBefore;
    const active = ripples.filter((r) => r.status === "active");
    const affected = active.flatMap((r) => r.items);
    const seriesOf = (rows: string[]) => new Set(rows.map((x) => (x === "G60_CN" ? "G60" : x)));
    const rowsOf = (rp: (typeof ripples)[number]) => [...new Set(rp.items.flatMap((i) => [i.row, ...i.alsoRows]))];
    const steps = [
      { name: "Fetch", status: "ok" as const, detail: added.length ? `${added.length} new records from ${new Set(added.map((s) => s.sourceName)).size} sources (deduped by URL and content hash)` : "No new records: all URLs already seen" },
      { name: "Classify", status: added.length ? ("ok" as const) : ("skipped" as const), detail: `${added.length} signals mapped onto the fixed taxonomy (${WEB_CLASSIFIER.promptVersion}, scripted in the demo)` },
      {
        name: "Gate",
        status: added.length ? ("ok" as const) : ("skipped" as const),
        detail: `${added.length} passed (quote in stored snapshot, dated); ${facts.filter((s) => s.trust === "D" || s.trust === "E").length} low-trust competitor facts → watch list only`,
      },
      { name: "Match metrics", status: facts.length ? ("ok" as const) : ("skipped" as const), detail: facts.length ? `${facts.length} competitor facts with a metric matched against ${ripples.reduce((n, r) => n + r.items.length, 0)} requirement targets` : "No competitor fact with a metric" },
      {
        name: "Assess impact",
        status: ripples.length ? ("ok" as const) : ("skipped" as const),
        detail: active.length
          ? `${affected.length} items in ${seriesOf(active.flatMap(rowsOf)).size} series: ${["behind", "at_par", "still_ahead", "not_comparable"].map((v) => `${affected.filter((i) => i.verdict === v).length} ${v.replace("_", " ")}`).join(", ")}`
          : ripples.length
            ? "Low-trust facts only: listed on the watch list"
            : "Nothing affected",
      },
    ];
    const run = {
      id: runId,
      agent: "competitor" as const,
      series: body.series,
      startedAt,
      endedAt: now(),
      status: "ok" as const,
      valid: added.length,
      rejected: added.length ? 1 : 0,
      newSignals: added.length,
      llmCostUsd: Math.round((0.3 + added.length * 0.08) * 100) / 100,
      note: added.length ? `Watchlist run triggered by ${user.name}` : "No new findings: all URLs already seen (dedupe by URL and content hash)",
      steps,
      rippleId: active[0]?.id ?? null,
    };
    d.agentRuns.push(run);
    return {
      run,
      signals: added,
      notifications: notes,
      ripples: ripples.map((rp) => ({
        id: rp.id,
        status: rp.status,
        items: rp.items.length,
        rows: rowsOf(rp).length,
        summary: `${rp.fact.competitor} ${rp.fact.value} ${rp.fact.unit} ${rp.fact.cycle} affects ${rp.items.length} items in ${seriesOf(rowsOf(rp)).size} series${rp.status === "watch" ? " (watch list only)" : ""}`,
      })),
    };
  },
  quarantine: () => db().quarantine,

  // Cases
  cases: ({ query }) =>
    db().cases.filter(
      (c) =>
        (!query.series || c.series === query.series || c.relatedSeries.includes(query.series)) &&
        (!query.ownerId || c.ownerId === query.ownerId || c.coOwnerIds.includes(query.ownerId)) &&
        (!query.state || c.state === query.state) &&
        (!query.scope || c.scope === query.scope),
    ),
  createCase: ({ body, user }) => {
    const d = db();
    const picked = d.signals.filter((s) => body.signalIds.includes(s.id));
    if (!picked.length && (!body.topicId || !body.aspectGroup)) throw new ApiError(400, "A case started by hand needs a topic and an aspect of the fixed taxonomy.");
    const topicId = picked.length ? mostFrequentTopic(picked) : body.topicId!;
    const topic = (taxonomyData as TaxonomyResponse).topics.find((t) => t.id === topicId);
    if (!picked.length && !topic) throw new ApiError(400, `${body.topicId} is not a topic of the fixed taxonomy.`);
    // The car area always follows from the topic (signals without a topic keep their own area).
    const carArea: Case["carArea"] = topic?.carArea ?? picked[0]?.carArea ?? "quality_materials";
    const aspectGroup = picked.length ? (picked.find((s) => s.topicId === topicId)?.aspectGroup ?? picked[0].aspectGroup) : body.aspectGroup!;
    const prefix = `CASE-${body.series}-${body.scope === "CN" ? "CN-" : ""}`;
    const id = nextId(prefix, d.cases.filter((c) => (body.scope === "CN" ? c.id.includes("-CN-") : !c.id.includes("-CN-"))));
    const c: Case = {
      id,
      title: body.title,
      shortTitle: shortFromTitle(body.title),
      summary: body.summary,
      series: body.series,
      relatedSeries: [],
      scope: body.scope,
      ownerId: user.id,
      coOwnerIds: [],
      watcherIds: [],
      state: "new",
      outcome: null,
      markets: [],
      carArea,
      type: body.type,
      changeDepth: body.changeDepth,
      featureName: topic?.shortLabel ?? body.title,
      highlights: [body.summary],
      topicId,
      aspectGroup,
      stances: [],
      bodyMd: `## Problem\n\n${body.summary}\n\n## Who is affected\n\n_To fill._\n\n## Evidence summary\n\n${body.signalIds.length ? `${body.signalIds.length} signals selected on the radar.` : "_Started by hand. Add evidence: files, links or notes._"}\n\n## Today's car\n\n_To fill._\n\n## Competitors\n\n_To fill._\n\n## Brand fit\n\n_AI proposal pending._\n\n## Options considered\n\n_None yet._\n\n## Decision log\n\n- ${now().slice(0, 10)} · Case opened by ${user.name}: ${body.rationale}`,
      bodyVersion: 1,
      signalIds: body.signalIds,
      figures: { perMarket: [], equipmentToday: "To check against the option list", competitorOffer: [], trend: "" },
      marketConflict: null,
      brandFit: { value: 0.5, reason: "Not assessed yet.", confirmedBy: null },
      factors: { customers: 0, severity: 0.5, satisfaction_gap: 0.3, competitor_gap: 0.3, market_volume: 0.3, regression: 0, trend: 0.2, brand_fit: 0.5 },
      evidenceLevel: "low",
      context: { preset: [{ kind: "brand", label: `BMW brand profile v${d.brandProfile.version}`, detail: d.brandProfile.pillars.map((p) => p.name).join(" · "), ref: "brand-profile" }], pmInputs: [] },
      originCaseId: null,
      mergedInto: null,
      requirementIds: [],
      manualRank: null,
      newSignalCount: 0,
      createdAt: now(),
      createdBy: user.id,
      updatedAt: now(),
      synthetic: true,
    };
    for (const sid of body.signalIds) {
      const s = d.signals.find((x) => x.id === sid);
      if (s && !s.caseId) {
        s.caseId = id;
        s.status = "clustered";
      }
    }
    d.cases.push(c);
    recomputeFigures(d, c);
    d.clusters.push({ id: `CL-${id}`, label: c.title, series: c.series, carArea: c.carArea, size: c.signalIds.length, sentiment: 0, markets: {}, caseId: id, signalIds: c.signalIds });
    audit({ actorId: user.id, action: "case.created", objectType: "case", objectId: id, after: { title: c.title, signals: c.signalIds.length }, rationale: body.rationale });
    return c;
  },
  addCaseEvidence: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    assertCaseEditor(user, c);
    const severity = { complaint: "difficult_to_use", wish: "wish" } as Partial<Record<Signal["kind"], Signal["severity"]>>;
    const sourceType = { csv_row: "pm_upload", link: "pm_link", note: "pm_note" } as const;
    // Trust: a PM's file is first-hand data (C), a link is unverified web (D), a note is an assumption (E).
    const trust = { csv_row: "C", link: "D", note: "E" } as const;
    const host = (url?: string) => {
      try {
        return url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
      } catch {
        return undefined;
      }
    };
    const added: Signal[] = body.items.map((it, i) => {
      const s: Signal = {
        id: nextId("SIG-PM-", d.signals),
        kind: it.kind,
        severity: severity[it.kind] ?? "none",
        agent: "pm",
        sourceType: sourceType[it.type],
        sourceName: it.type === "csv_row" ? (it.source ?? "Uploaded file") : it.type === "link" ? (host(it.url) ?? "Link") : user.name,
        trust: trust[it.type],
        url: it.url || undefined,
        recordRef: `pm:${it.type === "csv_row" ? `${it.source ?? "upload"}#row${i + 1}` : it.type}@${nextId("SIG-PM-", d.signals)}`,
        publishedAt: now(),
        fetchedAt: now(),
        series: c.series,
        vehicleRole: "current",
        powertrain: "unknown",
        market: it.market,
        marketBasis: it.market === "unknown" ? "unknown" : "stated",
        carArea: c.carArea,
        topicId: c.topicId,
        aspectGroup: c.aspectGroup ?? null,
        featureHint: c.featureName,
        summary: it.title?.trim() || it.text.slice(0, 140),
        quote: it.text,
        language: "en",
        audience: it.type === "link" ? "public" : "owner",
        caseId: c.id,
        status: "clustered",
        classification: { method: "manual", label: `Added by ${user.name}` },
        synthetic: false,
      };
      // The raw text is kept as the signal's source record, so the quote can be checked like any other.
      d.sourceRecords.push({ ref: s.recordRef!, sourceName: s.sourceName, url: s.url, text: it.text, sha256: sha256(it.text), fetchedAt: s.fetchedAt, synthetic: false });
      d.signals.push(s);
      c.signalIds.push(s.id);
      return s;
    });
    recomputeFigures(d, c);
    touch(c);
    audit({ actorId: user.id, action: "case.evidence_added", objectType: "case", objectId: c.id, after: { signals: added.map((s) => s.id) }, rationale: body.rationale });
    return { case: c, added };
  },
  caseBundle: ({ params }) => {
    const d = db();
    const c = findCase(d, params.id);
    const reqs = d.requirements.filter((r) => r.caseId === c.id);
    const reqIds = new Set(reqs.map((r) => r.id));
    const linkedIds = new Set<string>([
      ...(c.originCaseId ? [c.originCaseId] : []),
      ...(c.mergedInto ? [c.mergedInto] : []),
      ...d.cases.filter((x) => x.originCaseId === c.id || x.mergedInto === c.id).map((x) => x.id),
      ...d.referrals.filter((r) => r.caseId === c.id && r.linkedCaseId).map((r) => r.linkedCaseId!),
    ]);
    return {
      case: c,
      signals: caseSignals(d, c),
      questions: d.questions.filter((q) => (q.objectType === "case" && q.objectId === c.id) || (q.objectType === "requirement" && reqIds.has(q.objectId))),
      requirements: reqs,
      referrals: d.referrals.filter((r) => r.caseId === c.id || r.linkedCaseId === c.id),
      alerts: d.alerts.filter((a) => a.caseId === c.id || (a.requirementId && reqIds.has(a.requirementId))),
      meetingNotes: d.meetingNotes.filter((n) => n.caseId === c.id),
      proposals: d.proposals.filter((p) => p.objectId === c.id || reqIds.has(p.objectId)),
      linkedCases: d.cases.filter((x) => linkedIds.has(x.id)),
    };
  },
  patchCase: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const onlyWatch = Object.keys(body.patch).every((k) => k === "watcherIds");
    if (!onlyWatch) assertCaseEditor(user, c);
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(body.patch) as (keyof typeof body.patch)[]) before[k] = structuredClone(c[k]);
    Object.assign(c, body.patch);
    if (body.patch.bodyMd !== undefined) c.bodyVersion += 1;
    if (body.patch.brandFit) c.factors.brand_fit = body.patch.brandFit.value;
    touch(c);
    const rankChanging = body.patch.manualRank !== undefined || body.patch.brandFit !== undefined;
    audit({
      actorId: user.id,
      action: onlyWatch ? "case.watch_changed" : "case.edited",
      objectType: "case",
      objectId: c.id,
      before,
      after: body.patch,
      rationale: body.rationale,
      scoreSnapshot: rankChanging ? scoreSnapshotNow(d, c.id, profileOf(d, user.id)) : undefined,
    });
    return c;
  },
  transitionCase: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    if (body.action === "refer" && body.escalate) {
      // Anyone involved may escalate a conflict to the head of product line.
      const ref: Referral = {
        id: nextId("REF-", d.referrals),
        kind: "escalation",
        caseId: c.id,
        fromUserId: user.id,
        toUserId: head(d).id,
        note: body.rationale,
        status: "pending",
        createdAt: now(),
        linkedCaseId: null,
      };
      d.referrals.push(ref);
      audit({ actorId: user.id, action: "escalation.created", objectType: "case", objectId: c.id, after: { to: ref.toUserId }, rationale: body.rationale });
      notify({ userId: ref.toUserId, kind: "escalation", title: `Escalation from ${user.name}`, body: c.title, link: `/cases/${c.id}`, actorId: user.id });
      return c;
    }
    assertCaseEditor(user, c);
    const before = { state: c.state, outcome: c.outcome };
    const stateFor: Partial<Record<typeof body.action, CaseState>> = {
      open: "new",
      start: "investigating",
      await: "awaiting_answers",
      ready: "ready",
      reopen: "investigating",
    };
    if (stateFor[body.action]) {
      c.state = stateFor[body.action]!;
      if (body.action === "reopen") {
        c.outcome = null;
        c.outcomeNote = undefined;
      }
    } else {
      if (c.state === "observed") throw new ApiError(409, "Open the case before deciding it.");
      c.state = "decided";
      c.outcomeNote = body.rationale;
      switch (body.action) {
        case "confirm": {
          // No auto-draft: step 3 asks the shape questions (layer 3) before the drafter runs.
          c.outcome = "confirmed";
          break;
        }
        case "refer": {
          const to = must(d.users.find((u) => u.id === body.toUserId), "Receiver");
          c.outcome = "referred";
          const ref: Referral = { id: nextId("REF-", d.referrals), kind: "referral", caseId: c.id, fromUserId: user.id, toUserId: to.id, note: body.rationale, status: "pending", createdAt: now(), linkedCaseId: null };
          d.referrals.push(ref);
          if (!c.watcherIds.includes(to.id)) c.watcherIds.push(to.id);
          notify({ userId: to.id, kind: "referral", title: `${user.name} referred a case to you`, body: c.title, link: "/inbox", actorId: user.id });
          break;
        }
        case "innovation": {
          c.outcome = "innovation_pool";
          if (!d.innovation.some((m) => m.caseId === c.id))
            d.innovation.push({ caseId: c.id, horizon: body.horizon ?? "next_gen", votes: [user.id], interestedSeries: [c.series], pulledInto: [], pitch: body.rationale });
          break;
        }
        case "park":
          c.outcome = "parked";
          break;
        case "reject":
          c.outcome = "rejected";
          break;
        case "merge": {
          const target = findCase(d, must(body.mergeIntoId, "Merge target"));
          if (target.id === c.id) throw new ApiError(400, "Cannot merge a case into itself.");
          c.outcome = "merged";
          c.mergedInto = target.id;
          for (const sid of c.signalIds) if (!target.signalIds.includes(sid)) target.signalIds.push(sid);
          d.signals.forEach((s) => s.caseId === c.id && (s.caseId = target.id));
          recomputeFigures(d, target);
          touch(target);
          if (target.ownerId !== user.id) notify({ userId: target.ownerId, kind: "new_signals", title: `${user.name} merged a case into yours`, body: `${c.id} → ${target.id}`, link: `/cases/${target.id}`, actorId: user.id });
          break;
        }
      }
    }
    c.bodyMd = c.bodyMd.replace("## Decision log", `## Decision log\n\n- ${now().slice(0, 10)} · ${user.name}: ${body.action} (${body.rationale})`).replace("\n\n_No decisions yet._", "");
    touch(c);
    audit({
      actorId: user.id,
      action: c.state === "decided" && !stateFor[body.action] ? "case.decided" : "case.state_changed",
      objectType: "case",
      objectId: c.id,
      before,
      after: { state: c.state, outcome: c.outcome, mergedInto: c.mergedInto ?? undefined },
      rationale: body.rationale,
      scoreSnapshot: body.action === "confirm" ? scoreSnapshotNow(d, c.id, profileOf(d, user.id)) : undefined,
    });
    return c;
  },
  createQuestion: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const q: OpenQuestion = {
      id: nextId("Q-", d.questions),
      objectType: "case",
      objectId: c.id,
      addressee: body.addressee,
      contact: body.contact,
      question: body.question,
      why: body.why,
      status: "open",
      dueDate: body.dueDate,
      askedBy: user.id,
      createdAt: now(),
      fieldsAffected: body.fieldsAffected ?? [],
    };
    d.questions.push(q);
    if (c.state === "investigating" || c.state === "new") {
      // Not an automatic status change: the PM moves the card. We only log the question.
    }
    audit({ actorId: user.id, action: "question.created", objectType: "case", objectId: c.id, after: { question: q.question, addressee: q.addressee } });
    return q;
  },
  addMeetingNote: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const note = { id: nextId("MN-", d.meetingNotes), caseId: c.id, title: body.title, date: body.date, attendees: body.attendees, text: body.text, createdBy: user.id, proposalIds: [] as string[] };
    const qs = d.questions.filter((q) => q.objectId === c.id || c.requirementIds.includes(q.objectId));
    const drafts = extractFromNote(c, qs, d.requirements, body.text);
    const proposals = saveProposals(d, drafts);
    note.proposalIds = proposals.map((p) => p.id);
    d.meetingNotes.push(note);
    c.context.pmInputs.push({ kind: "meeting", label: body.title, detail: `${body.attendees.length} attendees · ${proposals.length} AI proposals`, at: now(), ref: note.id });
    touch(c);
    audit({ actorId: user.id, action: "meeting_note.added", objectType: "case", objectId: c.id, after: { noteId: note.id } });
    if (proposals.length) audit({ actorId: "agent:note_extractor", action: "proposal.created", objectType: "case", objectId: c.id, after: { count: proposals.length }, rationale: "Extracted from meeting note" });
    return { note, proposals };
  },
  saveCaseStance: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    assertCanDraft(user, c);
    const before = stanceOf(c, user.id);
    for (const k of Object.keys(body.overrides) as BriefFieldKey[])
      if ((body.overrides as Record<string, unknown>)[k] !== undefined && !body.overrideReasons[k]) throw new ApiError(400, `Say why this case differs from your product specs (${briefFieldLabel[k].toLowerCase()}).`);
    const stance = { ...body, authorId: user.id, pendingShape: before?.pendingShape ?? [], updatedAt: now() };
    c.stances = [...c.stances.filter((s) => s.authorId !== user.id), stance];
    const parts = [
      stance.ambition && `ambition ${stance.ambition}`,
      ...Object.keys(stance.overrides).map((k) => `overrides ${briefFieldLabel[k as BriefFieldKey].toLowerCase()}`),
      ...stance.evidenceTakes.map((t) => `${t.effect}: ${t.text}`),
      ...stance.inside.map((x) => x.text),
    ].filter(Boolean);
    c.context.pmInputs = c.context.pmInputs.filter((i) => i.ref !== `stance-${user.id}`);
    c.context.pmInputs.push({ kind: "note", label: `${user.name}'s context`, detail: parts.join(" · ") || "No changes to the product specs", at: now(), ref: `stance-${user.id}` });
    touch(c);
    audit({
      actorId: user.id,
      action: "case.stance_saved",
      objectType: "case",
      objectId: c.id,
      before: before ? { ambition: before.ambition, overrides: before.overrides } : undefined,
      after: { ambition: stance.ambition, overrides: stance.overrides, takes: stance.evidenceTakes.length, inside: stance.inside.length },
      rationale: Object.values(stance.overrideReasons).filter(Boolean).join(" · ") || "Context saved",
    });
    const message: ChatMessage = {
      id: nextId("MSG-", d.messages),
      objectType: "case",
      objectId: c.id,
      role: "assistant",
      content: followUpQuestions(d, c, user.id),
      citations: [],
      proposalIds: [],
      createdAt: now(),
    };
    d.messages.push(message);
    return { case: c, message };
  },
  shapeQuestions: ({ params, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const input = buildInput(d, c, user);
    const region = regionOf(d, c, user);
    const global = d.requirements.find((r) => r.caseId === c.id && r.marketScope === "global" && r.status !== "rejected" && r.ownerId !== user.id);
    return { questions: getDrafter().shapeQuestions(input), brief: input.brief, stance: input.stance, variantOf: region !== "global" && global ? global.id : null };
  },
  askShapeQuestions: ({ params, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const questions = getDrafter().shapeQuestions(buildInput(d, c, user));
    const message: ChatMessage = {
      id: nextId("MSG-", d.messages),
      objectType: "case",
      objectId: c.id,
      role: "assistant",
      content: shapeQuestionsMessage(questions, c.signalIds.length),
      citations: [],
      proposalIds: [],
      createdAt: now(),
    };
    d.messages.push(message);
    audit({ actorId: "agent:drafter", action: "requirement.shape_asked", objectType: "case", objectId: c.id, after: { questions: questions.map((q) => q.key), for: user.id } });
    return message;
  },
  generateRequirements: async ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    assertCanDraft(user, c);
    if (c.outcome !== "confirmed") throw new ApiError(409, "Requirements are generated only from confirmed cases.");
    const input = buildInput(d, c, user, { answers: (body.answers ?? []).map((a) => ({ ...a, byDefault: false })) });
    const out = await getDrafter().draft(input);
    const created = out.drafts.map((draft) => {
      const variantOf = draft.marketScope !== "global" ? (input.siblings.find((r) => r.marketScope === "global")?.id ?? null) : null;
      return createRequirement(d, c, draft, user.id, { ownerId: canEditCase(user, c) && user.role !== "head" ? user.id : user.role === "head" ? c.ownerId : user.id, briefId: input.briefId, drafter: out.drafter, variantOf });
    });
    for (const r of created) {
      audit({
        actorId: user.id,
        action: "requirement.shape_answered",
        objectType: "requirement",
        objectId: r.id,
        after: Object.fromEntries(r.shapeAnswers.map((a) => [a.key, `${a.value}${a.byDefault ? " (default)" : ""}`])),
        rationale: r.shapeAnswers.length ? r.shapeAnswers.map((a) => `${shapeKeyLabel[a.key]}: ${a.value}`).join(" · ") : "No shape questions for this case",
      });
    }
    // The chat answers were used; clear them.
    const stance = stanceOf(c, user.id);
    if (stance) stance.pendingShape = [];
    return created;
  },
  exportCaseMd: ({ params, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    const signals = caseSignals(d, c);
    const front = {
      id: c.id,
      title: c.title,
      series: c.series,
      scope: c.scope,
      state: c.state,
      outcome: c.outcome,
      owner: userName(d, c.ownerId),
      markets: c.markets,
      car_area: c.carArea,
      type: c.type,
      change_depth: c.changeDepth,
      evidence_level: c.evidenceLevel,
      brand_fit: c.brandFit,
      factors: c.factors,
      requirements: c.requirementIds,
      signals: signals.map((s) => ({ id: s.id, source: s.sourceName, market: s.market, ref: s.recordRef ?? s.url, synthetic: s.synthetic })),
      exported_at: now(),
      synthetic: c.synthetic,
    };
    audit({ actorId: user.id, action: "case.exported_md", objectType: "case", objectId: c.id });
    return { filename: `${c.id}.md`, content: `---\n${toYaml(front)}---\n\n# ${c.title}\n\n${c.bodyMd}\n` };
  },
  caseSegments: ({ params }) => {
    const d = db();
    return caseSegments(d, findCase(d, params.id));
  },

  // Questions
  questions: ({ query, user }) => {
    const d = db();
    if (query.all) return d.questions;
    const mine = new Set([...d.cases.filter((c) => canEditCase(user, c) && user.role !== "head").map((c) => c.id), ...d.requirements.filter((r) => r.ownerId === user.id).map((r) => r.id)]);
    return d.questions.filter((q) => q.askedBy === user.id || mine.has(q.objectId));
  },
  patchQuestion: ({ params, body, user }) => {
    const d = db();
    const q = must(d.questions.find((x) => x.id === params.id), "Question");
    const before = structuredClone(q);
    Object.assign(q, body);
    if (body.answer && !body.status) q.status = "answered";
    if (q.status === "answered" && before.status !== "answered") {
      q.answeredAt = now();
      q.answerSource = q.answerSource ?? "manual";
      const c = d.cases.find((x) => x.id === q.objectId);
      c?.context.pmInputs.push({ kind: "answer", label: `${q.addressee} answered`, detail: q.answer ?? "", at: now(), ref: q.id });
    }
    audit({ actorId: user.id, action: q.status === "answered" && before.status !== "answered" ? "question.answered" : "question.edited", objectType: "question", objectId: q.id, before, after: q });
    return q;
  },

  // Requirements
  requirements: ({ query }) => db().requirements.filter((r) => (!query.series || r.series === query.series) && (!query.caseId || r.caseId === query.caseId)),
  requirementBundle: ({ params }) => {
    const d = db();
    const r = findReq(d, params.id);
    const c = findCase(d, r.caseId);
    const plan = d.plans.find((p) => p.series === r.series);
    return {
      requirement: r,
      case: c,
      signals: caseSignals(d, c),
      questions: d.questions.filter((q) => q.objectId === r.id || q.objectId === c.id),
      variants: d.requirements.filter((x) => x.id !== r.id && (x.variantOf === r.id || r.variantOf === x.id || x.caseId === r.caseId)),
      alerts: d.alerts.filter((a) => a.requirementId === r.id),
      proposals: d.proposals.filter((p) => p.objectId === r.id),
      plannedFeature: plan?.features.find((f) => f.id === r.plannedFeatureId) ?? null,
      check: currentCheck(d, r),
      versions: d.requirementVersions.filter((v) => v.requirementId === r.id).sort((a, b) => b.version - a.version),
      feedback: d.feedback.filter((f) => f.requirementId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      brief: r.briefId ? (d.briefs.find((b) => b.id === r.briefId) ?? null) : null,
    };
  },
  patchRequirement: ({ params, body, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    assertReqEditor(user, r);
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(body.patch) as (keyof typeof body.patch)[]) before[k] = structuredClone(r[k]);
    audit({ actorId: user.id, action: "requirement.edited", objectType: "requirement", objectId: r.id, before, after: body.patch, rationale: body.rationale });
    // Classification and the argument sheet live outside the versioned snapshot.
    const { manualRank, carArea, changeDepth, argumentMd, ...versioned } = body.patch;
    if (manualRank !== undefined) r.manualRank = manualRank;
    if (carArea !== undefined) r.carArea = carArea;
    if (changeDepth !== undefined) r.changeDepth = changeDepth;
    if (argumentMd !== undefined) r.argumentMd = argumentMd;
    if (!Object.keys(versioned).length) return touch(r);
    const next = { ...snapshotOf(r), ...versioned } as RequirementSnapshot;
    if (versioned.description !== undefined) next.descriptionParts = sentences(versioned.description);
    next.provenance = retagEdits(snapshotOf(r), next, body.rationale);
    applyVersion(d, r, RequirementSnapshot.parse(next), "edit", user.id, body.rationale);
    maybeLearnCost(d, user);
    return r;
  },
  addFeedback: async ({ params, body, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    assertReqEditor(user, r);
    const fb: FeedbackEntry = {
      id: nextId("FB-", d.feedback),
      requirementId: r.id,
      from: body.from,
      text: body.text,
      response: body.response,
      pmRationale: body.rationale,
      signalIds: body.signalIds ?? [],
      proposalId: null,
      resultingVersion: null,
      createdAt: now(),
      createdBy: user.id,
    };
    d.feedback.push(fb);
    const current = snapshotOf(r);
    // Composer-made requirements are redrafted with the feedback layer; hand-written ones get a minimal patch.
    const draft = r.drafter?.startsWith("composer") ? (await redraft(d, r, { extraFeedback: fb })).draft : feedbackPatch(current, fb);
    const summary = `v${r.version + 1}: ${changeSummary(current, draft)} (${addresseeLabel[fb.from].toLowerCase()} feedback, you ${feedbackResponseLabel[fb.response].toLowerCase()})`;
    const [p] = saveProposals(d, [{ objectType: "requirement", objectId: r.id, source: "feedback", kind: "new_version", summary, changes: [{ field: "version", before: current, after: draft }], citations: fb.signalIds }]);
    fb.proposalId = p.id;
    const c = findCase(d, r.caseId);
    c.context.pmInputs.push({ kind: "answer", label: `${addresseeLabel[fb.from]} feedback on ${r.id}`, detail: `"${fb.text}" → you ${feedbackResponseLabel[fb.response].toLowerCase()}: ${fb.pmRationale}`, at: now(), ref: fb.id });
    audit({ actorId: user.id, action: "requirement.feedback_recorded", objectType: "requirement", objectId: r.id, after: { feedbackId: fb.id, from: fb.from, response: fb.response }, rationale: fb.pmRationale });
    audit({ actorId: "agent:drafter", action: "proposal.created", objectType: "requirement", objectId: r.id, after: { proposalId: p.id, kind: "new_version" }, rationale: summary });
    return { feedback: fb, proposal: p };
  },
  runRequirementCheck: async ({ params, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    return saveCheck(await checkRequirement(d, r, now(), true), `Run by ${user.name}`);
  },
  transitionRequirement: ({ params, body, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    const before = r.status;
    const isHead = user.role === "head";
    let openIssues: { red: number; amber: number } | undefined;
    const need = (ok: boolean, msg: string) => {
      if (!ok) throw new ApiError(409, msg);
    };
    switch (body.action) {
      case "discuss":
        assertReqEditor(user, r);
        need(r.status === "draft", "Only drafts go into discussion.");
        r.status = "in_discussion";
        break;
      case "approve":
        assertReqEditor(user, r);
        need(["draft", "in_discussion"].includes(r.status), "Approve from draft or in discussion.");
        r.status = "pm_approved";
        r.sentBackReason = undefined;
        {
          // The quality check warns but never blocks; open issues are logged with the PM's reason.
          const issues = currentCheck(d, r).issues;
          const red = issues.filter((i) => i.severity === "red").length;
          if (issues.length) openIssues = { red, amber: issues.length - red };
        }
        notify({ userId: head(d).id, kind: "sign_off_request", title: "Sign-off requested", body: `${r.id} · ${r.title}`, link: `/requirements/${r.id}`, actorId: user.id });
        break;
      case "send_back":
        need(isHead, "Only the head of product line sends back.");
        need(r.status === "pm_approved", "Only PM-approved requirements can be sent back.");
        r.status = "in_discussion";
        r.sentBackReason = body.rationale;
        notify({ userId: r.ownerId, kind: "sent_back", title: `${user.name} sent a requirement back`, body: `${r.id}: ${body.rationale}`, link: `/requirements/${r.id}`, actorId: user.id });
        break;
      case "sign_off":
        need(isHead, "Only the head of product line signs off.");
        need(r.status === "pm_approved", "Sign off PM-approved requirements only.");
        r.status = "signed_off";
        notify({ userId: r.ownerId, kind: "sign_off_request", title: "Requirement signed off", body: `${r.id} · ${r.title}`, link: `/requirements/${r.id}`, actorId: user.id });
        break;
      case "plan": {
        need(r.ownerId === user.id || isHead, "Only the owner plans a requirement.");
        need(r.status === "signed_off", "Plan signed-off requirements only.");
        r.status = "planned";
        const plan = must(d.plans.find((p) => p.series === r.series), "Vehicle plan");
        let f = plan.features.find((x) => x.id === r.plannedFeatureId);
        if (!f) {
          const c = d.cases.find((x) => x.id === r.caseId);
          f = { id: `pf-${r.id.toLowerCase()}`, carArea: r.carArea, name: c?.featureName ?? r.title, today: "absent", todayDetail: c?.figures.equipmentToday ?? "", action: "new", requirementIds: [], release: r.releaseTarget, protected: false, note: "" };
          plan.features.push(f);
          r.plannedFeatureId = f.id;
        }
        if (!f.requirementIds.includes(r.id)) f.requirementIds.push(r.id);
        audit({ actorId: user.id, action: "plan.feature_linked", objectType: "plan", objectId: `${r.series}/${f.id}`, after: { requirementId: r.id } });
        break;
      }
      case "export":
        need(r.status === "planned", "Export planned requirements only.");
        r.status = "exported";
        break;
      case "reject":
        assertReqEditor(user, r);
        r.status = "rejected";
        break;
      case "restore":
        assertReqEditor(user, r);
        need(r.status === "rejected", "Only rejected requirements can be restored.");
        r.status = "draft";
        break;
    }
    touch(r);
    audit({
      actorId: user.id,
      action: "requirement.status_changed",
      objectType: "requirement",
      objectId: r.id,
      before: { status: before, costSize: r.cost.size },
      after: { status: r.status, ...(openIssues && { openIssues }) },
      rationale: body.rationale,
      scoreSnapshot: body.action === "sign_off" || body.action === "approve" ? scoreSnapshotNow(d, r.caseId, profileOf(d, user.id)) : undefined,
    });
    if (body.action === "reject") maybeLearnCost(d, user);
    return r;
  },

  // Scoring
  scores: ({ query, user }) => {
    const d = db();
    const profile = query.profileId ? must(d.weightProfiles.find((p) => p.id === query.profileId), "Weight profile") : profileOf(d, user.id);
    return computeScores(d, profile, query.series);
  },
  previewScores: ({ body, user }) => {
    const d = db();
    const base = profileOf(d, user.id);
    return computeScores(d, { id: "preview", weights: { ...base.weights, ...body.weights }, costMultiplier: base.costMultiplier }, body.series);
  },
  weightProfiles: () => db().weightProfiles,
  saveWeightProfile: ({ params, body, user }) => {
    const d = db();
    const p = must(d.weightProfiles.find((x) => x.id === params.id), "Weight profile");
    if (p.ownerId ? p.ownerId !== user.id : user.role !== "head") throw new ApiError(403, p.ownerId ? "Only the owner edits this profile." : "Default profiles are owned by the head of product line. Save a copy instead.");
    const before = structuredClone(p);
    Object.assign(p, body, { id: p.id });
    audit({ actorId: user.id, action: "weight_profile.updated", objectType: "profile", objectId: p.id, before: before.weights, after: p.weights });
    return p;
  },
  createWeightProfile: ({ body, user }) => {
    const d = db();
    const p = { ...body, id: nextId("wp-", d.weightProfiles, 3), ownerId: user.id, isDefault: false };
    d.weightProfiles.push(p);
    audit({ actorId: user.id, action: "weight_profile.created", objectType: "profile", objectId: p.id, after: p.weights });
    return p;
  },
  brandProfile: () => db().brandProfile,
  saveBrandProfile: ({ body, user }) => {
    const d = db();
    if (user.role !== "head") throw new ApiError(403, "Only the head of product line edits the brand profile.");
    const before = d.brandProfile.version;
    d.brandProfile = { ...body, version: before + 1, updatedAt: now(), updatedBy: user.id };
    audit({ actorId: user.id, action: "brand_profile.updated", objectType: "profile", objectId: "brand-profile", before: { version: before }, after: { version: before + 1 } });
    return d.brandProfile;
  },

  // Routing
  referrals: ({ user }) => {
    const d = db();
    return d.referrals
      .filter((r) => user.role === "head" || r.toUserId === user.id || r.fromUserId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  decideReferral: ({ params, body, user }) => {
    const d = db();
    const r = must(d.referrals.find((x) => x.id === params.id), "Referral");
    const c = findCase(d, r.caseId);
    const isReceiver = r.toUserId === user.id || (r.kind === "escalation" && user.role === "head");
    switch (body.decision) {
      case "accept": {
        if (!isReceiver) throw new ApiError(403, "Only the receiver accepts a referral.");
        if (r.status !== "pending") throw new ApiError(409, "Referral is not pending.");
        const linked = linkedCaseFor(d, c, user, user.role === "attribute_pm" ? c.series : user.series[0], body.rationale);
        r.status = "accepted";
        r.linkedCaseId = linked.id;
        r.decidedAt = now();
        notify({ userId: r.fromUserId, kind: "referral", title: `${user.name} accepted your referral`, body: `${c.title} → ${linked.id}`, link: `/cases/${linked.id}`, actorId: user.id });
        break;
      }
      case "decline": {
        if (!isReceiver) throw new ApiError(403, "Only the receiver declines a referral.");
        r.status = "declined";
        r.declineReason = body.rationale;
        r.decidedAt = now();
        c.state = "ready";
        c.outcome = null;
        touch(c);
        notify({ userId: r.fromUserId, kind: "referral", title: `${user.name} declined your referral`, body: body.rationale, link: `/cases/${c.id}`, actorId: user.id });
        break;
      }
      case "escalate": {
        r.status = "escalated";
        const esc: Referral = { id: nextId("REF-", d.referrals), kind: "escalation", caseId: c.id, fromUserId: user.id, toUserId: head(d).id, note: `Referral ${r.id} contested: ${body.rationale}`, status: "pending", createdAt: now(), linkedCaseId: null };
        d.referrals.push(esc);
        notify({ userId: esc.toUserId, kind: "escalation", title: `Escalation from ${user.name}`, body: c.title, link: `/cases/${c.id}`, actorId: user.id });
        break;
      }
      case "resolve": {
        if (user.role !== "head") throw new ApiError(403, "Only the head of product line resolves escalations.");
        r.status = "resolved";
        r.resolution = `${body.resolution ?? "decided"}: ${body.rationale}`;
        r.decidedAt = now();
        const label = { one_market: "Prioritize one market", variant: "Build a market variant", keep_both: "Keep both open", take_over: "Head takes over", return: "Return to owner" }[body.resolution ?? "return"];
        c.context.pmInputs.push({ kind: "note", label: `Head decision: ${label}`, detail: body.rationale, at: now(), ref: r.id });
        if (c.marketConflict) c.marketConflict = { ...c.marketConflict, note: `${c.marketConflict.note} → Decision (${userName(d, user.id)}): ${label}. ${body.rationale}` };
        c.bodyMd = c.bodyMd.replace("## Decision log", `## Decision log\n\n- ${now().slice(0, 10)} · Head of product line: ${label} (${body.rationale})`);
        touch(c);
        for (const uid of new Set([r.fromUserId, c.ownerId, ...c.watcherIds]))
          if (uid !== user.id) notify({ userId: uid, kind: "escalation", title: `Escalation resolved: ${label}`, body: c.title, link: `/cases/${c.id}`, actorId: user.id });
        break;
      }
    }
    audit({ actorId: user.id, action: `${r.kind}.${body.decision}`, objectType: "referral", objectId: r.id, after: { status: r.status, linkedCaseId: r.linkedCaseId, resolution: body.resolution }, rationale: body.rationale });
    return r;
  },
  innovation: () => {
    const d = db();
    return d.innovation.map((meta) => ({ meta, case: findCase(d, meta.caseId) })).sort((a, b) => b.meta.votes.length - a.meta.votes.length);
  },
  voteInnovation: ({ params, user }) => {
    const d = db();
    const meta = must(d.innovation.find((m) => m.caseId === params.caseId), "Innovation item");
    meta.votes = meta.votes.includes(user.id) ? meta.votes.filter((v) => v !== user.id) : [...meta.votes, user.id];
    for (const s of user.series) if (!meta.interestedSeries.includes(s) && meta.votes.includes(user.id)) meta.interestedSeries.push(s);
    return meta;
  },
  pullInnovation: ({ params, body, user }) => {
    const d = db();
    const meta = must(d.innovation.find((m) => m.caseId === params.caseId), "Innovation item");
    const source = findCase(d, meta.caseId);
    const linked = linkedCaseFor(d, source, user, body.series, body.rationale);
    meta.pulledInto.push(linked.id);
    if (!meta.interestedSeries.includes(body.series)) meta.interestedSeries.push(body.series);
    notify({ userId: source.ownerId, kind: "referral", title: `${user.name} pulled an innovation into ${body.series}`, body: source.title, link: `/cases/${linked.id}`, actorId: user.id });
    return linked;
  },

  // Plan and export
  plan: ({ params }) => must(db().plans.find((p) => p.series === params.series), `Plan ${params.series}`),
  patchPlanFeature: ({ params, body, user }) => {
    const d = db();
    const plan = must(d.plans.find((p) => p.series === params.series), "Plan");
    if (!plan.ownerIds.includes(user.id) && user.role !== "head") throw new ApiError(403, "Only the series PMs edit the vehicle plan.");
    const f = must(plan.features.find((x) => x.id === params.featureId), "Feature");
    const before = structuredClone(f);
    Object.assign(f, body.patch);
    audit({ actorId: user.id, action: "plan.feature_edited", objectType: "plan", objectId: `${plan.series}/${f.id}`, before, after: f, rationale: body.rationale });
    return plan;
  },
  exportRequirements: ({ body, user }) => {
    const d = db();
    const scores = computeScores(d, profileOf(d, user.id), body.series);
    const rank = new Map(scores.requirements.map((s) => [s.requirementId, s]));
    const list = d.requirements
      .filter((r) => r.series === body.series && (body.requirementIds ? body.requirementIds.includes(r.id) : ["signed_off", "planned", "exported"].includes(r.status)))
      .sort((a, b) => (rank.get(a.id)?.rank ?? 999) - (rank.get(b.id)?.rank ?? 999));
    const rows = list.map((r) => {
      const c = d.cases.find((x) => x.id === r.caseId)!;
      const sigs = caseSignals(d, c).filter((s) => s.sourceType !== "bmw_study").slice(0, 5);
      return {
        ID: r.id,
        Summary: r.title,
        Description: r.description,
        Category: r.carArea,
        Market: r.marketScope,
        Release: r.releaseTarget,
        Priority: rank.get(r.id)?.rank ?? "",
        Score: rank.get(r.id)?.score ?? "",
        "Evidence level": r.evidenceLevel,
        Metrics: r.metrics.map((m) => `${m.question}: ${m.target} (${m.basis})`).join(" | "),
        "Acceptance criteria": r.acceptanceCriteria.join(" | "),
        Assumptions: r.assumptions.join(" | "),
        "Cost size": r.cost.size,
        "Cost band": `${r.cost.eurBand} (${r.cost.source})`,
        "Linked case": c.id,
        "Linked findings": sigs.map((s) => s.id).join(" "),
        Rationale: `${c.summary} Brand fit ${c.brandFit.value}.`,
        Provenance: provenanceLine(r),
        Version: r.version,
        Status: r.status,
      };
    });
    let content: string;
    if (body.format === "json") content = JSON.stringify(rows, null, 2);
    else {
      const cols = rows[0] ? Object.keys(rows[0]) : ["ID"];
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      content = [cols.join(","), ...rows.map((row) => cols.map((k) => esc(row[k as keyof typeof row])).join(","))].join("\n");
    }
    for (const r of list.filter((x) => x.status === "planned")) {
      r.status = "exported";
      touch(r);
      audit({ actorId: user.id, action: "requirement.status_changed", objectType: "requirement", objectId: r.id, before: { status: "planned" }, after: { status: "exported" }, rationale: "Exported to Codebeamer" });
    }
    audit({ actorId: user.id, action: "requirements.exported", objectType: "plan", objectId: body.series, after: { count: rows.length, format: body.format } });
    return { filename: `requirements_${body.series}_${now().slice(0, 10)}.${body.format === "json" ? "json" : "csv"}`, mime: body.format === "json" ? "application/json" : "text/csv", content, count: rows.length };
  },
  requirementDeck: ({ params, user }) => {
    const d = db();
    const series = params.series as Requirement["series"];
    const plan = must(d.plans.find((p) => p.series === series), `Plan ${series}`);
    const profile = profileOf(d, user.id);
    const scores = computeScores(d, profile, series);
    const rank = new Map(scores.requirements.map((s) => [s.requirementId, s]));
    const weightTotal = FactorKeys.options.reduce((s, f) => s + (profile.weights[f] ?? 0), 0) || 1;
    const sev = { defect: 0, difficult_to_use: 1, wish: 2, none: 3 } as const;
    const decisionActions = new Set(["requirement.status_changed", "requirement.edited", "case.decided", "proposal.accepted", "escalation.created", "referral.resolve", "escalation.resolve"]);
    const list = d.requirements
      .filter((r) => r.series === series && ["signed_off", "planned", "exported"].includes(r.status))
      .sort((a, b) => (rank.get(a.id)?.rank ?? 999) - (rank.get(b.id)?.rank ?? 999));
    const slides = list.map((r) => {
      const c = findCase(d, r.caseId);
      const sigs = caseSignals(d, c);
      const quotes = sigs
        .filter((s) => s.sourceType === "bmw_feedback" && s.kind !== "like" && !s.synthetic)
        .sort((a, b) => Number(a.kind !== "complaint") - Number(b.kind !== "complaint") || (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4))
        .slice(0, 3)
        .map((s) => {
          const text = (s.quoteEn ?? s.quote).replace(/\s+/g, " ").trim();
          return { ref: s.id, market: s.market, text: text.length > 240 ? `${text.slice(0, 237).replace(/\s+\S*$/, "")}…` : text };
        });
      const comp = sigs.filter((s) => s.kind === "competitor_fact").slice(0, 3);
      const decisions = d.audit
        .filter((e) => (e.objectId === r.id || e.objectId === c.id) && decisionActions.has(e.action))
        .slice(-5)
        .reverse()
        .map((e) => {
          const after = (e.after ?? {}) as { status?: string; outcome?: string };
          const action = e.action === "requirement.status_changed" ? `${e.objectId}: ${after.status?.replace("_", " ")}` : e.action === "case.decided" ? `${e.objectId}: ${after.outcome}` : `${e.objectId}: ${e.action.split(".").pop()?.replace("_", " ")}`;
          return { at: e.at, actor: e.actorId.startsWith("agent:") ? `AI ${e.actorId.slice(6).replace("_", " ")}` : userName(d, e.actorId), action, rationale: e.rationale };
        });
      const issues = currentCheck(d, r).issues;
      const red = issues.filter((i) => i.severity === "red").length;
      return {
        requirementId: r.id,
        rank: rank.get(r.id)?.rank ?? 0,
        score: rank.get(r.id)?.score ?? 0,
        title: r.title,
        description: r.description,
        status: r.status,
        release: r.releaseTarget,
        marketScope: r.marketScope,
        evidenceLevel: r.evidenceLevel,
        metrics: r.metrics,
        quotes,
        factors: FactorKeys.options.map((f) => {
          const weight = (profile.weights[f] ?? 0) / weightTotal;
          return { factor: f, value: c.factors[f] ?? 0, weight: Math.round(weight * 1000) / 1000, contribution: Math.round(weight * (c.factors[f] ?? 0) * 1000) / 1000 };
        }),
        competitor: comp.length ? comp.map((s) => `${s.competitor ?? s.sourceName}: ${s.summary}`) : c.figures.competitorOffer,
        decisions,
        openIssues: { red, amber: issues.length - red },
        provenance: provenanceCounts(r),
        version: r.version,
        caseId: c.id,
        caseTitle: c.title,
        ownerName: userName(d, r.ownerId),
      };
    });
    audit({ actorId: user.id, action: "requirements.deck_exported", objectType: "plan", objectId: series, after: { count: slides.length, profile: profile.id } });
    return { filename: `engineering-round_${series}_${now().slice(0, 10)}.pptx`, series, successorName: plan.successorName, generatedAt: now(), slides };
  },

  // Conversation
  messages: ({ params }) => db().messages.filter((m) => m.objectType === params.type && m.objectId === params.id),
  postMessage: async ({ params, body, user }) => {
    const d = db();
    const objectType = params.type as "case" | "requirement";
    const r = objectType === "requirement" ? findReq(d, params.id) : undefined;
    const c = findCase(d, r ? r.caseId : params.id);
    const userMsg: ChatMessage = { id: nextId("MSG-", d.messages), objectType, objectId: params.id, role: "user", authorId: user.id, content: body.content, citations: [], proposalIds: [], createdAt: now() };
    d.messages.push(userMsg);

    if (body.segment) {
      const seg = await segmentReply(d, c, objectType, params.id, body.segment);
      if (!seg) throw new ApiError(400, `Unknown segment ${body.segment} for ${c.id}.`);
      const segProposals = saveProposals(d, seg.proposals);
      const segMsg: ChatMessage = { id: nextId("MSG-", d.messages), objectType, objectId: params.id, role: "assistant", content: seg.text, citations: seg.citations, proposalIds: segProposals.map((p) => p.id), createdAt: now() };
      d.messages.push(segMsg);
      audit({ actorId: "agent:segment", action: "segment.asked", objectType, objectId: params.id, after: { segment: body.segment, citations: seg.citations.length }, rationale: body.content });
      return { messages: [userMsg, segMsg], proposals: segProposals };
    }

    // Replies to the shape questions asked in the chat pre-fill the step-3 form (layer 3, the PM's own input).
    const thread = d.messages.filter((m) => m.objectType === "case" && m.objectId === c.id && m.id !== userMsg.id);
    const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
    if (objectType === "case" && lastAssistant?.content.startsWith("Before I draft")) {
      const questions = getDrafter().shapeQuestions(buildInput(d, c, user));
      const text = body.content.toLowerCase();
      const picked = questions
        .map((q) => ({ q, o: q.options.find((o) => text.includes(o.value.replace("_", " ")) || text.includes(o.label.toLowerCase())) }))
        .filter((x): x is { q: (typeof questions)[number]; o: { value: string; label: string } } => !!x.o);
      if (picked.length) {
        let stance = stanceOf(c, user.id);
        if (!stance) {
          stance = { authorId: user.id, overrides: {}, overrideReasons: {}, evidenceTakes: [], inside: [], ambition: null, pendingShape: [], updatedAt: now() };
          c.stances.push(stance);
        }
        stance.pendingShape = [...stance.pendingShape.filter((a) => !picked.some((p) => p.q.key === a.key)), ...picked.map((p) => ({ key: p.q.key, value: p.o.value }))];
        stance.updatedAt = now();
        audit({ actorId: user.id, action: "requirement.shape_answered", objectType: "case", objectId: c.id, after: Object.fromEntries(picked.map((p) => [p.q.key, p.o.value])), rationale: `Answered in the case chat: "${body.content}"` });
        const reply: ChatMessage = {
          id: nextId("MSG-", d.messages),
          objectType,
          objectId: c.id,
          role: "assistant",
          content: `Noted: ${picked.map((p) => `**${shapeKeyLabel[p.q.key]}** → ${p.o.label}`).join(", ")}. The form in step 3 is pre-filled; press **Create requirements** when you're ready.`,
          citations: [],
          proposalIds: [],
          createdAt: now(),
        };
        d.messages.push(reply);
        return { messages: [userMsg, reply], proposals: [] };
      }
    }

    const scripted = scriptedReply(d, { objectType, c, r }, body.content, user.id, now());
    let text = scripted.text;
    let citations = scripted.citations;
    // Live LLM only for free-form questions; proposals and research stay scripted so they keep the contract.
    if (liveChatEnabled() && scripted.proposals.length === 0 && scripted.newSignals.length === 0) {
      const history = d.messages.filter((m) => m.objectType === objectType && m.objectId === params.id && m.id !== userMsg.id);
      const live = await liveReply(c, caseSignals(d, c), history, body.content, r);
      if (live) {
        text = live;
        const ids = [...new Set([...live.matchAll(/\[([A-Z0-9-]+)\]/g)].map((m) => m[1]))];
        citations = ids.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s).map(cite);
      }
    }
    for (const s of scripted.newSignals) {
      d.signals.push(s);
      c.signalIds.push(s.id);
      c.newSignalCount += 1;
    }
    if (scripted.newSignals.length) {
      recomputeFigures(d, c);
      audit({ actorId: "agent:researcher", action: "signals.researched", objectType: "case", objectId: c.id, after: { added: scripted.newSignals.map((s) => s.id) }, rationale: body.content });
    }
    const proposals = saveProposals(d, scripted.proposals);
    const reply: ChatMessage = { id: nextId("MSG-", d.messages), objectType, objectId: params.id, role: "assistant", content: text, citations, proposalIds: proposals.map((p) => p.id), createdAt: now() };
    d.messages.push(reply);
    return { messages: [userMsg, reply], proposals };
  },
  argusAsk: ({ body, user }) => argusReply(db(), body, user, now()),
  decideProposal: ({ params, body, user }) => {
    const d = db();
    const p = must(d.proposals.find((x) => x.id === params.id), "Proposal");
    if (p.status !== "pending") throw new ApiError(409, "Proposal already decided.");
    if (body.decision === "reject") {
      p.status = "rejected";
      if (p.kind === "new_version") {
        const fb = d.feedback.find((f) => f.proposalId === p.id);
        if (fb) fb.resultingVersion = null;
      }
    } else if (p.objectType === "brief") {
      // Strategy-doc extraction or a learning proposal: apply one brief field.
      const b = briefById(d, p.objectId);
      assertBriefEditor(user, b);
      const ch = p.changes[0];
      const field = BriefFieldKeys.parse(ch.field);
      const shared = b.kind === "overlay" ? briefById(d, b.parentId!) : b;
      const differs = JSON.stringify(ch.after) !== JSON.stringify(shared.values[field]);
      if (b.kind === "overlay" && !differs) {
        delete b.values[field];
        delete b.meta[field];
      } else {
        (b.values as Record<string, unknown>)[field] = structuredClone(ch.after);
        b.meta[field] = {
          source: p.source === "strategy_doc" ? "doc" : "pm",
          confirmed: true,
          reason: b.kind === "overlay" ? (p.citations[0] ? `From your strategy doc: "${p.citations[0]}"` : p.summary) : undefined,
          updatedAt: now(),
          updatedBy: user.id,
        };
      }
      b.version += 1;
      touch(b);
      audit({ actorId: user.id, action: "brief.updated", objectType: "brief", objectId: b.id, before: { [field]: ch.before }, after: { [field]: ch.after }, rationale: body.rationale ?? p.summary });
      p.status = "accepted";
    } else if (p.kind === "new_version") {
      const r = findReq(d, p.objectId);
      assertReqEditor(user, r);
      const fb = d.feedback.find((f) => f.proposalId === p.id);
      applyVersion(d, r, RequirementSnapshot.parse(p.changes[0].after), p.source === "brief_change" ? "brief_change" : p.source === "monitor" ? "ripple" : "feedback", user.id, body.rationale ?? p.summary, fb?.id);
      if (fb) fb.resultingVersion = r.version;
      if (p.source === "monitor") resetSignOff(d, r, user, body.rationale ?? p.summary);
      p.status = "accepted";
    } else {
      const target = p.objectType === "case" ? findCase(d, p.objectId) : findReq(d, p.objectId);
      if (p.objectType === "case") assertCaseEditor(user, target as Case);
      else assertReqEditor(user, target as Requirement);
      switch (p.kind) {
        case "field":
        case "body":
          for (const ch of p.changes) (target as unknown as Record<string, unknown>)[ch.field] = structuredClone(ch.after);
          if (p.kind === "body" && "bodyVersion" in target) target.bodyVersion += 1;
          break;
        case "question_answer": {
          const q = must(d.questions.find((x) => x.id === p.questionId), "Question");
          q.status = "answered";
          q.answer = String(p.changes[0]?.after ?? "");
          q.answerSource = p.source === "chat" ? "chat" : "meeting_note";
          q.answeredAt = now();
          break;
        }
        case "new_question": {
          const spec = p.changes[0].after as Pick<OpenQuestion, "addressee" | "question" | "why">;
          d.questions.push({ id: nextId("Q-", d.questions), objectType: p.objectType, objectId: p.objectId, ...spec, status: "open", askedBy: user.id, createdAt: now(), fieldsAffected: [] });
          break;
        }
        case "new_requirement": {
          const c = target as Case;
          createRequirement(d, c, p.changes[0].after as Draft, user.id);
          break;
        }
        default:
          break;
      }
      if ("context" in target) target.context.pmInputs.push({ kind: "diff", label: "AI proposal accepted", detail: p.summary, at: now(), ref: p.id });
      touch(target);
      if (p.source === "monitor" && p.objectType === "requirement" && p.kind === "field") {
        // A competitor-driven change is a new version of the same requirement, with its sign-off reset.
        const r = target as Requirement;
        r.version += 1;
        d.requirementVersions.push({ requirementId: r.id, version: r.version, snapshot: snapshotOf(r), cause: "ripple", rationale: body.rationale ?? p.summary, createdAt: now(), createdBy: user.id });
        audit({ actorId: user.id, action: "requirement.version_created", objectType: "requirement", objectId: r.id, before: { version: r.version - 1 }, after: { version: r.version, cause: "ripple", change: p.summary }, rationale: body.rationale ?? p.summary });
        resetSignOff(d, r, user, p.summary);
      }
      p.status = "accepted";
    }
    p.decidedBy = user.id;
    p.decidedAt = now();
    audit({
      actorId: user.id,
      action: `proposal.${p.status}`,
      objectType: p.objectType,
      objectId: p.objectId,
      before: p.kind === "field" || p.kind === "body" ? Object.fromEntries(p.changes.map((c) => [c.field, c.before])) : undefined,
      after: p.kind === "field" || p.kind === "body" ? Object.fromEntries(p.changes.map((c) => [c.field, c.after])) : p.kind === "new_version" ? { kind: "new_version", summary: p.summary } : p.changes[0]?.after,
      rationale: body.rationale ?? p.summary,
    });
    return p;
  },
  comments: ({ query }) => db().comments.filter((c) => c.objectType === query.objectType && c.objectId === query.objectId),
  addComment: ({ body, user }) => {
    const d = db();
    const mentions = d.users.filter((u) => u.id !== user.id && (body.body.includes(`@${u.name}`) || body.body.includes(`@${u.name.split(" ")[0]}`))).map((u) => u.id);
    const comment = { id: nextId("C-", d.comments), ...body, authorId: user.id, mentions, createdAt: now() };
    d.comments.push(comment);
    const link = `/${body.objectType === "case" ? "cases" : "requirements"}/${body.objectId}`;
    for (const uid of mentions) notify({ userId: uid, kind: "mention", title: `${user.name} mentioned you`, body: body.body.slice(0, 120), link, actorId: user.id });
    audit({ actorId: user.id, action: "comment.added", objectType: body.objectType, objectId: body.objectId, after: { commentId: comment.id, mentions } });
    return comment;
  },

  // Inbox
  notifications: ({ user }) => db().notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  readNotifications: ({ body, user }) => {
    db().notifications.forEach((n) => {
      if (n.userId === user.id && (!body.ids || body.ids.includes(n.id))) n.read = true;
    });
    return { ok: true as const };
  },
  alerts: ({ query, user }) => {
    const d = db();
    return d.alerts.filter((a) => query.all || user.role === "head" || a.ownerId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  resolveAlert: ({ params, body, user }) => {
    const d = db();
    const a = must(d.alerts.find((x) => x.id === params.id), "Alert");
    if (a.ownerId !== user.id && user.role !== "head") throw new ApiError(403, "Only the owning PM resolves an alert.");
    a.status = body.status;
    a.resolution = body.rationale;
    if (body.status === "rework") {
      const r = a.requirementId ? d.requirements.find((x) => x.id === a.requirementId) : undefined;
      if (r && reqOrder.indexOf(r.status) > 1) r.status = "in_discussion";
      const c = a.caseId ? d.cases.find((x) => x.id === a.caseId) : undefined;
      if (c && c.state !== "decided") c.state = "investigating";
    }
    audit({ actorId: user.id, action: `alert.${body.status}`, objectType: a.requirementId ? "requirement" : "case", objectId: a.requirementId ?? a.caseId ?? a.id, after: { alertId: a.id }, rationale: body.rationale });
    return a;
  },

  // Oversight
  audit: ({ query }) => {
    const list = db()
      .audit.filter((e) => (!query.objectId || e.objectId === query.objectId || e.objectId.startsWith(`${query.objectId}/`)) && (!query.actorType || e.actorType === query.actorType))
      .slice()
      .reverse();
    return query.limit ? list.slice(0, query.limit) : list;
  },
  taxonomy: () => taxonomyData as TaxonomyResponse,
  portfolio: () => {
    const d = db();
    const allSeries = ["G60", "F70", "G70"] as const;
    const staleBefore = new Date(new Date(now()).getTime() - 14 * 86400000).toISOString();
    return {
      series: allSeries.map((s) => {
        const cs = d.cases.filter((c) => c.series === s);
        const rs = d.requirements.filter((r) => r.series === s);
        const profile = d.weightProfiles.find((p) => p.isDefault)!;
        const ranked = computeScores(d, profile, s).requirements.slice(0, 5);
        const sales: Record<string, number> = { G60: { EU: 127000, US: 80000, CN: 78000, RoW: 31000 }, F70: { EU: 87000, RoW: 31000 }, G70: { EU: 17000, US: 14000, CN: 12000, RoW: 9000 } }[s];
        return {
          series: s,
          name: { G60: "5 Series", F70: "1 Series", G70: "7 Series" }[s],
          ownerIds: d.plans.find((p) => p.series === s)?.ownerIds ?? [],
          casesByState: Object.fromEntries((["observed", "new", "investigating", "awaiting_answers", "ready", "decided"] as const).map((st) => [st, cs.filter((c) => c.state === st).length])) as Record<CaseState, number>,
          casesByOutcome: cs.reduce<Record<string, number>>((acc, c) => (c.outcome ? { ...acc, [c.outcome]: (acc[c.outcome] ?? 0) + 1 } : acc), {}),
          requirementsByStatus: Object.fromEntries(([...reqOrder, "rejected"] as const).map((st) => [st, rs.filter((r) => r.status === st).length])) as Record<RequirementStatus, number>,
          topRequirements: ranked.map((x) => {
            const r = rs.find((y) => y.id === x.requirementId)!;
            return { id: r.id, title: r.title, score: x.score, status: r.status };
          }),
          staleCases: cs.filter((c) => c.state !== "decided" && c.state !== "observed" && c.updatedAt < staleBefore).length,
          conflicts: cs.filter((c) => c.marketConflict && c.state !== "decided").length,
          openAlerts: d.alerts.filter((a) => a.status === "open" && cs.some((c) => c.id === a.caseId)).length,
          volume2030: sales,
        };
      }),
      workload: d.users
        .filter((u) => u.role !== "head")
        .map((u) => ({
          userId: u.id,
          activeCases: d.cases.filter((c) => c.ownerId === u.id && c.state !== "decided" && c.state !== "observed").length,
          openQuestions: d.questions.filter((q) => q.askedBy === u.id && q.status === "open").length,
          pendingReferrals: d.referrals.filter((r) => r.toUserId === u.id && r.status === "pending").length,
          awaitingSignOff: d.requirements.filter((r) => r.ownerId === u.id && r.status === "pm_approved").length,
        })),
    };
  },
  reset: () => {
    resetStore();
    return { ok: true as const };
  },

  // Trace replay
  requirementReplay: ({ params, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    audit({ actorId: user.id, action: "requirement.replay_viewed", objectType: "requirement", objectId: r.id });
    return buildReplay(d, r);
  },

  // Competitor ripple
  ripples: () => db().ripples,
  ripple: ({ params }) => {
    const d = db();
    return { ripple: must(d.ripples.find((r) => r.id === params.id), `Ripple ${params.id}`), conversions: d.conversions, settings: d.monitorSettings };
  },
  decideRippleItem: ({ params, body, user }) => {
    const d = db();
    const ripple = must(d.ripples.find((r) => r.id === params.id), `Ripple ${params.id}`);
    const item = must(ripple.items.find((i) => i.id === params.itemId), `Item ${params.itemId}`);
    const proposal = decideItem(d, user, ripple, item, body);
    return { ripple, proposal };
  },
  conversions: () => db().conversions,
  saveConversion: ({ params, body, user }) => {
    const d = db();
    if (user.role !== "head") throw new ApiError(403, "Only the head of product line changes the team's conversion factor. Try another factor on the ripple screen instead.");
    const c = must(d.conversions.find((x) => x.id === params.id), `Conversion ${params.id}`);
    if (body.factor < c.range[0] || body.factor > c.range[1]) throw new ApiError(400, `Factor ${body.factor} is outside the stated range ${c.range[0]}–${c.range[1]}. Widen the range with a source first.`);
    const before = c.factor;
    c.factor = body.factor;
    c.updatedAt = now();
    c.updatedBy = user.id;
    reassess(d);
    audit({ actorId: user.id, action: "conversion.updated", objectType: "settings", objectId: c.id, before: { factor: before }, after: { factor: c.factor, isAssumption: c.isAssumption }, rationale: body.rationale });
    return c;
  },
  monitorSettings: () => db().monitorSettings,
  saveMonitorSettings: ({ body, user }) => {
    const d = db();
    const before = { ...d.monitorSettings };
    if (body.muteThresholdPct !== undefined) d.monitorSettings.muteThresholdPct = body.muteThresholdPct;
    if (body.atParTolerancePct !== undefined) d.monitorSettings.atParTolerancePct = body.atParTolerancePct;
    d.monitorSettings.updatedAt = now();
    d.monitorSettings.updatedBy = user.id;
    audit({ actorId: user.id, action: "settings.updated", objectType: "settings", objectId: "monitor", before: { muteThresholdPct: before.muteThresholdPct, atParTolerancePct: before.atParTolerancePct }, after: { muteThresholdPct: d.monitorSettings.muteThresholdPct, atParTolerancePct: d.monitorSettings.atParTolerancePct }, rationale: body.rationale });
    return d.monitorSettings;
  },
};
