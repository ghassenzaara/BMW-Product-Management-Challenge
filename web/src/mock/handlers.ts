import { stringify as toYaml } from "yaml";
import type { z } from "zod";
import type {
  Case,
  CaseState,
  ChatMessage,
  Dataset,
  EndpointName,
  endpoints,
  Market,
  OpenQuestion,
  Proposal,
  Referral,
  Requirement,
  RequirementStatus,
  Signal,
  TaxonomyResponse,
  User,
} from "@/contracts";
import { ApiError, audit, db, must, nextId, notify, now, resetStore } from "./store";
import { computeScores } from "./scoring";
import { draftRequirements } from "./ai/drafts";
import { cite, followUpQuestions, scriptedReply, type ProposalDraft } from "./ai/chat";
import { extractFromNote } from "./ai/notes";
import { liveChatEnabled, liveReply } from "./ai/live";
import { refreshPool } from "./authored/world";
import { webSpecToSignal } from "./convert";
import taxonomyData from "./fixtures/taxonomy.json";

type Ep = typeof endpoints;
type In<T> = T extends z.ZodType ? z.output<T> : undefined;
export interface Ctx<K extends EndpointName> {
  params: Record<string, string>;
  query: Ep[K] extends { query: infer Q } ? In<Q> : Record<string, never>;
  body: Ep[K] extends { body: infer B } ? In<B> : undefined;
  user: User;
}
type Out<K extends EndpointName> = z.input<Ep[K]["response"]>;
type Handlers = { [K in EndpointName]: (ctx: Ctx<K>) => Out<K> | Promise<Out<K>> };

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

