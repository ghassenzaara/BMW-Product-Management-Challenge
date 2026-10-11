import { z } from "zod";
import {
  Agent,
  Addressee,
  AspectGroup,
  BriefFieldKey,
  CarArea,
  CaseAction,
  CaseState,
  CaseType,
  ChangeDepth,
  EvidenceLevel,
  FactorKey,
  FeedbackResponse,
  InnovationHorizon,
  Market,
  Region,
  ReleaseTarget,
  RequirementAction,
  RequirementStatus,
  RippleDecisionKind,
  Series,
  ShapeKey,
  SignalKind,
  SignalStatus,
} from "./enums";
import {
  Alert,
  AgentRun,
  AuditEvent,
  BrandProfile,
  BriefConflict,
  BriefValues,
  Case,
  CaseStance,
  ChatMessage,
  ChatSegment,
  Comment,
  CycleConversion,
  FeedbackEntry,
  FieldChange,
  InnovationMeta,
  MeetingNote,
  Metric,
  MonitorSettings,
  Notification,
  OpenQuestion,
  PlannedFeature,
  Proposal,
  QuarantineItem,
  Referral,
  Requirement,
  RequirementCheck,
  RequirementVersion,
  ResolvedBrief,
  Ripple,
  ScoreSnapshot,
  ScoredCase,
  SeriesBrief,
  ShapeQuestion,
  Signal,
  SourceRecord,
  SignalCluster,
  User,
  VehiclePlan,
  WeightProfile,
  Workspace,
} from "./entities";

/**
 * The REST contract. Every endpoint is declared once here; the typed client,
 * the mock backend, the contract test and the OpenAPI export all read this list.
 * Base URL: NEXT_PUBLIC_API_BASE_URL (default "/api", the mock).
 * The acting user is sent as header `x-user-id` (real backend: auth token).
 */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointDef<
  Q extends z.ZodType = z.ZodType,
  B extends z.ZodType = z.ZodType,
  R extends z.ZodType = z.ZodType,
> {
  method: Method;
  /** Express-style path, e.g. "/cases/:id". */
  path: string;
  summary: string;
  tag: string;
  query?: Q;
  body?: B;
  response: R;
}

/** Keeps the literal shape so `body` / `query` stay non-optional where declared. */
function ep<const D extends EndpointDef>(def: D): D {
  return def;
}

const Rationale = z.string().min(1, "A short reason is required");
const Ok = z.object({ ok: z.literal(true) });

