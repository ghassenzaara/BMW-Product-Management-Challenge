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

const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-px text-xs font-medium leading-4 whitespace-nowrap";

const tone = {
  slate: "border-tone-slate-bd bg-tone-slate-bg text-tone-slate-fg",
  sky: "border-tone-sky-bd bg-tone-sky-bg text-tone-sky-fg",
  violet: "border-tone-violet-bd bg-tone-violet-bg text-tone-violet-fg",
  amber: "border-tone-amber-bd bg-tone-amber-bg text-tone-amber-fg",
  emerald: "border-tone-emerald-bd bg-tone-emerald-bg text-tone-emerald-fg",
  red: "border-tone-red-bd bg-tone-red-bg text-tone-red-fg",
  fuchsia: "border-tone-fuchsia-bd bg-tone-fuchsia-bg text-tone-fuchsia-fg",
  blue: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-fg",
  teal: "border-tone-teal-bd bg-tone-teal-bg text-tone-teal-fg",
  outline: "border-border bg-card text-muted-foreground",
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

const dotColor: Record<Tone, string> = {
  slate: "bg-tone-slate-dot",
  sky: "bg-tone-sky-dot",
  violet: "bg-tone-violet-dot",
  amber: "bg-tone-amber-dot",
  emerald: "bg-tone-emerald-dot",
  red: "bg-tone-red-dot",
  fuchsia: "bg-tone-fuchsia-dot",
  blue: "bg-tone-blue-dot",
  teal: "bg-tone-teal-dot",
  outline: "bg-muted-foreground/50",
};
/** Quiet status for lists: a coloured dot plus a short word, no box. */
export function StatusDot({ t, children, className }: { t: Tone; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground", className)}>
      <span className={cn("size-2 rounded-full", dotColor[t])} aria-hidden />
      {children}
    </span>
  );
}
export const CaseStateDot = ({ state }: { state: CaseState }) => <StatusDot t={caseStateTone[state]}>{caseStateLabel[state]}</StatusDot>;
export const ReqStatusDot = ({ status }: { status: RequirementStatus }) => <StatusDot t={reqTone[status]}>{requirementStatusLabel[status]}</StatusDot>;

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

/** Evidence strength as signal bars (friend's design): 3 = strong, 0 = assumption only. */
export function EvidenceBars({ level, showLabel = true }: { level: EvidenceLevel; showLabel?: boolean }) {
  const n = { high: 3, medium: 2, low: 1, assumption: 0 }[level];
  const label = { high: "Strong evidence", medium: "Medium evidence", low: "Weak evidence", assumption: "Assumption" }[level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-3 w-1.5 rounded-[2px]", i < n ? (n === 3 ? "bg-positive" : n === 2 ? "bg-tone-sky-fg" : "bg-warning") : "bg-border-strong")} />
            ))}
          </span>
          {showLabel ? label : <span className="sr-only">{label}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">How sure we are, not how important. Strong = at least two independent source types and enough customers in the target market.</TooltipContent>
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

export const trustText: Record<Trust, string> = {
  A: "BMW data",
  B: "official / primary source",
  C: "professional review or press",
  D: "owner forum / social",
  E: "announcement = assumption",
};

export function TrustBadge({ trust }: { trust: Trust }) {
  const text: Record<Trust, string> = Object.fromEntries(Object.entries(trustText).map(([k, v]) => [k, `${k} · ${v}`])) as Record<Trust, string>;
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
        <div className="h-full rounded-full bg-foreground/80" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}
