import type {
  Agent,
  EvidenceLevel,
  FactorKey,
  Market,
  Region,
  ReleaseTarget,
  RequirementStatus,
  SourceType,
  Trust,
} from "@/contracts";

/**
 * Vocabulary mapping between the UI contract (src/contracts) and the backend
 * (backend/API.md, database-design.md). Pure functions, tested by scripts/map-test.ts.
 */

// ---------- Markets ----------
export type BackendMarket = "USA" | "China" | "Europe" | "Rest of World" | "unknown";

const MARKET_TO_BACKEND: Record<Market, BackendMarket> = {
  US: "USA",
  CN: "China",
  EU: "Europe",
  RoW: "Rest of World",
  unknown: "unknown",
};
const MARKET_FROM_BACKEND = Object.fromEntries(Object.entries(MARKET_TO_BACKEND).map(([k, v]) => [v, k])) as Record<BackendMarket, Market>;

export const marketToBackend = (m: Market): BackendMarket => MARKET_TO_BACKEND[m];
export const marketFromBackend = (m: string | null | undefined): Market => MARKET_FROM_BACKEND[m as BackendMarket] ?? "unknown";

/**
 * Requirement scope. UI `RoW` means "every market except China"; the backend has no
 * such grouping: a requirement is for all markets (null) or split per market.
 */
export function regionFromRequirementMarket(m: string | null | undefined): Region {
  if (!m) return "global";
  return m === "China" ? "CN" : "RoW";
}

// ---------- Release ----------
const RELEASE_TO_BACKEND: Record<ReleaseTarget, "next_gen" | "current_car" | "ota"> = { next_gen: "next_gen", lci: "current_car", ota: "ota" };
export const releaseToBackend = (r: ReleaseTarget) => RELEASE_TO_BACKEND[r];
export const releaseFromBackend = (r: string | null | undefined): ReleaseTarget => (r === "current_car" ? "lci" : r === "ota" ? "ota" : "next_gen");

// ---------- Evidence level (display only, CLAUDE.md) ----------
export function evidenceFromBackend(e: string | null | undefined): EvidenceLevel {
  if (e === "bmw_data") return "high";
  if (e === "web") return "medium";
  return "assumption";
}
export function evidenceToBackend(e: EvidenceLevel): "bmw_data" | "web" | "assumption" {
  if (e === "high") return "bmw_data";
  if (e === "medium" || e === "low") return "web";
  return "assumption";
}

// ---------- Requirement status ----------
export type BackendRequirementStatus = "draft" | "in_discussion" | "approved" | "signed_off" | "planned" | "exported" | "rejected" | "deleted";

/** Backend `approved` is the PM's approval; the head's sign-off, planned and exported have the same names. */
export function requirementStatusFromBackend(s: string): RequirementStatus {
  if (s === "approved") return "pm_approved";
  if (s === "in_discussion" || s === "signed_off" || s === "planned" || s === "exported" || s === "rejected") return s;
  return "draft"; // draft; deleted rows never reach the UI
}

// ---------- Score factors ----------
/** Backend factor name for each UI factor. `brand_fit` is a multiplier in the backend, not a factor. */
export const FACTOR_TO_BACKEND: Partial<Record<FactorKey, string>> = {
  customers: "distinct_customers",
  severity: "severity",
  satisfaction_gap: "satisfaction_gap",
  competitor_gap: "competitor_gap",
  market_volume: "market_volume",
  regression: "removed_vs_predecessor",
  trend: "trend",
};
const FACTOR_FROM_BACKEND = Object.fromEntries(Object.entries(FACTOR_TO_BACKEND).map(([k, v]) => [v, k])) as Record<string, FactorKey>;

export const BRAND_MULTIPLIER = { fits: 1.0, neutral: 0.8, off_brand: 0.5 } as const;
export type BrandFitTag = keyof typeof BRAND_MULTIPLIER;

/** Backend weights -> UI weights. `reach` has no UI slider and is dropped; brand_fit shows the multiplier tag instead. */
export function weightsFromBackend(w: Record<string, number>): Record<FactorKey, number> {
  const out = { customers: 0, severity: 0, satisfaction_gap: 0, competitor_gap: 0, market_volume: 0, regression: 0, trend: 0, brand_fit: 0 } as Record<FactorKey, number>;
  for (const [k, v] of Object.entries(w)) {
    const f = FACTOR_FROM_BACKEND[k];
    if (f) out[f] = v;
  }
  return out;
}

