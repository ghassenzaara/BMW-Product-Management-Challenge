import type { Ambition, BriefFieldKey, BriefValues, Case, Market, Metric, Provenance, Region, ReleaseTarget, ShapeAnswer, ShapeKey, ShapeQuestion, Signal, TargetCycle, TargetSpec } from "@/contracts";
import { ambitionLabel, briefFieldLabel, costSensitivityLabel, insideKindLabel, marketLabel, normalize, positioningLabel, regionLabel, releaseLabel, targetCustomerLabel } from "@/contracts";
import { benchmarks, solutionHints } from "../authored/hints";
import { assumption, context, evidence, fromBrief } from "./provenance";
import type { Draft, DraftInput } from "./drafter";

/**
 * Scripted, deterministic requirement composer (the stand-in for the real brain).
 * It reads every context layer and tags every part it writes:
 *   brand → series brief (shared + regional overlay) → case stance → shape answers → feedback.
 * Same inputs always give the same requirement, so the demo shows cause and effect.
 */

type Base = Omit<DraftInput, "answers" | "feedback" | "previous">;
const MARKETS = ["EU", "US", "CN", "RoW"] as const;
type SalesMarket = (typeof MARKETS)[number];

// ---------- Effective context: brief with the stance's overrides ----------
function fallbackBrief(c: Case): BriefValues {
  const w = { EU: 0, US: 0, CN: 0, RoW: 0 };
  c.figures.perMarket.forEach((m) => m.market !== "unknown" && m.salesShare2030 !== undefined && (w[m.market] = m.salesShare2030));
  return {
    thesis: "",
    targetCustomer: { who: "keep_owners", positioning: "premium" },
    marketWeights: w,
    changeAmbition: { level: "balanced", innovationSlots: 1 },
    protectList: [],
    dontFightOn: [],
    givens: { platform: "", sop: "", frozen: [], openReleases: ["next_gen", "lci", "ota"], cycle: "WLTP" },
    costEnvelope: { sensitivity: "medium", perCarBand: "to define" },
  };
}

type OverridableKey = "marketWeights" | "targetCustomer" | "costEnvelope" | "givens";

function effective(input: Base) {
  const base = input.brief?.values ?? fallbackBrief(input.case);
  const o = input.stance?.overrides ?? {};
  const v: BriefValues = { ...base, ...o };
  const overridden = (k: BriefFieldKey) => k in o && (o as Record<string, unknown>)[k] !== undefined;
  /** Provenance for a value that comes from the brief (or the stance overriding it). */
  const tag = (path: string, k: BriefFieldKey, detail?: string, signalIds: string[] = []): Provenance => {
    if (overridden(k)) {
      const reason = input.stance?.overrideReasons[k];
      return context(path, "case_stance", `stance.${k}`, `Your context · ${detail ?? briefFieldLabel[k].toLowerCase()} (overrides the product specs${reason ? `: ${reason}` : ""})`, signalIds);
    }
    if (!input.brief) return assumption(path, `Assumption · no product specs yet (${briefFieldLabel[k].toLowerCase()} is a default)`, signalIds);
    const p = fromBrief(path, k, input.brief.origin[k] === "overlay", detail);
    return { ...p, signalIds };
  };
  return { v, overridden: overridden as (k: OverridableKey) => boolean, tag };
}

// ---------- Evidence: BMW customer records, read with the stance ----------
const sevRank: Record<string, number> = { defect: 0, difficult_to_use: 1, wish: 2, none: 3 };

function customerEvidence(input: Base) {
  const all = input.signals.filter((s) => s.agent === "bmw_data" && s.sourceType === "bmw_feedback" && ["complaint", "wish", "like"].includes(s.kind));
  let used = all;
  const applied: { text: string; before: number; after: number }[] = [];
  for (const t of input.stance?.evidenceTakes ?? []) {
    const match = (s: Signal) =>
      (!t.market || s.market === t.market) && (!t.powertrain || s.powertrain === t.powertrain) && (!t.keyword || (s.quoteEn ?? s.quote).toLowerCase().includes(t.keyword.toLowerCase()));
    const next = t.effect === "focus" ? used.filter(match) : used.filter((s) => !match(s));
    // A focus that leaves nothing would hide the problem; keep the evidence and say so.
    applied.push({ text: t.text, before: used.length, after: next.length || used.length });
    if (next.length) used = next;
  }
  const negatives = used.filter((s) => s.kind !== "like");
  const likes = used.filter((s) => s.kind === "like");
  const counts: Record<SalesMarket, number> = { EU: 0, US: 0, CN: 0, RoW: 0 };
  used.forEach((s) => s.market !== "unknown" && counts[s.market as SalesMarket]++);
  const top = [...negatives].sort((a, b) => (sevRank[a.severity] ?? 4) - (sevRank[b.severity] ?? 4)).slice(0, 3).map((s) => s.id);
  return { all, used, negatives, likes, counts, top };
}

