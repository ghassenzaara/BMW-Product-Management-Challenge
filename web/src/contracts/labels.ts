import type {
  Addressee,
  Agent,
  Ambition,
  BriefFieldKey,
  CarArea,
  CaseOutcome,
  CaseState,
  CaseType,
  ChangeAmbition,
  ChangeDepth,
  CheckKind,
  ContextLayer,
  CostSensitivity,
  EvidenceEffect,
  EvidenceLevel,
  FactorKey,
  FeedbackResponse,
  InnovationHorizon,
  InsideKind,
  Market,
  PlanAction,
  Positioning,
  ProvenanceSource,
  Region,
  ReleaseTarget,
  RequirementStatus,
  Series,
  ShapeKey,
  SignalKind,
  SourceType,
  TargetCustomer,
  ImpactVerdict,
  PortfolioRow,
  RippleDecisionKind,
  ClassificationMethod,
} from "./enums";

/** Display labels for contract enums. UI-only; the API exchanges the keys. */

export const contextLayerLabel: Record<ContextLayer, string> = {
  brand: "Brand",
  series_brief: "Your product specs",
  case_stance: "Your context",
  requirement_shape: "Your answer",
  feedback: "Feedback",
};

export const provenanceLabel: Record<ProvenanceSource, string> = { evidence: "Evidence", pm_context: "Your context", assumption: "Assumption" };

export const briefFieldLabel: Record<BriefFieldKey, string> = {
  thesis: "Thesis for the successor",
  targetCustomer: "Target customer",
  marketWeights: "Market weights",
  changeAmbition: "Evolution or revolution",
  protectList: "Protect list",
  dontFightOn: "Don't fight on",
  givens: "Already decided",
  costEnvelope: "Cost envelope",
};

export const briefFieldQuestion: Record<BriefFieldKey, string> = {
  thesis: "In one sentence: what must the successor be?",
  targetCustomer: "Keep today's owners, or win buyers from competitors? And at which tier?",
  marketWeights: "How much does each market count? (pre-filled from 2030 sales)",
  changeAmbition: "Evolution or revolution: how many real innovations does the successor get?",
  protectList: "Which strengths must not change?",
  dontFightOn: "Where do we deliberately not compete?",
  givens: "What is already decided (platform, SOP, frozen parts), and which releases are still open?",
  costEnvelope: "How sensitive is the cost envelope, and what is the rough budget per car?",
};

export const targetCustomerLabel: Record<TargetCustomer, string> = { keep_owners: "Keep today's owners", conquest: "Win buyers from competitors", both: "Both" };
export const positioningLabel: Record<Positioning, string> = { base: "Base", premium: "Premium", luxury: "Luxury" };
export const changeAmbitionLabel: Record<ChangeAmbition, string> = { evolution: "Evolution", balanced: "Balanced", revolution: "Revolution" };
export const costSensitivityLabel: Record<CostSensitivity, string> = { low: "Low", medium: "Medium", high: "High" };
export const ambitionLabel: Record<Ambition, string> = { fix: "Fix the problem", match: "Match the best competitor", beat: "Beat the best competitor" };
export const shapeKeyLabel: Record<ShapeKey, string> = { scope: "Scope", benchmark: "Benchmark", solution: "Solution", release: "Release", offer: "Offer" };
export const evidenceEffectLabel: Record<EvidenceEffect, string> = { discount: "Discount", focus: "Focus on" };
export const insideKindLabel: Record<InsideKind, string> = { past_decision: "Past decision", supplier_tech: "Supplier tech", engineering_on_it: "Engineering already on it", other: "Other" };
export const feedbackResponseLabel: Record<FeedbackResponse, string> = { accept: "Accept", push_back: "Push back", compromise: "Compromise" };

export const seriesLabel: Record<Series, string> = {
  G60: "5 Series (G60)",
  F70: "1 Series (F70)",
  G70: "7 Series (G70)",
};

export const checkKindLabel: Record<CheckKind, string> = {
  vague_word: "Vague wording",
  missing_scope: "Scope",
  out_of_scope: "Out of scope",
  duplicate: "Duplicate",
  conflict: "Conflict",
  baukasten: "Baukasten",
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
  pm: "Added by a PM",
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
  pm_upload: "Uploaded file",
  pm_link: "Link",
  pm_note: "PM note",
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

export const verdictLabel: Record<ImpactVerdict, string> = {
  behind: "Behind",
  at_par: "At par",
  still_ahead: "Still ahead",
  not_comparable: "Not comparable",
};

export const portfolioRowLabel: Record<PortfolioRow, string> = {
  G60: "5 Series (G60)",
  G60_CN: "5 Series China (G68)",
  G70: "7 Series (G70)",
  F70: "1 Series (F70)",
};

export const rippleDecisionLabel: Record<RippleDecisionKind, string> = {
  raise_target: "Raise target",
  keep: "Keep, with reason",
  market_variant: "Create market variant",
  reopen_case: "Reopen case",
};

export const classificationLabel: Record<ClassificationMethod, string> = {
  bmw_label: "BMW label (VFC lookup)",
  llm: "Model",
  manual: "Set by a person",
};
