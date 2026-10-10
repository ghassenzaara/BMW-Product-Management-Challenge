"use client";

import Link from "next/link";
import { AlertTriangle, GitBranch, MessageSquareQuote, Sparkles } from "lucide-react";
import type { Case } from "@/contracts";
import { carAreaLabel } from "@/contracts";
import { cn } from "@/lib/utils";
import { EvidenceBadge, MarketChip, OutcomeBadge, Pill, ScoreBar } from "@/components/common/badges";
import { UserAvatar } from "@/components/common/people";

export function CaseCard({ c, score, rank, compact, dragging }: { c: Case; score?: number; rank?: number; compact?: boolean; dragging?: boolean }) {
  return (
    <Link
      href={`/cases/${c.id}`}
      className={cn(
        "block rounded-lg border bg-card p-3 text-left shadow-xs transition hover:border-primary/50 hover:shadow-sm",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
        c.outcome === "rejected" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {rank !== undefined && <span className="font-mono font-semibold text-foreground">#{rank}</span>}
        <span className="font-mono">{c.id}</span>
        <span className="flex-1" />
        {c.newSignalCount > 0 && (
          <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1 text-primary" title="New signals since you last looked">
            <Sparkles className="size-3" />
            {c.newSignalCount}
          </span>
        )}
        {c.marketConflict && c.state !== "decided" && <AlertTriangle className="size-3.5 text-amber-500" aria-label="Market conflict" />}
        {c.originCaseId && <GitBranch className="size-3.5" aria-label="Linked case" />}
      </div>
      <div className={cn("mt-1 text-sm leading-snug font-medium", compact ? "line-clamp-2" : "line-clamp-3")}>{c.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {c.outcome && <OutcomeBadge outcome={c.outcome} />}
        <Pill>{carAreaLabel[c.carArea]}</Pill>
        {c.markets
          .filter((m) => m !== "unknown")
          .slice(0, 3)
          .map((m) => (
            <MarketChip key={m} market={m} muted />
          ))}
        {c.scope === "CN" && <Pill t="red">China</Pill>}
      </div>
      {score !== undefined && <ScoreBar value={score} className="mt-2.5" />}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <UserAvatar id={c.ownerId} size="xs" />
        <span className="flex items-center gap-0.5">
          <MessageSquareQuote className="size-3" />
          {c.signalIds.length}
        </span>
        <span className="flex-1" />
        {!compact && <EvidenceBadge level={c.evidenceLevel} />}
      </div>
    </Link>
  );
}
