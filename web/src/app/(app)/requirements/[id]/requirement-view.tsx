"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Bot, Car, CornerUpLeft, PanelRight, Upload } from "lucide-react";
import {
  regionLabel,
  type RequirementAction,
} from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { EvidenceBadge, OutcomeBadge, Pill, RegionChip, ReleaseChip, ReqStatusBadge, ScoreBar } from "@/components/common/badges";
import { ObjectActivity } from "@/components/common/activity";
import { PageSkeleton } from "@/components/common/page";
import { ProposalCard } from "@/components/common/proposal-card";
import { UserAvatar, useUsers } from "@/components/common/people";
import { useScores } from "@/components/cases/use-scores";
import { ChatPanel } from "@/components/chat/chat-panel";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { SignalCard } from "@/components/signals/signal-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArgumentSheet, requirementButtons, Spec, TraceChain } from "@/components/requirements/requirement-parts";

export function RequirementView() {
  const { id } = useParams<{ id: string }>();
  const bundle = useApi("requirementBundle", { params: { id } });
  const me = useApi("me");
  const scores = useScores();
  const router = useRouter();
  const { name } = useUsers();
  const [action, setAction] = useState<RequirementAction | null>(null);
  const [side, setSide] = useState<"details" | "chat">("details");
  const [tab, setTab] = useState("spec");

  if (!bundle.data || !me.data) return <PageSkeleton />;
  const b = bundle.data;
  const r = b.requirement;
  const user = me.data.user;
  const isOwner = user.id === r.ownerId;
  const isHead = user.role === "head";
  const canEdit = isOwner || isHead;
  const score = scores.reqs.get(r.id);

  const buttons = requirementButtons(r, user);

  const onCite = (ref: string) => (ref.startsWith("CASE-") ? router.push(`/cases/${ref}`) : router.push(`/cases/${b.case.id}?signal=${ref}`));

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">
        <div className="border-b bg-background px-6 pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href={`/plan/${r.series}`} className="hover:underline">
              Vehicle plan
            </Link>
            <span>/</span>
            <span className="font-mono">{r.id}</span>
            {r.synthetic && <Pill className="ml-1">synthetic</Pill>}
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-snug font-semibold tracking-tight">{r.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <ReqStatusBadge status={r.status} />
                <ReleaseChip release={r.releaseTarget} />
                <RegionChip region={r.marketScope} />
                <EvidenceBadge level={r.evidenceLevel} />
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserAvatar id={r.ownerId} size="xs" /> {name(r.ownerId)}
                </span>
                <span className="text-muted-foreground">updated {fromNow(r.updatedAt)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {buttons.map(([a, label, variant]) => (
                <Button key={a} size="sm" variant={variant} onClick={() => setAction(a)}>
                  {a === "send_back" && <CornerUpLeft className="size-3.5" />}
                  {a === "plan" && <Car className="size-3.5" />}
                  {a === "export" && <Upload className="size-3.5" />}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 pt-4">
          {r.sentBackReason && r.status === "in_discussion" && (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <CornerUpLeft className="mt-0.5 size-4 text-amber-600" /> Sent back by the head of product line: “{r.sentBackReason}”
            </div>
          )}
          {b.alerts
            .filter((a) => a.status === "open")
            .map((a) => (
              <div key={a.id} className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  <b>{a.title}</b> · {a.detail}{" "}
                  <Link href={`/cases/${b.case.id}`} className="text-primary hover:underline">
                    Resolve on the case
                  </Link>
                </span>
              </div>
            ))}
          <TraceChain b={b} />
          {b.proposals
            .filter((p) => p.status === "pending")
            .map((p) => (
              <ProposalCard key={p.id} p={p} canDecide={canEdit} />
            ))}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-6 py-4">
          <TabsList>
            <TabsTrigger value="spec">Specification</TabsTrigger>
            <TabsTrigger value="argument">Argument sheet</TabsTrigger>
            <TabsTrigger value="evidence">Evidence ({b.signals.length})</TabsTrigger>
            <TabsTrigger value="questions">Questions ({b.questions.filter((q) => q.status === "open").length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="spec" className="pt-3">
            <Spec r={r} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="argument" className="pt-3">
            <ArgumentSheet b={b} />
          </TabsContent>
          <TabsContent value="evidence" className="space-y-2 pt-3">
            <p className="text-xs text-muted-foreground">Evidence is inherited from the confirmed case {b.case.id}. Open the case to filter and add signals.</p>
            {b.signals.slice(0, 40).map((s) => (
              <SignalCard key={s.id} s={s} compact />
            ))}
          </TabsContent>
          <TabsContent value="questions" className="space-y-2 pt-3">
            {b.questions.map((q) => (
              <div key={q.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Pill t={q.status === "answered" ? "emerald" : "amber"}>{q.status}</Pill>
                  <span className="font-medium">{q.question}</span>
                </div>
                {q.answer && <p className="mt-1 text-muted-foreground">→ {q.answer}</p>}
              </div>
            ))}
            <Link href={`/cases/${b.case.id}?step=knowledge`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Manage questions on the case <ArrowRight className="size-3.5" />
            </Link>
          </TabsContent>
          <TabsContent value="activity" className="pt-3">
            <ObjectActivity objectType="requirement" objectId={r.id} />
          </TabsContent>
        </Tabs>
      </div>

      <aside className="sticky top-0 flex h-[calc(100dvh-3.5rem)] w-[340px] shrink-0 flex-col border-l bg-background 2xl:w-[420px]">
        <div className="border-b px-3 py-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={side} onValueChange={(v) => v && setSide(v as "details")} className="w-full">
            <ToggleGroupItem value="details" className="flex-1 gap-1.5">
              <PanelRight className="size-3.5" /> Details
            </ToggleGroupItem>
            <ToggleGroupItem value="chat" className="flex-1 gap-1.5">
              <Bot className="size-3.5" /> AI assistant
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {side === "chat" ? (
            <ChatPanel objectType="requirement" objectId={r.id} proposals={b.proposals} canEdit={canEdit} onCite={onCite} />
          ) : (
            <div className="space-y-4 p-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rank</div>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-semibold tabular-nums">#{score?.rank ?? "—"}</span>
                  <span className="pb-1 text-xs text-muted-foreground">of all requirements</span>
                </div>
                {score && <ScoreBar value={score.score} className="mt-2" />}
                <p className="mt-1 text-[11px] text-muted-foreground">Case score × cost factor for size {r.cost.size} under {me.data.weightProfile.name}.</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rough cost</div>
                <div className="mt-1 flex items-center gap-2">
                  <Pill t="slate">Size {r.cost.size}</Pill>
                  <span>{r.cost.eurBand}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Source: {r.cost.source.replace("_", " ")} · {r.cost.note}
                </p>
                <p className="text-[11px] text-muted-foreground">Cost is a rough factor only; engineering and finance decide feasibility.</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">From case</div>
                <Link href={`/cases/${b.case.id}`} className="mt-1 block rounded-md border p-2 hover:border-primary/50">
                  <span className="font-mono text-xs">{b.case.id}</span>
                  <span className="block text-sm">{b.case.title}</span>
                  {b.case.outcome && <OutcomeBadge outcome={b.case.outcome} />}
                </Link>
              </div>
              {b.variants.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Sibling requirements / variants</div>
                  {b.variants.map((v) => (
                    <Link key={v.id} href={`/requirements/${v.id}`} className="mt-1 block text-sm text-primary hover:underline">
                      {v.id} · {regionLabel[v.marketScope]}
                    </Link>
                  ))}
                </div>
              )}
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vehicle plan</div>
                {b.plannedFeature ? (
                  <Link href={`/plan/${r.series}`} className="mt-1 block text-sm text-primary hover:underline">
                    {b.plannedFeature.name} · {b.plannedFeature.action}
                  </Link>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Not planned yet. After sign-off, “Add to vehicle plan”.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
      <RequirementActionDialog r={r} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </div>
  );
}