function recomputeFigures(d: Dataset, c: Case) {
  const sigs = caseSignals(d, c);
  const markets = new Set<Market>(c.markets);
  sigs.forEach((s) => s.market !== "unknown" && markets.add(s.market));
  const old = new Map(c.figures.perMarket.map((m) => [m.market, m]));
  c.markets = [...markets];
  c.figures.perMarket = [...markets].map((m) => {
    const inM = sigs.filter((s) => s.market === m && s.sourceType !== "bmw_study" && s.kind !== "competitor_fact");
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
  const customers = sigs.filter((s) => s.sourceType !== "bmw_study" && !["competitor_fact", "trend"].includes(s.kind)).length;
  c.factors.customers = Math.round(Math.min(1, Math.log10(1 + customers) / Math.log10(61)) * 100) / 100;
}

function createRequirement(d: Dataset, c: Case, draft: ReturnType<typeof draftRequirements>[number], actorId: string): Requirement {
  const prefix = `REQ-${c.series}-${draft.marketScope === "CN" ? "CN-" : ""}`;
  const r: Requirement = {
    id: nextId(prefix, d.requirements),
    caseId: c.id,
    series: c.series,
    variantOf: null,
    status: "draft",
    carArea: c.carArea,
    changeDepth: c.changeDepth,
    ownerId: c.ownerId,
    manualRank: null,
    plannedFeatureId: null,
    createdAt: now(),
    updatedAt: now(),
    synthetic: true,
    ...draft,
  };
  d.requirements.push(r);
  c.requirementIds.push(r.id);
  audit({ actorId, action: "requirement.drafted", objectType: "requirement", objectId: r.id, after: { title: r.title }, rationale: `Generated from ${c.id}` });
  return r;
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
    pmContext: null,
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
    return { user, workspace: workspaceOf(d, user.id), weightProfile: profileOf(d, user.id) };
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
    const fresh = refreshPool.filter((spec, i) => !d.signals.some((s) => s.id === `SIG-REFRESH-${i}`)).map((spec) => ({ spec, i: refreshPool.indexOf(spec) }));
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
        if (s.kind === "competitor_fact" && s.metric) {
          const alertId = nextId("AL-", d.alerts);
          d.alerts.push({
            id: alertId,
            ownerId: c.ownerId,
            caseId: c.id,
            requirementId: null,
            verdict: "raises_the_bar",
            title: `${s.competitor}: ${s.summary}`,
            detail: `New competitor fact (trust ${s.trust}) may raise the bar for ${c.id}. Today: ${c.figures.equipmentToday}.`,
            signalIds: [s.id],
            status: "open",
            createdAt: now(),
          });
          audit({ actorId: "agent:monitor", action: "alert.raised", objectType: "case", objectId: c.id, after: { alertId, verdict: "raises_the_bar" } });
          notify({ userId: c.ownerId, kind: "alert", title: "Competitor raises the bar", body: s.summary, link: `/cases/${c.id}`, actorId: "agent:monitor" });
          notes++;
        }
      }
    }
    const run = {
      id: nextId("RUN-live-", d.agentRuns, 2),
      agent: "customer_public" as const,
      series: body.series,
      startedAt,
      endedAt: now(),
      status: "ok" as const,
      valid: added.length,
      rejected: added.length ? 1 : 0,
      newSignals: added.length,
      llmCostUsd: Math.round((0.3 + added.length * 0.08) * 100) / 100,
      note: added.length ? `Watchlist run triggered by ${user.name}` : "No new findings: all URLs already seen (dedupe by URL and content hash)",
    };
    d.agentRuns.push(run);
    audit({ actorId: "agent:fetcher", action: "signals.fetched", objectType: "signal", objectId: run.id, after: { newSignals: added.length }, rationale: `Refresh by ${user.id}` });
    return { run, signals: added, notifications: notes };
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
    const prefix = `CASE-${body.series}-${body.scope === "CN" ? "CN-" : ""}`;
    const id = nextId(prefix, d.cases.filter((c) => (body.scope === "CN" ? c.id.includes("-CN-") : !c.id.includes("-CN-"))));
    const c: Case = {
      id,
      title: body.title,
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
      carArea: body.carArea,
      type: body.type,
      changeDepth: body.changeDepth,
      featureName: body.title,
      highlights: [body.summary],
      topicId: mostFrequentTopic(d.signals.filter((s) => body.signalIds.includes(s.id))),
      pmContext: null,
      bodyMd: `## Problem\n\n${body.summary}\n\n## Who is affected\n\n_To fill._\n\n## Evidence summary\n\n${body.signalIds.length} signals selected on the radar.\n\n## Today's car\n\n_To fill._\n\n## Competitors\n\n_To fill._\n\n## Brand fit\n\n_AI proposal pending._\n\n## Options considered\n\n_None yet._\n\n## Decision log\n\n- ${now().slice(0, 10)} · Case opened by ${user.name}: ${body.rationale}`,
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
    audit({ actorId: user.id, action: onlyWatch ? "case.watch_changed" : "case.edited", objectType: "case", objectId: c.id, before, after: body.patch, rationale: body.rationale });
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
          c.outcome = "confirmed";
          if (!d.requirements.some((r) => r.caseId === c.id && r.status !== "rejected")) {
            for (const draft of draftRequirements(c, d)) createRequirement(d, c, draft, "agent:requirement_writer");
          }
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
    audit({ actorId: user.id, action: c.state === "decided" && !stateFor[body.action] ? "case.decided" : "case.state_changed", objectType: "case", objectId: c.id, before, after: { state: c.state, outcome: c.outcome, mergedInto: c.mergedInto ?? undefined }, rationale: body.rationale });
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
  savePmContext: ({ params, body, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    assertCaseEditor(user, c);
    const before = c.pmContext;
    c.pmContext = { ...body, updatedAt: now(), updatedBy: user.id };
    const parts = [
      body.marketFocus && `focus ${body.marketFocus}`,
      body.costSensitivity && `cost sensitivity ${body.costSensitivity}`,
      body.positioning && `${body.positioning} positioning`,
      body.timing && `timing ${body.timing}`,
    ].filter(Boolean);
    c.context.pmInputs = c.context.pmInputs.filter((i) => i.ref !== "pm-context");
    c.context.pmInputs.push({ kind: "note", label: "PM knowledge", detail: [parts.join(" · "), body.note].filter(Boolean).join(" — "), at: now(), ref: "pm-context" });
    touch(c);
    audit({ actorId: user.id, action: "case.pm_context_saved", objectType: "case", objectId: c.id, before, after: c.pmContext });
    const message: ChatMessage = {
      id: nextId("MSG-", d.messages),
      objectType: "case",
      objectId: c.id,
      role: "assistant",
      content: followUpQuestions(d, c),
      citations: [],
      proposalIds: [],
      createdAt: now(),
    };
    d.messages.push(message);
    return { case: c, message };
  },
  generateRequirements: ({ params, user }) => {
    const d = db();
    const c = findCase(d, params.id);
    assertCaseEditor(user, c);
    if (c.outcome !== "confirmed") throw new ApiError(409, "Requirements are generated only from confirmed cases.");
    return draftRequirements(c, d).map((draft) => createRequirement(d, c, draft, "agent:requirement_writer"));
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
    };
  },
  patchRequirement: ({ params, body, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    assertReqEditor(user, r);
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(body.patch) as (keyof typeof body.patch)[]) before[k] = structuredClone(r[k]);
    Object.assign(r, body.patch);
    touch(r);
    audit({ actorId: user.id, action: "requirement.edited", objectType: "requirement", objectId: r.id, before, after: body.patch, rationale: body.rationale });
    return r;
  },
  transitionRequirement: ({ params, body, user }) => {
    const d = db();
    const r = findReq(d, params.id);
    const before = r.status;
    const isHead = user.role === "head";
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
    audit({ actorId: user.id, action: "requirement.status_changed", objectType: "requirement", objectId: r.id, before: { status: before }, after: { status: r.status }, rationale: body.rationale });
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

  // Conversation
  messages: ({ params }) => db().messages.filter((m) => m.objectType === params.type && m.objectId === params.id),
  postMessage: async ({ params, body, user }) => {
    const d = db();
    const objectType = params.type as "case" | "requirement";
    const r = objectType === "requirement" ? findReq(d, params.id) : undefined;
    const c = findCase(d, r ? r.caseId : params.id);
    const userMsg: ChatMessage = { id: nextId("MSG-", d.messages), objectType, objectId: params.id, role: "user", authorId: user.id, content: body.content, citations: [], proposalIds: [], createdAt: now() };
    d.messages.push(userMsg);

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
  decideProposal: ({ params, body, user }) => {
    const d = db();
    const p = must(d.proposals.find((x) => x.id === params.id), "Proposal");
    if (p.status !== "pending") throw new ApiError(409, "Proposal already decided.");
    if (body.decision === "reject") {
      p.status = "rejected";
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
          createRequirement(d, c, p.changes[0].after as ReturnType<typeof draftRequirements>[number], user.id);
          break;
        }
      }
      if ("context" in target) target.context.pmInputs.push({ kind: "diff", label: "AI proposal accepted", detail: p.summary, at: now(), ref: p.id });
      touch(target);
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
      after: p.kind === "field" || p.kind === "body" ? Object.fromEntries(p.changes.map((c) => [c.field, c.after])) : p.changes[0]?.after,
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
};
