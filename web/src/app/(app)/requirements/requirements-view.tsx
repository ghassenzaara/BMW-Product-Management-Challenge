"use client";

import { useState } from "react";
import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Columns3, ListOrdered } from "lucide-react";
import { requirementStatusLabel, seriesShort, type Requirement, type RequirementAction, type RequirementStatus, type Series } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { EvidenceBadge, Pill, RegionChip, ReleaseChip, ReqStatusBadge, ScoreBar } from "@/components/common/badges";
import { useScores } from "@/components/cases/use-scores";
import { RequirementCard } from "@/components/requirements/requirement-card";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";

const columns: RequirementStatus[] = ["draft", "in_discussion", "pm_approved", "signed_off", "planned", "exported"];

function actionFor(from: RequirementStatus, to: RequirementStatus): RequirementAction | null {
  if (to === "in_discussion") return from === "draft" ? "discuss" : from === "pm_approved" ? "send_back" : null;
  if (to === "pm_approved") return "approve";
  if (to === "signed_off") return "sign_off";
  if (to === "planned") return "plan";
  if (to === "exported") return "export";
  if (to === "rejected") return "reject";
  if (to === "draft" && from === "rejected") return "restore";
  return null;
}

export function RequirementsView() {
  const me = useApi("me");
  const { data: reqs = [] } = useApi("requirements");
  const scores = useScores();
  const [view, setView] = useState<"board" | "ranked">("board");
  const [mine, setMine] = useState<"mine" | "all">("all");
  const [series, setSeries] = useState<string>("all");
  const [showRejected, setShowRejected] = useState(false);
  const [pending, setPending] = useState<{ r: Requirement; action: RequirementAction } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const myId = me.data?.user.id;
  const list = reqs.filter((r) => (mine === "all" || r.ownerId === myId) && (series === "all" || r.series === series));
  const cols: RequirementStatus[] = showRejected ? [...columns, "rejected"] : columns;

  const onDragEnd = (e: DragEndEvent) => {
    const r = list.find((x) => x.id === e.active.id);
    const to = e.over?.id as RequirementStatus | undefined;
    if (!r || !to || to === r.status) return;
    const action = actionFor(r.status, to);
    if (action) setPending({ r, action });
  };

  const ranked = [...list].filter((r) => r.status !== "rejected").sort((a, b) => (scores.reqs.get(a.id)?.rank ?? 999) - (scores.reqs.get(b.id)?.rank ?? 999));

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Requirements"
        description="What BMW builds, with a measurable target, a release (next generation, mid-life update or OTA) and a rough cost. Built from confirmed cases; rank = case score adjusted by cost."
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as "board")}>
            <ToggleGroupItem value="board" className="gap-1.5 px-2.5">
              <Columns3 className="size-3.5" /> Board
            </ToggleGroupItem>
            <ToggleGroupItem value="ranked" className="gap-1.5 px-2.5">
              <ListOrdered className="size-3.5" /> Ranked
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={mine} onValueChange={(v) => v && setMine(v as "mine")}>
            <ToggleGroupItem value="mine" className="px-2.5">
              Mine
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="px-2.5">
              All PMs
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={series} onValueChange={setSeries}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All series</SelectItem>
              {(["G60", "F70", "G70"] as Series[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {seriesShort[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={showRejected} onCheckedChange={setShowRejected} /> Show rejected
          </label>
          <span className="text-xs text-muted-foreground">{list.length} requirements · drag a card to move it (reason required)</span>
        </div>
      </PageHeader>

      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
            {cols.map((s) => (
              <Column key={s} status={s} items={list.filter((r) => r.status === s)} scores={scores.reqs} />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="p-4">
          <div className="overflow-hidden rounded-lg border bg-card">
            {ranked.map((r) => {
              const s = scores.reqs.get(r.id);
              return (
                <Link key={r.id} href={`/requirements/${r.id}`} className="grid grid-cols-[48px_1fr_140px_150px] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/40">
                  <span className="font-mono text-sm font-semibold">{s?.rank ?? "—"}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{r.id}</span>
                      <ReqStatusBadge status={r.status} />
                      <ReleaseChip release={r.releaseTarget} />
                      <RegionChip region={r.marketScope} />
                      <EvidenceBadge level={r.evidenceLevel} />
                    </span>
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                  </span>
                  <span className="text-xs">
                    <Pill>Cost {r.cost.size}</Pill> <span className="text-muted-foreground">{r.cost.eurBand}</span>
                  </span>
                  {s ? <ScoreBar value={s.score} /> : <span />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {pending && <RequirementActionDialog r={pending.r} action={pending.action} onOpenChange={(o) => !o && setPending(null)} />}
    </div>
  );
}

function Column({ status, items, scores }: { status: RequirementStatus; items: Requirement[]; scores: Map<string, { score: number; rank: number }> }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sorted = [...items].sort((a, b) => (scores.get(a.id)?.rank ?? 999) - (scores.get(b.id)?.rank ?? 999));
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/60", isOver && "bg-primary/10 ring-2 ring-primary/40")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <ReqStatusBadge status={status} />
        <span className="text-xs text-muted-foreground">{items.length}</span>
        {status === "pm_approved" && <span className="ml-auto text-[10px] text-muted-foreground">awaiting sign-off</span>}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        {sorted.map((r) => (
          <Draggable key={r.id} r={r} score={scores.get(r.id)} />
        ))}
        {items.length === 0 && <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{requirementStatusLabel[status]}</div>}
      </div>
    </div>
  );
}

function Draggable({ r, score }: { r: Requirement; score?: { score: number; rank: number } }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: r.id });
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, position: "relative" } : undefined} {...attributes} {...listeners}>
      <RequirementCard r={r} score={score?.score} rank={score?.rank} />
    </div>
  );
}

