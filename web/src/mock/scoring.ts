import type { Case, Dataset, FactorKey, Requirement, ScoresResponse, Series, WeightProfile } from "@/contracts";
import { FactorKey as FactorKeys } from "@/contracts";

/**
 * Reference scoring (architecture.mmd §5 + §8). The logic team replaces this
 * with the real scorer; the formula must stay visible and explainable:
 *
 *   case score = Σ w_f · factor_f / Σ w_f          (0..1, no cost: a problem has no cost)
 *   requirement score = case score · costMultiplier[size]
 *
 * Manual rank overrides (with reason) win over the computed order.
 */

const FACTORS = FactorKeys.options;

export function caseScore(c: Case, weights: Record<FactorKey, number>) {
  const total = FACTORS.reduce((s, f) => s + (weights[f] ?? 0), 0) || 1;
  const contributions = Object.fromEntries(FACTORS.map((f) => [f, ((weights[f] ?? 0) * (c.factors[f] ?? 0)) / total])) as Record<FactorKey, number>;
  const score = FACTORS.reduce((s, f) => s + contributions[f], 0);
  return { score, contributions };
}

function rankable(c: Case) {
  return c.state !== "observed" && !(c.state === "decided" && (c.outcome === "rejected" || c.outcome === "merged"));
}

export function computeScores(
  d: Dataset,
  profile: Pick<WeightProfile, "id" | "weights" | "costMultiplier">,
  series?: Series,
): ScoresResponse {
  const cases = d.cases.filter((c) => rankable(c) && (!series || c.series === series || c.relatedSeries.includes(series)));
  const scored = cases.map((c) => ({ c, ...caseScore(c, profile.weights) }));
  scored.sort((a, b) => {
    if (a.c.manualRank != null && b.c.manualRank != null) return a.c.manualRank - b.c.manualRank;
    if (a.c.manualRank != null) return -1;
    if (b.c.manualRank != null) return 1;
    return b.score - a.score;
  });

  const caseById = new Map(d.cases.map((c) => [c.id, c]));
  const reqs = d.requirements.filter((r: Requirement) => r.status !== "rejected" && (!series || r.series === series));
  const reqScored = reqs
    .map((r) => {
      const c = caseById.get(r.caseId);
      const base = c ? caseScore(c, profile.weights).score : 0;
      return { r, score: base * (profile.costMultiplier[r.cost.size] ?? 1) };
    })
    .sort((a, b) => (a.r.manualRank ?? 1e9) - (b.r.manualRank ?? 1e9) || b.score - a.score);

  return {
    profileId: profile.id,
    weights: profile.weights,
    cases: scored.map((s, i) => ({
      caseId: s.c.id,
      profileId: profile.id,
      score: round(s.score),
      rank: i + 1,
      contributions: Object.fromEntries(Object.entries(s.contributions).map(([k, v]) => [k, round(v)])) as Record<FactorKey, number>,
    })),
    requirements: reqScored.map((s, i) => ({ requirementId: s.r.id, score: round(s.score), rank: i + 1 })),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
