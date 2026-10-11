"use client";

import Link from "next/link";
import { AlertTriangle, GitBranch, Sparkles, Users } from "lucide-react";
import type { Case } from "@/contracts";
import { cn } from "@/lib/utils";
import { EvidenceBars, OutcomeBadge } from "@/components/common/badges";
import { UserAvatar } from "@/components/common/people";

/** Board card: the short name, who owns it, how many customers, how strong the evidence. */
export function CaseCard({ c, score, rank, dragging }: { c: Case; score?: number; rank?: number; compact?: boolean; dragging?: boolean }) {
  const customers = c.figures.perMarket.reduce((s, m) => s + m.customers, 0);
  return (
    <Link
      href={`/cases/${c.id}`}
      title={c.title}
      className={cn(
        "block rounded-lg border bg-card p-3 text-left transition-colors duration-150 hover:border-border-strong",
        dragging && "rotate-1 border-border-strong shadow-md",
        c.outcome === "rejected" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-sm leading-snug font-semibold">{c.shortTitle}</span>
        {c.newSignalCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full border border-border px-1.5 text-xs leading-5 font-semibold text-foreground tabular-nums before:mr-0.5 before:size-1.5 before:rounded-full before:bg-ember before:content-['']" title="New signals">
            <Sparkles className="size-3" />
            {c.newSignalCount}
          </span>
        )}
        {c.marketConflict && c.state !== "decided" && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Market conflict" />}
        {c.originCaseId && <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-label="Linked case" />}
      </div>
      {c.outcome && (
        <div className="mt-1.5">
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
        {rank !== undefined && <span className="tabular-nums" title={score !== undefined ? `Score ${score.toFixed(2)}` : undefined}>#{rank}</span>}
        <EvidenceBars level={c.evidenceLevel} showLabel={false} />
      </div>
    </Link>
  );
}
