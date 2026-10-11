import type { Case, CaseStance, Dataset, FeedbackEntry, Provenance, Region, Requirement, RequirementSnapshot, ResolvedBrief, ShapeAnswer, Signal, User } from "@/contracts";
import { RequirementSnapshot as RequirementSnapshotSchema } from "@/contracts";
import { overlayOf, resolveBrief, sharedBrief } from "../briefs";
import { getDrafter, type Draft, type DraftInput } from "./drafter";
import { context } from "./provenance";

/** Builds drafter input from the store. Handlers and the scripted chat share it. */

export function stanceOf(c: Case, userId: string): CaseStance | null {
  return c.stances.find((s) => s.authorId === userId) ?? null;
}

export function briefFor(d: Dataset, c: Case, userId: string): { resolved: ResolvedBrief | null; briefId: string | null } {
  const resolved = resolveBrief(d, c.series, userId);
  const briefId = overlayOf(d, c.series, userId)?.id ?? sharedBrief(d, c.series)?.id ?? null;
  return { resolved, briefId };
}

export function caseSignalsOf(d: Dataset, c: Case): Signal[] {
  return c.signalIds.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s);
}

/** The region a user drafts for: their overlay's region, else their own region. */
export function regionOf(d: Dataset, c: Case, user: User): Region {
  return overlayOf(d, c.series, user.id)?.region ?? (user.region === "CN" ? "CN" : user.region === "RoW" ? "RoW" : "global");
}

export function buildInput(
  d: Dataset,
  c: Case,
  author: User,
  opts: { answers?: ShapeAnswer[]; feedback?: FeedbackEntry[]; previous?: RequirementSnapshot | null; brief?: ResolvedBrief | null; excludeRequirementId?: string } = {},
): DraftInput {
  const { resolved, briefId } = briefFor(d, c, author.id);
  return {
    case: c,
    signals: caseSignalsOf(d, c),
    brand: d.brandProfile,
    brief: opts.brief !== undefined ? opts.brief : resolved,
    briefId,
    author,
    region: regionOf(d, c, author),
    stance: stanceOf(c, author.id),
    answers: opts.answers ?? [],
    feedback: opts.feedback ?? [],
    previous: opts.previous ?? null,
    plan: d.plans.find((p) => p.series === c.series) ?? null,
    siblings: d.requirements.filter((r) => r.caseId === c.id && r.id !== opts.excludeRequirementId && r.status !== "rejected"),
    conversions: d.conversions,
  };
}

export function snapshotOf(r: Requirement): RequirementSnapshot {
  return RequirementSnapshotSchema.parse(r);
}

/**
 * Re-run the drafter for an existing requirement with its stored inputs
 * (owner's stance, the answers the PM gave explicitly, all feedback), optionally with another brief.
 */
export async function redraft(d: Dataset, r: Requirement, opts: { brief?: ResolvedBrief | null; extraFeedback?: FeedbackEntry } = {}): Promise<{ draft: Draft; drafter: string }> {
  const c = d.cases.find((x) => x.id === r.caseId)!;
  const author = d.users.find((u) => u.id === r.ownerId)!;
  const feedback = d.feedback.filter((f) => f.requirementId === r.id && f.resultingVersion !== null);
  if (opts.extraFeedback) feedback.push(opts.extraFeedback);
  const input = buildInput(d, c, author, {
    answers: r.shapeAnswers.filter((a) => !a.byDefault),
    feedback,
    previous: snapshotOf(r),
    brief: opts.brief,
    excludeRequirementId: r.id,
  });
  const out = await getDrafter().draft(input);
  return { draft: out.drafts[0], drafter: out.drafter };
}

const comparable = (s: RequirementSnapshot) => JSON.stringify([s.title, s.descriptionParts, s.metrics, s.acceptanceCriteria, s.assumptions, s.marketScope, s.releaseTarget, s.cost.size]);
export function snapshotsDiffer(a: RequirementSnapshot, b: RequirementSnapshot) {
  return comparable(a) !== comparable(b);
}

