/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Alert,
  AuditEvent,
  Case,
  CaseStance,
  ChatMessage,
  Comment,
  FeedbackEntry,
  InnovationMeta,
  Market,
  MarketFigure,
  MeetingNote,
  ObjectType,
  OpenQuestion,
  PlannedFeature,
  Proposal,
  Referral,
  Requirement,
  RequirementCheck,
  RequirementSnapshot,
  RequirementVersion,
  Series,
  SeriesBrief,
  Signal,
  User,
  VehiclePlan,
} from "@/contracts";
import { Series as SeriesEnum } from "@/contracts";
import {
  agentFromBackend,
  brandFitFromBackend,
  evidenceFromBackend,
  evidenceToBackend,
  factorFromBackend,
  marketFromBackend,
  powertrainFromBackend,
  releaseFromBackend,
  releaseToBackend,
  requirementStatusFromBackend,
  rewriteCitations,
  sourceTypeFromBackend,
  trustFromBackend,
} from "./map";

/**
 * Backend rows (snake_case, backend vocabulary: backend/API.md, database-design.md)
 * -> entities of the UI contract (src/contracts). Pure functions.
 */
export type Row = Record<string, any>;

const isSeries = (v: unknown): v is Series => SeriesEnum.options.includes(v as Series);
const iso = (v: unknown) => (v ? String(v) : "");
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- people ----------
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function userFromBackend(u: Row): User {
  const series = (u.vehicles as string[]).filter(isSeries);
  return {
    id: u.id,
    name: u.name,
    initials: u.initials ?? initialsOf(u.name),
    // The UI knows three PM roles; an admin acts as head, an engineer is shown as a cross-series colleague.
    role: u.pm_role ?? (u.role === "admin" ? "head" : u.role === "pm" ? "vehicle_pm" : "attribute_pm"),
    title: u.title ?? (u.role === "engineer" ? "Engineering" : u.role === "admin" ? "Administrator" : "Product Manager"),
    series: series.length ? series : [...SeriesEnum.options],
    region: u.region ?? "global",
    attributeScope: u.attribute_scope ?? undefined,
    color: u.color ?? "#64748b",
    synthetic: !!u.synthetic,
  };
}

/** `pm:<uuid>` -> the user id; agents, seeds and the system keep an `agent:` id. */
export function actorId(actor: string | null | undefined): string {
  if (!actor) return "agent:system";
  const [kind, id] = actor.split(":");
  if (kind === "pm" || kind === "engineer" || kind === "admin") return id;
  return actor.startsWith("agent:") ? actor : `agent:${actor}`;
}

// ---------- signals ----------
export function signalFromBackend(s: Row, fallbackSeries: Series): Signal {
  const metric = s.metric && typeof s.metric.value === "number" ? { name: s.metric.name, value: s.metric.value, unit: s.metric.unit ?? "", cycle: s.metric.period ?? undefined } : undefined;
  return {
    id: s.id,
    kind: s.kind,
    severity: s.severity ?? "none",
    agent: agentFromBackend(s.evidence_role, s.source_id, s.kind),
    sourceType: sourceTypeFromBackend(s.source_id, s.content_type),
    sourceName: s.source_name ?? s.source_id ?? "source",
    trust: trustFromBackend(s.source_id, s.content_type),
    url: s.url && /^https?:/.test(s.url) ? s.url : undefined,
    recordRef: s.record_id,
    publishedAt: iso(s.published_at ?? s.fetched_at),
    fetchedAt: iso(s.fetched_at ?? s.created_at),
    series: isSeries(s.vehicle) ? s.vehicle : fallbackSeries,
    vehicleRole: s.vehicle_role ?? "unknown",
    competitor: s.competitor ?? undefined,
    powertrain: powertrainFromBackend(s.powertrain),
    market: marketFromBackend(s.market),
    marketBasis: s.market_basis ?? "unknown",
    country: s.country ?? undefined,
    carArea: (s.car_area?.[0] ?? "quality_materials") as Signal["carArea"],
    topicId: s.topic_id ?? null,
    aspectGroup: s.aspect_group ?? null,
    featureHint: s.topic ?? s.feature_hint ?? "",
    summary: s.summary ?? "",
    quote: s.quote ?? "",
    quoteEn: s.quote_en ?? undefined,
    language: s.language ?? "en",
    audience: s.evidence_role === "bmw_customer" || s.content_type === "owner" ? "owner" : s.content_type === "expert" ? "reviewer" : "public",
    reach: s.reach ?? undefined,
    reachUnit: s.reach_unit === "views" || s.reach_unit === "upvotes" || s.reach_unit === "likes" ? s.reach_unit : s.reach != null ? "none" : undefined,
    metric,
    caseId: s.case_id ?? null,
    status: s.case_id ? "clustered" : "unclustered",
    classification: s.classified_by ? { method: s.classified_by === "pm" ? ("manual" as const) : (s.classified_by as "bmw_label" | "llm"), label: s.classified_by === "pm" ? "Added by a PM" : undefined } : undefined,
    synthetic: false,
  };
}

