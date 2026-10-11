import { z } from "zod";
import {
  ActorType,
  Addressee,
  AlertStatus,
  AlertVerdict,
  Agent,
  Ambition,
  AnswerSource,
  AspectGroup,
  Audience,
  Availability,
  BriefFieldKey,
  CarArea,
  CaseOutcome,
  CaseState,
  CaseType,
  ChangeAmbition,
  ChangeDepth,
  CheckKind,
  CheckSeverity,
  ClassificationMethod,
  Comparator,
  ContextLayer,
  CostSensitivity,
  CostSize,
  CostSource,
  EvidenceEffect,
  EvidenceLevel,
  FactorKey,
  FeedbackResponse,
  ImpactVerdict,
  InnovationHorizon,
  InsideKind,
  Market,
  MetricBasis,
  MetricKey,
  NotificationKind,
  ObjectType,
  PlanAction,
  PortfolioRow,
  Positioning,
  Powertrain,
  ProjectType,
  ProposalKind,
  ProposalSource,
  ProposalStatus,
  ProvenanceSource,
  QuestionStatus,
  ReferralStatus,
  Region,
  ReleaseTarget,
  RequirementStatus,
  RippleDecisionKind,
  Role,
  Series,
  Severity,
  ShapeKey,
  SignalKind,
  SignalStatus,
  SourceType,
  TargetCustomer,
  TargetCycle,
  Trust,
} from "./enums";

/**
 * Entities of the REST contract. Field names follow Ghassen's data-model.mmd
 * where it covers the concept (FINDING = Signal, CASE, REQUIREMENT, ...).
 * Timestamps are ISO 8601 strings.
 */

const Id = z.string().min(1);
const IsoDate = z.string(); // ISO 8601
const Factors = z.record(FactorKey, z.number().min(0).max(1));

// ---------- People and workspaces ----------
export const User = z.object({
  id: Id,
  name: z.string(),
  initials: z.string(),
  role: Role,
  title: z.string(),
  series: z.array(Series),
  region: Region,
  attributeScope: z.string().optional(),
  color: z.string(),
  synthetic: z.boolean(),
});
export type User = z.infer<typeof User>;

export const SourceFilter = z.object({
  excludeSocial: z.boolean(),
  ownersOnly: z.boolean(),
  minTrust: z.enum(["A", "B", "C", "D", "E"]),
});
export type SourceFilter = z.infer<typeof SourceFilter>;

export const Watchlist = z.object({
  competitors: z.array(z.string()),
  topics: z.array(z.string()),
  domains: z.array(z.string()),
  languages: z.array(z.string()),
});
export type Watchlist = z.infer<typeof Watchlist>;

export const Workspace = z.object({
  id: Id,
  userId: Id,
  series: Series,
  region: Region,
  projectType: ProjectType,
  weightProfileId: Id,
  sourceFilter: SourceFilter,
  watchlist: Watchlist,
});
export type Workspace = z.infer<typeof Workspace>;

export const WeightProfile = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  ownerId: Id.nullable(), // null = default profile owned by the head of product line
  isDefault: z.boolean(),
  weights: Factors,
  /** Requirement rank = case score x multiplier for its cost size. */
  costMultiplier: z.record(CostSize, z.number()),
});
export type WeightProfile = z.infer<typeof WeightProfile>;

export const BrandPillar = z.object({ name: z.string(), description: z.string() });
export const BrandProfile = z.object({
  version: z.number().int(),
  updatedAt: IsoDate,
  updatedBy: Id,
  pillars: z.array(BrandPillar),
  doNot: z.array(z.string()),
  notesMd: z.string(),
});
export type BrandProfile = z.infer<typeof BrandProfile>;

// ---------- Signals (FINDING) ----------
export const SignalMetric = z.object({ name: z.string(), value: z.number(), unit: z.string(), cycle: z.string().optional() });

