import { z } from "zod";

/**
 * Shared vocabularies. These are part of the REST contract: the backend must
 * use exactly these string values. Labels for the UI live in `labels.ts`.
 */

export const Series = z.enum(["G60", "F70", "G70"]);
export type Series = z.infer<typeof Series>;

/** Sales markets as in sales_volumes.csv plus "unknown" for web signals. */
export const Market = z.enum(["EU", "US", "CN", "RoW", "unknown"]);
export type Market = z.infer<typeof Market>;

/** Workspace / requirement scope. One car line has a China PM and a rest-of-world PM. */
export const Region = z.enum(["global", "RoW", "CN"]);
export type Region = z.infer<typeof Region>;

export const Role = z.enum(["vehicle_pm", "attribute_pm", "head"]);
export type Role = z.infer<typeof Role>;

export const ProjectType = z.enum(["new_gen", "lci"]);
export type ProjectType = z.infer<typeof ProjectType>;

// ---------- Signals ----------
export const SignalKind = z.enum(["complaint", "wish", "like", "competitor_fact", "trend", "innovation"]);
export type SignalKind = z.infer<typeof SignalKind>;

export const Severity = z.enum(["defect", "difficult_to_use", "wish", "none"]);
export type Severity = z.infer<typeof Severity>;

/** Which agent produced the signal (architecture.mmd §2 + BMW data import). */
/** "pm" = evidence a PM added by hand (uploaded file, link or note), not fetched by an agent. */
export const Agent = z.enum(["bmw_data", "competitor", "customer_public", "trends", "innovation_scout", "pm"]);
export type Agent = z.infer<typeof Agent>;

export const SourceType = z.enum([
  "bmw_feedback",
  "bmw_study",
  "bmw_sales",
  "option_list",
  "review",
  "video",
  "forum",
  "social",
  "news",
  "competitor_official",
  "trend_report",
  "trade_fair",
  "pm_upload",
  "pm_link",
  "pm_note",
]);
export type SourceType = z.infer<typeof SourceType>;

/** Trust tiers from external-sources.md (A = BMW data ... E = announcement/assumption). */
export const Trust = z.enum(["A", "B", "C", "D", "E"]);
export type Trust = z.infer<typeof Trust>;

export const Audience = z.enum(["owner", "reviewer", "public"]);
export type Audience = z.infer<typeof Audience>;

export const Powertrain = z.enum(["ICE", "PHEV", "BEV", "unknown"]);
export type Powertrain = z.infer<typeof Powertrain>;

export const SignalStatus = z.enum(["new", "clustered", "unclustered", "quarantined"]);
export type SignalStatus = z.infer<typeof SignalStatus>;

// ---------- Taxonomy ----------
export const CarArea = z.enum([
  "exterior_design",
  "interior_comfort",
  "seats",
  "climate",
  "infotainment_hmi",
  "connectivity_digital",
  "driver_assistance",
  "dynamics_powertrain",
  "range_charging",
  "practicality",
  "quality_materials",
]);
export type CarArea = z.infer<typeof CarArea>;

/** Aspect groups (taxonomy/aspects.csv): what a statement is about. */
export const AspectGroup = z.enum([
  "function",
  "usability",
  "reliability",
  "performance",
  "efficiency_range",
  "design",
  "comfort",
  "space",
  "quality",
  "sound",
  "price",
]);
export type AspectGroup = z.infer<typeof AspectGroup>;

export const CaseType = z.enum([
  "new_feature",
  "fix_improve",
  "performance_target",
  "quality_perception",
  "market_variant",
  "brand_differentiator",
  "regression",
]);
export type CaseType = z.infer<typeof CaseType>;

export const ChangeDepth = z.enum(["trim_option", "part_module", "platform_powertrain", "software_ota"]);
export type ChangeDepth = z.infer<typeof ChangeDepth>;

// ---------- Case lifecycle ----------
export const CaseState = z.enum(["observed", "new", "investigating", "awaiting_answers", "ready", "decided"]);
export type CaseState = z.infer<typeof CaseState>;

export const CaseOutcome = z.enum(["confirmed", "referred", "innovation_pool", "parked", "merged", "rejected"]);
export type CaseOutcome = z.infer<typeof CaseOutcome>;

