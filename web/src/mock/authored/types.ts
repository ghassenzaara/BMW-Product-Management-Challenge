import type {
  Agent,
  Audience,
  CarArea,
  Case,
  ChatMessage,
  Market,
  Powertrain,
  Series,
  SignalKind,
  Severity,
  SourceType,
  Trust,
} from "@/contracts";

/**
 * Authoring formats used only by scripts/seed.ts. The seed resolves them against
 * the real processed CSVs and produces contract entities (src/contracts).
 */

/** Selects real BMW verbatims from docs/02-data/processed/feedback_verbatims.csv. */
export interface VerbatimSelector {
  model: Series;
  /** Regex on the `topics` column (BMW VFC labels). */
  topic?: string;
  /** Regex on the verbatim text. */
  text?: string;
  /** Feedback types to keep, e.g. ["Wants", "Difficult to Use"]. */
  types?: string[];
  engine?: string;
  limit: number;
  /** Verbatim IDs that must be included (e.g. the examples quoted in the docs). */
  pin?: string[];
}

/** A row of the customer study (study_cn_eu_2025.csv or study_us_2025.csv). */
export interface StudyRef {
  attribute: string;
  model: "F70" | "G60" | "G68" | "G70";
  market: "EU" | "China" | "US";
}

/** An invented external signal. The URL points to the real site, never a fake post. */
export interface WebSignalSpec {
  agent: Exclude<Agent, "bmw_data">;
  sourceType: SourceType;
  sourceName: string;
  url: string;
  trust: Trust;
  kind: SignalKind;
  severity?: Severity;
  market: Market;
  marketBasis?: "stated" | "inferred";
  language?: string;
  audience: Audience;
  publishedAt: string;
  summary: string;
  quote: string;
  quoteEn?: string;
  competitor?: string;
  powertrain?: Powertrain;
  reach?: number;
  reachUnit?: "views" | "upvotes" | "likes" | "none";
  metric?: { name: string; value: number; unit: string; cycle?: string };
}

export type CaseSpec = Omit<
  Case,
  | "signalIds"
  | "figures"
  | "requirementIds"
  | "newSignalCount"
  | "synthetic"
  | "bodyVersion"
  | "createdAt"
  | "updatedAt"
  | "watcherIds"
  | "coOwnerIds"
  | "manualRank"
  | "markets"
  | "originCaseId"
  | "mergedInto"
  | "relatedSeries"
  | "factors"
> & {
  createdAt: string;
  updatedAt?: string;
  markets?: Market[];
  relatedSeries?: Series[];
  coOwnerIds?: string[];
  watcherIds?: string[];
  originCaseId?: string;
  mergedInto?: string;
  newSignalCount?: number;
  /** Factors except customers + market_volume, which the seed computes from the data. */
  factors: Omit<Case["factors"], "customers" | "market_volume"> & Partial<Pick<Case["factors"], "customers" | "market_volume">>;
  verbatims: VerbatimSelector[];
  study: StudyRef[];
  web: WebSignalSpec[];
  equipmentToday: string;
  competitorOffer: string[];
  trend: string;
  powertrainHint?: Powertrain;
};

export type ChatSeed = Omit<ChatMessage, "id" | "proposalIds"> & { proposalIds?: string[] };

export type { CarArea };