// ---------- cases ----------
/** Backend lifecycle per line (state + workflow + outcome) -> the UI's state and outcome. */
export function caseStateFromBackend(cv: Row): { state: Case["state"]; outcome: Case["outcome"] } {
  if (cv.state === "observed") return { state: "observed", outcome: null };
  if (cv.state === "confirmed") return { state: "decided", outcome: "confirmed" };
  if (cv.state === "rejected") return { state: "decided", outcome: cv.outcome === "merged" ? "merged" : "rejected" };
  if (cv.outcome) return { state: "decided", outcome: cv.outcome };
  return { state: cv.workflow ?? "new", outcome: null };
}

function equipmentText(eq: Row | undefined): string {
  if (!eq?.listed) return "Not in the option list (German market)";
  const n = (xs?: unknown[]) => xs?.length ?? 0;
  const parts = [n(eq.standard) && `standard on ${n(eq.standard)} variants`, n(eq.optional) && `optional on ${n(eq.optional)}`, n(eq.absent) && `absent on ${n(eq.absent)}`, eq.removed && "removed vs. predecessor"].filter(Boolean);
  const price = eq.option_prices_eur?.length ? `; from ${Math.round(eq.option_prices_eur[0])} EUR` : "";
  return `${parts.join(", ") || "listed"}${price} (German option list)`;
}

function perMarket(markets: Row, study: Row[]): MarketFigure[] {
  return Object.entries(markets ?? {})
    .map(([name, m]: [string, any]) => {
      const market = marketFromBackend(name);
      const total = (m.complaints ?? 0) + (m.wishes ?? 0) + (m.likes ?? 0);
      const worst = study.filter((s) => s.market === name).sort((a, b) => Number(a.normalized) - Number(b.normalized))[0];
      return {
        market,
        customers: m.customers ?? 0,
        complaints: m.complaints ?? 0,
        wishes: m.wishes ?? 0,
        likes: m.likes ?? 0,
        studyLabel: worst?.attribute,
        studyScore: worst ? `${round2(Number(worst.normalized))} of 1 (${worst.sheet})` : undefined,
        sentiment: total ? round2(Math.max(-1, Math.min(1, ((m.likes ?? 0) - (m.complaints ?? 0) - 0.5 * (m.wishes ?? 0)) / total))) : 0,
      };
    })
    .filter((m) => m.market !== "unknown" || m.customers > 0)
    .sort((a, b) => b.customers - a.customers);
}

/**
 * One case as a PM sees it for one line. `row` is a board row (GET /cases) or the same
 * fields built from the case page (see `rowFromPage`). `ownerFallback` is the line's PM
 * when nobody took the case yet.
 */
