import type { AuditEvent, Dataset, IntegrityCheck, ReplayEvent, ReplayResponse, Requirement, Signal } from "@/contracts";
import { auditAction } from "@/lib/audit";
import { sha256 } from "./convert";
import { computeScores } from "./scoring";
import { now } from "./store";

/**
 * Trace replay of one requirement: everything from the first quote to the plan slot,
 * read from the stored rows and the append-only audit log, plus four integrity checks
 * that are recomputed on every call (never cached, failures never hidden).
 */

const LABELS: Record<string, string> = {
  "data.imported": "BMW data imported",
  "case.created": "Case opened",
  "case.scored": "Case scored",
  "case.state_changed": "Case moved",
  "case.decided": "Case decided",
  "case.stance_saved": "PM context saved",
  "case.rescored": "Case re-scored",
  "case.edited": "Case edited",
  "weight_profile.updated": "Weight profile changed",
  "requirement.drafted": "Requirement drafted",
  "requirement.shape_answered": "Shape question answered",
  "requirement.feedback_recorded": "Engineering feedback",
  "requirement.version_created": "New version",
  "requirement.status_changed": "Status changed",
  "requirement.edited": "Edited",
  "requirement.signoff_reset": "Sign-off reset",
  "alert.raised": "Competitor alert",
  "ripple.decided": "Decision on competitor fact",
  "ripple.kept": "Target kept",
  "proposal.created": "AI proposal",
  "proposal.accepted": "Proposal accepted",
  "proposal.rejected": "Proposal rejected",
  "question.answered": "Question answered",
  "signals.fetched": "Agent run",
};

/** Actions that change a status or a decision; each one must carry a rationale. */
/** Mock names (requirement.status_changed) and the backend's (requirement.state_change, requirement_version.create). */
const NEEDS_RATIONALE = /status_changed|state_changed?$|\.decided$|version_created|requirement_version\.create|signoff_reset|ripple\.kept|alert\.(dismissed|rework)|conversion\.updated/;

/** A link or a note a PM added is evidence, not a customer voice. */
const isPmOpinion = (s: Signal) => s.sourceType === "pm_link" || s.sourceType === "pm_note";

