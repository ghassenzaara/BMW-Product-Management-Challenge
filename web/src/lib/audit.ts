import type { AuditEvent } from "@/contracts";
import { fmtDateTime } from "@/lib/format";

/**
 * Plain-language rendering of audit events. The log stores machine names and the
 * changed fields as data; a person reads "Status: planned → exported", never JSON.
 * UI-only: works for the mock's events and for the backend's.
 */

// ---------- what happened ----------
const ACTIONS: Record<string, string> = {
  // backend (object_type.action)
  "case.create": "Case created",
  "case.update": "Case edited",
  "case_vehicle.create": "Case applies to a line",
  "case_vehicle.update": "Case updated for the line",
  "case_vehicle.state_change": "Case moved",
  "case_stance.create": "Context saved",
  "case_stance.update": "Context saved",
  "requirement.create": "Requirement drafted",
  "requirement.update": "Requirement edited",
  "requirement.state_change": "Status changed",
  "requirement.delete": "Requirement deleted",
  "requirement_version.create": "New version",
  "requirement_feedback.create": "Feedback recorded",
  "requirement_feedback.update": "Feedback linked",
  "requirement_check.create": "Quality check",
  "proposal.create": "AI proposal",
  "proposal.accept": "Proposal accepted",
  "proposal.reject": "Proposal rejected",
  "referral.create": "Referral sent",
  "referral.accept": "Referral accepted",
  "referral.decline": "Referral declined",
  "referral.escalate": "Escalated to the head",
  "referral.resolve": "Escalation resolved",
  "open_question.create": "Question asked",
  "open_question.answer": "Question answered",
  "open_question.update": "Question edited",
  "meeting_note.create": "Meeting note added",
  "comment.create": "Comment",
  "alert.create": "Alert raised",
  "alert.dismissed": "Alert dismissed",
  "alert.rework": "Sent to rework",
  "series_brief.create": "Product specs created",
  "series_brief.update": "Product specs updated",
  "series_brief.resolve": "Product specs difference resolved",
  "planned_feature.create": "Plan decision",
  "planned_feature.update": "Plan decision changed",
  "weight_profile.create": "Weight profile created",
  "weight_profile.update": "Weights changed",
  "brand_profile.create": "Brand profile updated",
  "workspace.create": "Workspace set",
  "workspace.update": "Workspace changed",
  "innovation_item.create": "Added to the innovation pool",
  "innovation_item.update": "Innovation pool updated",
  "config.update": "Settings changed",
  "case.export": "Case exported",
  "vehicle_plan.export": "Requirements exported",
  "requirement.view": "Trace replay opened",
  "source_record.create": "Evidence stored",
  // mock (object.verb)
  "case.created": "Case created",
  "case.edited": "Case edited",
  "case.state_changed": "Case moved",
  "case.decided": "Case decided",
  "case.stance_saved": "Context saved",
  "case.watch_changed": "Watchers changed",
  "case.exported_md": "Case exported",
  "case.evidence_added": "Evidence added by the PM",
  "requirement.drafted": "Requirement drafted",
  "requirement.edited": "Requirement edited",
  "requirement.status_changed": "Status changed",
  "requirement.checked": "Quality check",
  "requirement.version_created": "New version",
  "requirement.feedback_recorded": "Feedback recorded",
  "requirement.shape_asked": "Shape questions asked",
  "requirement.shape_answered": "Shape questions answered",
  "requirements.exported": "Exported to Codebeamer",
  "requirements.deck_exported": "Deck downloaded",
  "proposal.created": "AI proposal",
  "proposal.accepted": "Proposal accepted",
  "proposal.rejected": "Proposal rejected",
  "question.created": "Question asked",
  "question.answered": "Question answered",
  "question.edited": "Question edited",
  "meeting_note.added": "Meeting note added",
  "comment.added": "Comment",
  "brief.created": "Product specs created",
  "brief.updated": "Product specs updated",
  "brief.conflict_resolved": "Product specs difference resolved",
  "weight_profile.updated": "Weights changed",
  "weight_profile.created": "Weight profile created",
  "brand_profile.updated": "Brand profile updated",
  "workspace.updated": "Workspace changed",
  "signals.fetched": "Signals fetched",
  "signals.researched": "Research run",
  "segment.asked": "Segment asked",
  "alert.raised": "Alert raised",
};