export function caseFromBackend(row: Row, ownerFallback: string, extra: Partial<Case> = {}): Case {
  const { state, outcome } = caseStateFromBackend(row);
  const figures = perMarket(row.markets_full ?? {}, row.study ?? []);
  const negative = Object.entries(row.markets_full ?? {}).filter(([, m]: [string, any]) => m.negative_share != null);
  const conflictMarkets = negative.filter(([, m]: [string, any]) => m.negative_share >= 0.6 || m.negative_share <= 0.4).map(([name]) => marketFromBackend(name));
  const factors = { customers: 0, severity: 0, satisfaction_gap: 0, competitor_gap: 0, market_volume: 0, regression: 0, trend: 0, brand_fit: brandFitFromBackend(row.brand_fit) } as Case["factors"];
  for (const [k, v] of Object.entries(row.factors ?? {})) {
    const f = factorFromBackend(k);
    if (f) factors[f] = Math.max(0, Math.min(1, Number(v) || 0));
  }
  const sources = row.source_types ?? {};
  const offers = (row.competitor_offers ?? []).map((o: Row) => `${o.brand} ${o.model}: ${o.metric} ${o.value ?? o.value_text ?? ""}${o.unit ? ` ${o.unit}` : ""}`.trim());
  return {
    id: row.id,
    title: row.title ?? row.id,
    shortTitle: row.short_title || row.topic || row.title || row.id,
    summary: row.summary ?? "",
    highlights: row.highlights ?? [],
    topicId: row.topic_id ?? null,
    aspectGroup: row.aspect_group ?? null,
    stances: [],
    series: row.vehicle,
    relatedSeries: (row.other_vehicles ?? []).filter(isSeries),
    scope: row.scope ?? "global",
    ownerId: row.owner_id ?? ownerFallback,
    coOwnerIds: row.co_owner_ids ?? [],
    watcherIds: row.watcher_ids ?? [],
    state,
    outcome,
    outcomeNote: row.outcome_note ?? undefined,
    markets: figures.map((m) => m.market).filter((m): m is Market => m !== "unknown"),
    carArea: row.car_area,
    type: row.case_type ?? "fix_improve",
    changeDepth: row.change_depth ?? "part_module",
    featureName: row.topic ?? "",
    bodyMd: rewriteCitations(row.body_md ?? ""),
    bodyVersion: row.body_version ?? 1,
    signalIds: [],
    figures: {
      perMarket: figures,
      equipmentToday: equipmentText(row.equipment),
      competitorOffer: offers.length ? offers : row.competitor_signals ? [`${row.competitor_signals} competitor signals in the evidence`] : [],
      trend: row.trend_signals ? `${row.trend_signals} trend signals` : "",
    },
    marketConflict: row.market_conflict
      ? { note: negative.map(([name, m]: [string, any]) => `${name}: ${Math.round(m.negative_share * 100)}% negative of ${m.customers} customers`).join("; "), markets: conflictMarkets }
      : null,
    brandFit: {
      value: brandFitFromBackend(row.brand_fit),
      reason: row.brand_fit_reason ?? (row.brand_fit ? `Tagged "${row.brand_fit}" by ${row.brand_fit_source === "pm" ? "the PM" : "the AI"}.` : "Not assessed yet (scored as neutral)."),
      confirmedBy: row.brand_fit_confirmed_by ?? null,
    },
    factors,
    evidenceLevel: sources.bmw_internal ? "high" : Object.keys(sources).length ? "medium" : "assumption",
    context: { preset: [], pmInputs: [] },
    originCaseId: null,
    mergedInto: null,
    requirementIds: row.requirement_ids ?? [],
    manualRank: row.manual_rank ?? null,
    manualRankReason: row.manual_rank_reason ?? undefined,
    newSignalCount: row.flag_new_evidence ?? 0,
    createdAt: iso(row.created_at),
    createdBy: actorId(row.created_by),
    updatedAt: iso(row.updated_at ?? row.created_at),
    synthetic: false,
    ...extra,
  };
}

/** The case page (GET /cases/{id}) flattened to a board row for one line and one weight profile. */
export function rowFromPage(page: Row, vehicle: string, profileId: string | null): Row {
  const cv = (page.vehicles as Row[]).find((v) => v.vehicle === vehicle) ?? page.vehicles[0] ?? { vehicle, state: "observed" };
  const vf = page.figures?.by_vehicle?.[cv.vehicle] ?? {};
  const score = (page.scores as Row[]).find((s) => s.weight_profile_id === profileId) ?? (page.scores as Row[]).find((s) => s.vehicle === cv.vehicle);
  return {
    ...page,
    ...cv,
    id: page.id,
    created_at: page.created_at,
    updated_at: cv.updated_at > page.updated_at ? cv.updated_at : page.updated_at,
    other_vehicles: (page.vehicles as Row[]).map((v) => v.vehicle).filter((v) => v !== cv.vehicle),
    markets_full: vf.markets ?? {},
    study: vf.study ?? [],
    equipment: vf.equipment ?? {},
    competitor_offers: vf.competitor_offers ?? [],
    competitor_signals: vf.competitor_evidence?.signals ?? 0,
    trend_signals: vf.trend_signals ?? 0,
    source_types: page.figures?.source_types ?? {},
    factors: Object.fromEntries(Object.entries(score?.factors ?? {}).map(([k, v]: [string, any]) => [k, v.normalized])),
    requirement_ids: (page.requirements as Row[]).filter((r) => r.vehicle === cv.vehicle && r.status !== "deleted").map((r) => r.id),
  };
}

