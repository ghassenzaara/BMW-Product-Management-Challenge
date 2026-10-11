import { factorLabel, type FactorKey } from "@/contracts";

/** "Moved up because Brand fit weight ↑ and this case scores 0.80 on it" (weights changed, factors fixed). */
export function movedBecause(factors: Record<FactorKey, number>, base: Record<FactorKey, number>, next: Record<FactorKey, number>, up: boolean) {
  const changes = (Object.keys(next) as FactorKey[])
    .map((f) => ({ f, d: (next[f] - base[f]) * factors[f] }))
    .filter((x) => Math.abs(x.d) > 0.001)
    .sort((a, b) => (up ? b.d - a.d : a.d - b.d));
  const top = changes[0];
  if (!top) return null;
  const dir = next[top.f] > base[top.f] ? "↑" : "↓";
  return `${up ? "Moved up" : "Moved down"} because ${factorLabel[top.f]} weight ${dir} and this case scores ${factors[top.f].toFixed(2)} on it`;
}

/** "Moved up 9 → 6 because Competitor gap 0.55 → 0.70 (Xiaomi SU7 800 km CLTC)" (a factor changed, weights fixed). */
export function movedBecauseFactor(factor: FactorKey, before: number, after: number, rankBefore: number, rankAfter: number, cause: string) {
  if (rankBefore === rankAfter) return `Rank unchanged (${rankAfter}); ${factorLabel[factor]} ${before.toFixed(2)} → ${after.toFixed(2)} (${cause})`;
  return `${rankAfter < rankBefore ? "Moved up" : "Moved down"} ${rankBefore} → ${rankAfter} because ${factorLabel[factor]} ${before.toFixed(2)} → ${after.toFixed(2)} (${cause})`;
}
