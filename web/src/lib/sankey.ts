import type { Case, Signal, SourceType, TaxonomyResponse } from "@/contracts";
import { carAreaLabel } from "@/contracts";

/**
 * Builds the three-column evidence graph shown as a Sankey diagram:
 * sources → what they say (topic · type, or a fact) → case.
 * Pure data; the layout lives in components/sankey/sankey-chart.tsx.
 */

export type Tone = "customer" | "study" | "web" | "fact" | "competitor";
/** What a statement is: drives the coloured line under a middle node. */
export type SayType = "defect" | "hard_to_use" | "wish" | "like" | "complaint" | "trend";

export interface SankeyNode {
  id: string;
  column: 0 | 1 | 2;
  label: string;
  sub?: string;
  say?: SayType;
  value: number;
  tone: Tone;
  hero?: boolean;
  signalIds: string[];
  href?: string;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  tone: Tone;
}
export interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export const sayLabel: Record<SayType, string> = {
  defect: "defect",
  hard_to_use: "hard to use",
  wish: "wish",
  like: "like",
  complaint: "complaint",
  trend: "trend",
};

/** Source columns group raw source types into what a PM recognises. */
const sourceGroup: Record<SourceType, { id: string; label: string; tone: Tone }> = {
  bmw_feedback: { id: "feedback", label: "Customer feedback", tone: "customer" },
  bmw_study: { id: "study", label: "Customer study", tone: "study" },
  bmw_sales: { id: "study", label: "Customer study", tone: "study" },
  option_list: { id: "option", label: "Option list", tone: "fact" },
  review: { id: "reviews", label: "Reviews", tone: "web" },
  video: { id: "video", label: "Videos & social", tone: "web" },
  social: { id: "video", label: "Videos & social", tone: "web" },
  forum: { id: "forum", label: "Owner forums", tone: "web" },
  news: { id: "news", label: "News & trends", tone: "web" },
  trend_report: { id: "news", label: "News & trends", tone: "web" },
  trade_fair: { id: "news", label: "News & trends", tone: "web" },
  competitor_official: { id: "competitor", label: "Competitor web", tone: "competitor" },
  pm_upload: { id: "pm", label: "Added by you", tone: "customer" },
  pm_link: { id: "pm", label: "Added by you", tone: "customer" },
  pm_note: { id: "pm", label: "Added by you", tone: "customer" },
};
export const sourceGroupOf = (s: Signal) => sourceGroup[s.sourceType];

export function sayOf(s: Signal): SayType {
  if (s.kind === "like") return "like";
  if (s.kind === "wish" || s.severity === "wish") return "wish";
  if (s.kind === "trend" || s.kind === "innovation") return "trend";
  if (s.severity === "defect") return "defect";
  if (s.severity === "difficult_to_use") return "hard_to_use";
  return "complaint";
}

export const isFact = (s: Signal) => s.kind === "competitor_fact";
/** Customers = distinct people speaking (feedback, reviews, forums), not study rows or facts. */
export const isCustomer = (s: Signal) => !isFact(s) && s.sourceType !== "bmw_study" && s.sourceType !== "bmw_sales" && s.sourceType !== "pm_note" && s.kind !== "trend";

type TopicLabels = Map<string, string>;
export const topicLabels = (t?: TaxonomyResponse): TopicLabels => new Map((t?.topics ?? []).map((x) => [x.id, x.shortLabel]));

function factNode(s: Signal): Pick<SankeyNode, "label" | "sub"> {
  const metric = s.metric ? `${s.metric.value} ${s.metric.unit}${s.metric.cycle ? ` ${s.metric.cycle}` : ""}` : undefined;
  return { label: s.competitor ?? s.featureHint, sub: metric ?? s.summary };
}