const words = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]+/g, " ").trim().toLowerCase();
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function auditAction(action: string): string {
  return ACTIONS[action] ?? sentence(words(action));
}

// ---------- what changed ----------
/** Bookkeeping columns: true, but not what a reader wants to know. */
const SKIP = new Set(["id", "created_at", "updated_at", "createdAt", "updatedAt", "embedding", "body_version", "bodyVersion", "version", "run_id", "request_id", "read_by", "rank_score", "model", "prompt_version", "object_type", "object_id", "requirement_id", "case_id", "feature_id", "created_by", "decided_at", "answered_at", "resolved_at", "confirmed_at", "deleted_at", "tags", "figures", "provenance", "snapshot", "retrieved_signals", "cited_signals", "chat_message_id", "meeting_note_id", "proposal_id", "feedback_id", "brief_id", "config_id", "weight_profile_id", "user_id", "author_id", "from_user", "to_user", "asked_by", "owner_id_source"]);

const LABELS: Record<string, string> = {
  values: "Answers",
  body_md: "Page text",
  bodyMd: "Page text",
  state: "State",
  workflow: "Step",
  outcome: "Decision",
  outcome_note: "Reason",
  state_reason: "Reason",
  status: "Status",
  owner_id: "Owner",
  co_owner_ids: "Co-owners",
  watcher_ids: "Watchers",
  market_scope: "Scope",
  marketScope: "Scope",
  release_target: "Release",
  releaseTarget: "Release",
  release_fit: "Release fit",
  cost_size: "Cost size",
  costSize: "Cost size",
  cost_source: "Cost from",
  cost_band: "Cost band",
  cost_note: "Cost note",
  sent_back_reason: "Sent back because",
  description_parts: "Sentences",
  acceptance_criteria: "Acceptance criteria",
  acceptanceCriteria: "Acceptance criteria",
  case_weights: "Weights",
  manual_rank: "Manual rank",
  manualRank: "Manual rank",
  manual_rank_reason: "Rank reason",
  flag_new_evidence: "New signals since confirmation",
  market_conflict: "Market conflict",
  pm_rationale: "PM's reason",
  resulting_version: "Resulting version",
  is_protected: "Protected",
  short_title: "Short title",
  brand_fit: "Brand fit",
  case_type: "Case type",
  change_depth: "Change depth",
  decision_note: "Note",
  decided_by: "Decided by",
  resolved_by: "Resolved by",
  linked_vehicle: "Worked for",
  linked_case_id: "Linked case",
  held_on: "Date",
  due_date: "Due",
  dueDate: "Due",
  evidence_takes: "Reading of the evidence",
  override_reasons: "Why it differs from the product specs",
  pending_shape: "Shape answers from the chat",
  shape_answers: "Shape answers",
  thesis: "Thesis",
  targetCustomer: "Target customer",
  marketWeights: "Market weights",
  changeAmbition: "Evolution or revolution",
  protectList: "Protect list",
  dontFightOn: "Don't fight on",
  givens: "Already decided",
  costEnvelope: "Cost envelope",
};

/** Which fields to show, in this order, when a whole new row was logged. */
const CREATED = ["title", "name", "summary", "question", "answer", "text", "body", "note", "kind", "source", "addressee", "response", "verdict", "status", "state", "outcome", "action", "release", "horizon", "pitch", "vehicle", "market_scope", "cause", "rationale", "engine", "issues"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);
const label = (key: string) => LABELS[key] ?? sentence(words(key));
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Name = (id: string) => string;

