/* eslint-disable @typescript-eslint/no-explicit-any */
import { stringify as toYaml } from "yaml";
import type {
  AgentRun,
  Agent,
  BrandProfile,
  BriefFieldKey,
  Case,
  ChatMessage,
  Dataset,
  FactorKey,
  FeedbackEntry,
  Market,
  Notification,
  Proposal,
  QuarantineItem,
  Region,
  Requirement,
  RequirementCheck,
  RequirementSnapshot,
  ScoresResponse,
  Series,
  ShapeQuestion,
  Signal,
  TaxonomyResponse,
  User,
  VehiclePlan,
  WeightProfile,
  Workspace,
} from "@/contracts";
import { FactorKey as FactorKeys, addresseeLabel, feedbackResponseLabel, shapeKeyLabel } from "@/contracts";
import type { Handlers } from "@/mock/handlers";
import { ApiError } from "@/mock/store";
import { composeShapeQuestions } from "@/mock/ai/composer";
import type { ProposalDraft } from "@/mock/ai/chat";
import { followUpQuestions, shapeQuestionsMessage } from "@/mock/ai/chat";
import { changeSummary, feedbackPatch, retagEdits } from "@/mock/ai/drafting";
import { extractFromNote } from "@/mock/ai/notes";
import { provenanceCounts, provenanceLine, sentences } from "@/mock/ai/provenance";
import { ruleCheck } from "@/mock/ai/quality";
import { caseSegments, segmentReply } from "@/mock/ai/segment";
import { extractFromDoc } from "@/mock/briefs";
import { conversions as teamConversions, monitorSettings as defaultMonitorSettings } from "@/mock/authored/world";
import { buildReplay } from "@/mock/replay";
import { backend, cached, invalidateCache, type QueryValue } from "./client";
import { FACTOR_TO_BACKEND, brandFitToBackend, marketFromBackend, marketToBackend, releaseToBackend, rewriteCitations, weightsFromBackend, weightsToBackend } from "./map";
import {
  type Row,
  alertFromBackend,
  auditFromBackend,
  briefFromBackend,
  caseFromBackend,
  chatFromBackend,
  checkFromBackend,
  commentFromBackend,
  feedbackFromBackend,
  innovationFromBackend,
  noteFromBackend,
  planFromBackend,
  proposalFromBackend,
  questionFromBackend,
  referralFromBackend,
  requirementFieldsToBackend,
  requirementFromBackend,
  rowFromPage,
  signalFromBackend,
  snapshotFromBackend,
  stanceFromBackend,
  userFromBackend,
  versionFromBackend,
} from "./shape";

/**
 * The UI contract (src/contracts/api.ts) served from the FastAPI backend
 * (DATA_SOURCE=backend). Same signatures as src/mock/handlers.ts. Users are the
 * backend's users: `user.id` is an app_user id and is sent as X-User-Id.
 *
 * Storage, permissions, state rules and the audit trail are the backend's. What
 * stays here is the UI's deterministic assistant logic (shape questions, quality
 * rules, note and strategy-doc extraction, "ask the segment"), which runs on the
 * mapped real data and stores its results through the backend.
 */

// ---------- backend access ----------
const get = <T = Row>(user: User, path: string, query?: Record<string, QueryValue>) => backend<T>(user.id, "GET", path, { query });

async function send<T = Row>(user: User, method: "POST" | "PUT" | "PATCH", path: string, body?: unknown) {
  const out = await backend<T>(user.id, method, path, { body: body ?? {} });
  invalidateCache();
  return out;
}

export const backendUsers = (asUserId: string) => cached("users", 30_000, async () => (await backend<Row[]>(asUserId, "GET", "/users")).map(userFromBackend));
const users = (user: User) => backendUsers(user.id);

interface Ctx {
  ws: Row;
  vehicle: Series;
  market: string;
  profileId: string;
  all: User[];
  /** The line's PM when a case or requirement has no owner yet. */
  owner: (vehicle?: string) => string;
}

async function ctx(user: User): Promise<Ctx> {
  const [ws, all] = await Promise.all([cached(`ws:${user.id}`, 10_000, () => get(user, "/workspace")), users(user)]);
  if (!ws.config) throw new ApiError(409, "No config (vehicle and market) is available for you yet. Seed the backend first.");
  const owner = (vehicle: string = ws.config.vehicle) =>
    all.find((u) => u.role === "vehicle_pm" && u.series.length < 3 && u.series.includes(vehicle as Series) && u.region !== "CN")?.id ??
    all.find((u) => u.role === "vehicle_pm" && u.series.includes(vehicle as Series))?.id ??
    user.id;
  return { ws, vehicle: ws.config.vehicle, market: ws.config.market, profileId: ws.weight_profile_id, all, owner };
}

const ALL_STATES = ["open", "confirmed", "rejected"];

/** Board rows of the caller's profile (ranked, with factors); observed cases only when asked. */
const board = (user: User, profileId: string, states: string[] = ALL_STATES) =>
  cached(`board:${profileId}:${states.join(",")}`, 10_000, () => get<Row[]>(user, "/cases", { profile_id: profileId, state: states }));

const reqBoard = (user: User, profileId: string) =>
  cached(`reqs:${profileId}`, 10_000, () => get<Row[]>(user, "/requirements", { profile_id: profileId, status: ["draft", "in_discussion", "approved", "signed_off", "planned", "exported", "rejected"] }));

async function caseSignals(user: User, caseId: string, series: Series): Promise<Signal[]> {
  const res = await get<{ items: Row[] }>(user, "/signals", { case_id: caseId, limit: 2000 });
  return res.items.map((s) => signalFromBackend(s, series));
}

/** The case page mapped for the caller's line, with everything the PM added to it. */
async function loadCase(user: User, id: string, c?: Ctx) {
  const x = c ?? (await ctx(user));
  const page = await cached(`case:${id}`, 5_000, () => get(user, `/cases/${encodeURIComponent(id)}`));
  const vehicles = (page.vehicles as Row[]).map((v) => v.vehicle);
  const vehicle = vehicles.includes(x.vehicle) ? x.vehicle : (vehicles[0] ?? x.vehicle);
  const row = rowFromPage(page, vehicle, x.profileId);
  const merged = (page.lineage as Row[]).find((l) => l.op === "merge" && l.from_case === id);
  const pmInputs = [
    ...(page.stances as Row[]).map((s) => ({ kind: "note" as const, label: `${x.all.find((u) => u.id === s.author_id)?.name ?? "A PM"}'s context`, detail: [s.ambition && `ambition ${s.ambition}`, ...(s.evidence_takes ?? []).map((t: Row) => `${t.effect}: ${t.text}`), ...(s.inside ?? []).map((i: Row) => i.text)].filter(Boolean).join(" · ") || "No changes to the product specs", at: String(s.updated_at), ref: `stance-${s.author_id}` })),
    ...(page.meeting_notes as Row[]).map((n) => ({ kind: "meeting" as const, label: n.title, detail: `${(n.attendees ?? []).length} attendees`, at: String(n.created_at), ref: n.id })),
    ...(page.questions as Row[]).filter((q) => q.status === "answered").map((q) => ({ kind: "answer" as const, label: `${q.addressee} answered`, detail: q.answer ?? "", at: String(q.answered_at), ref: q.id })),
    ...(page.proposals as Row[]).filter((p) => p.status === "accepted").map((p) => ({ kind: "diff" as const, label: "AI proposal accepted", detail: p.summary, at: String(p.decided_at), ref: p.id })),
  ];
  const mapped = caseFromBackend(row, x.owner(vehicle), {
    stances: (page.stances as Row[]).map(stanceFromBackend),
    mergedInto: merged?.to_case ?? null,
    context: {
      preset: [
        { kind: "baseline", label: "Today's equipment", detail: "", ref: "option-list" },
        ...(page.decisions as Row[]).slice(0, 5).map((d) => ({ kind: "past_decision" as const, label: `${d.action}${d.vehicle ? ` (${d.vehicle})` : ""}`, detail: d.rationale ?? "", at: String(d.created_at) })),
      ],
      pmInputs,
    },
  });
  mapped.context.preset[0].detail = mapped.figures.equipmentToday;
  return { page, row, vehicle: vehicle as Series, case: mapped, x };
}

async function loadRequirement(user: User, id: string, c?: Ctx) {
  const x = c ?? (await ctx(user));
  const row = await cached(`req:${id}`, 5_000, () => get(user, `/requirements/${encodeURIComponent(id)}`));
  if (row.status === "deleted") throw new ApiError(404, `Requirement ${id} was deleted`);
  return { row, requirement: requirementFromBackend(row, x.owner(row.vehicle)), x };
}

