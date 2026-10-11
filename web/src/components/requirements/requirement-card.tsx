"use client";

import Link from "next/link";
import type { Requirement } from "@/contracts";
import { cn } from "@/lib/utils";
import { EvidenceBadge, Pill, RegionChip, ReleaseChip, ReqStatusBadge, ScoreBar } from "@/components/common/badges";
import { UserAvatar } from "@/components/common/people";

export function RequirementCard({ r, score, rank, className }: { r: Requirement; score?: number; rank?: number; className?: string }) {
  return (
    <Link href={`/requirements/${r.id}`} className={cn("block rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-border-strong", r.status === "rejected" && "opacity-60", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {rank !== undefined && <span className="font-mono font-semibold text-foreground">#{rank}</span>}
        <span className="font-mono">{r.id}</span>
        <span className="flex-1" />
        <ReqStatusBadge status={r.status} />
      </div>
      <div className="mt-1 line-clamp-3 text-sm leading-snug font-medium">{r.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <ReleaseChip release={r.releaseTarget} />
        <RegionChip region={r.marketScope} />
        <Pill title={`${r.cost.eurBand} · ${r.cost.source.replace("_", " ")}`}>Cost {r.cost.size}</Pill>
        <EvidenceBadge level={r.evidenceLevel} />
      </div>
      {score !== undefined && <ScoreBar value={score} className="mt-2.5" />}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <UserAvatar id={r.ownerId} size="xs" />
        <span className="font-mono">← {r.caseId}</span>
        {r.sentBackReason && <Pill t="amber">sent back</Pill>}
      </div>
    </Link>
  );
}