// ---------- Benchmark: competitor facts with a number ----------
interface Bench {
  competitor: string;
  metric: string;
  value: number;
  unit: string;
  cycle?: string;
  lowerIsBetter: boolean;
  today?: number;
  signalId: string | null;
  source: string;
  /** The brief's thesis names this competitor. */
  fromThesis: boolean;
}

function benchmarkOf(input: Base, v: BriefValues): Bench | null {
  const facts = input.signals.filter((s) => s.kind === "competitor_fact" && s.metric);
  if (facts.length) {
    const lower = (u: string) => ["min", "s"].includes(u);
    const named = facts.find((s) => s.competitor && v.thesis.toLowerCase().includes(s.competitor.toLowerCase().split(" ").slice(-2).join(" ")));
    const best = named ?? [...facts].sort((a, b) => (lower(a.metric!.unit) ? a.metric!.value - b.metric!.value : b.metric!.value - a.metric!.value))[0];
    return {
      competitor: best.competitor ?? best.sourceName,
      metric: best.metric!.name,
      value: best.metric!.value,
      unit: best.metric!.unit,
      cycle: best.metric!.cycle,
      lowerIsBetter: lower(best.metric!.unit),
      signalId: best.id,
      source: best.sourceName,
      fromThesis: !!named,
    };
  }
  const a = benchmarks[input.case.id];
  return a ? { ...a, signalId: null, fromThesis: false } : null;
}

// ---------- Decisions that the questions can override ----------
function dontFightMatch(input: Base, v: BriefValues): string | null {
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
  const caseWords = new Set(words(`${input.case.featureName} ${input.case.title}`));
  return v.dontFightOn.find((d) => words(d).some((w) => caseWords.has(w))) ?? null;
}

function defaultAmbition(input: Base, v: BriefValues, bench: Bench | null, tag: ReturnType<typeof effective>["tag"]): { value: Ambition; why: string; prov: (path: string, ids?: string[]) => Provenance } {
  const df = dontFightMatch(input, v);
  if (df) return { value: "fix", why: `Your product specs say don't fight on "${df}": fix the complaint, don't race the competitor.`, prov: (p, ids) => tag(p, "dontFightOn", `don't fight on ${df}`, ids) };
  if (input.stance?.ambition)
    return {
      value: input.stance.ambition,
      why: `Your context on this case: ${ambitionLabel[input.stance.ambition].toLowerCase()}.`,
      prov: (p, ids = []) => context(p, "case_stance", "stance.ambition", `Your context · ${ambitionLabel[input.stance!.ambition!].toLowerCase()}`, ids),
    };
  if (v.changeAmbition.level === "revolution" || v.targetCustomer.who === "conquest")
    return {
      value: "beat",
      why: `Your product specs: ${v.changeAmbition.level === "revolution" ? "revolution" : "win buyers from competitors"}, so the target should beat the best competitor.`,
      prov: (p, ids) => tag(p, v.changeAmbition.level === "revolution" ? "changeAmbition" : "targetCustomer", v.changeAmbition.level === "revolution" ? "revolution" : "conquest buyers", ids),
    };
  if (bench)
    return {
      value: "match",
      why: `Your product specs call for an evolution${bench.fromThesis ? ` and its thesis names ${bench.competitor}` : ""}: match the best competitor rather than beat it.`,
      prov: (p, ids) => tag(p, bench.fromThesis ? "thesis" : "changeAmbition", bench.fromThesis ? `thesis names ${bench.competitor}` : "evolution", ids),
    };
  return { value: "fix", why: "No competitor benchmark: fix the customer problem first.", prov: (p, ids) => tag(p, "changeAmbition", "evolution", ids) };
}

