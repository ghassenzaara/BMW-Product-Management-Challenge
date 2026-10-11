import type { Comparator, ImpactVerdict, TargetCycle } from "./enums";
import type { CycleConversion } from "./entities";

/**
 * The comparison rule of the competitor ripple. The backend must implement the
 * same rule; the UI uses it to recolor the grid live when the PM edits a factor.
 *
 *   normalized = value × factor        (from → to), or value ÷ factor for the reverse row
 *   gap %      = (ours − theirs) / theirs × 100, sign flipped for "lower is better"
 *   verdict    = |gap| ≤ tolerance → at_par; gap > 0 → still_ahead; else behind
 */

export interface Normalized {
  value: number;
  low: number;
  high: number;
  conversion: CycleConversion | null;
  factor: number | null;
}

/** Converts a value between cycles. `factorOverride` replaces a row's factor (what-if); null = no conversion known. */
export function normalize(
  value: number,
  from: TargetCycle,
  to: TargetCycle,
  table: CycleConversion[],
  factorOverride: Record<string, number> = {},
): Normalized | null {
  if (from === to || from === "none" || to === "none") return from === to ? { value, low: value, high: value, conversion: null, factor: null } : null;
  const direct = table.find((c) => c.from === from && c.to === to);
  if (direct) {
    const f = factorOverride[direct.id] ?? direct.factor;
    return { value: round(value * f), low: round(value * direct.range[0]), high: round(value * direct.range[1]), conversion: direct, factor: f };
  }
  const reverse = table.find((c) => c.from === to && c.to === from);
  if (reverse) {
    const f = factorOverride[reverse.id] ?? reverse.factor;
    return { value: round(value / f), low: round(value / reverse.range[1]), high: round(value / reverse.range[0]), conversion: reverse, factor: f };
  }
  return null;
}

export function gapPct(ours: number, theirs: number, comparator: Comparator): number {
  const g = ((ours - theirs) / theirs) * 100;
  return Math.round((comparator === "gte" ? g : -g) * 10) / 10;
}

export function verdictOf(gap: number, tolerancePct: number): ImpactVerdict {
  if (Math.abs(gap) <= tolerancePct) return "at_par";
  return gap > 0 ? "still_ahead" : "behind";
}

/** Worst first: what a grid cell shows when several items share it. */
export const verdictSeverity: Record<ImpactVerdict, number> = { behind: 3, at_par: 2, still_ahead: 1, not_comparable: 0 };

const round = (n: number) => Math.round(n);
