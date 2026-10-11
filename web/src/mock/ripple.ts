import type {
  Case,
  Dataset,
  Metric,
  MetricKey,
  PortfolioRow,
  Proposal,
  Requirement,
  Ripple,
  RippleDecisionBody,
  RippleFact,
  RippleItem,
  ScoresResponse,
  Series,
  Signal,
  TargetCycle,
  TargetSpec,
  User,
} from "@/contracts";
import { TargetCycle as TargetCycles, gapPct, normalize, verdictLabel, verdictOf } from "@/contracts";
import { movedBecauseFactor } from "@/lib/rank-reasons";
import { ApiError, audit, must, nextId, notify, now } from "./store";
import { computeScores } from "./scoring";
import { scoreSnapshotNow } from "./snapshot";
import { segments } from "./authored/hints";
import { snapshotOf } from "./ai/drafting";

/**
 * The competitor ripple (mock of the monitor's impact service). A new competitor fact is
 * matched by metric key against every requirement target in the portfolio, converted into each
 * target's cycle with the labelled conversion table, judged (behind / at par / still ahead / not
 * comparable), and the cases behind those requirements are re-scored. A competitor update affects
 * requirements, not cases: a case without a target only carries the fact as evidence. Owners get
 * alerts; nothing is edited: every follow-up is a proposal or an audited decision by a person.
 */

const GAP_BUMP = { behind: 0.3, at_par: 0.15, still_ahead: 0, not_comparable: 0 } as const;
const LIVE = (r: Requirement) => !["rejected"].includes(r.status);
const SIGNED = ["signed_off", "planned", "exported"];

export function metricKeyOf(name: string): MetricKey | null {
  if (/10.?[–-]?.?80|charging time/i.test(name)) return "dc_10_80_min";
  if (/range/i.test(name)) return "ev_range";
  return null;
}

const rowOf = (series: Series, scope: string): PortfolioRow => (series === "G60" && scope === "CN" ? "G60_CN" : (series as PortfolioRow));
const cycleOf = (c?: string): TargetCycle => (TargetCycles.options.includes(c as TargetCycle) ? (c as TargetCycle) : "none");
const fmt = (v: number, unit: string, cycle: TargetCycle) => `${v} ${unit}${cycle !== "none" ? ` ${cycle}` : ""}`;
const specOf = (r: Requirement, key: MetricKey): { m: Metric; spec: TargetSpec } | null => {
  const m = r.metrics.find((x) => x.targetSpec?.key === key);
  return m?.targetSpec ? { m, spec: m.targetSpec } : null;
};

interface Comparison {
  theirsNormalized: RippleItem["theirsNormalized"];
  conversionId: string | null;
  gapPct: number | null;
  verdict: RippleItem["verdict"];
  reason: string;
}

/** One comparison: our value (in its cycle and market) against the fact, normalized. */
export function compareWith(d: Dataset, fact: RippleFact, ours: { value: number; unit: string; cycle: TargetCycle; comparator: "gte" | "lte"; market: string }, series: Series, factorOverride: Record<string, number> = {}): Comparison {
  const mine = segments.series[series];
  const theirs = segments.competitors[fact.competitor];
  const none = (reason: string): Comparison => ({ theirsNormalized: null, conversionId: null, gapPct: null, verdict: "not_comparable", reason });
  if (mine && theirs && (mine === "compact") !== (theirs === "compact")) return none(`Different segment: ${series} is ${mine}, ${fact.competitor} is ${theirs}. Listed, not judged.`);
  if (ours.market !== "global" && fact.market !== "unknown" && ours.market !== fact.market) return none(`The fact is for ${fact.market}; this target is for ${ours.market} only.`);
  if (ours.unit !== fact.unit) return none(`Units differ (${ours.unit} vs ${fact.unit}).`);
  const n = normalize(fact.value, fact.cycle, ours.cycle, d.conversions, factorOverride);
  if (!n) return none(`No conversion ${fact.cycle} → ${ours.cycle} on file.`);
  const gap = gapPct(ours.value, n.value, ours.comparator);
  const verdict = verdictOf(gap, d.monitorSettings.atParTolerancePct);
  const conv = n.conversion ? ` ≈ ${fmt(n.value, ours.unit, ours.cycle)} (factor ${n.factor}, range ${n.low}–${n.high}${n.conversion.isAssumption ? ", assumption" : ""})` : "";
  return {
    theirsNormalized: { value: n.value, unit: ours.unit, cycle: ours.cycle, low: n.low, high: n.high },
    conversionId: n.conversion?.id ?? null,
    gapPct: gap,
    verdict,
    reason: `Ours ${fmt(ours.value, ours.unit, ours.cycle)} vs ${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}${conv}: ${gap > 0 ? "+" : ""}${gap}% → ${verdictLabel[verdict].toLowerCase()}`,
  };
}

