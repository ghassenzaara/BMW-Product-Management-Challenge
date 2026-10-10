"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Scale } from "lucide-react";
import { CaseState as CaseStates, caseStateLabel, caseOutcomeLabel, requirementStatusLabel, type CaseOutcome, type RequirementStatus } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/common/page";
import { Pill, ReqStatusBadge, ScoreBar } from "@/components/common/badges";
import { AvatarStack, UserAvatar, useUsers } from "@/components/common/people";

const stateColor: Record<string, string> = {
  observed: "bg-slate-300",
  new: "bg-sky-400",
  investigating: "bg-violet-400",
  awaiting_answers: "bg-amber-400",
  ready: "bg-emerald-400",
  decided: "bg-slate-500",
};

export function PortfolioView() {
  const { data } = useApi("portfolio");
  const { name } = useUsers();
  if (!data) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="Portfolio" description="All series and markets at a glance: where cases and requirements stand, what's ranked on top, what is stuck, and who carries the load." />
      <div className="space-y-4 p-6">
        <div className="grid gap-4 xl:grid-cols-3">
          {data.series.map((s) => {
            const total = Object.values(s.casesByState).reduce((a, b) => a + b, 0) || 1;
            const vol = Object.values(s.volume2030).reduce((a, b) => a + b, 0);
            return (
              <div key={s.series} className="space-y-4 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/plan/${s.series}`} className="text-base font-semibold hover:underline">
                      {s.name} <span className="font-mono text-xs text-muted-foreground">{s.series}</span>
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      2030 volume {num(vol)} · {Object.entries(s.volume2030).map(([m, v]) => `${m} ${Math.round((v / vol) * 100)}%`).join(" · ")}
                    </div>
                  </div>
                  <AvatarStack ids={s.ownerIds} />
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cases by stage</div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    {CaseStates.options.map((st) => (
                      <div key={st} className={stateColor[st]} style={{ width: `${(s.casesByState[st] / total) * 100}%` }} title={`${caseStateLabel[st]}: ${s.casesByState[st]}`} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {CaseStates.options.map((st) => (
                      <span key={st} className="flex items-center gap-1">
                        <span className={cn("size-2 rounded-full", stateColor[st])} />
                        {caseStateLabel[st]} {s.casesByState[st]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.entries(s.casesByOutcome).map(([o, n]) => (
                      <Pill key={o}>
                        {caseOutcomeLabel[o as CaseOutcome]} {n}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Requirements</div>
                  <div className="flex flex-wrap gap-1">
                    {(Object.entries(s.requirementsByStatus) as [RequirementStatus, number][])
                      .filter(([, n]) => n > 0)
                      .map(([st, n]) => (
                        <Pill key={st}>
                          {requirementStatusLabel[st]} {n}
                        </Pill>
                      ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Top requirements (default weights)</div>
                  <ul className="space-y-1.5">
                    {s.topRequirements.map((r) => (
                      <li key={r.id}>
                        <Link href={`/requirements/${r.id}`} className="block rounded p-1 hover:bg-muted/60">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono">{r.id}</span>
                            <ReqStatusBadge status={r.status} />
                          </div>
                          <div className="truncate text-sm">{r.title}</div>
                          <ScoreBar value={r.score} className="mt-0.5" />
                        </Link>
                      </li>
                    ))}
                    {s.topRequirements.length === 0 && <li className="text-xs text-muted-foreground">None yet.</li>}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={cn("flex items-center gap-1", s.conflicts && "text-amber-600")}>
                    <Scale className="size-3.5" /> {s.conflicts} market conflicts
                  </span>
                  <span className={cn("flex items-center gap-1", s.openAlerts && "text-amber-600")}>
                    <AlertTriangle className="size-3.5" /> {s.openAlerts} open alerts
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" /> {s.staleCases} stale (&gt;14 days)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Workload by PM</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">PM</th>
                <th className="px-4 py-2 font-medium">Active cases</th>
                <th className="px-4 py-2 font-medium">Open questions</th>
                <th className="px-4 py-2 font-medium">Referrals waiting</th>
                <th className="px-4 py-2 font-medium">Awaiting your sign-off</th>
              </tr>
            </thead>
            <tbody>
              {data.workload.map((w) => (
                <tr key={w.userId} className="border-t">
                  <td className="px-4 py-2">
                    <Link href={`/cases?owner=${w.userId}`} className="flex items-center gap-2 hover:underline">
                      <UserAvatar id={w.userId} size="xs" /> {name(w.userId)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono">{w.activeCases}</td>
                  <td className="px-4 py-2 font-mono">{w.openQuestions}</td>
                  <td className="px-4 py-2 font-mono">{w.pendingReferrals}</td>
                  <td className="px-4 py-2 font-mono">{w.awaitingSignOff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
