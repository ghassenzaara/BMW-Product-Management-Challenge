import { createHash } from "node:crypto";
import type { CarArea, Series, Signal, SourceRecord } from "@/contracts";
import type { WebSignalSpec } from "./authored/types";

/** Model id and prompt version the web classifier would log. In the demo the classification is scripted. */
export const WEB_CLASSIFIER = { model: "scripted demo classifier (no LLM call)", promptVersion: "taxonomy-classify@1" };

/** Shared by scripts/seed.ts and the mock refresh run. */
export function webSpecToSignal(
  spec: WebSignalSpec,
  opts: { id: string; series: Series; carArea: CarArea; featureHint: string; caseId: string | null; fetchedAt: string; topicId?: string | null },
): Signal {
  return {
    id: opts.id,
    kind: spec.kind,
    severity: spec.severity ?? (spec.kind === "complaint" ? "difficult_to_use" : spec.kind === "wish" ? "wish" : "none"),
    agent: spec.agent,
    sourceType: spec.sourceType,
    sourceName: spec.sourceName,
    trust: spec.trust,
    url: spec.url,
    recordRef: `snapshot://${opts.id}`,
    publishedAt: spec.publishedAt,
    fetchedAt: opts.fetchedAt,
    series: opts.series,
    vehicleRole: spec.competitor ? "competitor" : "current",
    competitor: spec.competitor,
    powertrain: spec.powertrain ?? "unknown",
    market: spec.market,
    marketBasis: spec.marketBasis ?? "inferred",
    carArea: opts.carArea,
    topicId: spec.topicId ?? opts.topicId ?? null,
    aspectGroup: spec.aspectGroup ?? null,
    featureHint: opts.featureHint,
    summary: spec.summary,
    quote: spec.quote,
    quoteEn: spec.quoteEn,
    language: spec.language ?? "en",
    audience: spec.audience,
    reach: spec.reach,
    reachUnit: spec.reachUnit,
    metric: spec.metric,
    caseId: opts.caseId,
    status: opts.caseId ? "clustered" : "unclustered",
    classification: { method: "llm", ...WEB_CLASSIFIER },
    synthetic: true,
  };
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** The stored snapshot of a web page a synthetic signal was cut from (the demo has no real fetch). */
export function webSnapshotRecord(s: Signal): SourceRecord {
  const text = [s.sourceName, s.url ?? "", `published ${s.publishedAt}`, s.quote, s.quoteEn ? `[translation] ${s.quoteEn}` : ""].filter(Boolean).join("\n");
  return { ref: s.recordRef ?? `snapshot://${s.id}`, sourceName: s.sourceName, url: s.url, text, sha256: sha256(text), fetchedAt: s.fetchedAt, synthetic: true };
}