function rankMaps(d: Dataset, series: Series[]) {
  const profile = d.weightProfiles.find((p) => p.id === "wp-balanced") ?? d.weightProfiles[0];
  const out = new Map<Series, ScoresResponse>();
  for (const s of series) out.set(s, computeScores(d, profile, s));
  return { profile, out };
}

/** Builds a ripple from a competitor fact. Low-trust facts are listed only (watch list). */
export function assessFact(d: Dataset, s: Signal, runId: string): Ripple | null {
  if (s.kind !== "competitor_fact" || !s.metric) return null;
  const key = metricKeyOf(s.metric.name);
  if (!key) return null;
  const fact: RippleFact = {
    signalId: s.id,
    competitor: s.competitor ?? s.sourceName,
    key,
    value: s.metric.value,
    unit: s.metric.unit,
    cycle: cycleOf(s.metric.cycle),
    market: s.market,
    trust: s.trust,
    sourceName: s.sourceName,
    url: s.url,
    summary: s.summary,
  };
  const watch = s.trust === "D" || s.trust === "E";
  const id = nextId("RIP-", d.ripples);
  const items: RippleItem[] = [];

  // Requirements whose target uses the same metric key, in every series, market variant and Baukasten.
  for (const r of d.requirements.filter(LIVE)) {
    const hit = specOf(r, key);
    if (!hit) continue;
    const c = d.cases.find((x) => x.id === r.caseId)!;
    const cmp = compareWith(d, fact, hit.spec, r.series);
    const row = rowOf(r.series, r.marketScope);
    items.push({
      id: `${id}-${items.length + 1}`,
      kind: "requirement",
      objectId: r.id,
      title: r.title,
      caseId: c.id,
      row,
      alsoRows: c.relatedSeries.map((x) => rowOf(x, r.marketScope)).filter((x) => x !== row),
      carArea: r.carArea,
      ownerId: r.ownerId,
      coOwnerIds: c.coOwnerIds,
      status: r.status,
      ours: { value: hit.spec.value, unit: hit.spec.unit, cycle: hit.spec.cycle, comparator: hit.spec.comparator, market: hit.spec.market, text: hit.m.target },
      ...cmp,
      rankBefore: null,
      rankAfter: null,
      movedBecause: null,
      notified: [],
      muted: false,
      decision: null,
      variant: null,
    });
  }
  if (!items.length) return null;

  // Mute: a kept target stays quiet until the gap grows by more than the threshold.
  for (const it of items) {
    const mute = it.kind === "requirement" ? d.rippleMutes.find((m) => m.requirementId === it.objectId && m.key === key) : undefined;
    if (!mute || it.gapPct === null) continue;
    const worse = Math.round((mute.gapPctAtDecision - it.gapPct) * 10) / 10;
    if (worse <= d.monitorSettings.muteThresholdPct) {
      it.muted = true;
      it.reason += ` · Muted: kept by ${d.users.find((u) => u.id === mute.by)?.name ?? mute.by} ("${mute.reason}") at ${mute.gapPctAtDecision}%; re-alerts when the gap grows by more than ${d.monitorSettings.muteThresholdPct} points (now ${worse > 0 ? "+" : ""}${worse}).`;
    }
  }

  const ripple: Ripple = {
    id,
    runId,
    fact,
    status: watch ? "watch" : "active",
    statusReason: watch
      ? `Trust ${s.trust}: ${s.trust === "D" ? "a single unverified post" : "an announcement, not on sale"}. Listed on the watch list; no alerts, no score change.`
      : `Trust ${s.trust} (${s.sourceName}). Owners alerted; matched cases re-scored. Nothing changes without a person.`,
    conversionIds: [...new Set(items.map((i) => i.conversionId).filter((x): x is string => !!x))],
    tolerancePct: d.monitorSettings.atParTolerancePct,
    items,
    createdAt: now(),
  };
  d.ripples.unshift(ripple);
  audit({ actorId: "agent:monitor", action: "ripple.created", objectType: "ripple", objectId: id, after: { fact: `${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}`, trust: fact.trust, status: ripple.status, items: items.length }, rationale: ripple.statusReason });
  if (watch) return ripple;

  // A newer fact from the same competitor on the same metric replaces the older one: its open alerts
  // on the requirements assessed again here are closed, so each requirement carries one current alert.
  const reassessed = new Set(items.map((i) => i.objectId));
  for (const old of d.ripples.filter((r) => r.id !== id && r.status === "active" && r.fact.competitor === fact.competitor && r.fact.key === key)) {
    for (const a of d.alerts.filter((x) => x.rippleId === old.id && x.status === "open" && x.requirementId && reassessed.has(x.requirementId))) {
      a.status = "dismissed";
      a.resolution = `Superseded by ${id}: ${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}`;
      audit({ actorId: "agent:monitor", action: "alert.dismissed", objectType: "requirement", objectId: a.requirementId!, before: { status: "open" }, after: { status: "dismissed", rippleId: id }, rationale: a.resolution });
    }
  }

  // Re-score: the competitor-gap factor of every matched case grows with how far behind we are.
  const allSeries = [...new Set(items.flatMap((i) => [i.row === "G60_CN" ? "G60" : i.row, ...i.alsoRows.map((r) => (r === "G60_CN" ? "G60" : r))]))] as Series[];
  const before = rankMaps(d, allSeries);
  const bumps = new Map<string, { before: number; after: number }>();
  for (const it of items) {
    if (it.muted) continue;
    const c = d.cases.find((x) => x.id === it.caseId)!;
    const delta = GAP_BUMP[it.verdict];
    if (!delta) continue;
    const old = bumps.get(c.id)?.before ?? c.factors.competitor_gap;
    const next = Math.min(1, Math.round((old + delta) * 100) / 100);
    if (next > (bumps.get(c.id)?.after ?? old)) bumps.set(c.id, { before: old, after: next });
  }
  for (const [caseId, b] of bumps) d.cases.find((c) => c.id === caseId)!.factors.competitor_gap = b.after;
  const after = rankMaps(d, allSeries);
  const cause = `${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}`;
  for (const it of items) {
    const series = (it.row === "G60_CN" ? "G60" : it.row) as Series;
    const pick = (m: Map<Series, ScoresResponse>) =>
      it.kind === "requirement" ? m.get(series)?.requirements.find((x) => x.requirementId === it.objectId)?.rank : m.get(series)?.cases.find((x) => x.caseId === it.objectId)?.rank;
    it.rankBefore = pick(before.out) ?? null;
    it.rankAfter = pick(after.out) ?? null;
    const b = bumps.get(it.caseId);
    if (b && it.rankBefore !== null && it.rankAfter !== null) it.movedBecause = movedBecauseFactor("competitor_gap", b.before, b.after, it.rankBefore, it.rankAfter, cause);
  }
  for (const [caseId, b] of bumps) {
    audit({
      actorId: "agent:scorer",
      action: "case.rescored",
      objectType: "case",
      objectId: caseId,
      before: { competitor_gap: b.before },
      after: { competitor_gap: b.after, rippleId: id },
      rationale: `Competitor gap after ${cause}`,
      scoreSnapshot: scoreSnapshotNow(d, caseId, after.profile),
    });
  }

  // Notify: owners and co-owners get an alert, watchers an FYI, the head when a signed-off target is affected.
  const head = d.users.find((u) => u.role === "head");
  for (const it of items) {
    if (it.muted || it.verdict === "not_comparable") continue;
    const c = d.cases.find((x) => x.id === it.caseId)!;
    const link = `/ripple/${id}?item=${it.id}`;
    const pressing = it.verdict === "behind" || it.verdict === "at_par";
    const head_ = it.kind === "requirement" && SIGNED.includes(it.status) && pressing ? head : undefined;
    const owners = [...new Set([it.ownerId, ...it.coOwnerIds])];
    for (const uid of owners) {
      if (pressing) {
        d.alerts.push({
          id: nextId("AL-", d.alerts),
          ownerId: uid,
          caseId: it.caseId,
          requirementId: it.kind === "requirement" ? it.objectId : null,
          verdict: "raises_the_bar",
          title: `${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}: ${it.objectId} is ${verdictLabel[it.verdict].toLowerCase()}`,
          detail: it.reason,
          signalIds: [fact.signalId],
          status: "open",
          createdAt: now(),
          rippleId: id,
          itemVerdict: it.verdict,
          comparison: {
            ours: it.ours?.text ?? "No target yet",
            theirs: fmt(fact.value, fact.unit, fact.cycle),
            normalized: it.theirsNormalized ? fmt(it.theirsNormalized.value, it.theirsNormalized.unit, it.theirsNormalized.cycle) : "—",
            factor: it.conversionId ? (d.conversions.find((x) => x.id === it.conversionId)?.factor ?? null) : null,
            isAssumption: !!it.conversionId && !!d.conversions.find((x) => x.id === it.conversionId)?.isAssumption,
          },
        });
        notify({ userId: uid, kind: "alert", title: `${fact.competitor}: ${it.objectId} ${verdictLabel[it.verdict].toLowerCase()}`, body: it.reason, link, actorId: "agent:monitor" });
        it.notified.push({ userId: uid, kind: "alert" });
      } else {
        notify({ userId: uid, kind: "fyi", title: `${fact.competitor}: ${it.objectId} still ahead`, body: it.reason, link, actorId: "agent:monitor" });
        it.notified.push({ userId: uid, kind: "fyi" });
      }
    }
    if (pressing) {
      for (const uid of c.watcherIds.filter((w) => !owners.includes(w))) {
        notify({ userId: uid, kind: "fyi", title: `FYI ${fact.competitor}: ${it.objectId} ${verdictLabel[it.verdict].toLowerCase()}`, body: it.reason, link, actorId: "agent:monitor" });
        it.notified.push({ userId: uid, kind: "fyi" });
      }
    }
    if (head_ && !owners.includes(head_.id)) {
      notify({ userId: head_.id, kind: "alert", title: `Signed-off ${it.objectId} is ${verdictLabel[it.verdict].toLowerCase()}`, body: `${it.reason}. Any change to it needs a new sign-off.`, link, actorId: "agent:monitor" });
      it.notified.push({ userId: head_.id, kind: "head" });
    }
    if (pressing) audit({ actorId: "agent:monitor", action: "alert.raised", objectType: it.kind, objectId: it.objectId, after: { rippleId: id, itemId: it.id, verdict: it.verdict, gapPct: it.gapPct }, rationale: it.reason });
    if (it.notified.length) audit({ actorId: "agent:monitor", action: "notification.sent", objectType: "ripple", objectId: id, after: { itemId: it.id, to: it.notified } });
  }
  return ripple;
}

