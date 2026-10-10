import { z } from "zod";
import {
  Agent,
  Addressee,
  CarArea,
  CaseAction,
  CaseState,
  CaseType,
  ChangeDepth,
  FactorKey,
  InnovationHorizon,
  Market,
  Region,
  RequirementAction,
  RequirementStatus,
  Series,
  SignalKind,
  SignalStatus,
} from "./enums";
import {
  Alert,
  AgentRun,
  AuditEvent,
  BrandProfile,
  Case,
  ChatMessage,
  Comment,
  InnovationMeta,
  MeetingNote,
  Notification,
  OpenQuestion,
  PlannedFeature,
  Proposal,
  QuarantineItem,
  Referral,
  Requirement,
  ScoredCase,
  Signal,
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
export const MeResponse = z.object({ user: User, workspace: Workspace, weightProfile: WeightProfile });
export type MeResponse = z.infer<typeof MeResponse>;

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
  carArea: CarArea,
  type: CaseType,
  changeDepth: ChangeDepth,
  summary: z.string(),
  signalIds: z.array(z.string()).min(1),
  rationale: Rationale,
});

export const EditableCaseFields = Case.pick({
  title: true,
  summary: true,
  bodyMd: true,
  scope: true,
  markets: true,
  carArea: true,
  type: true,
  changeDepth: true,
  featureName: true,
  coOwnerIds: true,
  watcherIds: true,
  manualRank: true,
  manualRankReason: true,
  brandFit: true,
}).partial();

export const PatchCaseBody = z.object({ patch: EditableCaseFields, rationale: z.string().optional() });

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
}).partial();

export const PatchRequirementBody = z.object({ patch: EditableRequirementFields, rationale: Rationale });
export const RequirementTransitionBody = z.object({ action: RequirementAction, rationale: Rationale });

export const ReferralDecisionBody = z.object({
  decision: z.enum(["accept", "decline", "escalate", "resolve"]),
  rationale: Rationale,
  resolution: z.enum(["one_market", "variant", "keep_both", "take_over", "return"]).optional(),
});

export const ChatPostBody = z.object({ content: z.string().min(1) });
export const ChatPostResponse = z.object({ messages: z.array(ChatMessage), proposals: z.array(Proposal) });

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

export const PlanFeaturePatch = z.object({
  patch: PlannedFeature.pick({ action: true, note: true, release: true, protected: true }).partial(),
  rationale: Rationale,
});

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

export const RefreshResponse = z.object({ run: AgentRun, signals: z.array(Signal), notifications: z.number() });

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

  // Signals and agents
  signals: ep({ method: "GET", path: "/signals", tag: "signals", summary: "List signals (findings)", query: SignalQuery, response: z.array(Signal) }),
  clusters: ep({ method: "GET", path: "/clusters", tag: "signals", summary: "Signal clusters for the theme map", query: z.object({ series: Series.optional() }), response: z.array(SignalCluster) }),
  agentRuns: ep({ method: "GET", path: "/agent-runs", tag: "signals", summary: "Recent agent runs", response: z.array(AgentRun) }),
  refresh: ep({ method: "POST", path: "/agent-runs/refresh", tag: "signals", summary: "Run the fetch loop once for a series", body: z.object({ series: Series }), response: RefreshResponse }),
  quarantine: ep({ method: "GET", path: "/quarantine", tag: "signals", summary: "Rejected signals with reason", response: z.array(QuarantineItem) }),

  // Cases
  cases: ep({ method: "GET", path: "/cases", tag: "cases", summary: "List cases", query: CaseListQuery, response: z.array(Case) }),
  createCase: ep({ method: "POST", path: "/cases", tag: "cases", summary: "Start a case from signals", body: CreateCaseBody, response: Case }),
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
  generateRequirements: ep({ method: "POST", path: "/cases/:id/requirements/generate", tag: "cases", summary: "Draft requirement(s) from a confirmed case", body: z.object({}), response: z.array(Requirement) }),
  exportCaseMd: ep({ method: "GET", path: "/cases/:id/export.md", tag: "cases", summary: "Case as markdown with YAML front matter", response: z.object({ filename: z.string(), content: z.string() }) }),

  // Questions
  questions: ep({ method: "GET", path: "/questions", tag: "questions", summary: "Open questions (mine by default)", query: z.object({ all: z.coerce.boolean().optional() }), response: z.array(OpenQuestion) }),
  patchQuestion: ep({ method: "PATCH", path: "/questions/:id", tag: "questions", summary: "Edit or answer a question", body: PatchQuestionBody, response: OpenQuestion }),

  // Requirements
  requirements: ep({ method: "GET", path: "/requirements", tag: "requirements", summary: "List requirements", query: z.object({ series: Series.optional(), caseId: z.string().optional() }), response: z.array(Requirement) }),
  requirementBundle: ep({ method: "GET", path: "/requirements/:id", tag: "requirements", summary: "Requirement with its case and evidence", response: RequirementBundle }),
  patchRequirement: ep({ method: "PATCH", path: "/requirements/:id", tag: "requirements", summary: "Edit a requirement", body: PatchRequirementBody, response: Requirement }),
  transitionRequirement: ep({ method: "POST", path: "/requirements/:id/transition", tag: "requirements", summary: "Move a requirement", body: RequirementTransitionBody, response: Requirement }),

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

  // Conversation
  messages: ep({ method: "GET", path: "/threads/:type/:id/messages", tag: "conversation", summary: "AI chat thread of a case or requirement", response: z.array(ChatMessage) }),
  postMessage: ep({ method: "POST", path: "/threads/:type/:id/messages", tag: "conversation", summary: "Ask the AI; returns its answer and any proposals", body: ChatPostBody, response: ChatPostResponse }),
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
  portfolio: ep({ method: "GET", path: "/portfolio", tag: "oversight", summary: "Portfolio overview for the head of product line", response: PortfolioResponse }),
  reset: ep({ method: "POST", path: "/admin/reset", tag: "oversight", summary: "Reset the mock store to the seed", body: z.object({}), response: Ok }),
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
export type ResponseOf<N extends EndpointName> = z.infer<Endpoints[N]["response"]>;
export type BodyOf<N extends EndpointName> = Endpoints[N] extends { body: infer B extends z.ZodType } ? z.input<B> : never;
export type QueryOf<N extends EndpointName> = Endpoints[N] extends { query: infer Q extends z.ZodType } ? z.input<Q> : never;
