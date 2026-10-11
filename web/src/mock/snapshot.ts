import type { Dataset, ScoreSnapshot, WeightProfile } from "@/contracts";
import { computeScores } from "./scoring";
import { now } from "./store";

/** Version of a weight profile = 1 + the logged changes to it (the seed logs the 25.09. change of the default). */
export function profileVersion(d: Dataset, profileId: string) {
  return 1 + d.audit.filter((e) => e.action === "weight_profile.updated" && e.objectId === profileId).length;
}

/** The case score right now under `profile`, frozen into an audit event so a replay shows the score of that day. */
export function scoreSnapshotNow(d: Dataset, caseId: string, profile: WeightProfile): ScoreSnapshot | undefined {
  const scores = computeScores(d, profile);
  const row = scores.cases.find((s) => s.caseId === caseId);
  const c = d.cases.find((x) => x.id === caseId);
  if (!row || !c) return undefined;
  return {
    caseId,
    profileId: profile.id,
    profileName: profile.name,
    profileVersion: profileVersion(d, profile.id),
    weights: { ...profile.weights },
    factors: { ...c.factors },
    contributions: row.contributions,
    score: row.score,
    rank: row.rank,
    of: scores.cases.length,
    at: now(),
  };
}