// ---------- Shared payloads ----------
export const MeResponse = z.object({
  user: User,
  workspace: Workspace,
  weightProfile: WeightProfile,
  /** The vehicle PM's resolved series brief (layer 1); null for the head and cross-series PMs. */
  brief: ResolvedBrief.nullable(),
  /** True when a vehicle PM has not confirmed a brief yet: the UI opens onboarding. */
  needsOnboarding: z.boolean(),
  /**
   * What this data source offers, so the UI hides what it cannot do instead of failing on click.
   * Demo data: both true. Real backend: agents run on the server's schedule and the competitor
   * ripple with its monitor settings is not stored yet.
   */
  features: z.object({ agentRefresh: z.boolean(), competitorRipple: z.boolean() }),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const BriefBundle = z.object({
  resolved: ResolvedBrief.nullable(),
  shared: SeriesBrief.nullable(),
  overlay: SeriesBrief.nullable(),
  /** Pending AI proposals on the brief (strategy-doc extraction, learning). */
  proposals: z.array(Proposal),
});
export type BriefBundle = z.infer<typeof BriefBundle>;

/** A requirement a brief change would affect, with the proposed new version. */
export const BriefImpact = z.object({
  requirementId: z.string(),
  title: z.string(),
  fields: z.array(BriefFieldKey),
  summary: z.string(),
  changes: z.array(FieldChange),
  proposalId: z.string().nullable(),
});
export type BriefImpact = z.infer<typeof BriefImpact>;

export const SaveBriefBody = z.object({
  values: BriefValues.partial(),
  /** Why a field differs (required for overlay fields) or why it changed. */
  reasons: z.partialRecord(BriefFieldKey, z.string()),
  /** Fields the PM confirms as they are (pre-filled from data). */
  confirm: z.array(BriefFieldKey).optional(),
  /** Overlay only: fields that go back to the shared value. */
  clear: z.array(BriefFieldKey).optional(),
});

export const ShapeQuestionsResponse = z.object({
  questions: z.array(ShapeQuestion),
  brief: ResolvedBrief.nullable(),
  stance: CaseStance.nullable(),
  /** Set when the caller drafts a regional variant of an existing requirement on this case. */
  variantOf: z.string().nullable(),
});
export type ShapeQuestionsResponse = z.infer<typeof ShapeQuestionsResponse>;

export const CaseBundle = z.object({
  case: Case,
  signals: z.array(Signal),
  questions: z.array(OpenQuestion),
  requirements: z.array(Requirement),
  referrals: z.array(Referral),
  alerts: z.array(Alert),
  meetingNotes: z.array(MeetingNote),
  proposals: z.array(Proposal),
  linkedCases: z.array(Case),
});
export type CaseBundle = z.infer<typeof CaseBundle>;

export const RequirementBundle = z.object({
  requirement: Requirement,
  case: Case,
  signals: z.array(Signal),
  questions: z.array(OpenQuestion),
  variants: z.array(Requirement),
  alerts: z.array(Alert),
  proposals: z.array(Proposal),
  plannedFeature: PlannedFeature.nullable(),
  check: RequirementCheck.nullable(),
  versions: z.array(RequirementVersion),
  feedback: z.array(FeedbackEntry),
  /** The brief the requirement was composed with (shared or overlay). */
  brief: SeriesBrief.nullable(),
});
export type RequirementBundle = z.infer<typeof RequirementBundle>;

export const ScoredRequirement = z.object({ requirementId: z.string(), score: z.number(), rank: z.number().int() });
export type ScoredRequirement = z.infer<typeof ScoredRequirement>;

export const ScoresResponse = z.object({
  profileId: z.string(),
  weights: z.record(FactorKey, z.number()),
  cases: z.array(ScoredCase),
  requirements: z.array(ScoredRequirement),
});
export type ScoresResponse = z.infer<typeof ScoresResponse>;

export const CaseListQuery = z.object({
  series: Series.optional(),
  ownerId: z.string().optional(),
  state: CaseState.optional(),
  scope: Region.optional(),
});

export const SignalQuery = z.object({
  series: Series.optional(),
  caseId: z.string().optional(),
  agent: Agent.optional(),
  market: Market.optional(),
  kind: SignalKind.optional(),
  status: SignalStatus.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const CreateCaseBody = z.object({
  title: z.string().min(3),
  series: Series,
  scope: Region,
  type: CaseType,
  changeDepth: ChangeDepth,
  summary: z.string(),
  /** Empty when the PM starts a case by hand and adds evidence afterwards. */
  signalIds: z.array(z.string()),
  /**
   * Fixed taxonomy: a case has one topic and one aspect group, and its car area follows from the topic.
   * With signals both come from the signals; a case started by hand (no signals) must name them.
   */
  topicId: z.string().optional(),
  aspectGroup: AspectGroup.optional(),
  rationale: Rationale,
});

/** Evidence a PM adds by hand: rows of an uploaded CSV, links, or notes. Each item becomes a signal on the case. */
export const AddEvidenceBody = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(["csv_row", "link", "note"]),
        text: z.string().min(1),
        title: z.string().optional(),
        url: z.string().optional(),
        /** File name for csv_row items. */
        source: z.string().optional(),
        kind: SignalKind,
        market: Market,
      }),
    )
    .min(1),
  rationale: Rationale,
});

export const EditableCaseFields = Case.pick({
  title: true,
  shortTitle: true,
  summary: true,
  bodyMd: true,
  scope: true,
  // Car area, feature name and markets are not editable: they follow from the topic and the signals.
  type: true,
  changeDepth: true,
  coOwnerIds: true,
  watcherIds: true,
  manualRank: true,
  manualRankReason: true,
  brandFit: true,
}).partial();

export const PatchCaseBody = z.object({ patch: EditableCaseFields, rationale: z.string().optional() });

export const CaseStanceBody = CaseStance.omit({ authorId: true, updatedAt: true, pendingShape: true });

export const GenerateBody = z.object({
  /** Answers to the shape questions; missing keys use the question's default. */
  answers: z.array(z.object({ key: ShapeKey, value: z.string() })).optional(),
});

export const FeedbackBody = z.object({
  from: Addressee,
  text: z.string().min(3),
  response: FeedbackResponse,
  rationale: Rationale,
  signalIds: z.array(z.string()).optional(),
});
export const CaseTransitionBody = z.object({
  action: CaseAction,
  rationale: Rationale,
  toUserId: z.string().optional(), // refer
  mergeIntoId: z.string().optional(), // merge
  horizon: InnovationHorizon.optional(), // innovation
  escalate: z.boolean().optional(), // refer to head as escalation
});