function idealRelease(c: Case): ReleaseTarget {
  return c.changeDepth === "platform_powertrain" ? "next_gen" : c.changeDepth === "software_ota" ? "ota" : "lci";
}

function defaultRelease(c: Case, v: BriefValues): ReleaseTarget {
  const open = v.givens.openReleases;
  const ideal = idealRelease(c);
  if (open.includes(ideal)) return ideal;
  if (ideal !== "next_gen" && open.includes("next_gen")) return "next_gen";
  return open[0] ?? ideal;
}

function variantRegion(region: Region): Region {
  return region === "global" ? "global" : region;
}

// ---------- Layer 3: the adaptive questions ----------
export function composeShapeQuestions(input: Base): ShapeQuestion[] {
  const { v, tag } = effective(input);
  const ev = customerEvidence(input);
  const bench = benchmarkOf(input, v);
  const c = input.case;
  const pending = new Map((input.stance?.pendingShape ?? []).map((a) => [a.key, a.value]));
  const qs: ShapeQuestion[] = [];
  const withPending = (q: ShapeQuestion): ShapeQuestion => (pending.has(q.key) ? { ...q, default: pending.get(q.key)!, defaultWhy: "You answered this in the case chat." } : q);

  // Scope: conflict, a regional author, or evidence concentrated where the brief does not put its weight.
  const total = ev.used.length || 1;
  const topMarket = (MARKETS.slice().sort((a, b) => ev.counts[b] - ev.counts[a])[0] ?? "US") as SalesMarket;
  const heavier = MARKETS.filter((m) => m !== topMarket && v.marketWeights[m] > v.marketWeights[topMarket]);
  const regional = input.region !== "global";
  if (c.marketConflict || input.region === "CN" || (ev.counts[topMarket] / total > 0.8 && heavier.length)) {
    const variantLabel = `${regionLabel[variantRegion(input.region)]} variant`;
    const def = input.region === "CN" || c.marketConflict ? "variant" : "global";
    const why = c.marketConflict
      ? c.marketConflict.note
      : input.region === "CN"
        ? `You plan for China, and ${ev.counts.CN} of ${ev.used.length} records are Chinese. One global target, or a China variant next to the global requirement?`
        : `${Math.round((ev.counts[topMarket] / total) * 100)}% of the records come from ${marketLabel[topMarket as Market]} (product specs weight ${Math.round(v.marketWeights[topMarket] * 100)}%), but your product specs put more weight on ${heavier.map((m) => `${marketLabel[m as Market]} (${Math.round(v.marketWeights[m] * 100)}%)`).join(", ")}.`;
    qs.push(
      withPending({
        key: "scope",
        question: "One global requirement, or a regional variant?",
        why,
        options: [
          { value: "global", label: "Global" },
          ...(regional ? [{ value: "variant", label: variantLabel }] : []),
        ],
        default: regional ? def : "global",
        defaultWhy: def === "variant" ? "Your region has its own product specs, so the variant follows them." : "The product specs are global and no market conflict is known.",
        trigger: { layer: "series_brief", signalIds: ev.top, briefField: "marketWeights" },
      }),
    );
  }

  if (bench) {
    const amb = defaultAmbition(input, v, bench, tag);
    qs.push(
      withPending({
        key: "benchmark",
        question: `${bench.competitor} reaches ${bench.value} ${bench.unit}${bench.cycle ? ` ${bench.cycle}` : ""}. Fix, match or beat it?`,
        why: `${bench.metric} is the number engineering will be measured against${bench.signalId ? "" : ` (${bench.source}, not a web signal yet)`}.`,
        options: (["fix", "match", "beat"] as const).map((a) => ({ value: a, label: ambitionLabel[a] })),
        default: amb.value,
        defaultWhy: amb.why,
        trigger: { layer: "case_stance", signalIds: bench.signalId ? [bench.signalId] : [] },
      }),
    );
  }

  if (c.changeDepth === "platform_powertrain" && v.givens.frozen.length && v.givens.openReleases.length) {
    const def = defaultRelease(c, v);
    qs.push(
      withPending({
        key: "release",
        question: "This needs a platform-deep change. Which release?",
        why: `Your product specs say "${v.givens.frozen[0]}" is frozen; open releases: ${v.givens.openReleases.map((r) => releaseLabel[r]).join(", ")}.`,
        options: v.givens.openReleases.map((r) => ({ value: r, label: releaseLabel[r] })),
        default: def,
        defaultWhy: `${releaseLabel[def]} is the first open release that can take a platform change.`,
        trigger: { layer: "series_brief", signalIds: [], briefField: "givens" },
      }),
    );
  }

  const hint = solutionHints[c.id];
  if (hint) {
    qs.push(
      withPending({
        key: "solution",
        question: `The evidence points at ${hint.text}. Prescribe it, or stay solution-neutral?`,
        why: `Because ${hint.because}. Engineering usually picks the how; prescribe only what you have already decided.`,
        options: [
          { value: "neutral", label: "Solution-neutral" },
          { value: "prescribe", label: `Prescribe ${hint.text}` },
        ],
        default: "neutral",
        defaultWhy: "Requirements stay solution-neutral unless you decide otherwise.",
        trigger: { layer: "requirement_shape", signalIds: ev.top },
      }),
    );
  }

  if (v.targetCustomer.positioning !== "base" && ["trim_option", "part_module"].includes(c.changeDepth)) {
    const std = v.targetCustomer.who === "conquest" || v.costEnvelope.sensitivity === "low";
    qs.push(
      withPending({
        key: "offer",
        question: "Standard equipment, or a paid option?",
        why: `${positioningLabel[v.targetCustomer.positioning]} positioning, cost sensitivity ${costSensitivityLabel[v.costEnvelope.sensitivity].toLowerCase()}.`,
        options: [
          { value: "standard", label: "Standard" },
          { value: "option", label: "Paid option" },
        ],
        default: std ? "standard" : "option",
        defaultWhy: std ? "Conquest buyers or a low cost sensitivity: make it standard." : "Keeps the base price; owners who care can order it.",
        trigger: { layer: "series_brief", signalIds: [], briefField: "targetCustomer" },
      }),
    );
  }
  return qs.slice(0, 3);
}