export const Signal = z.object({
  id: Id,
  kind: SignalKind,
  severity: Severity,
  agent: Agent,
  sourceType: SourceType,
  sourceName: z.string(),
  trust: Trust,
  /** Deep link to the exact spot (text fragment / timestamp) for web sources. */
  url: z.string().optional(),
  /** Pointer into BMW data, e.g. "feedback_verbatims.csv#G60-0878". */
  recordRef: z.string().optional(),
  publishedAt: IsoDate,
  fetchedAt: IsoDate,
  series: Series,
  vehicleRole: z.enum(["current", "predecessor", "competitor", "unknown"]),
  competitor: z.string().optional(),
  powertrain: Powertrain,
  market: Market,
  marketBasis: z.enum(["stated", "inferred", "unknown"]),
  country: z.string().optional(),
  carArea: CarArea,
  /** Fixed taxonomy topic (taxonomy/taxonomy.json). Null when nothing fits ("other", review queue). */
  topicId: z.string().nullable(),
  aspectGroup: AspectGroup.nullable(),
  featureHint: z.string(),
  summary: z.string(),
  quote: z.string(),
  quoteEn: z.string().optional(),
  language: z.string(),
  audience: Audience,
  reach: z.number().optional(),
  reachUnit: z.enum(["views", "upvotes", "likes", "none"]).optional(),
  metric: SignalMetric.optional(),
  caseId: Id.nullable(),
  status: SignalStatus,
  /** How topic and aspect were assigned: BMW's VFC label (lookup) or a model with its prompt version. */
  classification: z
    .object({ method: ClassificationMethod, label: z.string().optional(), model: z.string().optional(), promptVersion: z.string().optional() })
    .optional(),
  synthetic: z.boolean(),
});
export type Signal = z.infer<typeof Signal>;

/** The stored raw record a signal was cut from. The quote must be found in `text`; `sha256` is over `text`. */
export const SourceRecord = z.object({
  ref: z.string(),
  sourceName: z.string(),
  url: z.string().optional(),
  text: z.string(),
  sha256: z.string(),
  fetchedAt: IsoDate,
  /** Web records in the demo are synthetic snapshots, not real fetched pages. */
  synthetic: z.boolean(),
});
export type SourceRecord = z.infer<typeof SourceRecord>;

export const SignalCluster = z.object({
  id: Id,
  label: z.string(),
  series: Series,
  carArea: CarArea,
  size: z.number().int(),
  sentiment: z.number().min(-1).max(1),
  markets: z.record(z.string(), z.number()),
  caseId: Id.nullable(),
  signalIds: z.array(Id),
});
export type SignalCluster = z.infer<typeof SignalCluster>;

export const AgentRun = z.object({
  id: Id,
  agent: Agent,
  series: Series,
  startedAt: IsoDate,
  endedAt: IsoDate,
  status: z.enum(["ok", "partial", "failed"]),
  valid: z.number().int(),
  rejected: z.number().int(),
  newSignals: z.number().int(),
  llmCostUsd: z.number(),
  note: z.string().optional(),
  /** Steps of the run as shown on Refresh: fetch, classify, gate, match metrics, assess impact. */
  steps: z.array(z.object({ name: z.string(), status: z.enum(["ok", "skipped", "failed"]), detail: z.string() })).optional(),
  /** Set when a competitor fact in this run affected targets across the portfolio. */
  rippleId: Id.nullable().optional(),
});
export type AgentRun = z.infer<typeof AgentRun>;

export const QuarantineItem = z.object({
  id: Id,
  agent: Agent,
  sourceName: z.string(),
  snippet: z.string(),
  reason: z.string(),
  at: IsoDate,
});
export type QuarantineItem = z.infer<typeof QuarantineItem>;

// ---------- Cases (the problem) ----------
export const MarketFigure = z.object({
  market: Market,
  customers: z.number().int(),
  complaints: z.number().int(),
  wishes: z.number().int(),
  likes: z.number().int(),
  studyLabel: z.string().optional(),
  studyScore: z.string().optional(),
  salesShare2030: z.number().optional(),
  sentiment: z.number().min(-1).max(1),
});
export type MarketFigure = z.infer<typeof MarketFigure>;

export const ContextItem = z.object({
  kind: z.enum(["brand", "baseline", "past_decision", "study", "sales", "competitor", "note", "meeting", "answer", "diff"]),
  label: z.string(),
  detail: z.string(),
  ref: z.string().optional(),
  at: IsoDate.optional(),
});
export type ContextItem = z.infer<typeof ContextItem>;

