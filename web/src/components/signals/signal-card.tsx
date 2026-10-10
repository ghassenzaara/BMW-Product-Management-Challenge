"use client";

import { ExternalLink, FileSpreadsheet } from "lucide-react";
import type { Signal } from "@/contracts";
import { agentLabel, marketLabel, signalKindLabel, sourceTypeLabel } from "@/contracts";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MarketChip, Pill, SyntheticTag, TrustBadge, type Tone } from "@/components/common/badges";
import { Checkbox } from "@/components/ui/checkbox";

const kindTone: Record<Signal["kind"], Tone> = {
  complaint: "red",
  wish: "amber",
  like: "emerald",
  competitor_fact: "violet",
  trend: "sky",
  innovation: "fuchsia",
};

export function SignalCard({
  s,
  highlighted,
  selectable,
  selected,
  onSelect,
  compact,
}: {
  s: Signal;
  highlighted?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  compact?: boolean;
}) {
  const severity = s.severity === "defect" ? "Defect" : s.severity === "difficult_to_use" ? "Difficult to use" : null;
  return (
    <div id={`signal-${s.id}`} className={cn("rounded-lg border bg-card p-3 transition", highlighted && "ring-2 ring-primary", selected && "border-primary/60 bg-primary/5")}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {selectable && <Checkbox checked={selected} onCheckedChange={(v) => onSelect?.(!!v)} className="mr-1" aria-label={`Select ${s.id}`} />}
        <span className="font-mono font-medium">{s.id}</span>
        <Pill t={kindTone[s.kind]}>{signalKindLabel[s.kind]}</Pill>
        {severity && <Pill t="outline">{severity}</Pill>}
        <MarketChip market={s.market} />
        {s.marketBasis === "inferred" && <span className="text-muted-foreground" title="Market inferred, not stated">(inferred)</span>}
        {s.powertrain !== "unknown" && <Pill>{s.powertrain}</Pill>}
        <TrustBadge trust={s.trust} />
        {s.synthetic && <SyntheticTag />}
        <span className="flex-1" />
        <span className="text-muted-foreground">{fmtDate(s.publishedAt)}</span>
      </div>
      <blockquote className={cn("mt-2 border-l-2 pl-3 text-sm leading-relaxed", s.kind === "like" ? "border-emerald-400" : s.kind === "complaint" ? "border-red-400" : "border-muted-foreground/40", compact && "line-clamp-3")}>
        {s.quote}
        {s.quoteEn && s.quoteEn !== s.quote && <span className="mt-1 block text-xs text-muted-foreground">EN: {s.quoteEn}</span>}
      </blockquote>
      {s.metric && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-violet-50 px-2 py-1 text-xs dark:bg-violet-950/50">
          <span className="font-medium">{s.competitor}</span> {s.metric.name}: <span className="font-mono font-semibold">{s.metric.value.toLocaleString()} {s.metric.unit}</span>
          {s.metric.cycle && <Pill>{s.metric.cycle}</Pill>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{s.sourceName}</span>
        <span>· {sourceTypeLabel[s.sourceType]}</span>
        <span>· {agentLabel[s.agent]}</span>
        {s.audience !== "owner" && <span>· {s.audience}</span>}
        {s.reach !== undefined && (
          <span title="Stored but not used as weight: reach is not relevance">
            · {s.reach.toLocaleString()} {s.reachUnit}
          </span>
        )}
        {s.country && <span>· {s.country}</span>}
        <span className="flex-1" />
        {s.recordRef && (
          <span className="flex items-center gap-1 font-mono" title="Pointer into the provided BMW data">
            <FileSpreadsheet className="size-3" />
            {s.recordRef}
          </span>
        )}
        {s.url && (
          <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            Source <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function marketSummary(signals: Signal[]) {
  const by = new Map<string, number>();
  signals.forEach((s) => by.set(s.market, (by.get(s.market) ?? 0) + 1));
  return [...by.entries()].map(([m, n]) => `${marketLabel[m as keyof typeof marketLabel]} ${n}`).join(" · ");
}