/** After a manual edit, parts the PM changed are tagged "Edited by the PM"; unchanged parts keep their provenance. */
export function retagEdits(prev: RequirementSnapshot, next: RequirementSnapshot, rationale: string): Provenance[] {
  const old = new Map(prev.provenance.map((p) => [p.path, p]));
  const edited = (path: string) => context(path, "requirement_shape", "pm.edit", `Edited by the PM · ${rationale.slice(0, 60)}`);
  const keepOrEdit = (path: string, changed: boolean) => (!changed && old.get(path)) || edited(path);
  const list = (key: "acceptanceCriteria" | "assumptions") =>
    next[key].map((text, i) => {
      const j = prev[key].indexOf(text);
      return j >= 0 && old.get(`${key}#${j}`) ? { ...old.get(`${key}#${j}`)!, path: `${key}#${i}` } : edited(`${key}#${i}`);
    });
  return [
    keepOrEdit("title", prev.title !== next.title),
    ...next.descriptionParts.map((text, i) => {
      const j = prev.descriptionParts.indexOf(text);
      return j >= 0 && old.get(`description#${j}`) ? { ...old.get(`description#${j}`)!, path: `description#${i}` } : edited(`description#${i}`);
    }),
    ...next.metrics.map((m) => keepOrEdit(`metrics.${m.id}.target`, prev.metrics.find((x) => x.id === m.id)?.target !== m.target)),
    ...list("acceptanceCriteria"),
    ...list("assumptions"),
    keepOrEdit("marketScope", prev.marketScope !== next.marketScope),
    keepOrEdit("releaseTarget", prev.releaseTarget !== next.releaseTarget),
    keepOrEdit("cost", prev.cost.size !== next.cost.size || prev.cost.eurBand !== next.cost.eurBand),
  ];
}

/** Feedback on a hand-written requirement: a minimal patch (target number, release, a logged note), tagged "feedback". */
export function feedbackPatch(s: RequirementSnapshot, fb: FeedbackEntry): RequirementSnapshot {
  const label = `Feedback · ${fb.from} (${fb.response.replace("_", " ")})`;
  const tag = (path: string) => context(path, "feedback", `feedback.${fb.id}`, label, fb.signalIds);
  const next: RequirementSnapshot = structuredClone(s);
  const who = fb.from === "finance" ? "Finance" : fb.from === "engineering" ? "Engineering" : fb.from;
  if (fb.response !== "push_back") {
    const m = next.metrics[0];
    const num = m && fb.text.match(/(\d+(?:[.,]\d+)?)/);
    const cur = m && m.target.match(/(\d+(?:[.,]\d+)?)/);
    if (m && num && cur) {
      const value = fb.response === "accept" ? Number(num[1].replace(",", ".")) : Math.round(((Number(num[1].replace(",", ".")) + Number(cur[1].replace(",", "."))) / 2) * 10) / 10;
      m.target = m.target.replace(cur[1], String(value));
      next.provenance = next.provenance.filter((p) => p.path !== `metrics.${m.id}.target`).concat(tag(`metrics.${m.id}.target`));
    }
    const rel = /next[- ]gen|next generation/i.test(fb.text) ? "next_gen" : /mid-life|\blci\b/i.test(fb.text) ? "lci" : /\bota\b|over-the-air/i.test(fb.text) ? "ota" : null;
    if (rel) {
      next.releaseTarget = rel;
      next.provenance = next.provenance.filter((p) => p.path !== "releaseTarget").concat(tag("releaseTarget"));
    }
    next.assumptions.push(`${who}: "${fb.text}" PM: ${fb.pmRationale}`);
  } else {
    next.assumptions.push(`${who} says: "${fb.text}" The PM keeps the target: ${fb.pmRationale}`);
    next.acceptanceCriteria.push(`${who} shows a path to ${next.metrics[0]?.target ?? "the target"} before sign-off`);
    next.provenance.push(tag(`acceptanceCriteria#${next.acceptanceCriteria.length - 1}`));
  }
  next.provenance.push(tag(`assumptions#${next.assumptions.length - 1}`));
  return next;
}

/** One line on what changed between two versions (proposal summaries, version list). */
export function changeSummary(a: RequirementSnapshot, b: RequirementSnapshot): string {
  const out: string[] = [];
  const t = (s: RequirementSnapshot) => s.metrics[0]?.target;
  if (t(a) !== t(b)) out.push(`target ${t(a) ?? "—"} → ${t(b) ?? "—"}`);
  if (a.releaseTarget !== b.releaseTarget) out.push(`release ${a.releaseTarget} → ${b.releaseTarget}`);
  if (a.marketScope !== b.marketScope) out.push(`scope ${a.marketScope} → ${b.marketScope}`);
  if (a.cost.size !== b.cost.size) out.push(`cost ${a.cost.size} → ${b.cost.size}`);
  if (JSON.stringify(a.acceptanceCriteria) !== JSON.stringify(b.acceptanceCriteria)) out.push("acceptance criteria");
  if (JSON.stringify(a.assumptions) !== JSON.stringify(b.assumptions)) out.push("assumptions");
  if (!out.length && JSON.stringify(a.descriptionParts) !== JSON.stringify(b.descriptionParts)) out.push("wording");
  return out.join(", ") || "no visible change";
}