/** After the head changes a factor: recompute every comparison of open ripples (no new alerts). */
export function reassess(d: Dataset) {
  for (const rp of d.ripples) {
    for (const it of rp.items) {
      if (!it.ours) continue;
      const series = (it.row === "G60_CN" ? "G60" : it.row) as Series;
      const cmp = compareWith(d, rp.fact, it.ours, series);
      Object.assign(it, { theirsNormalized: cmp.theirsNormalized, conversionId: cmp.conversionId, gapPct: cmp.gapPct, verdict: cmp.verdict, reason: cmp.reason });
    }
  }
}

function saveProposal(d: Dataset, p: Omit<Proposal, "id" | "status" | "createdAt">): Proposal {
  const full: Proposal = { ...p, id: nextId("P-", d.proposals), status: "pending", createdAt: now() };
  d.proposals.push(full);
  return full;
}

/** Just past the competitor (tolerance + 1 point), rounded to 10 km or a whole minute. */
function suggest(theirs: number, comparator: "gte" | "lte", tolerancePct: number, unit: string) {
  const step = unit === "km" ? 10 : 1;
  const f = 1 + (tolerancePct + 1) / 100;
  return comparator === "gte" ? Math.ceil((theirs * f) / step) * step : Math.floor(theirs / f / step) * step;
}

