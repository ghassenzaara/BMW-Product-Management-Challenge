import type { BriefFieldKey, ContextLayer, Provenance, Requirement } from "@/contracts";
import { briefFieldLabel } from "@/contracts";

/** Builders for requirement provenance tags. Used by the composer and the seed. */

export function evidence(path: string, signalIds: string[], label: string): Provenance {
  return { path, source: "evidence", layer: null, ref: null, signalIds, label };
}

export function assumption(path: string, label: string, signalIds: string[] = []): Provenance {
  return { path, source: "assumption", layer: null, ref: null, signalIds, label };
}

export function context(path: string, layer: ContextLayer, ref: string, label: string, signalIds: string[] = []): Provenance {
  return { path, source: "pm_context", layer, ref, signalIds, label };
}

export function fromBrief(path: string, field: BriefFieldKey, overlay = false, detail?: string): Provenance {
  return context(path, "series_brief", `brief.${field}`, `${overlay ? "Your regional product specs" : "Your product specs"} · ${detail ?? briefFieldLabel[field].toLowerCase()}`);
}

export function fromBrand(path: string, label: string): Provenance {
  return context(path, "brand", "brand.profile", `Brand · ${label}`);
}

/** Split a description into sentences (kept stable so "description#i" paths line up). */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9("“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function provenanceCounts(r: Pick<Requirement, "provenance">) {
  const n = { evidence: 0, pm_context: 0, assumption: 0 };
  r.provenance.forEach((p) => n[p.source]++);
  return n;
}

export function provenanceLine(r: Pick<Requirement, "provenance">) {
  const n = provenanceCounts(r);
  return `${n.evidence} evidence · ${n.pm_context} PM context · ${n.assumption} assumption`;
}

/** Brief fields a requirement depends on (read from its provenance refs). */
export function briefFieldsUsed(r: Pick<Requirement, "provenance">): BriefFieldKey[] {
  const keys = r.provenance.filter((p) => p.ref?.startsWith("brief.")).map((p) => p.ref!.slice(6) as BriefFieldKey);
  return [...new Set(keys)];
}

/**
 * Tags for requirements written before provenance existed (the seeded ones).
 * Each sentence gets an authored tag: "evidence", "assumption" or "brief.<field>".
 */
export type AuthoredTag = "evidence" | "assumption" | `brief.${BriefFieldKey}` | "stance" | "pm";

export function authoredProvenance(
  r: Pick<Requirement, "metrics" | "acceptanceCriteria" | "assumptions">,
  parts: string[],
  tags: { sentences: AuthoredTag[]; scope: AuthoredTag; release: AuthoredTag; cost: AuthoredTag },
  topSignals: string[],
): Provenance[] {
  const tag = (path: string, t: AuthoredTag, what: string): Provenance => {
    if (t === "evidence") return evidence(path, topSignals, `Evidence · ${topSignals.length} customer records`);
    if (t === "assumption") return assumption(path, `Assumption · ${what}`);
    if (t === "stance") return context(path, "case_stance", "stance.inside", "Your context · inside knowledge");
    if (t === "pm") return context(path, "requirement_shape", "pm.written", "Written by the PM");
    return fromBrief(path, t.slice(6) as BriefFieldKey);
  };
  return [
    ...parts.map((_, i) => tag(`description#${i}`, tags.sentences[i] ?? "assumption", "not backed by evidence yet")),
    ...r.metrics.map((m) =>
      m.basis === "evidence"
        ? evidence(`metrics.${m.id}.target`, topSignals, m.benchmark ? `Evidence · ${m.benchmark}` : "Evidence · customer records")
        : assumption(`metrics.${m.id}.target`, m.benchmark ? `Assumption · ${m.benchmark}` : "Assumption · target not measured yet"),
    ),
    ...r.acceptanceCriteria.map((_, i) => tag(`acceptanceCriteria#${i}`, "pm", "")),
    ...r.assumptions.map((_, i) => assumption(`assumptions#${i}`, "Assumption · stated by the PM")),
    tag("marketScope", tags.scope, "scope"),
    tag("releaseTarget", tags.release, "release"),
    tag("cost", tags.cost, "rough cost"),
  ];
}