export const CaseAction = z.enum([
  "open", // observed -> new
  "start", // -> investigating
  "await", // -> awaiting_answers
  "ready", // -> ready
  "reopen", // decided -> investigating
  "confirm",
  "refer",
  "innovation",
  "park",
  "merge",
  "reject",
]);
export type CaseAction = z.infer<typeof CaseAction>;

export const EvidenceLevel = z.enum(["high", "medium", "low", "assumption"]);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

/** Factors of the case importance score (architecture.mmd §5). All 0..1. */
export const FactorKey = z.enum([
  "customers",
  "severity",
  "satisfaction_gap",
  "competitor_gap",
  "market_volume",
  "regression",
  "trend",
  "brand_fit",
]);
export type FactorKey = z.infer<typeof FactorKey>;

// ---------- Requirements ----------
export const RequirementStatus = z.enum([
  "draft",
  "in_discussion",
  "pm_approved",
  "signed_off",
  "planned",
  "exported",
  "rejected",
]);
export type RequirementStatus = z.infer<typeof RequirementStatus>;

export const RequirementAction = z.enum([
  "discuss",
  "approve",
  "send_back",
  "sign_off",
  "plan",
  "export",
  "reject",
  "restore",
]);
export type RequirementAction = z.infer<typeof RequirementAction>;

export const ReleaseTarget = z.enum(["next_gen", "lci", "ota"]);
export type ReleaseTarget = z.infer<typeof ReleaseTarget>;

export const CostSize = z.enum(["S", "M", "L"]);
export const CostSensitivity = z.enum(["low", "medium", "high"]);
export type CostSensitivity = z.infer<typeof CostSensitivity>;
export const Positioning = z.enum(["base", "premium", "luxury"]);
export type Positioning = z.infer<typeof Positioning>;
export type CostSize = z.infer<typeof CostSize>;

export const CostSource = z.enum(["option_price", "ai_estimate", "pm", "engineering", "finance"]);
export type CostSource = z.infer<typeof CostSource>;

export const MetricBasis = z.enum(["evidence", "assumption"]);
export type MetricBasis = z.infer<typeof MetricBasis>;

/** Quality check on a requirement before PM approval (the checks engineering runs in Codebeamer). */
export const CheckKind = z.enum(["vague_word", "missing_scope", "out_of_scope", "duplicate", "conflict", "baukasten"]);
export type CheckKind = z.infer<typeof CheckKind>;

export const CheckSeverity = z.enum(["red", "amber"]);
export type CheckSeverity = z.infer<typeof CheckSeverity>;

// ---------- PM context layers ----------
/** Where a part of a requirement or a context value comes from, top to bottom. */
export const ContextLayer = z.enum(["brand", "series_brief", "case_stance", "requirement_shape", "feedback"]);
export type ContextLayer = z.infer<typeof ContextLayer>;

/** Provenance of one part of a requirement: customer evidence, the PM's context, or an assumption. */
export const ProvenanceSource = z.enum(["evidence", "pm_context", "assumption"]);
export type ProvenanceSource = z.infer<typeof ProvenanceSource>;

/** Series brief: who the successor is for. */
export const TargetCustomer = z.enum(["keep_owners", "conquest", "both"]);
export type TargetCustomer = z.infer<typeof TargetCustomer>;

/** Series brief: evolution vs. revolution. */
export const ChangeAmbition = z.enum(["evolution", "balanced", "revolution"]);
export type ChangeAmbition = z.infer<typeof ChangeAmbition>;

/** Case stance / requirement shape: how far to go on this problem. */
export const Ambition = z.enum(["fix", "match", "beat"]);
export type Ambition = z.infer<typeof Ambition>;

/** The adaptive questions asked when a requirement is created (at most 3 per case). */
export const ShapeKey = z.enum(["scope", "benchmark", "solution", "release", "offer"]);
export type ShapeKey = z.infer<typeof ShapeKey>;

/** The eight onboarding questions of a series brief. */
export const BriefFieldKey = z.enum(["thesis", "targetCustomer", "marketWeights", "changeAmbition", "protectList", "dontFightOn", "givens", "costEnvelope"]);
export type BriefFieldKey = z.infer<typeof BriefFieldKey>;

/** Case stance: how the PM wants a slice of the evidence read. */
export const EvidenceEffect = z.enum(["discount", "focus"]);
export type EvidenceEffect = z.infer<typeof EvidenceEffect>;