/** One value as a person would write it. */
function show(v: unknown, name: Name, key = ""): string {
  if (v === undefined || v === null || v === "") return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "string") {
    // A user id (mock: u-lena, backend: a uuid) reads as the person's name.
    if (/^u-[a-z]+$/.test(v) && name(v) !== v) return name(v);
    if (v in LABELS) return LABELS[v].toLowerCase();
    if (UUID.test(v)) {
      const n = name(v);
      return n === v ? "a user" : n;
    }
    if (/^(pm|engineer|admin):/.test(v)) return name(v.split(":")[1]);
    if (ISO.test(v)) return fmtDateTime(v);
    if (key === "body_md" || key === "bodyMd") return `${v.length.toLocaleString("en")} characters`;
    // Enum-like values read better without underscores; real text is left alone.
    return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(v) ? v.replace(/_/g, " ") : clip(v.replace(/\s+/g, " ").trim());
  }
  if (Array.isArray(v)) {
    if (!v.length) return "none";
    if (v.every((x) => typeof x !== "object" || x === null)) {
      const shown = v.slice(0, 4).map((x) => show(x, name));
      return shown.join(", ") + (v.length > 4 ? ` and ${v.length - 4} more` : "");
    }
    const texts = v.map((x) => (isObject(x) ? (x.text ?? x.question ?? x.name ?? x.message ?? x.title ?? x.value) : undefined)).filter((x): x is string => typeof x === "string");
    return texts.length ? clip(texts.slice(0, 3).join("; ")) + (v.length > 3 ? ` and ${v.length - 3} more` : "") : `${v.length} ${v.length === 1 ? "item" : "items"}`;
  }
  if (isObject(v)) {
    const parts = Object.entries(v)
      .filter(([k, x]) => !SKIP.has(k) && (typeof x !== "object" || x === null || Array.isArray(x)))
      .slice(0, 4)
      .map(([k, x]) => `${words(k)} ${show(x, name, k)}`);
    return parts.length ? clip(parts.join(", ")) : "changed";
  }
  return String(v);
}

export interface AuditLine {
  label: string;
  /** Present for a change; absent when only the new value is known. */
  from?: string;
  to: string;
}

/** The changed fields of an event as readable lines, most informative first, at most `max`. */
export function auditLines(e: Pick<AuditEvent, "before" | "after">, name: Name, max = 4): AuditLine[] {
  const before = isObject(e.before) ? e.before : undefined;
  const after = isObject(e.after) ? e.after : undefined;
  const lines: AuditLine[] = [];
  if (!before && !after) {
    const v = e.after ?? e.before;
    return v === undefined || v === null ? [] : [{ label: "Value", to: show(v, name) }];
  }
  if (before && after) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (SKIP.has(key) || same(before[key], after[key])) continue;
      const a = before[key];
      const b = after[key];
      // Two objects: say which of their parts changed (a brief's answers, a profile's weights).
      if (isObject(a) && isObject(b)) {
        const parts = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !same(a[k], b[k]));
        const leaf = parts.filter((k) => !isObject(a[k]) && !isObject(b[k]));
        if (key === "meta" || key === "override_reasons") continue; // bookkeeping of the answers shown next to it
        const listed = leaf.length <= 3 ? leaf : [];
        for (const k of listed) lines.push({ label: `${label(key)} · ${label(k)}`, from: show(a[k], name, k), to: show(b[k], name, k) });
        const rest = parts.filter((k) => !listed.includes(k));
        if (rest.length) lines.push({ label: label(key), to: `${rest.map((k) => label(k).toLowerCase()).slice(0, 5).join(", ")}${rest.length > 5 ? ` and ${rest.length - 5} more` : ""} changed` });
        continue;
      }
      lines.push({ label: label(key), from: show(a, name, key), to: show(b, name, key) });
    }
    return lines.slice(0, max);
  }
  // A new row (or the mock's "after only" events): the few fields that say what it is.
  const row = (after ?? before)!;
  const keys = [...CREATED.filter((k) => k in row), ...Object.keys(row).filter((k) => !CREATED.includes(k))];
  for (const key of keys) {
    const v = row[key];
    if (SKIP.has(key) || v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) || (isObject(v) && !Object.keys(v).length)) continue;
    if (key === "meta" || key === "values") {
      if (isObject(v)) lines.push({ label: key === "values" ? "Answers" : "Fields", to: Object.keys(v).map((k) => label(k).toLowerCase()).join(", ") });
      continue;
    }
    lines.push({ label: label(key), to: show(v, name, key) });
  }
  return lines.slice(0, max);
}

/** Any value as readable text (a proposal's before / after): lists as bullets, objects as "Label: value" lines. */
export function plainText(v: unknown, name: Name = (id) => id): string {
  if (Array.isArray(v)) return v.length ? v.map((x) => `• ${isObject(x) ? plainText(x, name).replace(/\n/g, "; ") : show(x, name)}`).join("\n") : "none";
  if (isObject(v))
    return (
      Object.entries(v)
        .filter(([k, x]) => !SKIP.has(k) && x !== null && x !== undefined && x !== "")
        .map(([k, x]) => `${label(k)}: ${isObject(x) || Array.isArray(x) ? show(x, name, k) : show(x, name, k)}`)
        .join("\n") || "none"
    );
  return show(v, name);
}