export const CreateQuestionBody = z.object({
  addressee: Addressee,
  contact: z.string().optional(),
  question: z.string().min(3),
  why: z.string(),
  dueDate: z.string().optional(),
  fieldsAffected: z.array(z.string()).optional(),
});

export const PatchQuestionBody = OpenQuestion.pick({
  addressee: true,
  contact: true,
  question: true,
  why: true,
  status: true,
  answer: true,
  dueDate: true,
}).partial();

export const MeetingNoteBody = z.object({
  title: z.string(),
  date: z.string(),
  attendees: z.array(z.string()),
  text: z.string().min(10),
});

export const EditableRequirementFields = Requirement.pick({
  title: true,
  shortTitle: true,
  description: true,
  marketScope: true,
  releaseTarget: true,
  carArea: true,
  changeDepth: true,
  metrics: true,
  acceptanceCriteria: true,
  assumptions: true,
  evidenceLevel: true,
  cost: true,
  manualRank: true,
  argumentMd: true,
}).partial();

export const PatchRequirementBody = z.object({ patch: EditableRequirementFields, rationale: Rationale });
export const RequirementTransitionBody = z.object({ action: RequirementAction, rationale: Rationale });

export const ReferralDecisionBody = z.object({
  decision: z.enum(["accept", "decline", "escalate", "resolve"]),
  rationale: Rationale,
  resolution: z.enum(["one_market", "variant", "keep_both", "take_over", "return"]).optional(),
});

export const ChatPostBody = z.object({
  content: z.string().min(1),
  /** Segment key from GET /cases/:id/segments: answer only from that segment's real verbatims. */
  segment: z.string().optional(),
});
export const ChatPostResponse = z.object({ messages: z.array(ChatMessage), proposals: z.array(Proposal) });

/** A case, requirement or signal the PM dragged into the global Argus chat as context. */
export const ArgusAttachment = z.object({ kind: z.enum(["case", "requirement", "signal"]), id: z.string() });
export type ArgusAttachment = z.infer<typeof ArgusAttachment>;
export const ArgusAskBody = z.object({
  content: z.string().min(1),
  attachments: z.array(ArgusAttachment).max(5),
  /** The conversation so far; the global chat is kept by the client, the server stores nothing. */
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20),
});
export const ArgusAskResponse = z.object({
  content: z.string(),
  /** Every [ID] in the answer, with the page it opens. */
  citations: z.array(z.object({ ref: z.string(), label: z.string(), href: z.string() })),
});
export type ArgusAskResponse = z.infer<typeof ArgusAskResponse>;

export const ProposalDecisionBody = z.object({ decision: z.enum(["accept", "reject"]), rationale: z.string().optional() });

export const CommentBody = z.object({
  objectType: z.enum(["case", "requirement"]),
  objectId: z.string(),
  body: z.string().min(1),
});

export const ExportBody = z.object({
  series: Series,
  format: z.enum(["codebeamer_csv", "json"]),
  requirementIds: z.array(z.string()).optional(),
});
export const ExportResponse = z.object({ filename: z.string(), mime: z.string(), content: z.string(), count: z.number().int() });

/** One slide of the engineering-round deck: the requirement and every argument behind it. */
export const DeckSlide = z.object({
  requirementId: z.string(),
  rank: z.number().int(),
  score: z.number(),
  title: z.string(),
  description: z.string(),
  status: RequirementStatus,
  release: ReleaseTarget,
  marketScope: Region,
  evidenceLevel: EvidenceLevel,
  metrics: z.array(Metric),
  quotes: z.array(z.object({ ref: z.string(), market: Market, text: z.string() })),
  factors: z.array(z.object({ factor: FactorKey, value: z.number(), weight: z.number(), contribution: z.number() })),
  competitor: z.array(z.string()),
  decisions: z.array(z.object({ at: z.string(), actor: z.string(), action: z.string(), rationale: z.string().optional() })),
  openIssues: z.object({ red: z.number().int(), amber: z.number().int() }),
  /** How many parts come from evidence, the PM's context and assumptions. */
  provenance: z.object({ evidence: z.number().int(), pm_context: z.number().int(), assumption: z.number().int() }),
  version: z.number().int(),
  caseId: z.string(),
  caseTitle: z.string(),
  ownerName: z.string(),
});
export type DeckSlide = z.infer<typeof DeckSlide>;

export const DeckResponse = z.object({
  filename: z.string(),
  series: Series,
  successorName: z.string(),
  generatedAt: z.string(),
  slides: z.array(DeckSlide),
});
export type DeckResponse = z.infer<typeof DeckResponse>;