export interface ReplayOptions {
  /**
   * True when `d.audit` holds only this chain's events (real backend), not the whole log.
   * Then a missing number between two events is another object's event, not a gap.
   */
  partialLog?: boolean;
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

function agentName(id: string) {
  const name = id.replace(/^agent:/, "").replace(/_/g, " ");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} (agent)`;
}

function quoteSample(signals: Signal[], n = 12): string[] {
  const rank = (s: Signal) => (s.severity === "defect" ? 0 : s.kind === "complaint" ? 1 : s.kind === "wish" ? 2 : 3) * 2 + (s.agent === "bmw_data" ? 0 : 1);
  return signals
    .filter((s) => s.sourceType !== "bmw_study" && s.kind !== "competitor_fact" && s.kind !== "trend")
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((s) => s.id);
}

function chainEvents(d: Dataset, r: Requirement, signalIds: Set<string>): AuditEvent[] {
  return d.audit.filter(
    (e) =>
      !VIEWS.has(e.action) &&
      ((e.objectType === "requirement" && e.objectId === r.id) ||
      (e.objectType === "case" && e.objectId === r.caseId) ||
      (e.objectType === "signal" && (signalIds.has(e.objectId) || e.action === "data.imported")) ||
      (e.objectType === "profile" && e.action === "weight_profile.updated")),
  );
}

/** Reads are logged too, but they are not steps in the life of the requirement. */
const VIEWS = new Set(["requirement.replay_viewed", "requirement.dossier_exported"]);

export function integrityChecks(d: Dataset, signals: Signal[], events: AuditEvent[], opts: ReplayOptions = {}): IntegrityCheck[] {
  const records = new Map(d.sourceRecords.map((x) => [x.ref, x]));

  const quoteFailures: string[] = [];
  const quoted = signals.filter((s) => s.sourceType !== "bmw_study");
  for (const s of quoted) {
    const rec = s.recordRef ? records.get(s.recordRef) : undefined;
    if (!rec) quoteFailures.push(`${s.id}: no stored source record (${s.recordRef ?? "no reference"})`);
    else if (!norm(rec.text).includes(norm(s.quote)) && !(s.quoteEn && norm(rec.text).includes(norm(s.quoteEn)))) quoteFailures.push(`${s.id}: quote not found in ${rec.ref}`);
  }
  const studyRows = signals.length - quoted.length;

  const hashFailures: string[] = [];
  for (const s of signals) {
    const rec = s.recordRef ? records.get(s.recordRef) : undefined;
    if (!rec) hashFailures.push(`${s.id}: no record to hash`);
    else if (!rec.sha256) hashFailures.push(`${rec.ref}: hash missing`);
    else if (sha256(rec.text) !== rec.sha256) hashFailures.push(`${rec.ref}: stored text does not match its hash (edited after capture)`);
  }
  const synthetic = new Set(signals.filter((s) => s.recordRef && records.get(s.recordRef)?.synthetic).map((s) => s.id)).size;

  const seqFailures: string[] = [];
  for (let i = 1; i < events.length; i++) if (events[i].seq <= events[i - 1].seq) seqFailures.push(`seq ${events[i].seq} after ${events[i - 1].seq}`);
  const lo = events[0]?.seq ?? 0;
  const hi = events.at(-1)?.seq ?? 0;
  const window = opts.partialLog ? [] : d.audit.filter((e) => e.seq >= lo && e.seq <= hi).map((e) => e.seq);
  for (let i = 1; i < window.length; i++) if (window[i] !== window[i - 1] + 1) seqFailures.push(`gap between seq ${window[i - 1]} and ${window[i]}`);

  const rationaleFailures = events.filter((e) => NEEDS_RATIONALE.test(e.action) && !e.rationale?.trim()).map((e) => `seq ${e.seq} ${e.action} by ${e.actorId}: no rationale`);
  const statusChanges = events.filter((e) => NEEDS_RATIONALE.test(e.action)).length;

  return [
    {
      id: "quotes_in_source",
      label: "Every quote is found in its source record",
      ok: quoteFailures.length === 0,
      detail: `${quoted.length - quoteFailures.length} of ${quoted.length} quotes found word for word${studyRows ? `; ${studyRows === 1 ? "1 study row is a figure" : `${studyRows} study rows are figures`}, checked by hash only` : ""}`,
      failures: quoteFailures,
    },
    {
      id: "record_hashes",
      label: "Every source record has a matching SHA-256 hash",
      ok: hashFailures.length === 0,
      detail: `${signals.length - hashFailures.length} of ${signals.length} records verified${synthetic ? ` (${synthetic} are synthetic web snapshots in the demo)` : ""}`,
      failures: hashFailures,
    },
    {
      id: "audit_sequence",
      label: opts.partialLog ? "Audit events of this chain are in order" : "Audit log has no gaps for this chain",
      ok: seqFailures.length === 0,
      detail: events.length ? `${events.length} events, seq ${lo}–${hi}, ${opts.partialLog ? "strictly ascending; the database refuses updates and deletes on the log" : "append-only"}` : "No events",
      failures: seqFailures,
    },
    {
      id: "rationale_on_status",
      label: "Every status change has a rationale",
      ok: rationaleFailures.length === 0,
      detail: `${statusChanges - rationaleFailures.length} of ${statusChanges} status changes and decisions carry a reason`,
      failures: rationaleFailures,
    },
  ];
}

export function buildReplay(d: Dataset, r: Requirement, opts: ReplayOptions = {}): ReplayResponse {
  const c = d.cases.find((x) => x.id === r.caseId)!;
  const signals = c.signalIds.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s);
  const ids = new Set(signals.map((s) => s.id));
  const events = chainEvents(d, r, ids);
  const users = new Map(d.users.map((u) => [u.id, u.name]));

  let version: number | null = null;
  const replayEvents: ReplayEvent[] = events.map((e) => {
    if (e.objectType === "requirement" && (e.action === "requirement.drafted" || e.action === "requirement.create")) version = 1;
    const after = e.after as { version?: number } | undefined;
    if (e.objectType === "requirement" && (e.action === "requirement.version_created" || e.action === "requirement_version.create") && after?.version) version = after.version;
    const agent = e.actorType === "ai" || e.actorId.startsWith("agent:");
    return {
      seq: e.seq,
      at: e.at,
      actorId: e.actorId,
      actorType: agent ? "agent" : "human",
      actorName: agent ? agentName(e.actorId) : (users.get(e.actorId) ?? e.actorId),
      action: e.action,
      label: LABELS[e.action] ?? auditAction(e.action),
      objectType: e.objectType,
      objectId: e.objectId,
      rationale: e.rationale ?? null,
      version,
      scoreSnapshot: e.scoreSnapshot ?? null,
    };
  });

  const quoteIds = quoteSample(signals);
  const customers = signals.filter((s) => s.sourceType !== "bmw_study" && s.kind !== "competitor_fact" && s.kind !== "trend" && !isPmOpinion(s));
  const profile = d.weightProfiles.find((p) => p.id === "wp-balanced") ?? d.weightProfiles[0];
  const scores = computeScores(d, profile);
  const row = scores.cases.find((s) => s.caseId === c.id);
  const plan = d.plans.find((p) => p.series === r.series);
  const records = new Map(d.sourceRecords.map((x) => [x.ref, x]));

  return {
    requirement: r,
    versions: d.requirementVersions.filter((v) => v.requirementId === r.id).sort((a, b) => a.version - b.version),
    case: c,
    signals,
    quoteIds,
    counts: {
      customers: customers.length,
      markets: [...new Set(customers.map((s) => s.market).filter((m) => m !== "unknown"))],
      sources: new Set(signals.map((s) => s.sourceName)).size,
      bmwRecords: signals.filter((s) => s.agent === "bmw_data").length,
      webRecords: signals.filter((s) => s.agent !== "bmw_data" && s.agent !== "pm").length,
    },
    sourceRecords: quoteIds.map((id) => signals.find((s) => s.id === id)?.recordRef).flatMap((ref) => (ref && records.get(ref) ? [records.get(ref)!] : [])),
    events: replayEvents,
    scoreToday: { score: row?.score ?? 0, rank: row?.rank ?? 0, of: scores.cases.length, profileName: profile.name },
    plannedFeature: plan?.features.find((f) => f.id === r.plannedFeatureId) ?? null,
    alerts: d.alerts.filter((a) => a.requirementId === r.id),
    integrity: integrityChecks(d, signals, events, opts),
    generatedAt: now(),
  };
}
