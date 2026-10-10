import type {
  Addressee,
  Agent,
  CarArea,
  CaseOutcome,
  CaseState,
  CaseType,
  ChangeDepth,
  EvidenceLevel,
  FactorKey,
  InnovationHorizon,
  Market,
  PlanAction,
  Region,
  ReleaseTarget,
  RequirementStatus,
  Series,
  SignalKind,
  SourceType,
} from "./enums";

/** Display labels for contract enums. UI-only; the API exchanges the keys. */

export const seriesLabel: Record<Series, string> = {
  G60: "5 Series (G60)",
  F70: "1 Series (F70)",
  G70: "7 Series (G70)",
};

export const seriesShort: Record<Series, string> = { G60: "5 Series", F70: "1 Series", G70: "7 Series" };

export const marketLabel: Record<Market, string> = {
  EU: "Europe",
  US: "USA",
  CN: "China",
  RoW: "Rest of World",
  unknown: "Unknown",
};

export const regionLabel: Record<Region, string> = { global: "Global", RoW: "Rest of World", CN: "China" };

export const caseStateLabel: Record<CaseState, string> = {
  observed: "Observed",
  new: "New",
  investigating: "Investigating",
  awaiting_answers: "Awaiting answers",
  ready: "Ready to decide",
  decided: "Decided",
};

export const caseOutcomeLabel: Record<CaseOutcome, string> = {
  confirmed: "Confirmed",
  referred: "Referred",
  innovation_pool: "Innovation pool",
  parked: "Parked",
  merged: "Merged",
  rejected: "Rejected",
};

export const requirementStatusLabel: Record<RequirementStatus, string> = {
  draft: "Draft",
  in_discussion: "In discussion",
  pm_approved: "PM approved",
  signed_off: "Signed off",
  planned: "Planned",
  exported: "Exported",
  rejected: "Rejected",
};

export const carAreaLabel: Record<CarArea, string> = {
  exterior_design: "Exterior, design & lighting",
  interior_comfort: "Interior & comfort",
  seats: "Seats",
  climate: "Climate",
  infotainment_hmi: "Infotainment & HMI",
  connectivity_digital: "Connectivity & digital",
  driver_assistance: "Driver assistance & safety",
  dynamics_powertrain: "Driving dynamics & powertrain",
  range_charging: "Range, charging & refuelling",
  practicality: "Practicality & access",
  quality_materials: "Quality & materials",
};

export const caseTypeLabel: Record<CaseType, string> = {
  new_feature: "New feature",
  fix_improve: "Fix / improve",
  performance_target: "Performance target",
  quality_perception: "Quality perception",
  market_variant: "Market variant",
  brand_differentiator: "Brand differentiator",
  regression: "Regression",
};

export const changeDepthLabel: Record<ChangeDepth, string> = {
  trim_option: "Trim / option",
  part_module: "Part / module",
  platform_powertrain: "Platform / powertrain",
  software_ota: "Software / OTA",
};

export const releaseLabel: Record<ReleaseTarget, string> = {
  next_gen: "Next generation",
  lci: "Mid-life update (LCI)",
  ota: "Over the air",
};

export const factorLabel: Record<FactorKey, string> = {
  customers: "Distinct customers",
  severity: "Severity",
  satisfaction_gap: "Satisfaction gap",
  competitor_gap: "Competitor gap",
  market_volume: "Market volume 2030",
  regression: "Regression vs predecessor",
  trend: "Trend",
  brand_fit: "Brand fit",
};

export const factorHint: Record<FactorKey, string> = {
  customers: "Distinct verbatims and web authors, log-scaled. Not views or likes.",
  severity: "Defect > difficult to use > wish.",
  satisfaction_gap: "Linked study attribute: low mean (EU/CN) or high bottom-3 (US).",
  competitor_gap: "Share of benchmark competitors that already offer it.",
  market_volume: "2030 sales share of the markets the evidence comes from.",
  regression: "Customers lost something the predecessor had.",
  trend: "External trend and innovation signals.",
  brand_fit: "AI-proposed, PM-confirmed fit with BMW brand pillars.",
};

export const evidenceLabel: Record<EvidenceLevel, string> = {
  high: "High evidence",
  medium: "Medium evidence",
  low: "Low evidence",
  assumption: "Assumption",
};

export const agentLabel: Record<Agent, string> = {
  bmw_data: "BMW data",
  competitor: "Competitor agent",
  customer_public: "Customer & public",
  trends: "Trends agent",
  innovation_scout: "Innovation scout",
};

export const sourceTypeLabel: Record<SourceType, string> = {
  bmw_feedback: "BMW feedback",
  bmw_study: "Customer study",
  bmw_sales: "Sales volumes",
  option_list: "Option list",
  review: "Pro review",
  video: "Video",
  forum: "Owner forum",
  social: "Social",
  news: "News",
  competitor_official: "Competitor official",
  trend_report: "Trend report",
  trade_fair: "Trade fair",
};

export const signalKindLabel: Record<SignalKind, string> = {
  complaint: "Complaint",
  wish: "Wish",
  like: "Like",
  competitor_fact: "Competitor fact",
  trend: "Trend",
  innovation: "Innovation",
};

export const addresseeLabel: Record<Addressee, string> = {
  engineering: "Engineering",
  finance: "Finance / controlling",
  design: "Design",
  quality: "Quality",
  market_pm: "Market PM",
  purchasing: "Purchasing",
  other: "Other",
};

export const planActionLabel: Record<PlanAction, string> = {
  keep: "Keep",
  new: "New",
  improve: "Improve",
  remove: "Remove",
};

export const horizonLabel: Record<InnovationHorizon, string> = {
  next_gen: "Next generation",
  gen_after: "Generation after",
  new_product: "New product",
};