// ---------- Layer 4: what feedback changes ----------
const releaseWord = (t: string): ReleaseTarget | null =>
  /next[- ]gen|next generation/i.test(t) ? "next_gen" : /mid-life|\blci\b/i.test(t) ? "lci" : /\bota\b|over-the-air|software update/i.test(t) ? "ota" : null;

/** The number engineering offers instead: the most conservative value with the unit (lowest range, longest time). */
function numberIn(text: string, unit: string, current: number, lowerIsBetter: boolean): number | null {
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const values = [...text.matchAll(re)].map((m) => Number(m[1].replace(",", "."))).filter((v) => v !== current);
  if (!values.length) return null;
  return lowerIsBetter ? Math.max(...values) : Math.min(...values);
}

/** Machine-readable target, so the competitor ripple can compare it (range and charging minutes only). */
function specOf(t: { value: number; unit: string; metricName: string; cycle?: string }, lowerIsBetter: boolean, scope: Region): TargetSpec | undefined {
  const key = /range/i.test(t.metricName) && t.unit === "km" ? "ev_range" : /10.?[–-]?.?80|charg/i.test(t.metricName) && t.unit === "min" ? "dc_10_80_min" : null;
  if (!key) return undefined;
  const cycle = (["WLTP", "CLTC", "EPA"].includes(t.cycle ?? "") ? t.cycle : "none") as TargetCycle;
  return { key, comparator: lowerIsBetter ? "lte" : "gte", value: t.value, unit: t.unit, cycle, market: scope === "CN" ? "CN" : scope === "RoW" ? "RoW" : "global" };
}

const roundTo = (n: number, unit: string) => (unit === "km" ? Math.round(n / 10) * 10 : unit === "min" ? Math.round(n * 2) / 2 : Math.round(n));