/** The mock's pure helpers read a Dataset; give them the slice they need. */
function mini(parts: Partial<Dataset>): Dataset {
  return { generatedAt: new Date().toISOString(), users: [], workspaces: [], weightProfiles: [], signals: [], clusters: [], agentRuns: [], quarantine: [], cases: [], questions: [], meetingNotes: [], proposals: [], requirements: [], referrals: [], innovation: [], plans: [], messages: [], comments: [], notifications: [], alerts: [], briefs: [], requirementVersions: [], feedback: [], audit: [], sourceRecords: [], conversions: teamConversions, ripples: [], rippleMutes: [], monitorSettings: defaultMonitorSettings, ...parts } as Dataset;
}

async function brandProfile(user: User): Promise<BrandProfile> {
  const b = await cached("brand", 60_000, () => get(user, "/brand-profile"));
  return { version: b.version, updatedAt: String(b.created_at), updatedBy: String(b.created_by).split(":").pop() ?? "", pillars: b.pillars ?? [], doNot: b.do_not ?? [], notesMd: b.body_md ?? "" };
}

async function saveProposals(user: User, drafts: ProposalDraft[], agent: string, extra: Row = {}): Promise<Proposal[]> {
  const out: Proposal[] = [];
  for (const p of drafts) {
    const row = await send(user, "POST", "/proposals", { object_type: p.objectType, object_id: p.objectId, source: p.source, kind: p.kind, summary: p.summary, changes: p.changes, question_id: p.questionId, citations: p.citations, agent, ...extra });
    out.push(proposalFromBackend(row));
  }
  return out;
}

/** Views and exports are part of the audit trail too (the files themselves are built here). */
const logAccess = (user: User, action: "export" | "view", objectType: "case" | "requirement" | "vehicle_plan", objectId: string, detail: string) =>
  backend(user.id, "POST", "/access-log", { body: { action, object_type: objectType, object_id: objectId, detail } });

const signalLabel = (signals: Signal[]) => (id: string) => signals.find((s) => s.id === id)?.sourceName ?? "Signal";

async function postAgentMessage(user: User, type: string, id: string, content: string, agent: string, cited: string[] = [], segment?: string) {
  return send(user, "POST", `/chat/${type}/${encodeURIComponent(id)}/messages`, { role: "agent", content, agent, cited_signals: cited, segment });
}

// ---------- mapping of small things ----------
function profileFromBackend(p: Row, configName: string): WeightProfile {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? `Weight profile for ${configName}`,
    ownerId: p.owner_id ?? null,
    isDefault: p.is_default,
    weights: weightsFromBackend(p.case_weights),
    costMultiplier: { S: p.cost_multipliers?.S ?? 1, M: p.cost_multipliers?.M ?? 0.85, L: p.cost_multipliers?.L ?? 0.7 },
  };
}

const profilesOf = async (user: User, configId: string) => (await cached(`config:${configId}`, 30_000, () => get(user, `/configs/${configId}`))).profiles as Row[];

function workspaceOf(user: User, x: Ctx): Workspace {
  return {
    id: `ws-${user.id}`,
    userId: user.id,
    series: x.vehicle,
    region: x.market === "China" ? "CN" : user.region === "global" ? "global" : "RoW",
    projectType: "new_gen", // not a setting on real data: the release-fit filter replaced it
    weightProfileId: x.profileId,
    sourceFilter: x.ws.source_filter,
    watchlist: x.ws.watchlist,
  };
}

function agentOfRun(name: string): Agent {
  if (name.includes("competitor")) return "competitor";
  if (name.includes("trend")) return "trends";
  if (name.includes("innovation")) return "innovation_scout";
  if (name.startsWith("seed") || name.includes("bmw")) return "bmw_data";
  return "customer_public";
}

const NOTIFICATION_KIND: Record<string, Notification["kind"]> = { case_opened: "new_signals", new_evidence: "new_signals", requirement_generated: "new_signals", market_conflict: "alert", run_failed: "alert", candidate_feature: "alert", new_competitor: "alert", brief_change: "alert" };
const UI_KINDS = new Set(["alert", "mention", "referral", "question_answered", "sign_off_request", "sent_back", "new_signals", "escalation"]);

function scoresFrom(profileId: string, weights: Record<FactorKey, number>, cases: Row[], requirements: Row[]): ScoresResponse {
  const empty = () => Object.fromEntries(FactorKeys.options.map((f) => [f, 0])) as Record<FactorKey, number>;
  return {
    profileId,
    weights,
    cases: cases.map((r) => {
      const contributions = empty();
      for (const f of FactorKeys.options) {
        const b = FACTOR_TO_BACKEND[f];
        if (b) contributions[f] = Math.max(0, Math.min(1, Number(r.contributions?.[b] ?? 0)));
      }
      return { caseId: r.id ?? r.case_id, profileId, score: Number(r.score ?? 0), rank: r.rank, contributions };
    }),
    requirements: requirements.map((r) => ({ requirementId: r.id ?? r.requirement_id, score: Number(r.rank_score ?? r.score ?? 0), rank: r.rank })),
  };
}

function shapeInput(user: User, c: Case, signals: Signal[], brand: BrandProfile, x: Ctx, siblings: Requirement[], plan: VehiclePlan | null) {
  const brief = x.ws.brief ?? null;
  return {
    case: { ...c, signalIds: signals.map((s) => s.id) },
    signals,
    brand,
    brief,
    briefId: brief ? (brief.overlayId ?? brief.sharedId) : null,
    author: user,
    region: (brief?.region ?? (user.region === "CN" ? "CN" : user.region === "RoW" ? "RoW" : "global")) as Region,
    stance: c.stances.find((s) => s.authorId === user.id) ?? null,
    plan,
    siblings,
    conversions: teamConversions,
  };
}

async function caseRequirements(user: User, page: Row, x: Ctx): Promise<Requirement[]> {
  const ids = (page.requirements as Row[]).filter((r) => r.status !== "deleted").map((r) => r.id);
  return Promise.all(ids.map(async (id) => (await loadRequirement(user, id, x)).requirement));
}

async function runCheck(user: User, r: Requirement, trigger: string, x: Ctx): Promise<RequirementCheck> {
  const [{ case: c }, siblings, plan] = await Promise.all([loadCase(user, r.caseId, x), reqBoard(user, x.profileId), get(user, `/plans/${r.series}`).then(planFromBackend).catch(() => null)]);
  const signals = await caseSignals(user, r.caseId, r.series);
  const d = mini({ cases: [{ ...c, signalIds: signals.map((s) => s.id) }], signals, requirements: [r, ...siblings.filter((s) => s.id !== r.id).map((s) => requirementFromBackend(s, x.owner(s.vehicle)))], plans: plan ? [plan] : [] });
  const check = ruleCheck(d, r, new Date().toISOString());
  const stored = await send(user, "POST", `/requirements/${encodeURIComponent(r.id)}/check`, { engine: check.engine, issues: check.issues, trigger });
  return checkFromBackend(stored);
}