export function stanceFromBackend(s: Row): CaseStance {
  return {
    authorId: s.author_id,
    overrides: s.overrides ?? {},
    overrideReasons: s.override_reasons ?? {},
    evidenceTakes: s.evidence_takes ?? [],
    inside: s.inside ?? [],
    ambition: s.ambition ?? null,
    pendingShape: s.pending_shape ?? [],
    updatedAt: iso(s.updated_at),
  };
}

// ---------- requirements ----------
/** The parts of a requirement that change between versions, both ways. */
export function snapshotFromBackend(s: Row): RequirementSnapshot {
  return {
    title: s.title ?? "",
    shortTitle: s.short_title || (s.title ?? "").split(/\s+/).slice(0, 4).join(" "),
    description: s.description ?? "",
    descriptionParts: s.description_parts ?? [],
    marketScope: s.market_scope ?? "global",
    releaseTarget: releaseFromBackend(s.release_target),
    metrics: (s.metrics ?? []).map((m: Row, i: number) => ({
      id: m.id ?? `m${i + 1}`,
      question: m.question ?? "",
      target: m.target ?? "",
      today: m.today ?? undefined,
      unit: m.unit ?? undefined,
      basis: m.basis === "evidence" ? "evidence" : "assumption",
      benchmark: m.benchmark ?? undefined,
      targetSpec: m.targetSpec ?? undefined,
    })),
    acceptanceCriteria: s.acceptance_criteria ?? [],
    assumptions: s.assumptions ?? [],
    evidenceLevel: evidenceFromBackend(s.evidence_level),
    cost: { size: s.cost_size ?? "M", eurBand: s.cost_band ?? "", source: s.cost_source ?? "ai_estimate", note: s.cost_note ?? "" },
    provenance: s.provenance ?? [],
    shapeAnswers: s.shape_answers ?? [],
  };
}

/** UI fields of a requirement (snapshot or an edit) -> the backend's PATCH /requirements/{id} body. */
export function requirementFieldsToBackend(p: Partial<RequirementSnapshot> & { changeDepth?: Requirement["changeDepth"] }): Row {
  const out: Row = {};
  if (p.title !== undefined) out.title = p.title;
  if (p.shortTitle !== undefined) out.short_title = p.shortTitle;
  if (p.description !== undefined) out.description = p.description;
  if (p.descriptionParts !== undefined) out.description_parts = p.descriptionParts;
  if (p.marketScope !== undefined) out.market_scope = p.marketScope;
  if (p.releaseTarget !== undefined) out.release_target = releaseToBackend(p.releaseTarget);
  if (p.changeDepth !== undefined) out.change_depth = p.changeDepth;
  if (p.metrics !== undefined) out.metrics = p.metrics;
  if (p.acceptanceCriteria !== undefined) out.acceptance_criteria = p.acceptanceCriteria;
  if (p.assumptions !== undefined) out.assumptions = p.assumptions;
  if (p.evidenceLevel !== undefined) out.evidence_level = evidenceToBackend(p.evidenceLevel);
  if (p.cost !== undefined) {
    out.cost_size = p.cost.size;
    out.cost_band = p.cost.eurBand;
    out.cost_source = p.cost.source;
    out.cost_note = p.cost.note;
  }
  if (p.provenance !== undefined) out.provenance = p.provenance;
  if (p.shapeAnswers !== undefined) out.shape_answers = p.shapeAnswers;
  return out;
}