// ---------- PM context layers (brand → series brief → case stance → requirement shape → feedback) ----------
/** Share of the successor's attention per sales market (pre-filled from 2030 sales, 0..1). */
export const MarketWeights = z.object({ EU: z.number().min(0).max(1), US: z.number().min(0).max(1), CN: z.number().min(0).max(1), RoW: z.number().min(0).max(1) });
export type MarketWeights = z.infer<typeof MarketWeights>;

/** The eight onboarding answers of a series brief; one key per question. */
export const BriefValues = z.object({
  /** One sentence: what the successor must be. */
  thesis: z.string(),
  targetCustomer: z.object({ who: TargetCustomer, positioning: Positioning }),
  marketWeights: MarketWeights,
  changeAmbition: z.object({ level: ChangeAmbition, innovationSlots: z.number().int().min(0) }),
  /** Strengths that must not change. */
  protectList: z.array(z.string()),
  /** Attributes where BMW deliberately does not compete. */
  dontFightOn: z.array(z.string()),
  /** Already decided: platform, SOP, frozen parts, the releases still open, the consumption cycle used for targets. */
  givens: z.object({
    platform: z.string(),
    sop: z.string(),
    frozen: z.array(z.string()),
    openReleases: z.array(ReleaseTarget),
    cycle: z.enum(["WLTP", "EPA", "CLTC"]),
  }),
  costEnvelope: z.object({ sensitivity: CostSensitivity, perCarBand: z.string() }),
});
export type BriefValues = z.infer<typeof BriefValues>;

export const BriefFieldMeta = z.object({
  /** data = pre-filled from BMW data, brand = inherited from the brand profile, doc = extracted from a strategy doc, pm = typed. */
  source: z.enum(["data", "brand", "doc", "pm"]),
  confirmed: z.boolean(),
  /** Required on overlay fields: why the region differs from the shared brief. */
  reason: z.string().optional(),
  /** Head's decision on an overlay field that differs from the shared brief. */
  resolution: z.object({ status: z.enum(["regional_variant", "aligned"]), by: Id, at: IsoDate, note: z.string() }).optional(),
  updatedAt: IsoDate,
  updatedBy: Id,
});
export type BriefFieldMeta = z.infer<typeof BriefFieldMeta>;

