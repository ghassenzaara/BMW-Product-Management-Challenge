import { z } from "zod";
import {
  ActorType,
  Addressee,
  AlertStatus,
  AlertVerdict,
  Agent,
  AnswerSource,
  Audience,
  Availability,
  CarArea,
  CaseOutcome,
  CaseState,
  CaseType,
  ChangeDepth,
  CostSize,
  CostSource,
  EvidenceLevel,
  FactorKey,
  InnovationHorizon,
  Market,
  MetricBasis,
  NotificationKind,
  ObjectType,
  PlanAction,
  Powertrain,
  ProjectType,
  ProposalKind,
  ProposalSource,
  ProposalStatus,
  QuestionStatus,
  ReferralStatus,
  Region,
  ReleaseTarget,
  RequirementStatus,
  Role,
  Series,
  Severity,
  SignalKind,
  SignalStatus,
  SourceType,
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
  synthetic: z.boolean(),
});
export type Signal = z.infer<typeof Signal>;

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

export const Case = z.object({
  id: Id,
  title: z.string(),
  summary: z.string(),
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
  objectType: z.enum(["case", "requirement"]),
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
export const Metric = z.object({
  id: Id,
  question: z.string(),
  target: z.string(),
  unit: z.string().optional(),
  basis: MetricBasis,
  benchmark: z.string().optional(),
});
export type Metric = z.infer<typeof Metric>;

export const Requirement = z.object({
  id: Id,
  caseId: Id,
  series: Series,
  title: z.string(),
  description: z.string(),
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
  createdAt: IsoDate,
  updatedAt: IsoDate,
  synthetic: z.boolean(),
});
export type Requirement = z.infer<typeof Requirement>;

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
});
export type Alert = z.infer<typeof Alert>;

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
});
export type AuditEvent = z.infer<typeof AuditEvent>;

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
  audit: z.array(AuditEvent),
});
export type Dataset = z.infer<typeof Dataset>;
