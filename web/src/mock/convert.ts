import type { CarArea, Series, Signal } from "@/contracts";
import type { WebSignalSpec } from "./authored/types";

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
    synthetic: true,
  };
}
