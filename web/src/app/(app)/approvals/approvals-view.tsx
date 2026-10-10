"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CornerUpLeft } from "lucide-react";
import { marketLabel, type Case, type Referral, type Requirement, type RequirementAction } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/common/page";
import { EvidenceBadge, Pill, RegionChip, ReleaseChip } from "@/components/common/badges";
import { UserAvatar, useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { useScores } from "@/components/cases/use-scores";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ApprovalsView() {
  const { data: reqs = [] } = useApi("requirements");
  const { data: referrals = [] } = useApi("referrals");
  const { data: cases = [] } = useApi("cases");
  const scores = useScores();
  const queue = reqs.filter((r) => r.status === "pm_approved").sort((a, b) => (scores.reqs.get(a.id)?.rank ?? 99) - (scores.reqs.get(b.id)?.rank ?? 99));
  const escalations = referrals.filter((r) => r.kind === "escalation");
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const pendingEsc = escalations.filter((r) => r.status === "pending");

  return (
    <div>
      <PageHeader title="Approvals" description="Sign off what goes into the successor and decide conflicts the PMs could not resolve between them." />
      <Tabs defaultValue="signoff" className="p-6">
        <TabsList>
          <TabsTrigger value="signoff">Sign-off queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="escalations">Escalations ({pendingEsc.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="signoff" className="space-y-3 pt-4">
          {queue.length === 0 && <Empty title="Nothing waiting for sign-off" />}
          {queue.map((r) => (
            <SignOffRow key={r.id} r={r} c={caseById.get(r.caseId)} rank={scores.reqs.get(r.id)?.rank} />
          ))}
        </TabsContent>
        <TabsContent value="escalations" className="space-y-3 pt-4">
          {escalations.length === 0 && <Empty title="No escalations" />}
          {escalations.map((e) => (
            <EscalationRow key={e.id} e={e} c={caseById.get(e.caseId)} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SignOffRow({ r, c, rank }: { r: Requirement; c?: Case; rank?: number }) {
  const { name } = useUsers();
  const [action, setAction] = useState<RequirementAction | null>(null);
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4">
      <div className="w-10 text-center">
        <div className="font-mono text-lg font-semibold">#{rank ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground">rank</div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{r.id}</span>
          <ReleaseChip release={r.releaseTarget} />
          <RegionChip region={r.marketScope} />
          <EvidenceBadge level={r.evidenceLevel} />
          <Pill>
            Cost {r.cost.size} · {r.cost.eurBand}
          </Pill>
          <span className="flex items-center gap-1">
            <UserAvatar id={r.ownerId} size="xs" /> {name(r.ownerId)}
          </span>
        </div>
        <Link href={`/requirements/${r.id}`} className="block text-base font-semibold hover:underline">
          {r.title}
        </Link>
        <p className="text-sm text-muted-foreground">{r.description}</p>
        <ul className="text-xs">
          {r.metrics.map((m) => (
            <li key={m.id}>
              • {m.question}: <b>{m.target}</b> <span className="text-muted-foreground">({m.basis})</span>
            </li>
          ))}
        </ul>
        {c && (
          <p className="text-xs text-muted-foreground">
            From <Link href={`/cases/${c.id}`} className="font-mono text-primary hover:underline">{c.id}</Link>: {c.signalIds.length} signals · brand fit {c.brandFit.value.toFixed(2)} · {c.figures.perMarket.map((m) => `${m.market} ${m.customers}`).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setAction("send_back")}>
          <CornerUpLeft className="size-3.5" /> Send back
        </Button>
        <Button size="sm" onClick={() => setAction("sign_off")}>
          <Check className="size-3.5" /> Sign off
        </Button>
      </div>
      <RequirementActionDialog r={r} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </div>
  );
}

const resolutions = [
  ["variant", "Build a market variant", "e.g. a China-specific trim or long-wheelbase version; the other market keeps its spec"],
  ["one_market", "Prioritize one market", "Follow the market with more 2030 volume or strategic weight; the other is informed"],
  ["keep_both", "Keep both open", "Not decidable yet; ask for more evidence (research, study)"],
] as const;

function EscalationRow({ e, c }: { e: Referral; c?: Case }) {
  const { name } = useUsers();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<(typeof resolutions)[number][0]>("variant");
  const decide = useApiMutation("decideReferral", { success: "Escalation resolved; both PMs notified" });
  const pending = e.status === "pending";
  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-4", !pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <AlertTriangle className="size-4 text-amber-500" />
        <span className="font-medium">Escalation from {name(e.fromUserId)}</span>
        <Pill t={pending ? "amber" : "emerald"}>{e.status}</Pill>
        <span className="text-xs text-muted-foreground">{fromNow(e.createdAt)}</span>
      </div>
      {c && (
        <>
          <Link href={`/cases/${c.id}`} className="block text-base font-semibold hover:underline">
            {c.id} · {c.title}
          </Link>
          <p className="text-sm text-muted-foreground">“{e.note}”</p>
          {c.marketConflict && <p className="rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950/40">{c.marketConflict.note}</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {c.figures.perMarket.map((m) => (
              <div key={m.market} className="rounded-lg border p-2 text-xs">
                <div className="font-medium">{marketLabel[m.market]}</div>
                <div className="text-muted-foreground">
                  {m.customers} customers · study {m.studyScore ?? "—"}
                </div>
                <div className="text-muted-foreground">2030 volume share {pct(m.salesShare2030)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {e.resolution && <p className="text-sm">Decision: {e.resolution}</p>}
      {pending && (
        <Button size="sm" onClick={() => setOpen(true)}>
          Decide
        </Button>
      )}
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title="Resolve the escalation"
        description="The decision is written to the case, both PMs are notified, and it stays in the audit trail."
        confirmLabel="Decide"
        pending={decide.isPending}
        onSubmit={async (rationale) => {
          await decide.mutateAsync({ params: { id: e.id }, body: { decision: "resolve", resolution, rationale } });
          setOpen(false);
        }}
      >
        <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)} className="space-y-2">
          {resolutions.map(([v, l, hint]) => (
            <Label key={v} className="flex items-start gap-2 rounded-md border p-2 font-normal">
              <RadioGroupItem value={v} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{l}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </RationaleDialog>
    </div>
  );
}
