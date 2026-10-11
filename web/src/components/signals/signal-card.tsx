"use client";

import { useState } from "react";
import { ExternalLink, FileSpreadsheet } from "lucide-react";
import type { Signal } from "@/contracts";
import { agentLabel, marketLabel, signalKindLabel, sourceTypeLabel } from "@/contracts";
import { cn } from "@/lib/utils";
import { SyntheticTag, trustText } from "@/components/common/badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const kindBorder: Record<Signal["kind"], string> = {
  complaint: "border-l-negative",
  wish: "border-l-tone-blue-dot",
  like: "border-l-positive",
  competitor_fact: "border-l-chart-5",
  trend: "border-l-tone-sky-dot",
  innovation: "border-l-tone-fuchsia-dot",
};

/**
 * One signal: the quote first, one quiet line of provenance under it.
 * Details (ID, record pointer, trust, agent) sit in tooltips, not on the card.
 */
export function SignalCard({
  s,
  highlighted,
  selectable,
  selected,
  onSelect,
}: {
  s: Signal;
  highlighted?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = [sourceTypeLabel[s.sourceType], s.market !== "unknown" ? marketLabel[s.market] : null, s.powertrain !== "unknown" ? s.powertrain : null, s.publishedAt.slice(0, 4)].filter(Boolean);
  return (
    <div
      id={`signal-${s.id}`}
      className={cn("flex gap-3 rounded-lg border border-l-[3px] bg-card p-3.5 transition-colors duration-150", kindBorder[s.kind], highlighted && "ring-2 ring-primary", selected && "bg-muted")}
      title={`${s.id} · ${signalKindLabel[s.kind]}`}
    >
      {selectable && <Checkbox checked={selected} onCheckedChange={(v) => onSelect?.(!!v)} className="mt-0.5" aria-label={`Select ${s.id}`} />}
      <div className="min-w-0 flex-1">
        {s.metric && (
          <div className="mb-1 text-sm">
            <span className="font-semibold">{s.competitor}</span> · {s.metric.name}{" "}
            <span className="font-semibold tabular-nums">
              {s.metric.value.toLocaleString()} {s.metric.unit}
              {s.metric.cycle && ` ${s.metric.cycle}`}
            </span>
          </div>
        )}
        <button onClick={() => setOpen(!open)} className={cn("block text-left text-sm leading-relaxed", !open && "line-clamp-3")}>
          {s.quoteEn && s.quoteEn !== s.quote ? s.quoteEn : s.quote}
        </button>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{meta.join(" · ")}</span>
          {s.synthetic && <SyntheticTag />}
          <span className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help rounded-sm border border-border-strong px-1.5 font-mono text-xs leading-4 text-foreground/80">{s.trust}</span>
            </TooltipTrigger>
            <TooltipContent>
              Trust {s.trust}: {trustText[s.trust]} · {agentLabel[s.agent]}
            </TooltipContent>
          </Tooltip>
          {s.recordRef && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help" aria-label={`BMW record ${s.recordRef}`}>
                  <FileSpreadsheet className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="font-mono">{s.recordRef}</TooltipContent>
            </Tooltip>
          )}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="rounded-sm text-foreground transition-colors duration-150 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Open source">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function marketSummary(signals: Signal[]) {
  const by = new Map<string, number>();
  signals.forEach((s) => by.set(s.market, (by.get(s.market) ?? 0) + 1));
  return [...by.entries()].map(([m, n]) => `${marketLabel[m as keyof typeof marketLabel]} ${n}`).join(" · ");
}