export function caseSankey(c: Case, signals: Signal[], topics: TopicLabels, maxStatements = 8, maxFacts = 4): SankeyGraph {
  const nodes = new Map<string, SankeyNode>();
  const links = new Map<string, SankeyLink>();
  const caseId = `case:${c.id}`;
  const customers = signals.filter(isCustomer).length;

  // Middle column: statements grouped by topic × type, facts one per node.
  const statements = new Map<string, Signal[]>();
  const facts: Signal[] = [];
  for (const s of signals) {
    if (isFact(s)) facts.push(s);
    else {
      const key = `${s.topicId ?? "other"}|${sayOf(s)}`;
      statements.set(key, [...(statements.get(key) ?? []), s]);
    }
  }
  // Biggest groups make the cut; shown grouped by topic (biggest topic first) so one topic reads as a block.
  const ranked = [...statements].sort((a, b) => b[1].length - a[1].length);
  const topicTotal = new Map<string, number>();
  for (const [key, sigs] of statements) topicTotal.set(key.split("|")[0], (topicTotal.get(key.split("|")[0]) ?? 0) + sigs.length);
  const shown = ranked.slice(0, maxStatements).sort((a, b) => {
    const [ta, tb] = [a[0].split("|")[0], b[0].split("|")[0]];
    return ta === tb ? b[1].length - a[1].length : topicTotal.get(tb)! - topicTotal.get(ta)! || ta.localeCompare(tb);
  });
  const folded = ranked.slice(maxStatements).flatMap(([, sigs]) => sigs);
  const middleOf = new Map<string, string>();
  for (const [key, sigs] of shown) {
    const [topicId, say] = key.split("|") as [string, SayType];
    const id = `say:${key}`;
    nodes.set(id, {
      id,
      column: 1,
      label: topicId === "other" ? "Other topics" : (topics.get(topicId) ?? topicId),
      say,
      value: sigs.length,
      tone: "customer",
      signalIds: sigs.map((s) => s.id),
    });
    sigs.forEach((s) => middleOf.set(s.id, id));
  }
  if (folded.length) {
    nodes.set("say:more", { id: "say:more", column: 1, label: `${ranked.length - maxStatements} more topics`, value: folded.length, tone: "customer", signalIds: folded.map((s) => s.id) });
    folded.forEach((s) => middleOf.set(s.id, "say:more"));
  }
  facts.slice(0, maxFacts).forEach((s) => {
    const id = `fact:${s.id}`;
    nodes.set(id, { id, column: 1, ...factNode(s), value: 1, tone: sourceGroupOf(s).tone === "competitor" ? "competitor" : "fact", signalIds: [s.id] });
    middleOf.set(s.id, id);
  });
  if (facts.length > maxFacts) {
    const rest = facts.slice(maxFacts);
    nodes.set("fact:more", { id: "fact:more", column: 1, label: `${rest.length} more facts`, value: rest.length, tone: "fact", signalIds: rest.map((s) => s.id) });
    rest.forEach((s) => middleOf.set(s.id, "fact:more"));
  }

  // Left column: source groups. Links source → middle.
  for (const s of signals) {
    const g = sourceGroupOf(s);
    const srcId = `src:${g.id}`;
    const src = nodes.get(srcId) ?? { id: srcId, column: 0 as const, label: g.label, value: 0, tone: g.tone, signalIds: [] };
    src.value += 1;
    src.signalIds.push(s.id);
    nodes.set(srcId, src);
    const mid = middleOf.get(s.id)!;
    const key = `${srcId}>${mid}`;
    const link = links.get(key) ?? { source: srcId, target: mid, value: 0, tone: g.tone };
    link.value += 1;
    links.set(key, link);
  }

  // Right column: the case. Links middle → case.
  nodes.set(caseId, {
    id: caseId,
    column: 2,
    label: c.shortTitle,
    sub: customers === 1 ? "customer" : "customers",
    value: signals.length,
    tone: "customer",
    hero: true,
    signalIds: signals.map((s) => s.id),
  });
  for (const n of nodes.values()) if (n.column === 1) links.set(`${n.id}>${caseId}`, { source: n.id, target: caseId, value: n.value, tone: n.tone === "customer" ? "customer" : n.tone });

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

/** Signals page: sources → car areas → cases (top N by signals, the rest as "unclustered"/"other cases"). */
export function overviewSankey(signals: Signal[], cases: Case[], maxCases = 8): SankeyGraph {
  const nodes = new Map<string, SankeyNode>();
  const links = new Map<string, SankeyLink>();
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const caseCount = new Map<string, number>();
  signals.forEach((s) => s.caseId && caseById.has(s.caseId) && caseCount.set(s.caseId, (caseCount.get(s.caseId) ?? 0) + 1));
  const topCases = new Set([...caseCount].sort((a, b) => b[1] - a[1]).slice(0, maxCases).map(([id]) => id));

  const add = (n: Omit<SankeyNode, "value" | "signalIds">, sid: string) => {
    const node = nodes.get(n.id) ?? { ...n, value: 0, signalIds: [] };
    node.value += 1;
    node.signalIds.push(sid);
    nodes.set(n.id, node);
  };
  const link = (source: string, target: string, tone: Tone) => {
    const key = `${source}>${target}`;
    const l = links.get(key) ?? { source, target, value: 0, tone };
    l.value += 1;
    links.set(key, l);
  };

  for (const s of signals) {
    const g = sourceGroupOf(s);
    const srcId = `src:${g.id}`;
    const areaId = `area:${s.carArea}`;
    const target = s.caseId && topCases.has(s.caseId) ? `case:${s.caseId}` : s.caseId ? "case:other" : "case:none";
    add({ id: srcId, column: 0, label: g.label, tone: g.tone }, s.id);
    add({ id: areaId, column: 1, label: carAreaLabel[s.carArea], tone: "customer" }, s.id);
    const c = s.caseId ? caseById.get(s.caseId) : undefined;
    add(
      target === "case:none"
        ? { id: target, column: 2, label: "Not in a case yet", tone: "fact" }
        : target === "case:other"
          ? { id: target, column: 2, label: "Other cases", tone: "customer" }
          : { id: target, column: 2, label: c!.shortTitle, tone: "customer", href: `/cases/${c!.id}` },
      s.id,
    );
    link(srcId, areaId, g.tone);
    link(areaId, target, target === "case:none" ? "fact" : "customer");
  }
  return { nodes: [...nodes.values()], links: [...links.values()] };
}