// ---------- The composer ----------
export function composeDrafts(input: DraftInput): Draft[] {
  const c = input.case;
  const { v, tag } = effective(input);
  const ev = customerEvidence(input);
  const bench = benchmarkOf(input, v);
  const questions = composeShapeQuestions(input);
  const given = new Map(input.answers.map((a) => [a.key, a.value]));
  const answers: ShapeAnswer[] = questions.map((q) => ({ key: q.key, value: given.get(q.key) ?? q.default, byDefault: !given.has(q.key) }));
  for (const a of input.answers) if (!answers.some((x) => x.key === a.key)) answers.push({ ...a, byDefault: false });
  const ans = (k: ShapeKey) => answers.find((a) => a.key === k);
  const shapeTag = (path: string, k: ShapeKey, label: string, ids: string[] = []) =>
    context(path, "requirement_shape", `shape.${k}`, `${!ans(k) ? "Default (not asked)" : ans(k)!.byDefault ? "Default answer" : "Your answer"} · ${label}`, ids);

  const parts: { text: string; prov: (path: string) => Provenance }[] = [];
  const criteria: typeof parts = [];
  const assumptions: typeof parts = [];
  const metrics: { m: Metric; prov: Provenance }[] = [];

  // Scope
  const scopeAns = ans("scope");
  const marketScope: Region = scopeAns?.value === "variant" ? variantRegion(input.region) : "global";
  const scopeProv = (path: string) => (scopeAns ? shapeTag(path, "scope", marketScope === "global" ? "global" : `${regionLabel[marketScope]} variant`, ev.top) : tag(path, "marketWeights", "market weights"));
  const variantOf = marketScope !== "global" ? input.siblings.find((r) => r.marketScope === "global" && r.status !== "rejected")?.id ?? null : null;

  // 1. Evidence
  const perMarket = MARKETS.filter((m) => ev.counts[m]).map((m) => `${marketLabel[m as Market]} ${ev.counts[m]}`).join(", ");
  parts.push({
    text: ev.used.length
      ? `${ev.used.length} BMW customer records describe the problem${perMarket ? ` (${perMarket})` : ""}: ${ev.negatives.length} complaints or wishes, ${ev.likes.length} likes.`
      : "No BMW customer record backs this problem yet.",
    prov: (p) => (ev.used.length ? evidence(p, ev.top, `Evidence · ${ev.used.length} BMW customer records`) : assumption(p, "Assumption · no customer evidence")),
  });
  for (const t of (input.stance?.evidenceTakes ?? []).map((t, i) => ({ t, i }))) {
    const before = ev.all.length;
    parts.push({ text: `Read with your context: ${t.t.text} (${ev.used.length} of ${before} records kept).`, prov: (p) => context(p, "case_stance", "stance.evidenceTakes", `Your context · ${t.t.effect} ${t.t.powertrain ?? t.t.market ?? t.t.keyword ?? ""}`.trim()) });
  }
  // Missing evidence, said out loud.
  if (marketScope === "CN" && ev.counts.CN < 3) {
    parts.push({
      text: ev.counts.CN
        ? `Only ${ev.counts.CN} Chinese customer record${ev.counts.CN === 1 ? "" : "s"}: the China need is an assumption until local feedback confirms it.`
        : "No Chinese customer record yet: the China need is an assumption until local feedback confirms it.",
      prov: (p) => assumption(p, "Assumption · missing Chinese evidence"),
    });
  } else if (marketScope === "global") {
    const missing = MARKETS.filter((m) => v.marketWeights[m] >= 0.2 && !ev.counts[m]);
    if (missing.length)
      parts.push({
        text: `No customer records from ${missing.map((m) => marketLabel[m as Market]).join(" or ")} yet, although the product specs weight ${missing.length === 1 ? "it" : "them"} ${missing.map((m) => `${Math.round(v.marketWeights[m] * 100)}%`).join(" / ")}: the global target assumes they share the problem.`,
        prov: (p) => assumption(p, `Assumption · no ${missing.map((m) => marketLabel[m as Market]).join("/")} evidence`),
      });
  }

  // 2. Target
  const amb = defaultAmbition(input, v, bench, tag);
  const benchAns = ans("benchmark");
  const ambition: Ambition = (benchAns?.value as Ambition) ?? amb.value;
  const ambProv = (path: string, ids: string[] = []) => (benchAns ? shapeTag(path, "benchmark", ambitionLabel[ambition].toLowerCase(), ids) : amb.prov(path, ids));
  let target: { value: number; unit: string; text: string; metricName: string; ref: number; cycle?: string } | null = null;
  const benchIds = bench?.signalId ? [bench.signalId] : [];
  if (bench) {
    const toCltcWanted = v.givens.cycle === "CLTC" && bench.cycle && bench.cycle !== "CLTC" && bench.unit === "km";
    const conv = toCltcWanted ? normalize(bench.value, bench.cycle as TargetCycle, "CLTC", input.conversions) : null;
    const toCltc = !!conv;
    const ref = conv ? conv.value : bench.value;
    let value: number;
    if (bench.lowerIsBetter) value = ambition === "beat" ? ref * 0.9 : ambition === "match" ? ref : ((bench.today ?? ref * 1.5) + ref) / 2;
    else value = ambition === "beat" ? ref * 1.05 : ambition === "match" ? ref : ref * 0.95;
    value = roundTo(bench.lowerIsBetter ? value : Math.ceil(value / (bench.unit === "km" ? 10 : 1)) * (bench.unit === "km" ? 10 : 1), bench.unit);
    const cycle = toCltc ? "CLTC" : bench.cycle;
    const metricName = cycle ? bench.metric.replace(bench.cycle ?? "", cycle).trim() : bench.metric;
    // The cycle goes into the target text only when the metric name does not already say it.
    const cycleSuffix = cycle && !metricName.includes(cycle) ? ` ${cycle}` : "";
    target = { value, unit: bench.unit, metricName, ref, cycle, text: `${bench.lowerIsBetter ? "≤" : "≥"} ${value} ${bench.unit}${cycleSuffix}` };
    if (conv?.conversion)
      assumptions.push({
        text: `The CLTC target is converted from the ${bench.cycle} benchmark (${bench.value} → ${conv.value} km, factor ${conv.conversion.factor} per ${conv.conversion.from}→${conv.conversion.to}, range ${conv.low}–${conv.high} km; ${conv.conversion.isAssumption ? "team assumption" : "sourced"}); engineering confirms the real CLTC value.`,
        prov: (p) => assumption(p, "Assumption · cycle conversion", benchIds),
      });
  }

  // 4. Feedback (applied on top of the layers, oldest first)
  let release: ReleaseTarget = (ans("release")?.value as ReleaseTarget) ?? defaultRelease(c, v);
  let releaseProv = (path: string) => (ans("release") ? shapeTag(path, "release", releaseLabel[release].toLowerCase()) : tag(path, "givens", `open releases: ${v.givens.openReleases.map((r) => releaseLabel[r]).join(", ")}`));
  let targetProv = (path: string) => ambProv(path, benchIds);
  for (const fb of input.feedback) {
    const label = `Feedback · ${fb.from} (${fb.response.replace("_", " ")})`;
    const num = target ? numberIn(fb.text, target.unit, target.value, !!bench?.lowerIsBetter) : null;
    const rel = releaseWord(fb.text);
    if (fb.response === "accept" || fb.response === "compromise") {
      if (target && num !== null) {
        const value = fb.response === "accept" ? num : roundTo((target.value + num) / 2, target.unit);
        const cycle = target.text.split(" ").slice(3).join(" ");
        target = { ...target, value, text: `${bench?.lowerIsBetter ? "≤" : "≥"} ${value} ${target.unit}${cycle ? ` ${cycle}` : ""}` };
        targetProv = (path) => context(path, "feedback", `feedback.${fb.id}`, label, fb.signalIds);
      }
      if (rel) {
        release = rel;
        releaseProv = (path) => context(path, "feedback", `feedback.${fb.id}`, label);
      }
      assumptions.push({ text: `${fb.from === "finance" ? "Finance" : "Engineering"}: "${fb.text}" PM: ${fb.pmRationale}`, prov: (p) => context(p, "feedback", `feedback.${fb.id}`, label, fb.signalIds) });
    } else {
      assumptions.push({ text: `${fb.from === "finance" ? "Finance" : "Engineering"} says: "${fb.text}" The PM keeps the target: ${fb.pmRationale}`, prov: (p) => context(p, "feedback", `feedback.${fb.id}`, label, fb.signalIds) });
      criteria.push({ text: `Engineering shows a path to ${target?.text ?? "the target"} before sign-off`, prov: (p) => context(p, "feedback", `feedback.${fb.id}`, label) });
    }
  }

  if (bench && target) {
    const vs = `${bench.competitor} ${bench.value} ${bench.unit}${bench.cycle ? ` ${bench.cycle}` : ""}`;
    // The verb follows the final number, which feedback may have moved below the benchmark.
    const gap = bench.lowerIsBetter ? target.ref - target.value : target.value - target.ref;
    const relation = Math.abs(gap) < 0.5 ? "matching" : gap > 0 ? "beating" : `${Math.round(Math.abs(gap) * 10) / 10} ${target.unit} behind`;
    parts.push({
      text: `Target: ${target.metricName} ${target.text}, ${relation} ${vs}.`,
      prov: (p) => targetProv(p),
    });
    metrics.push({
      m: {
        id: "m1",
        question: target.metricName,
        target: target.text,
        unit: target.unit,
        basis: bench.signalId ? "evidence" : "assumption",
        benchmark: `${vs} (${bench.source})`,
        targetSpec: specOf(target, !!bench.lowerIsBetter, marketScope),
      },
      prov: targetProv("metrics.m1.target"),
    });
  } else {
    parts.push({ text: `Target: the customer problem is fixed for ${c.featureName.toLowerCase()}, measured by fewer complaints.`, prov: (p) => ambProv(p, ev.top) });
  }
  const cut = ambition === "fix" ? 50 : ambition === "match" ? 60 : 70;
  metrics.push({
    m: { id: metrics.length ? "m2" : "m1", question: `Customers complaining about ${c.featureName.toLowerCase()}`, target: `−${cut}% vs. today`, basis: "assumption" },
    prov: assumption(`metrics.${metrics.length ? "m2" : "m1"}.target`, `Assumption · effect not measured yet (${ambitionLabel[ambition].toLowerCase()})`, ev.top),
  });

  // 3. Solution
  const hint = solutionHints[c.id];
  if (hint) {
    const sol = ans("solution");
    if (sol?.value === "prescribe")
      parts.push({ text: `PM decision: reach it with ${hint.text}, because ${hint.because}.`, prov: (p) => context(p, "requirement_shape", "shape.solution", "PM decision · solution", ev.top) });
    else parts.push({ text: "How it is reached is open to engineering (solution-neutral).", prov: (p) => shapeTag(p, "solution", "solution-neutral") });
  }

  // Scope, release, customer, offer
  parts.push({
    text: marketScope === "global" ? "Scope: all markets and derivatives." : `Scope: ${regionLabel[marketScope]} market variant${variantOf ? ` next to the global ${variantOf}` : ""}.`,
    prov: scopeProv,
  });
  const frozenNote = c.changeDepth === "platform_powertrain" && release !== "lci" && v.givens.frozen.length ? ` (platform-deep change; frozen: ${v.givens.frozen[0].toLowerCase()})` : "";
  parts.push({ text: `Release: ${releaseLabel[release]}${frozenNote}.`, prov: releaseProv });
  if (v.targetCustomer.who === "conquest")
    parts.push({ text: `It must be noticeable in the showroom${bench ? ` against ${bench.competitor}` : ""}: a conquest argument, not only a fix for owners.`, prov: (p) => tag(p, "targetCustomer", targetCustomerLabel.conquest.toLowerCase()) });
  else if (ev.likes.length)
    parts.push({
      text: `It must keep today's owners: what ${ev.likes.length} of them like today stays untouched.`,
      prov: (p) => tag(p, "targetCustomer", targetCustomerLabel[v.targetCustomer.who].toLowerCase(), ev.likes.slice(0, 3).map((s) => s.id)),
    });
  const offer = ans("offer");
  if (offer) parts.push({ text: offer.value === "standard" ? "Offered as standard equipment." : "Offered as a paid option.", prov: (p) => shapeTag(p, "offer", offer.value === "standard" ? "standard" : "paid option") });

  // Acceptance criteria
  if (v.protectList.length && (c.changeDepth === "platform_powertrain" || v.protectList.some((x) => x.toLowerCase().includes(c.carArea.split("_")[0]))))
    criteria.push({ text: `Must not degrade: ${v.protectList.join(", ").toLowerCase()} (protect list)`, prov: (p) => tag(p, "protectList", "protect list") });
  criteria.push({ text: `Stays within the cost envelope: ${v.costEnvelope.perCarBand}`, prov: (p) => tag(p, "costEnvelope", `cost envelope ${costSensitivityLabel[v.costEnvelope.sensitivity].toLowerCase()}`) });
  if (bench)
    criteria.push({
      text: `Verified ${bench.cycle ? `under the ${target?.metricName.includes("CLTC") ? "CLTC" : bench.cycle} cycle ` : ""}against ${bench.competitor}`,
      prov: (p) => (bench.signalId ? evidence(p, benchIds, `Evidence · ${bench.competitor} fact`) : assumption(p, `Assumption · ${bench.source}`)),
    });
  const df = dontFightMatch(input, v);
  if (df) criteria.push({ text: `No race on "${df}": fix the complaint, don't chase the competitor`, prov: (p) => tag(p, "dontFightOn", "don't fight on") });

  // Assumptions: inside knowledge, cost, missing brief
  for (const x of input.stance?.inside ?? []) assumptions.push({ text: `${insideKindLabel[x.kind]}: ${x.text}`, prov: (p) => context(p, "case_stance", "stance.inside", `Your stance · ${insideKindLabel[x.kind].toLowerCase()}`) });
  const sizes = { trim_option: "S", software_ota: "S", part_module: "M", platform_powertrain: "L" } as const;
  let size: "S" | "M" | "L" = sizes[c.changeDepth];
  if (ambition === "beat" && size !== "L") size = size === "S" ? "M" : "L";
  const overEnvelope = v.costEnvelope.sensitivity === "high" && size === "L";
  assumptions.push({
    text: `Rough cost ${size} from the change depth${ambition === "beat" ? " (one size up to beat the competitor)" : ""}${overEnvelope ? `; over your envelope (${v.costEnvelope.perCarBand}), Finance must confirm` : ""}.`,
    prov: (p) => assumption(p, overEnvelope ? "Assumption · over the cost envelope" : "Assumption · rough cost"),
  });
  if (!input.brief) assumptions.push({ text: "No product specs yet: scope, release and ambition use defaults.", prov: (p) => assumption(p, "Assumption · no product specs") });

  // Title
  const suffix = marketScope === "CN" ? " (China)" : marketScope === "RoW" ? " (Rest of World)" : "";
  const title = target ? `${c.featureName}: ${target.metricName} ${target.text}${suffix}` : `${c.featureName}: ${ambition === "fix" ? "fix the customer problem" : ambitionLabel[ambition].toLowerCase()}${suffix}`;
  const shortTitle = `${c.shortTitle}${marketScope === "CN" ? " (CN)" : ""}`;

  const descriptionParts = parts.map((x) => x.text);
  const provenance: Provenance[] = [
    target ? targetProv("title") : ambProv("title", ev.top),
    ...parts.map((x, i) => x.prov(`description#${i}`)),
    ...metrics.map((x) => x.prov),
    ...criteria.map((x, i) => x.prov(`acceptanceCriteria#${i}`)),
    ...assumptions.map((x, i) => x.prov(`assumptions#${i}`)),
    scopeProv("marketScope"),
    releaseProv("releaseTarget"),
    assumption("cost", `Assumption · rough size from the change depth; envelope ${costSensitivityLabel[v.costEnvelope.sensitivity].toLowerCase()}`),
  ];
  const negatives = marketScope === "CN" ? ev.negatives.filter((s) => s.market === "CN").length : ev.negatives.length;
  const evidenceLevel = negatives >= 20 ? "high" : negatives >= 5 ? "medium" : negatives > 0 ? "low" : "assumption";

  return [
    {
      title,
      shortTitle,
      description: descriptionParts.join(" "),
      descriptionParts,
      marketScope,
      releaseTarget: release,
      metrics: metrics.map((x) => x.m),
      acceptanceCriteria: criteria.map((x) => x.text),
      assumptions: assumptions.map((x) => x.text),
      evidenceLevel,
      cost: { size, eurBand: "to estimate", source: "ai_estimate", note: overEnvelope ? "Over the cost envelope." : "Rough size from the change depth." },
      provenance,
      shapeAnswers: answers,
    },
  ];
}