export const PlanFeaturePatch = z.object({
  patch: PlannedFeature.pick({ action: true, note: true, release: true, protected: true }).partial(),
  rationale: Rationale,
});

export const TaxonomyResponse = z.object({
  version: z.string(),
  carAreas: z.array(z.object({ id: CarArea, label: z.string(), description: z.string() })),
  topics: z.array(z.object({ id: z.string(), label: z.string(), shortLabel: z.string(), carArea: CarArea, hint: z.string().nullable() })),
  aspectGroups: z.array(z.object({ id: AspectGroup, description: z.string() })),
});
export type TaxonomyResponse = z.infer<typeof TaxonomyResponse>;

export const PortfolioResponse = z.object({
  series: z.array(
    z.object({
      series: Series,
      name: z.string(),
      ownerIds: z.array(z.string()),
      casesByState: z.record(CaseState, z.number()),
      casesByOutcome: z.record(z.string(), z.number()),
      requirementsByStatus: z.record(RequirementStatus, z.number()),
      topRequirements: z.array(z.object({ id: z.string(), title: z.string(), score: z.number(), status: RequirementStatus })),
      staleCases: z.number(),
      conflicts: z.number(),
      openAlerts: z.number(),
      volume2030: z.record(z.string(), z.number()),
    }),
  ),
  workload: z.array(
    z.object({
      userId: z.string(),
      activeCases: z.number(),
      openQuestions: z.number(),
      pendingReferrals: z.number(),
      awaitingSignOff: z.number(),
    }),
  ),
});
export type PortfolioResponse = z.infer<typeof PortfolioResponse>;