export const InsideKind = z.enum(["past_decision", "supplier_tech", "engineering_on_it", "other"]);
export type InsideKind = z.infer<typeof InsideKind>;

/** The PM's response to engineering or finance feedback on a requirement. */
export const FeedbackResponse = z.enum(["accept", "push_back", "compromise"]);
export type FeedbackResponse = z.infer<typeof FeedbackResponse>;

// ---------- Collaboration ----------
export const Addressee = z.enum(["engineering", "finance", "design", "quality", "market_pm", "purchasing", "other"]);
export type Addressee = z.infer<typeof Addressee>;

export const QuestionStatus = z.enum(["open", "answered", "dropped"]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const AnswerSource = z.enum(["meeting_note", "chat", "manual"]);
export type AnswerSource = z.infer<typeof AnswerSource>;

export const ReferralStatus = z.enum(["pending", "accepted", "declined", "escalated", "resolved"]);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

export const ObjectType = z.enum(["case", "requirement", "signal", "referral", "question", "plan", "profile", "workspace", "brief", "ripple", "settings"]);
export type ObjectType = z.infer<typeof ObjectType>;

export const ProposalKind = z.enum(["field", "body", "question_answer", "new_question", "new_requirement", "brief_field", "new_version"]);
export type ProposalKind = z.infer<typeof ProposalKind>;

export const ProposalSource = z.enum(["chat", "meeting_note", "monitor", "strategy_doc", "feedback", "brief_change", "learning"]);
export type ProposalSource = z.infer<typeof ProposalSource>;

export const ProposalStatus = z.enum(["pending", "accepted", "rejected"]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const NotificationKind = z.enum([
  "alert",
  "mention",
  "referral",
  "question_answered",
  "sign_off_request",
  "sent_back",
  "new_signals",
  "escalation",
  "fyi",
]);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const AlertVerdict = z.enum(["supports", "contradicts", "raises_the_bar"]);
export type AlertVerdict = z.infer<typeof AlertVerdict>;

export const AlertStatus = z.enum(["open", "dismissed", "rework"]);
export type AlertStatus = z.infer<typeof AlertStatus>;

export const ActorType = z.enum(["human", "ai"]);
export type ActorType = z.infer<typeof ActorType>;

export const PlanAction = z.enum(["keep", "new", "improve", "remove"]);
export type PlanAction = z.infer<typeof PlanAction>;

export const Availability = z.enum(["standard", "optional", "absent", "removed"]);
export type Availability = z.infer<typeof Availability>;

export const InnovationHorizon = z.enum(["next_gen", "gen_after", "new_product"]);
export type InnovationHorizon = z.infer<typeof InnovationHorizon>;

// ---------- Traceability and the competitor ripple ----------
/** Test cycle of a range figure. "none" for metrics without a cycle (e.g. charging minutes). */
export const TargetCycle = z.enum(["WLTP", "CLTC", "EPA", "none"]);
export type TargetCycle = z.infer<typeof TargetCycle>;

export const Comparator = z.enum(["gte", "lte"]);
export type Comparator = z.infer<typeof Comparator>;

/** Machine-comparable metric keys. A competitor fact and a target meet on the same key. */
export const MetricKey = z.enum(["ev_range", "dc_10_80_min"]);
export type MetricKey = z.infer<typeof MetricKey>;

/** Where our target stands against a new competitor value, after cycle normalization. */
export const ImpactVerdict = z.enum(["behind", "at_par", "still_ahead", "not_comparable"]);
export type ImpactVerdict = z.infer<typeof ImpactVerdict>;

export const RippleDecisionKind = z.enum(["raise_target", "keep", "market_variant", "reopen_case"]);
export type RippleDecisionKind = z.infer<typeof RippleDecisionKind>;

/** How a signal got its topic: BMW's own VFC label, a model, or a person. */
export const ClassificationMethod = z.enum(["bmw_label", "llm", "manual"]);
export type ClassificationMethod = z.infer<typeof ClassificationMethod>;

/** Portfolio row of the ripple grid: a series, or a series' market variant (G68 = 5 Series China). */
export const PortfolioRow = z.enum(["G60", "G60_CN", "G70", "F70"]);
export type PortfolioRow = z.infer<typeof PortfolioRow>;
