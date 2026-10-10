"use client";

import Link from "next/link";
import { AlertTriangle, GitBranch, Sparkles, Users } from "lucide-react";
import type { Case } from "@/contracts";
import { cn } from "@/lib/utils";
import { EvidenceBars, OutcomeBadge } from "@/components/common/badges";
import { UserAvatar } from "@/components/common/people";

export function CaseCard({ c, score, rank, dragging }: { c: Case; score?: number; rank?: number; compact?: boolean; dragging?: boolean }) {
  const customers = c.figures.perMarket.reduce((s, m) => s + m.customers, 0);
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
          <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1 text-primary" title="New signals">
            <Sparkles className="size-3" />
            {c.newSignalCount}
          </span>
        )}
        {c.marketConflict && c.state !== "decided" && <AlertTriangle className="size-3.5 text-amber-500" aria-label="Market conflict" />}
        {c.originCaseId && <GitBranch className="size-3.5" aria-label="Linked case" />}
      </div>
      <div className="mt-1 line-clamp-2 text-sm leading-snug font-medium">{c.title}</div>
      {c.outcome && (
        <div className="mt-2">
          <OutcomeBadge outcome={c.outcome} />
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <UserAvatar id={c.ownerId} size="xs" />
        <span className="flex items-center gap-1 tabular-nums" title="Customers">
          <Users className="size-3.5" />
          {customers}
        </span>
        <span className="flex-1" />
        <EvidenceBars level={c.evidenceLevel} showLabel={false} />
      </div>
      {score !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" title={`Score ${score.toFixed(2)}`}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
        </div>
      )}
    </Link>
  );
}
