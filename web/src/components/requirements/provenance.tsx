"use client";

import { BookOpen, FileQuestion, UserRound } from "lucide-react";
import { provenanceLabel, type Provenance, type Requirement } from "@/contracts";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

/**
 * Provenance shown inline: every sentence, target, criterion, assumption, scope, release and cost
 * says where it came from. Green = customer evidence, blue = the PM's own context, amber = assumption.
 */

const tone: Record<Provenance["source"], { chip: string; bar: string; line: string; icon: string }> = {
  evidence: {
    chip: "border-tone-emerald-bd bg-tone-emerald-bg text-tone-emerald-fg",
    bar: "bg-tone-emerald-dot",
    line: "decoration-tone-emerald-dot",
    icon: "text-tone-emerald-fg",
  },
  pm_context: {
    chip: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-fg",
    bar: "bg-tone-blue-dot",
    line: "decoration-tone-blue-dot",
    icon: "text-tone-blue-fg",
  },
  assumption: {
    chip: "border-tone-amber-bd bg-tone-amber-bg text-tone-amber-fg",
    bar: "bg-tone-amber-dot",
    line: "decoration-tone-amber-dot decoration-dashed",
    icon: "text-tone-amber-fg",
  },
};

const icon = { evidence: BookOpen, pm_context: UserRound, assumption: FileQuestion } as const;

export function provenanceMap(r: Pick<Requirement, "provenance">) {
  return new Map(r.provenance.map((p) => [p.path, p]));
}

export function ProvChip({ p, onCite, className }: { p: Provenance | undefined; onCite?: (ref: string) => void; className?: string }) {
  if (!p) return <span className={cn("rounded-full border border-dashed border-border-strong px-2 align-middle text-xs leading-4 text-muted-foreground", className)}>untagged</span>;
  const Icon = icon[p.source];
  const label = p.label.split(" · ").slice(-1)[0];
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <span className={cn("inline-flex max-w-[16rem] cursor-default items-center gap-1 rounded-full border px-2 py-px align-middle text-xs leading-4 font-medium", tone[p.source].chip, className)}>
          <Icon className="size-3 shrink-0" />
          <span className="truncate">{p.source === "evidence" ? `${p.signalIds.length || ""} ${p.signalIds.length === 1 ? "record" : "records"}`.trim() : label}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs" side="top">
        <div className="mb-1 font-semibold">{provenanceLabel[p.source]}</div>
        <p>{p.label}</p>
        {p.ref && <p className="mt-1 font-mono text-xs text-muted-foreground">{p.ref}</p>}
        {p.signalIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {p.signalIds.map((id) => (
              <button key={id} type="button" onClick={() => onCite?.(id)} className="rounded-sm border px-1.5 font-mono text-xs text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-muted">
                {id}
              </button>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/** A sentence with its provenance: underlined in the source colour, chip at the end. */
export function ProvText({ text, p, onCite }: { text: string; p: Provenance | undefined; onCite?: (ref: string) => void }) {
  return (
    <span>
      <span className={cn("underline decoration-2 underline-offset-4", p ? tone[p.source].line : "decoration-muted")}>{text}</span> <ProvChip p={p} onCite={onCite} />{" "}
    </span>
  );
}

export function ProvenanceLegend({ r }: { r: Pick<Requirement, "provenance"> }) {
  const n = { evidence: 0, pm_context: 0, assumption: 0 };
  r.provenance.forEach((p) => n[p.source]++);
  const total = r.provenance.length || 1;
  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
        {(Object.keys(n) as Provenance["source"][]).map((k) => (
          <div key={k} className={tone[k].bar} style={{ width: `${(n[k] / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(n) as Provenance["source"][]).map((k) => {
          const Icon = icon[k];
          return (
            <span key={k} className="inline-flex items-center gap-1">
              <Icon className={cn("size-3.5", tone[k].icon)} />
              <b className="font-semibold text-foreground">{n[k]}</b> {k === "evidence" ? "from evidence" : k === "pm_context" ? "from your context" : "assumptions"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