export function requirementFromBackend(r: Row, ownerFallback: string): Requirement {
  const status = requirementStatusFromBackend(r.status);
  const topic = r.topic_id ?? r.case?.topic_id ?? null;
  return {
    ...snapshotFromBackend(r),
    id: r.id,
    caseId: r.case_id,
    series: r.vehicle,
    version: r.body_version ?? 1,
    briefId: r.brief_id ?? null,
    drafter: r.drafter ?? r.prompt_version ?? null,
    variantOf: r.variant_of ?? null,
    status,
    carArea: r.car_area ?? r.case?.car_area ?? "quality_materials",
    changeDepth: r.change_depth ?? "part_module",
    ownerId: r.owner_id ?? ownerFallback,
    manualRank: r.manual_rank ?? null,
    // A planned requirement sits on the plan feature of its case's topic.
    plannedFeatureId: status === "planned" || status === "exported" ? topic : null,
    sentBackReason: r.sent_back_reason ?? undefined,
    argumentMd: r.argument_md ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at ?? r.created_at),
    synthetic: false,
  };
}

export function versionFromBackend(v: Row): RequirementVersion {
  return {
    requirementId: v.requirement_id,
    version: v.version,
    snapshot: snapshotFromBackend(v.snapshot ?? {}),
    cause: v.cause,
    feedbackId: v.feedback_id ?? undefined,
    rationale: v.rationale,
    createdAt: iso(v.created_at),
    createdBy: actorId(v.created_by),
  };
}

export function feedbackFromBackend(f: Row): FeedbackEntry {
  return {
    id: f.id,
    requirementId: f.requirement_id,
    from: f.source,
    text: f.text,
    response: f.response,
    pmRationale: f.pm_rationale,
    signalIds: f.signal_ids ?? [],
    proposalId: f.proposal_id ?? null,
    resultingVersion: f.resulting_version ?? null,
    createdAt: iso(f.created_at),
    createdBy: f.created_by,
  };
}

export function checkFromBackend(c: Row): RequirementCheck {
  return { requirementId: c.requirement_id, ranAt: iso(c.ran_at), engine: c.engine, issues: c.issues ?? [] };
}

// ---------- collaboration ----------
export function questionFromBackend(q: Row): OpenQuestion {
  return {
    id: q.id,
    objectType: q.object_type,
    objectId: q.object_id,
    addressee: q.addressee,
    contact: q.contact ?? undefined,
    question: q.question,
    why: q.why ?? "",
    status: q.status,
    answer: q.answer ?? undefined,
    answerSource: q.answer_source ?? undefined,
    answeredAt: q.answered_at ? iso(q.answered_at) : undefined,
    dueDate: q.due_date ? iso(q.due_date) : undefined,
    askedBy: q.asked_by,
    createdAt: iso(q.created_at),
    fieldsAffected: q.fields_affected ?? [],
  };
}

export function noteFromBackend(n: Row, proposals: Row[]): MeetingNote {
  return {
    id: n.id,
    caseId: n.case_id,
    title: n.title,
    date: iso(n.held_on ?? n.created_at),
    attendees: n.attendees ?? [],
    text: n.text,
    createdBy: n.created_by,
    proposalIds: proposals.filter((p) => p.meeting_note_id === n.id).map((p) => p.id),
  };
}

export function proposalFromBackend(p: Row): Proposal {
  return {
    id: p.id,
    objectType: p.object_type,
    objectId: p.object_id,
    source: p.source,
    kind: p.kind,
    summary: p.summary,
    changes: p.changes ?? [],
    questionId: p.question_id ?? undefined,
    citations: p.citations ?? [],
    status: p.status,
    createdAt: iso(p.created_at),
    decidedBy: p.decided_by ?? undefined,
    decidedAt: p.decided_at ? iso(p.decided_at) : undefined,
  };
}

export function referralFromBackend(r: Row): Referral {
  return {
    id: r.id,
    kind: r.kind,
    caseId: r.case_id,
    fromUserId: r.from_user,
    toUserId: r.to_user,
    note: r.note,
    status: r.status,
    createdAt: iso(r.created_at),
    decidedAt: r.decided_at ? iso(r.decided_at) : undefined,
    declineReason: r.decline_reason ?? undefined,
    linkedCaseId: r.linked_case_id ?? null,
    resolution: r.resolution ?? undefined,
  };
}

