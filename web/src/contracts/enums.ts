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
export const Agent = z.enum(["bmw_data", "competitor", "customer_public", "trends", "innovation_scout"]);
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
export const MarketFocus = z.enum(["global", "US", "EU", "CN"]);
export type MarketFocus = z.infer<typeof MarketFocus>;
export const Positioning = z.enum(["base", "premium", "luxury"]);
export type Positioning = z.infer<typeof Positioning>;
export type CostSize = z.infer<typeof CostSize>;

export const CostSource = z.enum(["option_price", "ai_estimate", "pm", "finance"]);
export type CostSource = z.infer<typeof CostSource>;

export const MetricBasis = z.enum(["evidence", "assumption"]);
export type MetricBasis = z.infer<typeof MetricBasis>;

// ---------- Collaboration ----------
export const Addressee = z.enum(["engineering", "finance", "design", "quality", "market_pm", "purchasing", "other"]);
export type Addressee = z.infer<typeof Addressee>;

export const QuestionStatus = z.enum(["open", "answered", "dropped"]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const AnswerSource = z.enum(["meeting_note", "chat", "manual"]);
export type AnswerSource = z.infer<typeof AnswerSource>;

export const ReferralStatus = z.enum(["pending", "accepted", "declined", "escalated", "resolved"]);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

export const ObjectType = z.enum(["case", "requirement", "signal", "referral", "question", "plan", "profile", "workspace"]);
export type ObjectType = z.infer<typeof ObjectType>;

export const ProposalKind = z.enum(["field", "body", "question_answer", "new_question", "new_requirement"]);
export type ProposalKind = z.infer<typeof ProposalKind>;

export const ProposalSource = z.enum(["chat", "meeting_note", "monitor"]);
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