/** UI weights -> backend weights. `reach` keeps its current backend value; `brand_fit` is ignored. */
export function weightsToBackend(w: Partial<Record<FactorKey, number>>, current: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = { ...current };
  for (const [k, v] of Object.entries(w)) {
    const b = FACTOR_TO_BACKEND[k as FactorKey];
    if (b && v !== undefined) out[b] = v;
  }
  return out;
}

export const factorFromBackend = (k: string): FactorKey | undefined => FACTOR_FROM_BACKEND[k];

/** UI 0..1 brand-fit value <-> backend tag. */
export function brandFitFromBackend(tag: string | null | undefined): number {
  return tag === "fits" ? 1 : tag === "off_brand" ? 0.2 : 0.6;
}
export function brandFitToBackend(v: number): BrandFitTag {
  return v >= 0.75 ? "fits" : v < 0.4 ? "off_brand" : "neutral";
}

// ---------- Signals ----------
const SOURCE_TYPE_BY_ID: Record<string, SourceType> = {
  bmw_feedback: "bmw_feedback",
  bmw_study: "bmw_study",
  bmw_sales: "bmw_sales",
  option_list: "option_list",
  "youtube-comments": "video",
  "youtube-transcripts": "video",
  "app-store": "review",
  "google-play": "review",
  carcomplaints: "review",
  "nhtsa-complaints": "review",
  "google-trends": "trend_report",
  // Evidence a PM added by hand
  pm_upload: "pm_upload",
  pm_link: "pm_link",
  pm_note: "pm_note",
};

export function sourceTypeFromBackend(sourceId: string | null | undefined, contentType: string | null | undefined): SourceType {
  if (sourceId && SOURCE_TYPE_BY_ID[sourceId]) return SOURCE_TYPE_BY_ID[sourceId];
  switch (contentType) {
    case "owner":
      return "forum";
    case "expert":
      return "review";
    case "press":
      return "competitor_official";
    case "news":
      return "news";
    case "bmw_internal":
      return "bmw_feedback";
    case "reference":
      return "trend_report";
    default:
      return "news";
  }
}

export function agentFromBackend(evidenceRole: string | null | undefined, sourceId: string | null | undefined, kind: string): Agent {
  if (sourceId?.startsWith("bmw_") || sourceId === "option_list") return "bmw_data";
  if (sourceId?.startsWith("pm_")) return "pm";
  if (evidenceRole === "competitor") return "competitor";
  if (kind === "trend") return "trends";
  if (kind === "innovation") return "innovation_scout";
  return "customer_public";
}

/** Display-only source tier (never part of the score: CLAUDE.md rejects a confidence axis). */
export function trustFromBackend(sourceId: string | null | undefined, contentType: string | null | undefined): Trust {
  if (sourceId?.startsWith("bmw_") || sourceId === "option_list") return "A";
  // A PM's file is first-hand data (C), a link is unverified web (D), a note is an assumption (E).
  if (sourceId === "pm_upload") return "C";
  if (sourceId === "pm_link") return "D";
  if (sourceId === "pm_note") return "E";
  if (contentType === "expert" || contentType === "reference") return "B";
  if (contentType === "owner" || contentType === "news") return "C";
  return "D";
}

export function powertrainFromBackend(p: string | null | undefined): "ICE" | "PHEV" | "BEV" | "unknown" {
  return p === "ICE" || p === "PHEV" || p === "BEV" ? p : "unknown";
}

// ---------- Citations ----------
/** `[signal:<uuid>]` -> `[<uuid>]`, the form the UI's markdown links to the case page. */
export const rewriteCitations = (text: string) =>
  text
    .replace(/\[signal:([0-9a-f-]{36})\]/gi, "[$1]")
    // PM context (brief, stance, answers, notes, feedback) is named, not linked to a signal.
    .replace(/\[context:([a-z_]+):([^\]\s]+)\]/g, (_, type: string, id: string) => `(${CONTEXT_LABEL[type] ?? "PM context"}${/^[A-Z]+-/.test(id) ? ` ${id}` : ""})`);

const CONTEXT_LABEL: Record<string, string> = { series_brief: "product specs", case_stance: "PM context", open_question: "question", meeting_note: "meeting note", requirement_feedback: "feedback", comment: "comment" };