export function innovationFromBackend(i: Row): InnovationMeta {
  return {
    caseId: i.case_id,
    horizon: i.horizon,
    votes: i.votes ?? [],
    interestedSeries: (i.interested_vehicles ?? []).filter(isSeries),
    // The same case is worked for the lines that pulled it: the link is the case itself.
    pulledInto: (i.pulled_into ?? []).length ? [i.case_id] : [],
    pitch: i.pitch ?? "",
  };
}

export function alertFromBackend(a: Row, ownerFallback: string): Alert {
  return {
    id: a.id,
    ownerId: a.owner_id ?? ownerFallback,
    caseId: a.case_id ?? null,
    requirementId: a.requirement_id ?? null,
    verdict: a.verdict,
    title: a.title,
    detail: a.detail ?? "",
    signalIds: a.signal_ids ?? [],
    status: a.status,
    resolution: a.resolution ?? undefined,
    createdAt: iso(a.created_at),
  };
}

export function commentFromBackend(c: Row): Comment {
  return { id: c.id, objectType: c.object_type, objectId: c.object_id, authorId: c.author_id, body: c.body, mentions: c.mentions ?? [], createdAt: iso(c.created_at) };
}

export function briefFromBackend(b: Row): SeriesBrief {
  return {
    id: b.id,
    series: b.vehicle,
    kind: b.kind,
    region: b.region,
    parentId: b.parent_id ?? null,
    ownerId: b.owner_id,
    values: b.values ?? {},
    meta: b.meta ?? {},
    version: b.version,
    createdAt: iso(b.created_at),
    updatedAt: iso(b.updated_at),
    synthetic: false,
  };
}

export function planFromBackend(p: Row): VehiclePlan {
  return {
    series: p.vehicle,
    successorName: p.successor_name,
    projectType: "new_gen", // not a setting on real data (the release-fit filter replaced it)
    sop: p.sop ?? "",
    ownerIds: p.owner_ids ?? [],
    features: (p.features as Row[]).map(
      (f): PlannedFeature => ({
        id: f.id,
        carArea: f.car_area,
        name: f.name,
        today: f.today,
        todayDetail: f.today_detail,
        action: f.action,
        requirementIds: f.requirement_ids ?? [],
        release: releaseFromBackend(f.release),
        protected: !!f.protected,
        note: f.note ?? "",
      }),
    ),
  };
}

export function chatFromBackend(m: Row, proposals: Row[], label: (signalId: string) => string): ChatMessage {
  return {
    id: m.id,
    objectType: m.object_type,
    objectId: m.object_id,
    role: m.role === "pm" ? "user" : "assistant",
    authorId: m.role === "pm" ? actorId(m.author) : undefined,
    content: rewriteCitations(m.content ?? ""),
    citations: ((m.cited_signals ?? []) as string[]).map((ref) => ({ ref, label: label(ref) })),
    proposalIds: proposals.filter((p) => p.chat_message_id === m.id).map((p) => p.id),
    createdAt: iso(m.created_at),
  };
}

// ---------- audit ----------
const AUDIT_OBJECT: Record<string, ObjectType> = {
  case: "case",
  case_vehicle: "case",
  case_stance: "case",
  meeting_note: "case",
  alert: "case",
  comment: "case",
  innovation_item: "case",
  decision: "case",
  requirement: "requirement",
  requirement_version: "requirement",
  requirement_feedback: "requirement",
  requirement_check: "requirement",
  proposal: "case",
  signal: "signal",
  referral: "referral",
  open_question: "question",
  planned_feature: "plan",
  vehicle_plan: "plan",
  weight_profile: "profile",
  brand_profile: "profile",
  config: "profile",
  workspace: "workspace",
  series_brief: "brief",
};

export function auditFromBackend(e: Row): AuditEvent {
  const objectType = AUDIT_OBJECT[e.object_type] ?? (String(e.object_id).startsWith("REQ-") ? "requirement" : "case");
  return {
    seq: Number(e.seq),
    at: iso(e.at),
    actorId: actorId(e.actor),
    actorType: e.actor_type === "human" ? "human" : "ai",
    action: `${e.object_type}.${e.action}`,
    objectType,
    objectId: String(e.object_id).split("/")[0],
    before: e.before ?? undefined,
    after: e.after ?? undefined,
    rationale: e.rationale ?? undefined,
  };
}