// ---------- handlers ----------
export const backendHandlers: Handlers = {
  // Identity
  me: async ({ user }) => {
    const x = await ctx(user);
    const profiles = await profilesOf(user, x.ws.config_id);
    const profile = profiles.find((p) => p.id === x.profileId) ?? profiles[0];
    return { user, workspace: workspaceOf(user, x), weightProfile: profileFromBackend(profile, x.ws.config.name), brief: x.ws.brief ?? null, needsOnboarding: !!x.ws.needs_onboarding, features: { agentRefresh: false, competitorRipple: false } };
  },
  users: ({ user }) => users(user),
  updateWorkspace: async ({ user, body }) => {
    const x = await ctx(user);
    const patch: Row = { source_filter: body.sourceFilter, watchlist: body.watchlist, weight_profile_id: body.weightProfileId };
    const wantMarket = body.region === "CN" ? "China" : undefined;
    const leaveChina = body.region !== undefined && body.region !== "CN" && x.market === "China";
    if ((body.series && body.series !== x.vehicle) || (wantMarket && wantMarket !== x.market) || leaveChina) {
      const all = await cached("configs", 60_000, () => get<Row[]>(user, "/configs"));
      const series = body.series ?? x.vehicle;
      const pool = all.filter((c) => c.vehicle === series);
      // Out of China: the line's largest other market (2030 volume).
      const others = pool.filter((c) => c.market !== "China").sort((a, b) => Number(b.sales_2030 ?? 0) - Number(a.sales_2030 ?? 0));
      const next = (leaveChina ? others[0] : pool.find((c) => c.market === (wantMarket ?? x.market))) ?? pool[0];
      if (!next) throw new ApiError(404, `No config for ${series}`);
      patch.config_id = next.id;
      if (!body.weightProfileId) patch.weight_profile_id = undefined;
    }
    await send(user, "PUT", "/workspace", patch);
    return workspaceOf(user, await ctx(user));
  },
  search: async ({ user, query }) => {
    const x = await ctx(user);
    const hits = await get<Row[]>(user, "/search", { q: query.q, vehicle: x.vehicle });
    return hits.map((h) => ({
      type: h.type,
      id: h.id,
      title: h.title ?? h.id,
      subtitle: h.subtitle ?? "",
      href: h.type === "case" ? `/cases/${h.id}` : h.type === "requirement" ? `/requirements/${h.id}` : h.type === "user" ? `/cases?owner=${h.id}` : h.case_id ? `/cases/${h.case_id}?signal=${h.id}` : `/radar?signal=${h.id}`,
    }));
  },

  // Series briefs (layer 1)
  briefs: async ({ user, query }) => (await get<Row[]>(user, "/briefs", { vehicle: query.series })).map(briefFromBackend),
  myBrief: async ({ user }) => {
    const x = await ctx(user);
    const b = await get(user, "/briefs/mine", { vehicle: x.vehicle });
    return { resolved: b.resolved ?? null, shared: b.shared ? briefFromBackend(b.shared) : null, overlay: b.overlay ? briefFromBackend(b.overlay) : null, proposals: (b.proposals as Row[]).map(proposalFromBackend) };
  },
  createOverlay: async ({ user, body }) => briefFromBackend(await send(user, "POST", "/briefs", { vehicle: body.series })),
  saveBrief: async ({ user, params, body }) => {
    const out = await send(user, "PUT", `/briefs/${params.id}`, { values: body.values, reasons: body.reasons, confirm: body.confirm, clear: body.clear });
    return { brief: briefFromBackend(out.brief), impact: out.impact };
  },
  previewBriefImpact: ({ user, params, body }) => backend(user.id, "POST", `/briefs/${params.id}/impact`, { body: { values: body.values } }),
  extractBrief: async ({ user, params, body }) => {
    const x = await ctx(user);
    if (!x.ws.brief) throw new ApiError(409, "The shared product specs are incomplete; fill them in before extracting from a document.");
    return saveProposals(user, extractFromDoc(body.text, x.ws.brief.values, params.id), "brief_extractor");
  },
  briefConflicts: ({ user }) => get(user, "/brief-conflicts") as Promise<any>,
  resolveBriefConflict: async ({ user, params, body }) => briefFromBackend(await send(user, "POST", `/briefs/${params.id}/conflicts/${params.field}`, body)),

  // Signals and agents
  signals: async ({ user, query }) => {
    const x = await ctx(user);
    const series = (query.series ?? x.vehicle) as Series;
    const filter = {
      vehicle: query.caseId ? undefined : series,
      case_id: query.caseId,
      market: query.market ? marketToBackend(query.market) : undefined,
      kind: query.kind,
      unassigned: query.status === "unclustered" || query.status === "new" ? true : undefined,
      q: query.q,
    };
    // Without a limit the caller wants the whole line (Signals page). The backend sorts by date and
    // BMW's verbatims have none, so one page would drop them: read every page (2,000 each, 10 at most).
    const rows = await cached(`signals:${JSON.stringify(filter)}:${query.limit ?? "all"}`, 30_000, async () => {
      const page = Math.min(query.limit ?? 2000, 2000);
      const out: Row[] = [];
      for (let offset = 0; offset < 20_000; offset += page) {
        const res = await get<{ total: number; items: Row[] }>(user, "/signals", { ...filter, limit: page, offset });
        out.push(...res.items);
        if (query.limit || out.length >= res.total || !res.items.length) break;
      }
      return out;
    });
    let items = rows.map((s) => signalFromBackend(s, series));
    if (query.agent) items = items.filter((s) => s.agent === query.agent);
    if (query.status === "clustered") items = items.filter((s) => s.caseId);
    return items;
  },
  clusters: () => [],
  agentRuns: async ({ user }) => {
    const x = await ctx(user);
    const runs = await get<Row[]>(user, "/runs", { limit: 50 });
    return runs.map(
      (r): AgentRun => ({
        id: r.id,
        agent: agentOfRun(r.agent),
        series: x.vehicle,
        startedAt: String(r.started_at),
        endedAt: String(r.ended_at ?? r.started_at),
        status: r.status === "failed" ? "failed" : r.status === "ok" ? "ok" : "partial",
        valid: r.signals_valid ?? 0,
        rejected: r.signals_quarantined ?? 0,
        newSignals: r.signals_valid ?? 0,
        llmCostUsd: Number(r.llm_cost_usd ?? 0),
        note: r.error ?? `${r.agent} (${r.mode})`,
      }),
    );
  },
  refresh: () => {
    throw new ApiError(501, "Fetch runs are started by the daily worker on the server, not from the UI. See the runs list for the latest results.");
  },
  quarantine: async ({ user }) => {
    const res = await get<{ items: Row[] }>(user, "/quarantine", { limit: 200 });
    return res.items.map((q): QuarantineItem => ({ id: q.id, agent: agentOfRun(q.agent ?? ""), sourceName: q.record_id, snippet: q.quote ?? q.summary ?? "", reason: q.reject_reason, at: String(q.created_at) }));
  },
  taxonomy: async ({ user }) => {
    const t = await cached("taxonomy", 600_000, () => get(user, "/taxonomy"));
    const out: TaxonomyResponse = {
      version: t.topics[0]?.taxonomy_version ?? "backend",
      carAreas: t.car_areas.map((a: Row) => ({ id: a.code, label: a.name, description: a.description ?? "" })),
      topics: t.topics.filter((x: Row) => x.car_area).map((x: Row) => ({ id: x.topic_id, label: x.name, shortLabel: x.name.split(",")[0].trim(), carArea: x.car_area, hint: x.hint })),
      aspectGroups: t.aspect_groups.map((a: Row) => ({ id: a.code, description: a.description ?? "" })),
    };
    return out;
  },

  // Cases
  cases: async ({ user, query }) => {
    const x = await ctx(user);
    const rows = await board(user, x.profileId, query.state === "observed" ? ["observed"] : ALL_STATES);
    return rows
      .map((r) => caseFromBackend(r, x.owner(r.vehicle)))
      .filter((c) => (!query.series || c.series === query.series || c.relatedSeries.includes(query.series)) && (!query.ownerId || c.ownerId === query.ownerId || c.coOwnerIds.includes(query.ownerId)) && (!query.state || c.state === query.state) && (!query.scope || c.scope === query.scope));
  },
  createCase: async ({ user, body }) => {
    // From signals the topic and aspect come with them; by hand the PM picked both from the fixed taxonomy.
    const out = await send(user, "POST", "/cases", {
      vehicle: body.series,
      title: body.title,
      summary: body.summary,
      signal_ids: body.signalIds,
      scope: body.scope,
      rationale: body.rationale,
      topic_id: body.signalIds.length ? undefined : body.topicId,
      aspect_group: body.signalIds.length ? undefined : body.aspectGroup,
      case_type: body.type,
      change_depth: body.changeDepth,
    });
    return (await loadCase(user, out.id)).case;
  },
  addCaseEvidence: async ({ user, params, body }) => {
    const { vehicle } = await loadCase(user, params.id);
    // Every item is stored as a source record and passes the validation gate; only file rows count as customers.
    const out = await send(user, "POST", `/cases/${encodeURIComponent(params.id)}/vehicles/${vehicle}/evidence`, {
      items: body.items.map((it) => ({ type: it.type, text: it.text, title: it.title, url: it.url, source: it.source, kind: it.kind, market: marketToBackend(it.market) })),
      rationale: body.rationale,
    });
    const ids = new Set<string>(out.added as string[]);
    if (!ids.size) throw new ApiError(422, `Nothing was added: ${(out.quarantined as Row[])[0]?.reason ?? "the validation gate rejected it"}.`);
    const fresh = await loadCase(user, params.id);
    const signals = await caseSignals(user, params.id, fresh.vehicle);
    return { case: { ...fresh.case, signalIds: signals.map((s) => s.id) }, added: signals.filter((s) => ids.has(s.id)) };
  },
  caseBundle: async ({ user, params }) => {
    const { page, case: c, vehicle, x } = await loadCase(user, params.id);
    const [signals, requirements] = await Promise.all([caseSignals(user, params.id, vehicle), caseRequirements(user, page, x)]);
    const proposals = page.proposals as Row[];
    return {
      case: { ...c, signalIds: signals.map((s) => s.id) },
      signals,
      questions: (page.questions as Row[]).map(questionFromBackend),
      requirements,
      referrals: (page.referrals as Row[]).map(referralFromBackend),
      alerts: (page.alerts as Row[]).map((a) => alertFromBackend(a, c.ownerId)),
      meetingNotes: (page.meeting_notes as Row[]).map((n) => noteFromBackend(n, proposals)),
      proposals: proposals.map(proposalFromBackend),
      linkedCases: [],
    };
  },
  patchCase: async ({ user, params, body }) => {
    const { case: c, vehicle } = await loadCase(user, params.id);
    const p = body.patch;
    const id = encodeURIComponent(params.id);
    const why = body.rationale || "Edited on the case page";
    if (p.bodyMd !== undefined) await send(user, "PUT", `/cases/${id}/page`, { body_md: p.bodyMd, title: p.title, expected_version: c.bodyVersion });
    // Names and classification; the topic (and so the car area) is fixed by the taxonomy.
    const details = { title: p.bodyMd === undefined ? p.title : undefined, short_title: p.shortTitle, summary: p.summary, case_type: p.type, change_depth: p.changeDepth };
    if (Object.values(details).some((v) => v !== undefined)) await send(user, "PATCH", `/cases/${id}/vehicles/${vehicle}/details`, { ...details, rationale: why });
    if (p.brandFit) await send(user, "POST", `/cases/${id}/tags`, { field: "brand_fit", value: brandFitToBackend(p.brandFit.value), rationale: p.brandFit.reason || why });
    if (p.manualRank !== undefined) await send(user, "POST", `/cases/${id}/vehicles/${vehicle}/rank`, { rank: p.manualRank, reason: p.manualRankReason ?? why });
    if (p.coOwnerIds || p.watcherIds || p.scope) await send(user, "PATCH", `/cases/${id}/vehicles/${vehicle}/work`, { co_owner_ids: p.coOwnerIds, watcher_ids: p.watcherIds, scope: p.scope, rationale: body.rationale });
    return (await loadCase(user, params.id)).case;
  },
  transitionCase: async ({ user, params, body }) => {
    const { vehicle } = await loadCase(user, params.id);
    const id = encodeURIComponent(params.id);
    if (body.action === "merge") {
      if (!body.mergeIntoId) throw new ApiError(400, "Pick the case to merge into.");
      await send(user, "POST", `/cases/${id}/merge`, { target_id: body.mergeIntoId, rationale: body.rationale });
    } else {
      // Confirm does not draft: step 3 asks the shape questions first.
      await send(user, "POST", `/cases/${id}/vehicles/${vehicle}/transition`, { action: body.action, rationale: body.rationale, to_user: body.toUserId, horizon: body.horizon, escalate: !!body.escalate, generate: false });
    }
    return (await loadCase(user, params.id)).case;
  },
  createQuestion: async ({ user, params, body }) => {
    const x = await ctx(user);
    return questionFromBackend(await send(user, "POST", `/cases/${encodeURIComponent(params.id)}/questions`, { addressee: body.addressee, contact: body.contact, question: body.question, why: body.why, due_date: body.dueDate?.slice(0, 10), fields_affected: body.fieldsAffected ?? [], vehicle: x.vehicle }));
  },
  addMeetingNote: async ({ user, params, body }) => {
    const { page, case: c, vehicle, x } = await loadCase(user, params.id);
    const note = await send(user, "POST", `/cases/${encodeURIComponent(params.id)}/meeting-notes`, { title: body.title, held_on: body.date.slice(0, 10) || null, attendees: body.attendees, text: body.text, vehicle });
    const requirements = await caseRequirements(user, page, x);
    const drafts = extractFromNote(c, (page.questions as Row[]).map(questionFromBackend), requirements, body.text);
    const proposals = await saveProposals(user, drafts, "note_extractor", { meeting_note_id: note.id });
    return { note: { ...noteFromBackend(note, []), proposalIds: proposals.map((p) => p.id) }, proposals };
  },
  saveCaseStance: async ({ user, params, body }) => {
    const id = encodeURIComponent(params.id);
    await send(user, "PUT", `/cases/${id}/stance`, { overrides: body.overrides, override_reasons: body.overrideReasons, evidence_takes: body.evidenceTakes, inside: body.inside, ambition: body.ambition });
    const { case: c, x } = await loadCase(user, params.id);
    const brief = await get(user, "/briefs/mine", { vehicle: c.series });
    const d = mini({ cases: [c], briefs: [brief.shared, brief.overlay].filter(Boolean).map(briefFromBackend) });
    const stored = await postAgentMessage(user, "case", params.id, followUpQuestions(d, c, user.id), "stance_follow_up");
    void x;
    return { case: c, message: chatFromBackend(stored, [], () => "Signal") };
  },
  shapeQuestions: async ({ user, params }) => {
    const { page, case: c, vehicle, x } = await loadCase(user, params.id);
    const [signals, brand, siblings] = await Promise.all([caseSignals(user, params.id, vehicle), brandProfile(user), caseRequirements(user, page, x)]);
    const input = shapeInput(user, c, signals, brand, x, siblings.filter((r) => r.status !== "rejected"), null);
    const global = siblings.find((r) => r.marketScope === "global" && r.status !== "rejected" && r.ownerId !== user.id);
    return { questions: composeShapeQuestions(input), brief: input.brief, stance: input.stance, variantOf: input.region !== "global" && global ? global.id : null };
  },
  askShapeQuestions: async ({ user, params }) => {
    const { page, case: c, vehicle, x } = await loadCase(user, params.id);
    const [signals, brand, siblings] = await Promise.all([caseSignals(user, params.id, vehicle), brandProfile(user), caseRequirements(user, page, x)]);
    const questions = composeShapeQuestions(shapeInput(user, c, signals, brand, x, siblings, null));
    const stored = await postAgentMessage(user, "case", params.id, shapeQuestionsMessage(questions, signals.length), "drafter");
    return chatFromBackend(stored, [], () => "Signal");
  },
  generateRequirements: async ({ user, params, body }) => {
    const { page, case: c, vehicle, x } = await loadCase(user, params.id);
    if (c.outcome !== "confirmed") throw new ApiError(409, "Requirements are generated only from confirmed cases.");
    const [signals, brand, siblings] = await Promise.all([caseSignals(user, params.id, vehicle), brandProfile(user), caseRequirements(user, page, x)]);
    const input = shapeInput(user, c, signals, brand, x, siblings.filter((r) => r.status !== "rejected"), null);
    const questions: ShapeQuestion[] = composeShapeQuestions(input);
    const given = new Map((body.answers ?? []).map((a) => [a.key, a.value]));
    const answers = questions.map((q) => ({ key: q.key, value: given.get(q.key) ?? q.default, by_default: !given.has(q.key) }));
    const scope = answers.find((a) => a.key === "scope")?.value === "variant" ? (input.region === "global" ? "RoW" : input.region) : "global";
    const release = answers.find((a) => a.key === "release")?.value;
    const global = siblings.find((r) => r.marketScope === "global" && r.status !== "rejected");
    const created = await send<Row[]>(user, "POST", `/cases/${encodeURIComponent(params.id)}/vehicles/${vehicle}/requirements/draft`, {
      answers,
      market_scope: scope,
      release_target: release ? releaseToBackend(release as Requirement["releaseTarget"]) : undefined,
      variant_of: scope !== "global" ? (global?.id ?? null) : null,
    });
    if (!created.length) throw new ApiError(409, `A ${scope === "global" ? "global" : scope} requirement already exists for this case.`);
    if (input.stance?.pendingShape.length) await send(user, "PUT", `/cases/${encodeURIComponent(params.id)}/stance`, { overrides: input.stance.overrides, override_reasons: input.stance.overrideReasons, evidence_takes: input.stance.evidenceTakes, inside: input.stance.inside, ambition: input.stance.ambition, pending_shape: [] });
    const out = created.map((r) => requirementFromBackend({ ...r, car_area: c.carArea, topic_id: c.topicId }, user.id));
    for (const r of out) await runCheck(user, r, "After drafting", x);
    return out;
  },
  exportCaseMd: async ({ user, params }) => {
    const { case: c, vehicle, x } = await loadCase(user, params.id);
    const signals = await caseSignals(user, params.id, vehicle);
    const front = {
      id: c.id,
      title: c.title,
      series: c.series,
      also_applies_to: c.relatedSeries,
      state: c.state,
      outcome: c.outcome,
      owner: x.all.find((u) => u.id === c.ownerId)?.name ?? c.ownerId,
      markets: c.markets,
      car_area: c.carArea,
      topic: c.topicId,
      type: c.type,
      change_depth: c.changeDepth,
      evidence_level: c.evidenceLevel,
      brand_fit: c.brandFit,
      factors: c.factors,
      requirements: c.requirementIds,
      signals: signals.map((s) => ({ id: s.id, source: s.sourceName, market: s.market, ref: s.recordRef ?? s.url })),
      exported_at: new Date().toISOString(),
    };
    await logAccess(user, "export", "case", c.id, "Case exported as markdown");
    return { filename: `${c.id}.md`, content: `---\n${toYaml(front)}---\n\n# ${c.title}\n\n${c.bodyMd}\n` };
  },
  caseSegments: async ({ user, params }) => {
    const { case: c, vehicle } = await loadCase(user, params.id);
    const signals = await caseSignals(user, params.id, vehicle);
    return caseSegments(mini({ signals }), { ...c, signalIds: signals.map((s) => s.id) });
  },

  // Questions
  questions: async ({ user, query }) => (await get<Row[]>(user, "/questions", { all: query.all ? true : undefined })).map(questionFromBackend),
  patchQuestion: async ({ user, params, body }) => questionFromBackend(await send(user, "PATCH", `/questions/${params.id}`, { addressee: body.addressee, contact: body.contact, question: body.question, why: body.why, status: body.status, answer: body.answer, due_date: body.dueDate?.slice(0, 10) })),

  // Requirements
  requirements: async ({ user, query }) => {
    const x = await ctx(user);
    if (query.caseId) return caseRequirements(user, (await loadCase(user, query.caseId, x)).page, x);
    const rows = await reqBoard(user, x.profileId);
    return rows.map((r) => requirementFromBackend(r, x.owner(r.vehicle))).filter((r) => !query.series || r.series === query.series);
  },
  requirementBundle: async ({ user, params }) => {
    const { row, requirement, x } = await loadRequirement(user, params.id);
    const { case: c } = await loadCase(user, row.case_id, x);
    const signals = await caseSignals(user, row.case_id, requirement.series);
    const plan = requirement.plannedFeatureId ? await get(user, `/plans/${requirement.series}`).then(planFromBackend).catch(() => null) : null;
    const check = row.check && row.check.version === row.body_version ? checkFromBackend(row.check) : await runCheck(user, requirement, "On opening the requirement", x);
    return {
      requirement,
      case: { ...c, signalIds: signals.map((s) => s.id) },
      signals,
      questions: (row.questions as Row[]).map(questionFromBackend),
      variants: (row.variants as Row[]).map((v) => requirementFromBackend({ ...v, car_area: requirement.carArea }, x.owner(v.vehicle))),
      alerts: (row.alerts as Row[]).map((a) => alertFromBackend(a, requirement.ownerId)),
      proposals: (row.proposals as Row[]).map(proposalFromBackend),
      plannedFeature: plan?.features.find((f) => f.id === requirement.plannedFeatureId) ?? null,
      check,
      versions: (row.versions as Row[]).map(versionFromBackend),
      feedback: (row.feedback as Row[]).map(feedbackFromBackend),
      brief: row.brief ? briefFromBackend(row.brief) : null,
    };
  },
  requirementReplay: async ({ user, params }) => {
    // Rebuilt from what the backend stores: the bundle, the audit log of the requirement and its case,
    // the board of the caller's weight profile, and the backend's own recheck of quotes and records.
    const b = await backendHandlers.requirementBundle({ user, params, query: {}, body: undefined } as Parameters<Handlers["requirementBundle"]>[0]);
    const x = await ctx(user);
    const caseId = encodeURIComponent(b.case.id);
    const [reqEvents, caseEvents, all, profiles, plan, rows, integrity] = await Promise.all([
      get<Row[]>(user, "/audit", { object_id: params.id, limit: 1000 }),
      get<Row[]>(user, "/audit", { object_id: b.case.id, limit: 1000 }),
      users(user),
      profilesOf(user, x.ws.config_id).then((ps) => ps.map((p) => profileFromBackend(p, x.ws.config.name))),
      get(user, `/plans/${b.requirement.series}`).then(planFromBackend).catch(() => null),
      board(user, x.profileId),
      get(user, `/cases/${caseId}/integrity`, { vehicle: b.requirement.series }),
    ]);
    // One log, oldest first: the backend lists newest first, and an event can be in both lists.
    const events = [...new Map([...reqEvents, ...caseEvents].map((e) => [Number(e.seq), e])).values()].sort((e1, e2) => Number(e1.seq) - Number(e2.seq)).map(auditFromBackend);
    const d = mini({ requirements: [b.requirement], cases: [b.case], signals: b.signals, requirementVersions: b.versions, alerts: b.alerts, audit: events, users: all, weightProfiles: profiles, plans: plan ? [plan] : [] });
    const out = buildReplay(d, b.requirement, { partialLog: true });
    const refs = [...new Set(out.quoteIds.map((sid) => b.signals.find((sg) => sg.id === sid)?.recordRef).filter((r): r is string => !!r))];
    const records = refs.length ? await backend<Row[]>(user.id, "POST", "/source-records/lookup", { body: { record_ids: refs } }) : [];
    const row = rows.find((r) => r.id === b.case.id);
    const profile = profiles.find((p) => p.id === x.profileId) ?? profiles[0];
    await logAccess(user, "view", "requirement", params.id, "Trace replay opened");
    return {
      ...out,
      sourceRecords: records.map((r) => ({ ref: r.record_id, sourceName: r.source_name, url: r.url && /^https?:/.test(r.url) ? r.url : undefined, text: r.text_original, sha256: r.content_hash, fetchedAt: String(r.fetched_at), synthetic: false })),
      // The rank the PM sees on the board, under their own weight profile.
      scoreToday: { score: Number(row?.score ?? 0), rank: row?.rank ?? 0, of: rows.length, profileName: profile?.name ?? "" },
      integrity: [
        {
          id: "quotes_in_source" as const,
          label: "Every quote is found in its source record",
          ok: integrity.quote_failure_count === 0,
          detail: `${integrity.quotes_found} of ${integrity.signals} quotes found word for word in ${integrity.records} stored records (rechecked now)`,
          failures: integrity.quote_failures,
        },
        {
          id: "record_hashes" as const,
          label: "Every source record is stored with the hash taken at capture",
          ok: integrity.record_failure_count === 0,
          detail: `${integrity.records_intact} of ${integrity.signals} signals point to an intact record with its hash`,
          failures: integrity.record_failures,
        },
        ...out.integrity.filter((c) => c.id !== "quotes_in_source" && c.id !== "record_hashes"),
      ],
    };
  },
  patchRequirement: async ({ user, params, body }) => {
    const { row, requirement, x } = await loadRequirement(user, params.id);
    const id = encodeURIComponent(params.id);
    // The car area always follows the case's topic. The argument sheet is the PM's presentation, not a version.
    const { manualRank, carArea: _carArea, argumentMd, ...content } = body.patch;
    void _carArea;
    if (argumentMd !== undefined) await send(user, "PATCH", `/requirements/${id}`, { argument_md: argumentMd ?? "", rationale: body.rationale });
    if (manualRank !== undefined) await send(user, "POST", `/requirements/${id}/rank`, { rank: manualRank, reason: body.rationale });
    if (Object.keys(content).length) {
      const prev = snapshotFromBackend(row);
      const next = { ...prev, ...content } as RequirementSnapshot;
      if (content.description !== undefined) next.descriptionParts = sentences(content.description);
      next.provenance = retagEdits(prev, next, body.rationale);
      await send(user, "PATCH", `/requirements/${id}`, { ...requirementFieldsToBackend({ ...content, descriptionParts: next.descriptionParts, provenance: next.provenance }), rationale: body.rationale, expected_version: row.body_version });
    }
    const fresh = (await loadRequirement(user, params.id, x)).requirement;
    if (Object.keys(content).length) await runCheck(user, fresh, `After version ${fresh.version}`, x);
    void requirement;
    return fresh;
  },
  transitionRequirement: async ({ user, params, body }) => {
    const { row, x } = await loadRequirement(user, params.id);
    const issues = body.action === "approve" ? ((row.check?.issues ?? []) as Row[]) : [];
    const red = issues.filter((i) => i.severity === "red").length;
    await send(user, "POST", `/requirements/${encodeURIComponent(params.id)}/transition`, { action: body.action, rationale: body.rationale, open_issues: issues.length ? { red, amber: issues.length - red } : undefined });
    return (await loadRequirement(user, params.id, x)).requirement;
  },
  addFeedback: async ({ user, params, body }) => {
    const { row, requirement } = await loadRequirement(user, params.id);
    const id = encodeURIComponent(params.id);
    const stored = await send(user, "POST", `/requirements/${id}/feedback`, { source: body.from, text: body.text, response: body.response, rationale: body.rationale, signal_ids: body.signalIds ?? [] });
    const fb: FeedbackEntry = feedbackFromBackend(stored);
    // The next version is proposed, never applied: a minimal patch from the feedback and the PM's response.
    const current = snapshotFromBackend(row);
    const draft = feedbackPatch(current, fb);
    const summary = `v${requirement.version + 1}: ${changeSummary(current, draft)} (${addresseeLabel[fb.from].toLowerCase()} feedback, you ${feedbackResponseLabel[fb.response].toLowerCase()})`;
    const [proposal] = await saveProposals(user, [{ objectType: "requirement", objectId: params.id, source: "feedback", kind: "new_version", summary, changes: [{ field: "version", before: current, after: draft }], citations: fb.signalIds }], "drafter");
    await send(user, "PATCH", `/requirements/feedback/${fb.id}`, { proposal_id: proposal.id });
    return { feedback: { ...fb, proposalId: proposal.id }, proposal };
  },
  runRequirementCheck: async ({ user, params }) => {
    const { requirement, x } = await loadRequirement(user, params.id);
    return runCheck(user, requirement, `Run by ${user.name}`, x);
  },

  // Scoring
  scores: async ({ user, query }) => {
    const x = await ctx(user);
    const profileId = query.profileId ?? x.profileId;
    const profiles = await profilesOf(user, x.ws.config_id);
    const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
    const [cases, reqs] = await Promise.all([board(user, profile.id), reqBoard(user, profile.id)]);
    return scoresFrom(profile.id, weightsFromBackend(profile.case_weights), cases, reqs.filter((r) => r.status !== "rejected"));
  },
  previewScores: async ({ user, body }) => {
    const x = await ctx(user);
    const out = await backend<Row>(user.id, "POST", "/scores/preview", { body: { profile_id: x.profileId, weights: weightsToBackend(body.weights) } });
    return scoresFrom("preview", weightsFromBackend(out.weights), out.cases, out.requirements);
  },
  weightProfiles: async ({ user }) => {
    const x = await ctx(user);
    return (await profilesOf(user, x.ws.config_id)).map((p) => profileFromBackend(p, x.ws.config.name));
  },
  saveWeightProfile: async ({ user, params, body }) => {
    const x = await ctx(user);
    const current = (await profilesOf(user, x.ws.config_id)).find((p) => p.id === params.id);
    if (!current) throw new ApiError(404, "Weight profile not found in your config");
    const p = await send(user, "PATCH", `/profiles/${params.id}`, { name: body.name, description: body.description, case_weights: body.weights ? weightsToBackend(body.weights, current.case_weights) : undefined, cost_multipliers: body.costMultiplier, is_default: body.isDefault, rationale: "Saved in the weights panel" });
    return profileFromBackend(p, x.ws.config.name);
  },
  createWeightProfile: async ({ user, body }) => {
    const x = await ctx(user);
    const base = (await profilesOf(user, x.ws.config_id)).find((p) => p.id === x.profileId);
    const p = await send(user, "POST", `/configs/${x.ws.config_id}/profiles`, { name: body.name, description: body.description, case_weights: weightsToBackend(body.weights, base?.case_weights ?? {}), cost_multipliers: body.costMultiplier, rationale: body.description || "Created in the weights panel" });
    return profileFromBackend(p, x.ws.config.name);
  },
  brandProfile: ({ user }) => brandProfile(user),
  saveBrandProfile: async ({ user, body }) => {
    await send(user, "POST", "/brand-profile", { body_md: body.notesMd, pillars: body.pillars, do_not: body.doNot, rationale: "Edited in the settings" });
    return brandProfile(user);
  },

  // Routing
  referrals: async ({ user }) => (await get<Row[]>(user, "/referrals")).map(referralFromBackend),
  decideReferral: async ({ user, params, body }) => referralFromBackend(await send(user, "POST", `/referrals/${params.id}/decision`, body)),
  innovation: async ({ user }) => {
    const x = await ctx(user);
    const items = await get<Row[]>(user, "/innovation");
    return Promise.all(items.map(async (i) => ({ meta: innovationFromBackend(i), case: (await loadCase(user, i.case_id, x)).case })));
  },
  voteInnovation: async ({ user, params }) => innovationFromBackend(await send(user, "POST", `/innovation/${encodeURIComponent(params.caseId)}/vote`)),
  pullInnovation: async ({ user, params, body }) => {
    await send(user, "POST", `/innovation/${encodeURIComponent(params.caseId)}/pull`, { vehicle: body.series, rationale: body.rationale });
    return (await loadCase(user, params.caseId)).case;
  },

  // Vehicle plan and hand-off
  plan: async ({ user, params }) => planFromBackend(await get(user, `/plans/${params.series}`)),
  patchPlanFeature: async ({ user, params, body }) => {
    const p = body.patch;
    return planFromBackend(await send(user, "PATCH", `/plans/${params.series}/features/${encodeURIComponent(params.featureId)}`, { action: p.action, note: p.note, release: p.release ? releaseToBackend(p.release) : undefined, is_protected: p.protected, rationale: body.rationale }));
  },
  exportRequirements: async ({ user, body }) => {
    const x = await ctx(user);
    const [rows, cases] = await Promise.all([reqBoard(user, x.profileId), board(user, x.profileId)]);
    const byCase = new Map(cases.map((c) => [c.id, c]));
    const list = rows.filter((r) => r.vehicle === body.series && (body.requirementIds ? body.requirementIds.includes(r.id) : ["signed_off", "planned", "exported"].includes(r.status)));
    const out = list.map((row) => {
      const r = requirementFromBackend(row, x.owner(row.vehicle));
      const c = byCase.get(row.case_id);
      return {
        ID: r.id,
        Summary: r.title,
        Description: r.description,
        Category: r.carArea,
        Market: r.marketScope,
        Release: r.releaseTarget,
        Priority: row.rank,
        Score: row.rank_score ?? "",
        "Evidence level": r.evidenceLevel,
        Metrics: r.metrics.map((m) => `${m.question}: ${m.target} (${m.basis})`).join(" | "),
        "Acceptance criteria": r.acceptanceCriteria.join(" | "),
        Assumptions: r.assumptions.join(" | "),
        "Cost size": r.cost.size,
        "Cost band": `${r.cost.eurBand} (${r.cost.source})`,
        "Linked case": r.caseId,
        "Linked findings": r.provenance.flatMap((p) => p.signalIds).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).join(" "),
        Rationale: c?.rationale ?? "",
        Provenance: provenanceLine(r),
        Version: r.version,
        Status: r.status,
      };
    });
    let content: string;
    if (body.format === "json") content = JSON.stringify(out, null, 2);
    else {
      const cols = out[0] ? Object.keys(out[0]) : ["ID"];
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      content = [cols.join(","), ...out.map((r) => cols.map((k) => esc(r[k as keyof typeof r])).join(","))].join("\n");
    }
    // The hand-over moves every planned requirement to exported (each one audited by the backend).
    for (const r of list.filter((r) => r.status === "planned")) await send(user, "POST", `/requirements/${encodeURIComponent(r.id)}/transition`, { action: "export", rationale: `Exported to Codebeamer (${body.format})` });
    await logAccess(user, "export", "vehicle_plan", body.series, `${out.length} requirements exported as ${body.format === "json" ? "JSON" : "Codebeamer CSV"}: ${out.map((r) => r.ID).join(", ") || "none"}`);
    const day = new Date().toISOString().slice(0, 10);
    return { filename: `requirements_${body.series}_${day}.${body.format === "json" ? "json" : "csv"}`, mime: body.format === "json" ? "application/json" : "text/csv", content, count: out.length };
  },
  requirementDeck: async ({ user, params }) => {
    const x = await ctx(user);
    const series = params.series as Series;
    const [rows, plan, profiles] = await Promise.all([reqBoard(user, x.profileId), get(user, `/plans/${series}`), profilesOf(user, x.ws.config_id)]);
    const weights = weightsFromBackend((profiles.find((p) => p.id === x.profileId) ?? profiles[0]).case_weights);
    const total = FactorKeys.options.reduce((s, f) => s + (weights[f] ?? 0), 0) || 1;
    const sev = { defect: 0, difficult_to_use: 1, wish: 2, none: 3 } as const;
    const list = rows.filter((r) => r.vehicle === series && ["signed_off", "planned", "exported"].includes(r.status));
    const slides = [];
    for (const row of list) {
      const { row: full, requirement: r } = await loadRequirement(user, row.id, x);
      const { page, case: c } = await loadCase(user, r.caseId, x);
      const signals = await caseSignals(user, r.caseId, series);
      const quotes = signals
        .filter((s) => s.sourceType === "bmw_feedback" && s.kind !== "like")
        .sort((a, b) => Number(a.kind !== "complaint") - Number(b.kind !== "complaint") || sev[a.severity] - sev[b.severity])
        .slice(0, 3)
        .map((s) => {
          const text = (s.quoteEn ?? s.quote).replace(/\s+/g, " ").trim();
          return { ref: s.id, market: s.market, text: text.length > 240 ? `${text.slice(0, 237).replace(/\s+\S*$/, "")}…` : text };
        });
      const comp = signals.filter((s) => s.kind === "competitor_fact").slice(0, 3);
      const name = (actor: string) => x.all.find((u) => u.id === actor.split(":").pop())?.name ?? actor;
      const decisions = [...(full.decisions as Row[]), ...(page.decisions as Row[]).filter((d) => !d.vehicle || d.vehicle === series)]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 5)
        .map((d) => ({ at: String(d.created_at), actor: name(d.actor), action: String(d.action).replace("_", " "), rationale: d.rationale ?? undefined }));
      const issues = ((full.check?.issues ?? []) as Row[]).filter(() => full.check?.version === full.body_version);
      const red = issues.filter((i) => i.severity === "red").length;
      slides.push({
        requirementId: r.id,
        rank: row.rank,
        score: Number(row.rank_score ?? 0),
        title: r.title,
        description: r.description,
        status: r.status,
        release: r.releaseTarget,
        marketScope: r.marketScope,
        evidenceLevel: r.evidenceLevel,
        metrics: r.metrics,
        quotes,
        factors: FactorKeys.options.map((f) => {
          const weight = (weights[f] ?? 0) / total;
          return { factor: f, value: c.factors[f] ?? 0, weight: Math.round(weight * 1000) / 1000, contribution: Math.round(weight * (c.factors[f] ?? 0) * 1000) / 1000 };
        }),
        competitor: comp.length ? comp.map((s) => `${s.competitor ?? s.sourceName}: ${s.summary}`) : c.figures.competitorOffer,
        decisions,
        openIssues: { red, amber: issues.length - red },
        provenance: provenanceCounts(r),
        version: r.version,
        caseId: c.id,
        caseTitle: c.title,
        ownerName: x.all.find((u) => u.id === r.ownerId)?.name ?? r.ownerId,
      });
    }
    await logAccess(user, "export", "vehicle_plan", series, `Engineering deck with ${slides.length} requirements: ${slides.map((sl) => sl.requirementId).join(", ") || "none"}`);
    const now = new Date().toISOString();
    return { filename: `engineering-round_${series}_${now.slice(0, 10)}.pptx`, series, successorName: plan.successor_name, generatedAt: now, slides };
  },

  // Conversation
  messages: async ({ user, params }) => {
    const [rows, proposals] = await Promise.all([get<Row[]>(user, `/chat/${params.type}/${encodeURIComponent(params.id)}`), get<Row[]>(user, "/proposals", { object_type: params.type, object_id: params.id })]);
    return rows.map((m) => chatFromBackend(m, proposals, () => "Signal"));
  },
  postMessage: async ({ user, params, body }) => {
    const type = params.type as "case" | "requirement";
    const id = encodeURIComponent(params.id);
    const x = await ctx(user);
    const caseId = type === "requirement" ? (await loadRequirement(user, params.id, x)).row.case_id : params.id;
    const { page, case: c, vehicle } = await loadCase(user, caseId, x);
    const signals = await caseSignals(user, caseId, vehicle);
    const label = signalLabel(signals);
    const full = { ...c, signalIds: signals.map((s) => s.id) };
    const say = (content: string) => send(user, "POST", `/chat/${type}/${id}/messages`, { role: "pm", content, segment: body.segment });

    if (body.segment) {
      // "Ask the segment": answered only from that segment's BMW verbatims; no evidence means it says so.
      const seg = await segmentReply(mini({ signals }), full, type, params.id, body.segment);
      if (!seg) throw new ApiError(400, `Unknown segment ${body.segment} for ${c.id}.`);
      const userMsg = await say(body.content);
      const proposals = await saveProposals(user, seg.proposals, "segment");
      const reply = await postAgentMessage(user, type, params.id, seg.text, "segment", seg.citations.map((ci) => ci.ref).filter((ref) => signals.some((s) => s.id === ref)), body.segment);
      const messages: ChatMessage[] = [chatFromBackend(userMsg, [], label), { ...chatFromBackend(reply, [], label), proposalIds: proposals.map((p) => p.id) }];
      return { messages, proposals };
    }

    // A reply to the shape questions pre-fills the form of step 3 (the PM's own answer, layer 3).
    const thread = await get<Row[]>(user, `/chat/case/${encodeURIComponent(caseId)}`);
    const lastAgent = [...thread].reverse().find((m) => m.role === "agent");
    if (type === "case" && lastAgent?.content.startsWith("Before I draft")) {
      const [brand, siblings] = await Promise.all([brandProfile(user), caseRequirements(user, page, x)]);
      const questions = composeShapeQuestions(shapeInput(user, c, signals, brand, x, siblings, null));
      const text = body.content.toLowerCase();
      const picked = questions.map((q) => ({ q, o: q.options.find((o) => text.includes(o.value.replace("_", " ")) || text.includes(o.label.toLowerCase())) })).filter((p): p is { q: ShapeQuestion; o: { value: string; label: string } } => !!p.o);
      if (picked.length) {
        const mine = c.stances.find((s) => s.authorId === user.id);
        const pending = [...(mine?.pendingShape ?? []).filter((a) => !picked.some((p) => p.q.key === a.key)), ...picked.map((p) => ({ key: p.q.key, value: p.o.value }))];
        const userMsg = await say(body.content);
        await send(user, "PUT", `/cases/${id}/stance`, { overrides: mine?.overrides ?? {}, override_reasons: mine?.overrideReasons ?? {}, evidence_takes: mine?.evidenceTakes ?? [], inside: mine?.inside ?? [], ambition: mine?.ambition ?? null, pending_shape: pending });
        const reply = await postAgentMessage(user, type, params.id, `Noted: ${picked.map((p) => `**${shapeKeyLabel[p.q.key]}** → ${p.o.label}`).join(", ")}. The form in step 3 is pre-filled; press **Create requirements** when you're ready.`, "drafter");
        return { messages: [chatFromBackend(userMsg, [], label), chatFromBackend(reply, [], label)], proposals: [] };
      }
    }

    // Everything else goes to the backend's assistant: retrieval over the stored sources, cited answers.
    const answer = await send(user, "POST", `/chat/${type}/${id}`, { question: body.content });
    const proposals = answer.proposal_id ? await get<Row[]>(user, "/proposals", { object_type: type, object_id: params.id, status: "pending" }) : [];
    const fresh = await get<Row[]>(user, `/chat/${type}/${id}`);
    const userMsg = [...fresh].reverse().find((m) => m.role === "pm");
    return { messages: [...(userMsg ? [chatFromBackend(userMsg, [], label)] : []), chatFromBackend(answer, proposals, label)], proposals: proposals.filter((p) => p.id === answer.proposal_id).map(proposalFromBackend) };
  },
  argusAsk: async ({ user, body }) => {
    // Attached cases and requirements go to the backend's assistant (the Q&A also lands in that object's thread);
    // signals and questions without an attachment are answered from search. Nothing is edited from here.
    const x = await ctx(user);
    const citations: { ref: string; label: string; href: string }[] = [];
    const parts: { title: string; text: string }[] = [];
    // Backend citations are signal UUIDs; a short uppercase token keeps them clickable in the chat.
    const short = (text: string, caseId: string) =>
      rewriteCitations(text).replace(/\[([0-9a-f]{8})-[0-9a-f-]{27}\]/gi, (m, head: string) => {
        const ref = `SIG-${head.toUpperCase()}`;
        citations.push({ ref, label: "Signal", href: `/cases/${caseId}?signal=${m.slice(1, -1)}` });
        return `[${ref}]`;
      });
    for (const a of body.attachments.slice(0, 3)) {
      if (a.kind === "signal") {
        const hit = (await get<Row[]>(user, "/search", { q: a.id, vehicle: x.vehicle })).find((h) => h.type === "signal" && h.id === a.id);
        if (hit) {
          citations.push({ ref: a.id, label: a.id, href: hit.case_id ? `/cases/${hit.case_id}?signal=${a.id}` : `/radar?signal=${a.id}` });
          parts.push({ title: a.id, text: [`[${a.id}] ${hit.title ?? ""}`, hit.subtitle ?? "", hit.case_id ? "Open its case to see the quote in context." : ""].filter(Boolean).join("\n\n") });
        }
        continue;
      }
      const caseId = a.kind === "requirement" ? (await loadRequirement(user, a.id, x)).row.case_id : a.id;
      const answer = await send(user, "POST", `/chat/${a.kind}/${encodeURIComponent(a.id)}`, { question: body.content });
      const note = answer.proposal_id ? `\n\n_I proposed an edit on ${a.id}; accept or reject it on its page._` : "";
      parts.push({ title: a.id, text: short(answer.content ?? "", caseId) + note });
    }
    if (parts.length) {
      const content = parts.length === 1 ? parts[0].text : parts.map((p) => `**${p.title}**\n\n${p.text}`).join("\n\n---\n\n");
      return { content, citations: [...new Map(citations.map((c) => [c.ref, c])).values()] };
    }
    const words = body.content.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
    const cases = new Map<string, Row>();
    for (const q of [body.content, ...words.sort((a, b) => b.length - a.length).slice(0, 3)]) {
      for (const h of await get<Row[]>(user, "/search", { q, vehicle: x.vehicle })) if (h.type === "case" && cases.size < 5) cases.set(h.id, h);
      if (cases.size >= 5) break;
    }
    if (!cases.size) return { content: "I found no case for that. Drag a case or requirement here and ask about it.", citations: [] };
    const list = [...cases.values()];
    return {
      content: ["These cases match your question:", "", ...list.map((h) => `- [${h.id}] **${h.title ?? h.id}**${h.subtitle ? ` · ${h.subtitle}` : ""}`), "", "_Drag one here to ask about its evidence._"].join("\n"),
      citations: list.map((h) => ({ ref: h.id, label: h.id, href: `/cases/${h.id}` })),
    };
  },
  decideProposal: async ({ user, params, body }) => {
    const all = await get<Row[]>(user, "/proposals", {});
    const p = all.find((x) => x.id === params.id);
    if (!p) throw new ApiError(404, "Proposal not found");
    if (p.status !== "pending") throw new ApiError(409, "Proposal already decided.");
    const why = body.rationale ?? p.summary;
    const oid = encodeURIComponent(p.object_id);
    const first = (p.changes as Row[])[0];
    // Accepting applies the change through the object's own audited endpoint, then records the decision.
    if (body.decision === "accept" && !p.chat_message_id) {
      if (p.object_type === "brief") {
        await send(user, "POST", `/briefs/${oid}/fields/${first.field as BriefFieldKey}`, { value: first.after, source: p.source === "strategy_doc" ? "doc" : "pm", reason: p.citations?.[0] ? `From your strategy doc: "${p.citations[0]}"` : why });
      } else if (p.kind === "new_version") {
        const { row } = await loadRequirement(user, p.object_id);
        const fb = (row.feedback as Row[]).find((f) => f.proposal_id === p.id);
        await send(user, "PATCH", `/requirements/${oid}`, { ...requirementFieldsToBackend(first.after as RequirementSnapshot), rationale: why, cause: p.source === "brief_change" ? "brief_change" : "feedback", feedback_id: fb?.id });
      } else if (p.kind === "question_answer") {
        await send(user, "PATCH", `/questions/${p.question_id}`, { answer: String(first?.after ?? ""), answer_source: p.source === "chat" ? "chat" : "meeting_note" });
      } else if (p.kind === "new_question") {
        const spec = first.after as Row;
        await send(user, "POST", `/${p.object_type}s/${oid}/questions`, { addressee: spec.addressee, question: spec.question, why: spec.why ?? "" });
      } else if (p.kind === "new_requirement") {
        const { vehicle } = await loadCase(user, p.object_id);
        const [created] = await send<Row[]>(user, "POST", `/cases/${oid}/vehicles/${vehicle}/requirements/draft`, { market_scope: (first.after as RequirementSnapshot).marketScope ?? "global" });
        if (created) await send(user, "PATCH", `/requirements/${encodeURIComponent(created.id)}`, { ...requirementFieldsToBackend(first.after as RequirementSnapshot), rationale: why });
      } else if (p.object_type === "requirement") {
        const patch = Object.fromEntries((p.changes as Row[]).map((ch) => [ch.field, ch.after]));
        await send(user, "PATCH", `/requirements/${oid}`, { ...requirementFieldsToBackend(patch), rationale: why });
      } else {
        const { case: c } = await loadCase(user, p.object_id);
        const patch = Object.fromEntries((p.changes as Row[]).map((ch) => [ch.field, ch.after])) as Row;
        if (patch.bodyMd === undefined && patch.title === undefined) throw new ApiError(422, `This proposal changes ${Object.keys(patch).join(", ")}; apply it on the case page, then reject or accept it here.`);
        await send(user, "PUT", `/cases/${oid}/page`, { body_md: patch.bodyMd ?? c.bodyMd, title: patch.title, expected_version: c.bodyVersion });
      }
    }
    return proposalFromBackend(await send(user, "POST", `/proposals/${params.id}/decision`, { accept: body.decision === "accept", note: body.rationale }));
  },
  comments: async ({ user, query }) => (await get<Row[]>(user, "/comments", { object_type: query.objectType, object_id: query.objectId })).map(commentFromBackend),
  addComment: async ({ user, body }) => commentFromBackend(await send(user, "POST", "/comments", { object_type: body.objectType, object_id: body.objectId, body: body.body })),

  // Inbox and monitoring
  notifications: async ({ user }) => {
    const rows = await get<Row[]>(user, "/notifications", { limit: 100 });
    return rows.map(
      (n): Notification => ({
        id: n.id,
        userId: user.id,
        kind: UI_KINDS.has(n.type) ? n.type : (NOTIFICATION_KIND[n.type] ?? "alert"),
        title: n.title ?? String(n.type).replaceAll("_", " "),
        body: n.message,
        link: n.link ?? (n.object_type === "case" ? `/cases/${n.object_id}` : n.object_type === "requirement" ? `/requirements/${n.object_id}` : "/radar"),
        actorId: n.actor ? (n.actor.startsWith("agent:") ? n.actor : n.actor.split(":").pop()) : undefined,
        read: n.read,
        createdAt: String(n.created_at),
      }),
    );
  },
  readNotifications: async ({ user, body }) => {
    if (body.ids) for (const id of body.ids) await send(user, "POST", `/notifications/${id}/read`);
    else await send(user, "POST", "/notifications/read-all");
    return { ok: true as const };
  },
  alerts: async ({ user, query }) => (await get<Row[]>(user, "/alerts", { all: query.all ? true : undefined })).map((a) => alertFromBackend(a, user.id)),
  resolveAlert: async ({ user, params, body }) => alertFromBackend(await send(user, "POST", `/alerts/${params.id}/resolve`, body), user.id),

  // Competitor ripple: produced by the demo agent run (Refresh), which the live backend doesn't
  // offer yet. The conversion table is the team assumption the drafter already uses.
  ripples: () => [],
  ripple: ({ params }) => {
    throw new ApiError(404, `Ripple ${params.id} not found: competitor ripples come from the demo agent run; the live backend doesn't create them yet.`);
  },
  decideRippleItem: ({ params }) => {
    throw new ApiError(404, `Ripple ${params.id} not found: competitor ripples come from the demo agent run; the live backend doesn't create them yet.`);
  },
  conversions: () => teamConversions,
  saveConversion: () => {
    throw new ApiError(501, "The live backend doesn't store conversion factors yet; the team assumption stays as configured.");
  },
  monitorSettings: () => defaultMonitorSettings,
  saveMonitorSettings: () => {
    throw new ApiError(501, "The live backend doesn't store monitor settings yet; the defaults apply.");
  },

  // Oversight
  audit: async ({ user, query }) => (await get<Row[]>(user, "/audit", { object_id: query.objectId, actor_type: query.actorType, limit: query.limit ?? 200 })).map(auditFromBackend),
  portfolio: async ({ user }) => {
    // Head overview (not in the navigation): counts of the caller's line from the board.
    const x = await ctx(user);
    const [cases, reqs] = await Promise.all([board(user, x.profileId), reqBoard(user, x.profileId)]);
    const mapped = cases.map((r) => caseFromBackend(r, x.owner(r.vehicle)));
    const states = ["observed", "new", "investigating", "awaiting_answers", "ready", "decided"] as const;
    const statuses = ["draft", "in_discussion", "pm_approved", "signed_off", "planned", "exported", "rejected"] as const;
    const rs = reqs.map((r) => requirementFromBackend(r, x.owner(r.vehicle)));
    const sales = await cached("configs", 60_000, () => get<Row[]>(user, "/configs"));
    return {
      series: [
        {
          series: x.vehicle,
          name: x.ws.config.name,
          ownerIds: x.all.filter((u) => u.role === "vehicle_pm" && u.series.includes(x.vehicle) && u.series.length < 3).map((u) => u.id),
          casesByState: Object.fromEntries(states.map((s) => [s, mapped.filter((c) => c.state === s).length])) as Record<Case["state"], number>,
          casesByOutcome: mapped.reduce<Record<string, number>>((acc, c) => (c.outcome ? { ...acc, [c.outcome]: (acc[c.outcome] ?? 0) + 1 } : acc), {}),
          requirementsByStatus: Object.fromEntries(statuses.map((s) => [s, rs.filter((r) => r.status === s).length])) as Record<Requirement["status"], number>,
          topRequirements: reqs.slice(0, 5).map((r) => ({ id: r.id, title: r.title ?? r.id, score: Number(r.rank_score ?? 0), status: requirementFromBackend(r, user.id).status })),
          staleCases: 0,
          conflicts: mapped.filter((c) => c.marketConflict && c.state !== "decided").length,
          openAlerts: 0,
          volume2030: Object.fromEntries(sales.filter((c) => c.vehicle === x.vehicle).map((c) => [marketFromBackend(c.market) as Market, c.sales_2030 ?? 0])),
        },
      ],
      workload: [],
    };
  },
  // Real data is never reset from the UI.
  reset: () => {
    invalidateCache();
    return { ok: true as const };
  },
};
