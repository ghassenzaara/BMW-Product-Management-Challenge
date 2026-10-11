/**
 * Per-case knowledge the scripted composer uses in place of a real model:
 * a solution the evidence points at (asked as "prescribe or stay solution-neutral?")
 * and benchmarks that are not web signals yet (e.g. from an engineering meeting).
 * The real brain derives these from the signals and the RAG index instead.
 */

export interface SolutionHint {
  /** "Reach it with …" */
  text: string;
  /** What the evidence says that points at it. */
  because: string;
}

export interface Benchmark {
  competitor: string;
  metric: string;
  value: number;
  unit: string;
  /** True for times (lower is better); false for range, power, … */
  lowerIsBetter: boolean;
  /** Today's BMW value, when known. */
  today?: number;
  source: string;
}

export const solutionHints: Record<string, SolutionHint> = {
  "CASE-G60-0001": { text: "8 programmable physical favourite buttons", because: "owners ask for physical shortcuts they can reach without looking" },
  "CASE-G60-0003": { text: "the Gen6 eDrive with cylindrical cells (Neue Klasse electrics)", because: "owners compare the range directly with newer competitors" },
  "CASE-G60-0005": { text: "a physical climate bar below the display", because: "owners say temperature and fan take too many steps on the screen" },
  "CASE-G60-0006": { text: "a compact spare wheel as an option", because: "owners complain about being stranded with only a sealant kit" },
};

/** Segment of each line and of the competitors the monitor knows; a compact car is not compared with a business saloon. */
export const segments = {
  series: { G60: "business", G70: "luxury", F70: "compact" } as Record<string, string>,
  competitors: { "Xiaomi SU7": "business", "Zeekr 007": "business", "Zeekr 001": "business", "Mercedes-Benz CLA": "compact", "Audi A6 e-tron": "business" } as Record<string, string>,
};

/** Benchmarks from outside the signal base (engineering meetings, tests). Shown as assumptions until a signal backs them. */
export const benchmarks: Record<string, Benchmark> = {
  "CASE-G60-0005": { competitor: "Mercedes E-Class", metric: "Cool-down 45 → 22 °C", value: 6, unit: "min", lowerIsBetter: true, today: 9, source: "Engineering benchmark (climate sync 10.10)" },
};