/** Layer 1: one shared brief per car project; a regional overlay holds only the fields that differ. */
export const SeriesBrief = z.object({
  id: Id,
  series: Series,
  kind: z.enum(["shared", "overlay"]),
  region: Region,
  parentId: Id.nullable(),
  ownerId: Id,
  values: BriefValues.partial(),
  meta: z.partialRecord(BriefFieldKey, BriefFieldMeta),
  version: z.number().int(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  synthetic: z.boolean(),
});
export type SeriesBrief = z.infer<typeof SeriesBrief>;

export const BriefConflict = z.object({
  field: BriefFieldKey,
  overlayId: Id,
  sharedValue: z.unknown(),
  overlayValue: z.unknown(),
  reason: z.string(),
  status: z.enum(["open", "regional_variant"]),
});
export type BriefConflict = z.infer<typeof BriefConflict>;

/** The brief a PM works with: shared values with the overlay applied, and where each field came from. */
export const ResolvedBrief = z.object({
  series: Series,
  region: Region,
  sharedId: Id,
  overlayId: Id.nullable(),
  values: BriefValues,
  origin: z.record(BriefFieldKey, z.enum(["data", "brand", "shared", "overlay"])),
  confirmed: z.boolean(),
  conflicts: z.array(BriefConflict),
});
export type ResolvedBrief = z.infer<typeof ResolvedBrief>;

/** Layer 2: one PM's stance on one case. Overrides the brief only where this case is different. */
export const CaseStance = z.object({
  authorId: Id,
  overrides: BriefValues.pick({ marketWeights: true, targetCustomer: true, costEnvelope: true, givens: true }).partial(),
  overrideReasons: z.partialRecord(BriefFieldKey, z.string()),
  /** The PM's reading of the evidence, e.g. "discount fleet drivers". */
  evidenceTakes: z.array(
    z.object({
      id: Id,
      text: z.string(),
      effect: EvidenceEffect,
      market: Market.optional(),
      powertrain: Powertrain.optional(),
      keyword: z.string().optional(),
    }),
  ),
  /** What the data can't show: past decisions, supplier tech, engineering already on it. */
  inside: z.array(z.object({ id: Id, kind: InsideKind, text: z.string() })),
  ambition: Ambition.nullable(),
  /** Answers to the requirement-shape questions given in the case chat; pre-fill the form (layer 3). */
  pendingShape: z.array(z.object({ key: ShapeKey, value: z.string() })),
  updatedAt: IsoDate,
});
export type CaseStance = z.infer<typeof CaseStance>;

export const Case = z.object({
  id: Id,
  title: z.string(),
  /** 2-4 words for lists, cards and diagrams; the title stays the full problem statement. */
  shortTitle: z.string(),
  summary: z.string(),
  /** Three short bullets shown under the evidence diagram: problem, who, competition. */
  highlights: z.array(z.string()),
  /** Main taxonomy topic of the case. */
  topicId: z.string().nullable(),
  /** Aspect group of the case (fixed taxonomy): a case is one topic and one aspect. */
  aspectGroup: AspectGroup.nullable().optional(),
  /** One stance per PM who worked the case (layer 2). */
  stances: z.array(CaseStance),
  series: Series,
  /** Other series the same problem shows up in (Baukasten / cross-series cases). */
  relatedSeries: z.array(Series),
  scope: Region,
  ownerId: Id,
  coOwnerIds: z.array(Id),
  watcherIds: z.array(Id),
  state: CaseState,
  outcome: CaseOutcome.nullable(),
  outcomeNote: z.string().optional(),
  markets: z.array(Market),
  carArea: CarArea,
  type: CaseType,
  changeDepth: ChangeDepth,
  featureName: z.string(),
  bodyMd: z.string(),
  bodyVersion: z.number().int(),
  signalIds: z.array(Id),
  figures: z.object({
    perMarket: z.array(MarketFigure),
    equipmentToday: z.string(),
    competitorOffer: z.array(z.string()),
    trend: z.string(),
  }),
  marketConflict: z.object({ note: z.string(), markets: z.array(Market) }).nullable(),
  brandFit: z.object({ value: z.number().min(0).max(1), reason: z.string(), confirmedBy: Id.nullable() }),
  factors: Factors,
  evidenceLevel: EvidenceLevel,
  context: z.object({ preset: z.array(ContextItem), pmInputs: z.array(ContextItem) }),
  originCaseId: Id.nullable(),
  mergedInto: Id.nullable(),
  requirementIds: z.array(Id),
  manualRank: z.number().int().nullable(),
  manualRankReason: z.string().optional(),
  newSignalCount: z.number().int(),
  createdAt: IsoDate,
  createdBy: z.string(),
  updatedAt: IsoDate,
  synthetic: z.boolean(),
});
export type Case = z.infer<typeof Case>;

export const ScoredCase = z.object({
  caseId: Id,
  profileId: Id,
  score: z.number(),
  rank: z.number().int(),
  contributions: Factors,
});
export type ScoredCase = z.infer<typeof ScoredCase>;

// ---------- Open questions and meeting notes ----------
export const OpenQuestion = z.object({
  id: Id,
  objectType: z.enum(["case", "requirement"]),
  objectId: Id,
  addressee: Addressee,
  contact: z.string().optional(),
  question: z.string(),
  why: z.string(),
  status: QuestionStatus,
  answer: z.string().optional(),
  answerSource: AnswerSource.optional(),
  answeredAt: IsoDate.optional(),
  dueDate: IsoDate.optional(),
  askedBy: Id,
  createdAt: IsoDate,
  fieldsAffected: z.array(z.string()),
});
export type OpenQuestion = z.infer<typeof OpenQuestion>;

export const MeetingNote = z.object({
  id: Id,
  caseId: Id,
  title: z.string(),
  date: IsoDate,
  attendees: z.array(z.string()),
  text: z.string(),
  createdBy: Id,
  proposalIds: z.array(Id),
});
export type MeetingNote = z.infer<typeof MeetingNote>;

export const FieldChange = z.object({ field: z.string(), before: z.unknown(), after: z.unknown() });
export type FieldChange = z.infer<typeof FieldChange>;

/** An AI suggestion the PM must accept or reject. The AI never edits directly. */
export const Proposal = z.object({
  id: Id,
  objectType: z.enum(["case", "requirement", "brief"]),
  objectId: Id,
  source: ProposalSource,
  kind: ProposalKind,
  summary: z.string(),
  changes: z.array(FieldChange),
  questionId: Id.optional(),
  citations: z.array(z.string()),
  status: ProposalStatus,
  createdAt: IsoDate,
  decidedBy: Id.optional(),
  decidedAt: IsoDate.optional(),
});
export type Proposal = z.infer<typeof Proposal>;

// ---------- Requirements (the solution) ----------
/** Machine-readable form of a target, so competitor facts can be compared with it. `target` stays the display text. */
export const TargetSpec = z.object({
  key: MetricKey,
  comparator: Comparator,
  value: z.number(),
  unit: z.string(),
  cycle: TargetCycle,
  /** Market the value is stated for; "global" = all markets. */
  market: z.enum(["global", "EU", "US", "CN", "RoW"]),
});
export type TargetSpec = z.infer<typeof TargetSpec>;

export const Metric = z.object({
  id: Id,
  question: z.string(),
  target: z.string(),
  /** Value today with its source (study, option list, complaint counts), when the data has one. */
  today: z.string().optional(),
  unit: z.string().optional(),
  basis: MetricBasis,
  benchmark: z.string().optional(),
  targetSpec: TargetSpec.optional(),
});
export type Metric = z.infer<typeof Metric>;

/** Layer 3: one adaptive question asked when requirements are created, only when the case raises it. */
export const ShapeQuestion = z.object({
  key: ShapeKey,
  question: z.string(),
  why: z.string(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  default: z.string(),
  defaultWhy: z.string(),
  trigger: z.object({ layer: ContextLayer, signalIds: z.array(Id), briefField: BriefFieldKey.optional() }),
});
export type ShapeQuestion = z.infer<typeof ShapeQuestion>;

export const ShapeAnswer = z.object({ key: ShapeKey, value: z.string(), byDefault: z.boolean() });
export type ShapeAnswer = z.infer<typeof ShapeAnswer>;

/**
 * Where one part of a requirement comes from. Paths: "title", "description#2",
 * "metrics.m1.target", "acceptanceCriteria#0", "assumptions#1", "marketScope", "releaseTarget", "cost".
 */
export const Provenance = z.object({
  path: z.string(),
  source: ProvenanceSource,
  /** For pm_context: which layer the value came from. */
  layer: ContextLayer.nullable(),
  /** E.g. "brief.costEnvelope", "stance.ambition", "shape.benchmark", "feedback.FB-0001". */
  ref: z.string().nullable(),
  signalIds: z.array(Id),
  /** Short text shown on the chip, e.g. "Your brief · cost envelope". */
  label: z.string(),
});
export type Provenance = z.infer<typeof Provenance>;

export const Requirement = z.object({
  id: Id,
  caseId: Id,
  series: Series,
  title: z.string(),
  /** 2-4 words for lists; the title stays the full SMART sentence. */
  shortTitle: z.string(),
  description: z.string(),
  /** The description sentence by sentence, so each one can carry its own provenance ("description#i"). */
  descriptionParts: z.array(z.string()),
  /** Provenance of every part: sentences, targets, criteria, assumptions, scope, release, cost. */
  provenance: z.array(Provenance),
  /** Current version; history in RequirementVersion. */
  version: z.number().int(),
  shapeAnswers: z.array(ShapeAnswer),
  /** Brief the draft was composed with (shared or overlay). */
  briefId: Id.nullable(),
  /** Which drafter produced the current version, e.g. "composer@1" (scripted) or a model id. */
  drafter: z.string().nullable(),
  marketScope: Region,
  variantOf: Id.nullable(),
  status: RequirementStatus,
  releaseTarget: ReleaseTarget,
  carArea: CarArea,
  changeDepth: ChangeDepth,
  metrics: z.array(Metric),
  acceptanceCriteria: z.array(z.string()),
  assumptions: z.array(z.string()),
  evidenceLevel: EvidenceLevel,
  cost: z.object({ size: CostSize, eurBand: z.string(), source: CostSource, note: z.string() }),
  ownerId: Id,
  manualRank: z.number().int().nullable(),
  plannedFeatureId: Id.nullable(),
  sentBackReason: z.string().optional(),
  /** The PM's edited argument sheet (markdown). Absent = generated from the requirement and its evidence. */
  argumentMd: z.string().nullable().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  synthetic: z.boolean(),
});
export type Requirement = z.infer<typeof Requirement>;

export const CheckIssue = z.object({
  id: Id,
  kind: CheckKind,
  severity: CheckSeverity,
  /** Requirement field the issue points at, e.g. "description" or "metrics". */
  field: z.string(),
  message: z.string(),
  /** Another requirement or planned feature the issue refers to. */
  relatedId: Id.optional(),
  suggestion: z.string().optional(),
});
export type CheckIssue = z.infer<typeof CheckIssue>;

export const RequirementCheck = z.object({
  requirementId: Id,
  ranAt: IsoDate,
  engine: z.enum(["rules", "rules+llm"]),
  issues: z.array(CheckIssue),
});
export type RequirementCheck = z.infer<typeof RequirementCheck>;

/** The parts of a requirement that change between versions. */
export const RequirementSnapshot = Requirement.pick({
  title: true,
  shortTitle: true,
  description: true,
  descriptionParts: true,
  marketScope: true,
  releaseTarget: true,
  metrics: true,
  acceptanceCriteria: true,
  assumptions: true,
  evidenceLevel: true,
  cost: true,
  provenance: true,
  shapeAnswers: true,
});
export type RequirementSnapshot = z.infer<typeof RequirementSnapshot>;

/** Same requirement ID, numbered versions; each keeps the cause (feedback, brief change, edit). */
export const RequirementVersion = z.object({
  requirementId: Id,
  version: z.number().int(),
  snapshot: RequirementSnapshot,
  cause: z.enum(["draft", "feedback", "brief_change", "edit", "ripple"]),
  feedbackId: Id.optional(),
  rationale: z.string(),
  createdAt: IsoDate,
  createdBy: z.string(),
});
export type RequirementVersion = z.infer<typeof RequirementVersion>;

/** Layer 4: engineering or finance feedback plus the PM's response; becomes context for the next version. */
export const FeedbackEntry = z.object({
  id: Id,
  requirementId: Id,
  from: Addressee,
  text: z.string(),
  response: FeedbackResponse,
  pmRationale: z.string(),
  signalIds: z.array(Id),
  proposalId: Id.nullable(),
  resultingVersion: z.number().int().nullable(),
  createdAt: IsoDate,
  createdBy: Id,
});
export type FeedbackEntry = z.infer<typeof FeedbackEntry>;

// ---------- Routing ----------
export const Referral = z.object({
  id: Id,
  /** referral = hand a case to another PM; escalation = ask the head to decide (e.g. CN vs RoW conflict). */
  kind: z.enum(["referral", "escalation"]),
  caseId: Id,
  fromUserId: Id,
  toUserId: Id,
  note: z.string(),
  status: ReferralStatus,
  createdAt: IsoDate,
  decidedAt: IsoDate.optional(),
  declineReason: z.string().optional(),
  linkedCaseId: Id.nullable(),
  resolution: z.string().optional(),
});
export type Referral = z.infer<typeof Referral>;

export const InnovationMeta = z.object({
  caseId: Id,
  horizon: InnovationHorizon,
  votes: z.array(Id),
  interestedSeries: z.array(Series),
  pulledInto: z.array(Id),
  pitch: z.string(),
});
export type InnovationMeta = z.infer<typeof InnovationMeta>;

// ---------- Vehicle plan ----------
export const PlannedFeature = z.object({
  id: Id,
  carArea: CarArea,
  name: z.string(),
  today: Availability,
  todayDetail: z.string(),
  action: PlanAction,
  requirementIds: z.array(Id),
  release: ReleaseTarget,
  protected: z.boolean(),
  note: z.string(),
});
export type PlannedFeature = z.infer<typeof PlannedFeature>;

export const VehiclePlan = z.object({
  series: Series,
  successorName: z.string(),
  projectType: ProjectType,
  sop: z.string(),
  ownerIds: z.array(Id),
  features: z.array(PlannedFeature),
});
export type VehiclePlan = z.infer<typeof VehiclePlan>;

// ---------- Conversation ----------
export const Citation = z.object({ ref: z.string(), label: z.string() });
export type Citation = z.infer<typeof Citation>;

export const ChatMessage = z.object({
  id: Id,
  objectType: z.enum(["case", "requirement"]),
  objectId: Id,
  role: z.enum(["user", "assistant"]),
  authorId: Id.optional(),
  content: z.string(),
  citations: z.array(Citation),
  proposalIds: z.array(Id),
  createdAt: IsoDate,
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/** A customer segment the PM can ask in the case chat. Built from real BMW verbatims only. */
export const ChatSegment = z.object({
  key: z.string(),
  label: z.string(),
  market: Market,
  powertrain: Powertrain.nullable(),
  verbatims: z.number().int(),
});
export type ChatSegment = z.infer<typeof ChatSegment>;

export const Comment = z.object({
  id: Id,
  objectType: z.enum(["case", "requirement"]),
  objectId: Id,
  authorId: Id,
  body: z.string(),
  mentions: z.array(Id),
  createdAt: IsoDate,
});
export type Comment = z.infer<typeof Comment>;

export const Notification = z.object({
  id: Id,
  userId: Id,
  kind: NotificationKind,
  title: z.string(),
  body: z.string(),
  link: z.string(),
  actorId: z.string().optional(),
  read: z.boolean(),
  createdAt: IsoDate,
});
export type Notification = z.infer<typeof Notification>;

export const Alert = z.object({
  id: Id,
  ownerId: Id,
  caseId: Id.nullable(),
  requirementId: Id.nullable(),
  verdict: AlertVerdict,
  title: z.string(),
  detail: z.string(),
  signalIds: z.array(Id),
  status: AlertStatus,
  resolution: z.string().optional(),
  createdAt: IsoDate,
  /** Set when the alert comes from a portfolio ripple. */
  rippleId: Id.optional(),
  itemVerdict: ImpactVerdict.optional(),
  /** "Ours 700 km WLTP vs. theirs 800 km CLTC ≈ 680 km WLTP (factor 0.85, assumption)". */
  comparison: z.object({ ours: z.string(), theirs: z.string(), normalized: z.string(), factor: z.number().nullable(), isAssumption: z.boolean() }).optional(),
});
export type Alert = z.infer<typeof Alert>;

/** A case score as computed at the moment of a decision, under the profile active then. */
export const ScoreSnapshot = z.object({
  caseId: Id,
  profileId: Id,
  profileName: z.string(),
  profileVersion: z.number().int(),
  weights: Factors,
  factors: Factors,
  contributions: Factors,
  score: z.number(),
  rank: z.number().int(),
  of: z.number().int(),
  at: IsoDate,
});
export type ScoreSnapshot = z.infer<typeof ScoreSnapshot>;

export const AuditEvent = z.object({
  seq: z.number().int(),
  at: IsoDate,
  actorId: z.string(), // user id or "agent:<name>"
  actorType: ActorType,
  action: z.string(),
  objectType: ObjectType,
  objectId: Id,
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  rationale: z.string().optional(),
  /** Written on case confirm, requirement sign-off and rank changes, so a replay shows the score of that day. */
  scoreSnapshot: ScoreSnapshot.optional(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

// ---------- Competitor ripple ----------
/** Conversion between test cycles. No published factor exists, so every row says whether it is an assumption. */
export const CycleConversion = z.object({
  id: Id,
  from: TargetCycle,
  to: TargetCycle,
  /** value_to = value_from × factor */
  factor: z.number().positive(),
  range: z.tuple([z.number().positive(), z.number().positive()]),
  source: z.string(),
  isAssumption: z.boolean(),
  updatedAt: IsoDate,
  updatedBy: z.string(),
});
export type CycleConversion = z.infer<typeof CycleConversion>;

export const RippleFact = z.object({
  signalId: Id,
  competitor: z.string(),
  key: MetricKey,
  value: z.number(),
  unit: z.string(),
  cycle: TargetCycle,
  market: Market,
  trust: Trust,
  sourceName: z.string(),
  url: z.string().optional(),
  summary: z.string(),
});
export type RippleFact = z.infer<typeof RippleFact>;

export const RippleItem = z.object({
  id: Id,
  kind: z.enum(["requirement", "case"]),
  objectId: Id,
  title: z.string(),
  caseId: Id,
  row: PortfolioRow,
  /** Baukasten: the other rows this item also counts for. */
  alsoRows: z.array(PortfolioRow),
  carArea: CarArea,
  ownerId: Id,
  coOwnerIds: z.array(Id),
  /** Requirement status or case state at assessment time. */
  status: z.string(),
  /** Our target (requirements only). */
  ours: z.object({ value: z.number(), unit: z.string(), cycle: TargetCycle, comparator: Comparator, market: z.string(), text: z.string() }).nullable(),
  /** The competitor value converted into our cycle (null when not comparable). */
  theirsNormalized: z.object({ value: z.number(), unit: z.string(), cycle: TargetCycle, low: z.number(), high: z.number() }).nullable(),
  conversionId: Id.nullable(),
  /** (ours − theirs) / theirs in %, signed so that positive = we are ahead. */
  gapPct: z.number().nullable(),
  verdict: ImpactVerdict,
  reason: z.string(),
  rankBefore: z.number().int().nullable(),
  rankAfter: z.number().int().nullable(),
  movedBecause: z.string().nullable(),
  notified: z.array(z.object({ userId: Id, kind: z.enum(["alert", "fyi", "head"]) })),
  muted: z.boolean(),
  /** The owner's call: raise target (proposal), keep with reason, or reopen the case. */
  decision: z
    .object({ kind: RippleDecisionKind, by: Id, rationale: z.string(), at: IsoDate, proposalId: Id.nullable() })
    .nullable(),
  /** A regional PM's market-variant proposal; independent of the owner's call. */
  variant: z.object({ by: Id, rationale: z.string(), at: IsoDate, proposalId: Id.nullable() }).nullable(),
});
export type RippleItem = z.infer<typeof RippleItem>;

export const Ripple = z.object({
  id: Id,
  runId: Id,
  fact: RippleFact,
  /** active = alerts sent; watch = low-trust fact, listed only. */
  status: z.enum(["active", "watch"]),
  statusReason: z.string(),
  conversionIds: z.array(Id),
  tolerancePct: z.number(),
  items: z.array(RippleItem),
  createdAt: IsoDate,
});
export type Ripple = z.infer<typeof Ripple>;

/** Repeat alerts for a kept target stay muted until the gap grows by more than the threshold. */
export const RippleMute = z.object({
  requirementId: Id,
  key: MetricKey,
  gapPctAtDecision: z.number(),
  reason: z.string(),
  by: Id,
  at: IsoDate,
});
export type RippleMute = z.infer<typeof RippleMute>;

export const MonitorSettings = z.object({
  muteThresholdPct: z.number().min(0).max(50),
  atParTolerancePct: z.number().min(0).max(20),
  updatedAt: IsoDate,
  updatedBy: z.string(),
});
export type MonitorSettings = z.infer<typeof MonitorSettings>;

/** Everything the mock store holds. The seed fixture has exactly this shape. */
export const Dataset = z.object({
  generatedAt: IsoDate,
  users: z.array(User),
  workspaces: z.array(Workspace),
  weightProfiles: z.array(WeightProfile),
  brandProfile: BrandProfile,
  signals: z.array(Signal),
  clusters: z.array(SignalCluster),
  agentRuns: z.array(AgentRun),
  quarantine: z.array(QuarantineItem),
  cases: z.array(Case),
  questions: z.array(OpenQuestion),
  meetingNotes: z.array(MeetingNote),
  proposals: z.array(Proposal),
  requirements: z.array(Requirement),
  referrals: z.array(Referral),
  innovation: z.array(InnovationMeta),
  plans: z.array(VehiclePlan),
  messages: z.array(ChatMessage),
  comments: z.array(Comment),
  notifications: z.array(Notification),
  alerts: z.array(Alert),
  briefs: z.array(SeriesBrief),
  requirementVersions: z.array(RequirementVersion),
  feedback: z.array(FeedbackEntry),
  sourceRecords: z.array(SourceRecord),
  conversions: z.array(CycleConversion),
  ripples: z.array(Ripple),
  rippleMutes: z.array(RippleMute),
  monitorSettings: MonitorSettings,
  audit: z.array(AuditEvent),
});
export type Dataset = z.infer<typeof Dataset>;