function retarget(m: Metric, value: number): Metric {
  const spec = m.targetSpec!;
  return { ...m, target: `${spec.comparator === "gte" ? "≥" : "≤"} ${fmt(value, spec.unit, spec.cycle)}`, targetSpec: { ...spec, value } };
}

/** An owner decision on one item. Raise and variant are proposals; keep mutes repeats; reopen moves the case back. */
export function decideItem(d: Dataset, user: User, ripple: Ripple, item: RippleItem, body: RippleDecisionBody): Proposal | null {
  if (body.kind === "market_variant" && item.variant) throw new ApiError(409, `A market variant was already proposed by ${item.variant.by}.`);
  if (body.kind !== "market_variant" && item.decision) throw new ApiError(409, `Already decided by ${item.decision.by}: ${item.decision.kind}.`);
  const c = must(d.cases.find((x) => x.id === item.caseId), "Case");
  const r = item.kind === "requirement" ? must(d.requirements.find((x) => x.id === item.objectId), "Requirement") : null;
  const owner = user.id === item.ownerId || item.coOwnerIds.includes(user.id) || user.role === "head";
  const series = (item.row === "G60_CN" ? "G60" : item.row) as Series;
  if (body.kind === "market_variant") {
    if (!r) throw new ApiError(400, "Market variants are made from a requirement.");
    if (!user.series.includes(series) || user.region === "global") throw new ApiError(403, "Only a regional PM of this series proposes a market variant.");
  } else if (!owner) throw new ApiError(403, `Only the owner or a co-owner decides on ${item.objectId}. You can comment or watch.`);

  let proposal: Proposal | null = null;
  const fact = ripple.fact;
  switch (body.kind) {
    case "raise_target": {
      if (!r || !item.ours || !item.theirsNormalized) throw new ApiError(400, "Nothing to raise: no comparable target.");
      const hit = specOf(r, fact.key)!;
      const value = body.value ?? suggest(item.theirsNormalized.value, hit.spec.comparator, ripple.tolerancePct, hit.spec.unit);
      const current = snapshotOf(r);
      const old = `${hit.spec.value} ${hit.spec.unit}`;
      const next = structuredClone(current);
      next.metrics = next.metrics.map((m) => (m.id === hit.m.id ? retarget(m, value) : m));
      next.title = next.title.replaceAll(old, `${value} ${hit.spec.unit}`);
      next.description = next.description.replaceAll(old, `${value} ${hit.spec.unit}`);
      next.descriptionParts = next.descriptionParts.map((p) => p.replaceAll(old, `${value} ${hit.spec.unit}`));
      const signed = SIGNED.includes(r.status);
      proposal = saveProposal(d, {
        objectType: "requirement",
        objectId: r.id,
        source: "monitor",
        kind: "new_version",
        summary: `v${r.version + 1}: target ${hit.m.target} → ${retarget(hit.m, value).target} after ${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)}${signed ? " · needs a new sign-off" : ""}`,
        changes: [{ field: "version", before: current, after: next }],
        citations: [fact.signalId],
      });
      break;
    }
    case "market_variant": {
      const hit = specOf(r!, fact.key)!;
      const n = normalize(fact.value, fact.cycle, "CLTC", d.conversions);
      const theirsCltc = n?.value ?? fact.value;
      const value = body.value ?? suggest(theirsCltc, hit.spec.comparator, ripple.tolerancePct, hit.spec.unit);
      const existing = d.requirements.find((x) => x.id !== r!.id && x.series === r!.series && x.marketScope === "CN" && LIVE(x) && specOf(x, fact.key));
      if (existing) {
        const em = specOf(existing, fact.key)!;
        proposal = saveProposal(d, {
          objectType: "requirement",
          objectId: existing.id,
          source: "monitor",
          kind: "field",
          summary: `Make ${existing.id} the China variant of ${r!.id} and raise it ${em.m.target} → ≥ ${value} km CLTC (${fact.competitor} ${fmt(fact.value, fact.unit, fact.cycle)})`,
          changes: [
            { field: "variantOf", before: existing.variantOf, after: r!.id },
            { field: "metrics", before: existing.metrics, after: existing.metrics.map((m) => (m.id === em.m.id ? { ...retarget({ ...m, targetSpec: { ...em.spec, cycle: "CLTC" } }, value) } : m)) },
          ],
          citations: [fact.signalId],
        });
      } else {
        const draft = snapshotOf(r!);
        const cn = structuredClone(draft);
        cn.marketScope = "CN";
        cn.title = `${draft.title} (China, ≥ ${value} km CLTC)`;
        cn.metrics = cn.metrics.map((m) => (m.id === hit.m.id ? retarget({ ...m, targetSpec: { ...hit.spec, cycle: "CLTC", market: "CN" } }, value) : m));
        proposal = saveProposal(d, { objectType: "case", objectId: c.id, source: "monitor", kind: "new_requirement", summary: `China variant of ${r!.id}: ≥ ${value} km CLTC`, changes: [{ field: "requirement", before: null, after: cn }], citations: [fact.signalId] });
      }
      break;
    }
    case "keep": {
      if (r && item.gapPct !== null) {
        d.rippleMutes = d.rippleMutes.filter((m) => !(m.requirementId === r.id && m.key === fact.key));
        d.rippleMutes.push({ requirementId: r.id, key: fact.key, gapPctAtDecision: item.gapPct, reason: body.rationale, by: user.id, at: now() });
      }
      for (const a of d.alerts.filter((x) => x.rippleId === ripple.id && x.caseId === item.caseId && (x.requirementId ?? null) === (r?.id ?? null) && x.status === "open")) {
        a.status = "dismissed";
        a.resolution = `Kept by ${user.name}: ${body.rationale}`;
      }
      c.context.pmInputs.push({ kind: "note", label: `Monitor context: target kept against ${fact.competitor}`, detail: body.rationale, at: now(), ref: ripple.id });
      audit({ actorId: user.id, action: "ripple.kept", objectType: item.kind, objectId: item.objectId, after: { rippleId: ripple.id, gapPct: item.gapPct, muteThresholdPct: d.monitorSettings.muteThresholdPct }, rationale: body.rationale });
      break;
    }
    case "reopen_case": {
      const before = { state: c.state, outcome: c.outcome };
      c.state = "investigating";
      c.outcome = null;
      c.outcomeNote = undefined;
      c.updatedAt = now();
      audit({ actorId: user.id, action: "case.state_changed", objectType: "case", objectId: c.id, before, after: { state: c.state, outcome: null, rippleId: ripple.id }, rationale: body.rationale });
      break;
    }
  }
  if (body.kind === "market_variant") item.variant = { by: user.id, rationale: body.rationale, at: now(), proposalId: proposal?.id ?? null };
  else item.decision = { kind: body.kind, by: user.id, rationale: body.rationale, at: now(), proposalId: proposal?.id ?? null };
  audit({
    actorId: user.id,
    action: "ripple.decided",
    objectType: item.kind,
    objectId: item.objectId,
    after: { rippleId: ripple.id, itemId: item.id, decision: body.kind, verdict: item.verdict, proposalId: proposal?.id ?? null },
    rationale: body.rationale,
  });
  if (proposal) audit({ actorId: "agent:monitor", action: "proposal.created", objectType: proposal.objectType, objectId: proposal.objectId, after: { proposalId: proposal.id, kind: proposal.kind }, rationale: proposal.summary });
  return proposal;
}

export const SIGNED_STATUSES = SIGNED;
export type { Case };
