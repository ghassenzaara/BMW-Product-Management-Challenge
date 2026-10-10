import { cn } from "@/lib/utils";
import {
  caseOutcomeLabel,
  caseStateLabel,
  carAreaLabel,
  caseTypeLabel,
  changeDepthLabel,
  evidenceLabel,
  regionLabel,
  releaseLabel,
  requirementStatusLabel,
  type CarArea,
  type CaseOutcome,
  type CaseState,
  type CaseType,
  type ChangeDepth,
  type EvidenceLevel,
  type Market,
  type Region,
  type ReleaseTarget,
  type RequirementStatus,
  type Trust,
} from "@/contracts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const pill = "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap";

const tone = {
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
  fuchsia: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  outline: "border-border text-muted-foreground",
} as const;
export type Tone = keyof typeof tone;

export function Pill({ t = "outline", className, children, title }: { t?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span className={cn(pill, tone[t], className)} title={title}>
      {children}
    </span>
  );
}

export const caseStateTone: Record<CaseState, Tone> = {
  observed: "slate",
  new: "sky",
  investigating: "violet",
  awaiting_answers: "amber",
  ready: "emerald",
  decided: "slate",
};
export const outcomeTone: Record<CaseOutcome, Tone> = {
  confirmed: "emerald",
  referred: "violet",
  innovation_pool: "fuchsia",
  parked: "amber",
  merged: "slate",
  rejected: "red",
};
export const reqTone: Record<RequirementStatus, Tone> = {
  draft: "slate",
  in_discussion: "amber",
  pm_approved: "sky",
  signed_off: "emerald",
  planned: "blue",
  exported: "teal",
  rejected: "red",
};

export const CaseStateBadge = ({ state }: { state: CaseState }) => <Pill t={caseStateTone[state]}>{caseStateLabel[state]}</Pill>;
export const OutcomeBadge = ({ outcome }: { outcome: CaseOutcome }) => <Pill t={outcomeTone[outcome]}>{caseOutcomeLabel[outcome]}</Pill>;
export const ReqStatusBadge = ({ status }: { status: RequirementStatus }) => <Pill t={reqTone[status]}>{requirementStatusLabel[status]}</Pill>;

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const t: Record<EvidenceLevel, Tone> = { high: "emerald", medium: "sky", low: "amber", assumption: "red" };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Pill t={t[level]}>{evidenceLabel[level]}</Pill>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">How sure we are, not how important. High = at least two independent source types and enough customers in the target market. Kept separate from the score.</TooltipContent>
    </Tooltip>
  );
}

export const MarketChip = ({ market, muted }: { market: Market; muted?: boolean }) => (
  <Pill t={muted ? "outline" : market === "CN" ? "red" : market === "US" ? "blue" : market === "EU" ? "sky" : "slate"}>{market === "unknown" ? "?" : market}</Pill>
);
export const RegionChip = ({ region }: { region: Region }) => <Pill t={region === "CN" ? "red" : region === "RoW" ? "sky" : "outline"}>{regionLabel[region]}</Pill>;
export const AreaChip = ({ area }: { area: CarArea }) => <Pill>{carAreaLabel[area]}</Pill>;
export const TypeChip = ({ type }: { type: CaseType }) => <Pill>{caseTypeLabel[type]}</Pill>;
export const DepthChip = ({ depth }: { depth: ChangeDepth }) => <Pill>{changeDepthLabel[depth]}</Pill>;
export const ReleaseChip = ({ release }: { release: ReleaseTarget }) => <Pill t={release === "ota" ? "teal" : release === "lci" ? "amber" : "blue"}>{releaseLabel[release]}</Pill>;

export function TrustBadge({ trust }: { trust: Trust }) {
  const text: Record<Trust, string> = {
    A: "A · BMW data",
    B: "B · official / primary source",
    C: "C · professional review or press",
    D: "D · owner forum / social",
    E: "E · announcement = assumption",
  };
  const t: Record<Trust, Tone> = { A: "emerald", B: "sky", C: "slate", D: "amber", E: "red" };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Pill t={t[trust]}>Trust {trust}</Pill>
        </span>
      </TooltipTrigger>
      <TooltipContent>{text[trust]}</TooltipContent>
    </Tooltip>
  );
}

export function SyntheticTag({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(pill, "border-dashed border-muted-foreground/40 text-muted-foreground", className)}>synthetic</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">Invented for the demo. Real BMW records (verbatims, study, sales) carry no tag. Web links point to the source site, not a real post.</TooltipContent>
    </Tooltip>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}