export const SearchResult = z.object({
  type: z.enum(["case", "requirement", "signal", "user"]),
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  href: z.string(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const RefreshResponse = z.object({
  run: AgentRun,
  signals: z.array(Signal),
  notifications: z.number(),
  /** Ripples created by competitor facts in this run (active and watch-only). */
  ripples: z.array(z.object({ id: z.string(), status: z.enum(["active", "watch"]), items: z.number().int(), rows: z.number().int(), summary: z.string() })),
});

export type RefreshResponse = z.infer<typeof RefreshResponse>;

// ---------- Trace replay ----------
export const IntegrityCheck = z.object({
  id: z.enum(["quotes_in_source", "record_hashes", "audit_sequence", "rationale_on_status"]),
  label: z.string(),
  ok: z.boolean(),
  detail: z.string(),
  failures: z.array(z.string()),
});
export type IntegrityCheck = z.infer<typeof IntegrityCheck>;

/** One step in the life of a requirement, as shown on the replay timeline. */
export const ReplayEvent = z.object({
  seq: z.number().int(),
  at: z.string(),
  actorId: z.string(),
  actorType: z.enum(["human", "agent"]),
  actorName: z.string(),
  action: z.string(),
  label: z.string(),
  objectType: z.string(),
  objectId: z.string(),
  rationale: z.string().nullable(),
  /** Requirement version current after this event (null before the first draft). */
  version: z.number().int().nullable(),
  scoreSnapshot: ScoreSnapshot.nullable(),
});
export type ReplayEvent = z.infer<typeof ReplayEvent>;

export const ReplayResponse = z.object({
  requirement: Requirement,
  versions: z.array(RequirementVersion),
  case: Case,
  /** Every signal of the case (for the diagram and the as-of counts). */
  signals: z.array(Signal),
  /** Sample shown in beat 1: defects first, then complaints and wishes, real BMW records before web. */
  quoteIds: z.array(z.string()),
  counts: z.object({ customers: z.number().int(), markets: z.array(Market), sources: z.number().int(), bmwRecords: z.number().int(), webRecords: z.number().int() }),
  /** Raw records behind the sampled quotes. */
  sourceRecords: z.array(SourceRecord),
  events: z.array(ReplayEvent),
  scoreToday: z.object({ score: z.number(), rank: z.number().int(), of: z.number().int(), profileName: z.string() }),
  plannedFeature: PlannedFeature.nullable(),
  alerts: z.array(Alert),
  integrity: z.array(IntegrityCheck),
  generatedAt: z.string(),
});
export type ReplayResponse = z.infer<typeof ReplayResponse>;

// ---------- Competitor ripple ----------
export const RippleBundle = z.object({ ripple: Ripple, conversions: z.array(CycleConversion), settings: MonitorSettings });
export type RippleBundle = z.infer<typeof RippleBundle>;

export const RippleDecisionBody = z.object({
  kind: RippleDecisionKind,
  rationale: Rationale,
  /** raise_target / market_variant: the new value in the item's cycle (defaults to just ahead of the competitor). */
  value: z.number().positive().optional(),
});
export type RippleDecisionBody = z.infer<typeof RippleDecisionBody>;

export const InnovationEntry = z.object({ meta: InnovationMeta, case: Case });
export type InnovationEntry = z.infer<typeof InnovationEntry>;

// ---------- Endpoints ----------
export const endpoints = {
  // Identity and workspace
  me: ep({ method: "GET", path: "/me", tag: "identity", summary: "Current user, workspace and active weight profile", response: MeResponse }),
  users: ep({ method: "GET", path: "/users", tag: "identity", summary: "All users", response: z.array(User) }),
  updateWorkspace: ep({
    method: "PUT",
    path: "/workspace",
    tag: "identity",
    summary: "Update my workspace (weights, filters, watchlist, project type)",
    body: Workspace.omit({ id: true, userId: true }).partial(),
    response: Workspace,
  }),
  search: ep({ method: "GET", path: "/search", tag: "identity", summary: "Global search", query: z.object({ q: z.string() }), response: z.array(SearchResult) }),

  // Series briefs (layer 1)
  briefs: ep({ method: "GET", path: "/briefs", tag: "briefs", summary: "Shared briefs and regional overlays", query: z.object({ series: Series.optional() }), response: z.array(SeriesBrief) }),
  myBrief: ep({ method: "GET", path: "/briefs/mine", tag: "briefs", summary: "My resolved brief with its shared brief, overlay and pending proposals", response: BriefBundle }),
  createOverlay: ep({
    method: "POST",
    path: "/briefs",
    tag: "briefs",
    summary: "Create my regional overlay on the shared brief of my series",
    body: z.object({ series: Series }),
    response: SeriesBrief,
  }),
  saveBrief: ep({
    method: "PUT",
    path: "/briefs/:id",
    tag: "briefs",
    summary: "Save brief answers (reasons per changed field); returns the requirements it affects as new-version proposals",
    body: SaveBriefBody,
    response: z.object({ brief: SeriesBrief, impact: z.array(BriefImpact) }),
  }),
  previewBriefImpact: ep({
    method: "POST",
    path: "/briefs/:id/impact",
    tag: "briefs",
    summary: "What would change in which requirements if these brief values were saved (nothing is stored)",
    body: z.object({ values: BriefValues.partial() }),
    response: z.array(BriefImpact),
  }),
  extractBrief: ep({
    method: "POST",
    path: "/briefs/:id/extract",
    tag: "briefs",
    summary: "Paste a strategy doc; the AI proposes brief field values to accept or reject one by one",
    body: z.object({ text: z.string().min(20) }),
    response: z.array(Proposal),
  }),
  briefConflicts: ep({ method: "GET", path: "/brief-conflicts", tag: "briefs", summary: "Overlay fields that differ from the shared brief (open ones first)", response: z.array(BriefConflict.extend({ series: Series, ownerId: z.string() })) }),
  resolveBriefConflict: ep({
    method: "POST",
    path: "/briefs/:id/conflicts/:field",
    tag: "briefs",
    summary: "Head of product line: accept the difference as a regional variant, or align the overlay to the shared brief",
    body: z.object({ resolution: z.enum(["regional_variant", "align"]), rationale: Rationale }),
    response: SeriesBrief,
  }),

  // Signals and agents
  signals: ep({ method: "GET", path: "/signals", tag: "signals", summary: "List signals (findings)", query: SignalQuery, response: z.array(Signal) }),
  clusters: ep({ method: "GET", path: "/clusters", tag: "signals", summary: "Signal clusters for the theme map", query: z.object({ series: Series.optional() }), response: z.array(SignalCluster) }),
  agentRuns: ep({ method: "GET", path: "/agent-runs", tag: "signals", summary: "Recent agent runs", response: z.array(AgentRun) }),
  refresh: ep({ method: "POST", path: "/agent-runs/refresh", tag: "signals", summary: "Run the fetch loop once for a series", body: z.object({ series: Series }), response: RefreshResponse }),
  quarantine: ep({ method: "GET", path: "/quarantine", tag: "signals", summary: "Rejected signals with reason", response: z.array(QuarantineItem) }),

  // Cases
  cases: ep({ method: "GET", path: "/cases", tag: "cases", summary: "List cases", query: CaseListQuery, response: z.array(Case) }),
  createCase: ep({ method: "POST", path: "/cases", tag: "cases", summary: "Start a case from signals, or empty to fill by hand", body: CreateCaseBody, response: Case }),
  addCaseEvidence: ep({ method: "POST", path: "/cases/:id/evidence", tag: "cases", summary: "Add PM evidence (CSV rows, links, notes) as signals", body: AddEvidenceBody, response: z.object({ case: Case, added: z.array(Signal) }) }),
  caseBundle: ep({ method: "GET", path: "/cases/:id", tag: "cases", summary: "Case with signals, questions, requirements, referrals", response: CaseBundle }),
  patchCase: ep({ method: "PATCH", path: "/cases/:id", tag: "cases", summary: "Edit case fields or body", body: PatchCaseBody, response: Case }),
  transitionCase: ep({ method: "POST", path: "/cases/:id/transition", tag: "cases", summary: "Move a case (state or outcome)", body: CaseTransitionBody, response: Case }),
  createQuestion: ep({ method: "POST", path: "/cases/:id/questions", tag: "cases", summary: "Add an open question", body: CreateQuestionBody, response: OpenQuestion }),
  addMeetingNote: ep({
    method: "POST",
    path: "/cases/:id/meeting-notes",
    tag: "cases",
    summary: "Paste meeting notes; AI proposes answers and field updates",
    body: MeetingNoteBody,
    response: z.object({ note: MeetingNote, proposals: z.array(Proposal) }),
  }),
  saveCaseStance: ep({
    method: "PUT",
    path: "/cases/:id/stance",
    tag: "cases",
    summary: "Save my stance on this case (layer 2: brief overrides, take on the evidence, inside knowledge, ambition); the AI answers with follow-up questions",
    body: CaseStanceBody,
    response: z.object({ case: Case, message: ChatMessage }),
  }),
  shapeQuestions: ep({
    method: "GET",
    path: "/cases/:id/shape-questions",
    tag: "cases",
    summary: "Adaptive questions (max 3) before drafting requirements, each with a default and why it is asked",
    response: ShapeQuestionsResponse,
  }),
  askShapeQuestions: ep({
    method: "POST",
    path: "/cases/:id/shape-questions/ask",
    tag: "cases",
    summary: "Post the shape questions once in the case chat; replies with an option label pre-fill the form",
    body: z.object({}),
    response: ChatMessage,
  }),
  generateRequirements: ep({
    method: "POST",
    path: "/cases/:id/requirements/generate",
    tag: "cases",
    summary: "Draft requirement(s) from a confirmed case with the caller's brief, stance and shape answers; every part carries provenance",
    body: GenerateBody,
    response: z.array(Requirement),
  }),
  exportCaseMd: ep({ method: "GET", path: "/cases/:id/export.md", tag: "cases", summary: "Case as markdown with YAML front matter", response: z.object({ filename: z.string(), content: z.string() }) }),
  caseSegments: ep({
    method: "GET",
    path: "/cases/:id/segments",
    tag: "cases",
    summary: "Customer segments of a case (market, market x powertrain) with their count of real BMW verbatims",
    response: z.array(ChatSegment),
  }),

  // Questions
  questions: ep({ method: "GET", path: "/questions", tag: "questions", summary: "Open questions (mine by default)", query: z.object({ all: z.coerce.boolean().optional() }), response: z.array(OpenQuestion) }),
  patchQuestion: ep({ method: "PATCH", path: "/questions/:id", tag: "questions", summary: "Edit or answer a question", body: PatchQuestionBody, response: OpenQuestion }),

  // Requirements
  requirements: ep({ method: "GET", path: "/requirements", tag: "requirements", summary: "List requirements", query: z.object({ series: Series.optional(), caseId: z.string().optional() }), response: z.array(Requirement) }),
  requirementBundle: ep({ method: "GET", path: "/requirements/:id", tag: "requirements", summary: "Requirement with its case and evidence", response: RequirementBundle }),
  patchRequirement: ep({ method: "PATCH", path: "/requirements/:id", tag: "requirements", summary: "Edit a requirement", body: PatchRequirementBody, response: Requirement }),
  transitionRequirement: ep({ method: "POST", path: "/requirements/:id/transition", tag: "requirements", summary: "Move a requirement", body: RequirementTransitionBody, response: Requirement }),
  addFeedback: ep({
    method: "POST",
    path: "/requirements/:id/feedback",
    tag: "requirements",
    summary: "Record engineering/finance feedback and the PM's response (layer 4); returns a new-version proposal",
    body: FeedbackBody,
    response: z.object({ feedback: FeedbackEntry, proposal: Proposal }),
  }),
  requirementReplay: ep({
    method: "GET",
    path: "/requirements/:id/replay",
    tag: "requirements",
    summary: "Whole life of a requirement for the trace replay: quotes, signals, case, score per decision, events and integrity checks",
    response: ReplayResponse,
  }),
  runRequirementCheck: ep({
    method: "POST",
    path: "/requirements/:id/check",
    tag: "requirements",
    summary: "Run the quality check (vague words, scope, out of scope, duplicates, conflicts, Baukasten); rules plus an LLM pass when available",
    body: z.object({}),
    response: RequirementCheck,
  }),

  // Scoring
  scores: ep({ method: "GET", path: "/scores", tag: "scoring", summary: "Ranked cases and requirements for a weight profile", query: z.object({ profileId: z.string().optional(), series: Series.optional() }), response: ScoresResponse }),
  previewScores: ep({
    method: "POST",
    path: "/scores/preview",
    tag: "scoring",
    summary: "What-if ranking for unsaved weights",
    body: z.object({ weights: z.partialRecord(FactorKey, z.number()), series: Series.optional() }),
    response: ScoresResponse,
  }),
  weightProfiles: ep({ method: "GET", path: "/weight-profiles", tag: "scoring", summary: "Weight profiles", response: z.array(WeightProfile) }),
  saveWeightProfile: ep({ method: "PUT", path: "/weight-profiles/:id", tag: "scoring", summary: "Save a weight profile", body: WeightProfile.omit({ id: true }).partial(), response: WeightProfile }),
  createWeightProfile: ep({ method: "POST", path: "/weight-profiles", tag: "scoring", summary: "Create a weight profile", body: WeightProfile.omit({ id: true, ownerId: true, isDefault: true }), response: WeightProfile }),
  brandProfile: ep({ method: "GET", path: "/brand-profile", tag: "scoring", summary: "Current BMW brand profile", response: BrandProfile }),
  saveBrandProfile: ep({ method: "PUT", path: "/brand-profile", tag: "scoring", summary: "New brand profile version (head only)", body: BrandProfile.pick({ pillars: true, doNot: true, notesMd: true }), response: BrandProfile }),

  // Routing
  referrals: ep({ method: "GET", path: "/referrals", tag: "routing", summary: "Referrals and escalations involving me (head: all)", response: z.array(Referral) }),
  decideReferral: ep({ method: "POST", path: "/referrals/:id/decide", tag: "routing", summary: "Accept, decline, escalate or resolve", body: ReferralDecisionBody, response: Referral }),
  innovation: ep({ method: "GET", path: "/innovation", tag: "routing", summary: "Innovation pool", response: z.array(InnovationEntry) }),
  voteInnovation: ep({ method: "POST", path: "/innovation/:caseId/vote", tag: "routing", summary: "Toggle my vote", body: z.object({}), response: InnovationMeta }),
  pullInnovation: ep({ method: "POST", path: "/innovation/:caseId/pull", tag: "routing", summary: "Pull an innovation item into my series as a linked case", body: z.object({ series: Series, rationale: Rationale }), response: Case }),

  // Vehicle plan and hand-off
  plan: ep({ method: "GET", path: "/plans/:series", tag: "plan", summary: "Successor vehicle plan", response: VehiclePlan }),
  patchPlanFeature: ep({ method: "PATCH", path: "/plans/:series/features/:featureId", tag: "plan", summary: "Edit a planned feature", body: PlanFeaturePatch, response: VehiclePlan }),
  exportRequirements: ep({ method: "POST", path: "/exports", tag: "plan", summary: "Export approved requirements (Codebeamer CSV or JSON)", body: ExportBody, response: ExportResponse }),
  requirementDeck: ep({
    method: "POST",
    path: "/plans/:series/deck",
    tag: "plan",
    summary: "Slides for the engineering round: signed-off and planned requirements with quotes, score, competition and decisions",
    body: z.object({}),
    response: DeckResponse,
  }),

  // Conversation
  messages: ep({ method: "GET", path: "/threads/:type/:id/messages", tag: "conversation", summary: "AI chat thread of a case or requirement", response: z.array(ChatMessage) }),
  postMessage: ep({ method: "POST", path: "/threads/:type/:id/messages", tag: "conversation", summary: "Ask the AI; returns its answer and any proposals", body: ChatPostBody, response: ChatPostResponse }),
  argusAsk: ep({
    method: "POST",
    path: "/argus/ask",
    tag: "conversation",
    summary: "Ask Argus from anywhere, with dragged-in cases, requirements or signals as context; answers only, never edits",
    body: ArgusAskBody,
    response: ArgusAskResponse,
  }),
  decideProposal: ep({ method: "POST", path: "/proposals/:id/decide", tag: "conversation", summary: "Accept or reject an AI proposal", body: ProposalDecisionBody, response: Proposal }),
  comments: ep({ method: "GET", path: "/comments", tag: "conversation", summary: "Comments on an object", query: z.object({ objectType: z.enum(["case", "requirement"]), objectId: z.string() }), response: z.array(Comment) }),
  addComment: ep({ method: "POST", path: "/comments", tag: "conversation", summary: "Comment with @mentions", body: CommentBody, response: Comment }),

  // Inbox and monitoring
  notifications: ep({ method: "GET", path: "/notifications", tag: "inbox", summary: "My notifications", response: z.array(Notification) }),
  readNotifications: ep({ method: "POST", path: "/notifications/read", tag: "inbox", summary: "Mark as read (all if ids omitted)", body: z.object({ ids: z.array(z.string()).optional() }), response: Ok }),
  alerts: ep({ method: "GET", path: "/alerts", tag: "inbox", summary: "Monitoring alerts", query: z.object({ all: z.coerce.boolean().optional() }), response: z.array(Alert) }),
  resolveAlert: ep({ method: "POST", path: "/alerts/:id/resolve", tag: "inbox", summary: "Dismiss or send to rework", body: z.object({ status: z.enum(["dismissed", "rework"]), rationale: Rationale }), response: Alert }),

  // Oversight
  audit: ep({
    method: "GET",
    path: "/audit",
    tag: "oversight",
    summary: "Append-only audit log",
    query: z.object({ objectId: z.string().optional(), actorType: z.enum(["human", "ai"]).optional(), limit: z.coerce.number().int().optional() }),
    response: z.array(AuditEvent),
  }),
  taxonomy: ep({ method: "GET", path: "/taxonomy", tag: "signals", summary: "Fixed taxonomy: car areas, topics, aspect groups", response: TaxonomyResponse }),
  portfolio: ep({ method: "GET", path: "/portfolio", tag: "oversight", summary: "Portfolio overview for the head of product line", response: PortfolioResponse }),
  reset: ep({ method: "POST", path: "/admin/reset", tag: "oversight", summary: "Reset the mock store to the seed", body: z.object({}), response: Ok }),

  // Competitor ripple
  ripples: ep({ method: "GET", path: "/ripples", tag: "monitor", summary: "Ripples, newest first", response: z.array(Ripple) }),
  ripple: ep({ method: "GET", path: "/ripples/:id", tag: "monitor", summary: "One ripple with the conversion table and monitor settings", response: RippleBundle }),
  decideRippleItem: ep({
    method: "POST",
    path: "/ripples/:id/items/:itemId/decision",
    tag: "monitor",
    summary: "Owner decision on an affected item: raise target or market variant (both proposals), keep with reason (mutes repeats), reopen the case",
    body: RippleDecisionBody,
    response: z.object({ ripple: Ripple, proposal: Proposal.nullable() }),
  }),
  conversions: ep({ method: "GET", path: "/conversions", tag: "monitor", summary: "Cycle conversion table (labelled assumptions)", response: z.array(CycleConversion) }),
  saveConversion: ep({
    method: "PUT",
    path: "/conversions/:id",
    tag: "monitor",
    summary: "Change a conversion factor (head only); re-assesses open ripples",
    body: z.object({ factor: z.number().positive(), rationale: Rationale }),
    response: CycleConversion,
  }),
  monitorSettings: ep({ method: "GET", path: "/settings/monitor", tag: "monitor", summary: "Monitor settings (mute threshold, at-par tolerance)", response: MonitorSettings }),
  saveMonitorSettings: ep({
    method: "PUT",
    path: "/settings/monitor",
    tag: "monitor",
    summary: "Change monitor settings (logged with a reason)",
    body: z.object({ muteThresholdPct: z.number().min(0).max(50).optional(), atParTolerancePct: z.number().min(0).max(20).optional(), rationale: Rationale }),
    response: MonitorSettings,
  }),
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
export type ResponseOf<N extends EndpointName> = z.infer<Endpoints[N]["response"]>;
export type BodyOf<N extends EndpointName> = Endpoints[N] extends { body: infer B extends z.ZodType } ? z.input<B> : never;
export type QueryOf<N extends EndpointName> = Endpoints[N] extends { query: infer Q extends z.ZodType } ? z.input<Q> : never;
