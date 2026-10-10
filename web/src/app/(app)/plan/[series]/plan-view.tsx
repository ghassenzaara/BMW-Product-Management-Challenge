"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Download, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PlanAction as PlanActions,
  carAreaLabel,
  planActionLabel,
  seriesShort,
  type CarArea,
  type PlanAction,
  type PlannedFeature,
  type Requirement,
  type RequirementStatus,
  type Series,
} from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { download } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/common/page";
import { Pill, ReleaseChip, ReqStatusBadge, type Tone } from "@/components/common/badges";
import { UserAvatar } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const actionTone: Record<PlanAction, Tone> = { keep: "slate", new: "emerald", improve: "sky", remove: "red" };

type Filter = "active" | "progress" | "signed_off" | "planned" | "rejected";
const filters: [Filter, string, (s: RequirementStatus) => boolean][] = [
  ["active", "All", (s) => s !== "rejected"],
  ["progress", "In progress", (s) => s === "draft" || s === "in_discussion" || s === "pm_approved"],
  ["signed_off", "Signed off", (s) => s === "signed_off"],
  ["planned", "Planned", (s) => s === "planned" || s === "exported"],
  ["rejected", "Rejected", (s) => s === "rejected"],
];

/** Vehicle plan = the requirement list of a series, grouped by car area, next to today's equipment. */
export function PlanView() {
  const { series } = useParams<{ series: Series }>();
  const router = useRouter();
  const me = useApi("me");
  const plan = useApi("plan", { params: { series } });
  const { data: reqs = [] } = useApi("requirements", { query: { series } });
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [reqId, setReqId] = useState<string | null>(null);

  if (!plan.data || !me.data) return <PageSkeleton />;
  const p = plan.data;
  const canEdit = p.ownerIds.includes(me.data.user.id) || me.data.user.role === "head";
  const test = filters.find((f) => f[0] === filter)![2];
  const shown = reqs.filter((r) => test(r.status));
  const featureOf = new Map(p.features.flatMap((f) => f.requirementIds.map((id) => [id, f] as const)));
  const areas = [...new Set<CarArea>([...shown.map((r) => r.carArea), ...p.features.map((f) => f.carArea)])];

  const exportCsv = async () => {
    const res = await api("exportRequirements", { body: { series, format: "codebeamer_csv" } });
    download(res.filename, res.content, res.mime);
    await qc.invalidateQueries();
    toast.success(`${res.count} requirements exported to ${res.filename}`);
  };

  return (
    <div>
      <PageHeader
        title="Vehicle plan"
        actions={
          <>
            <ToggleGroup type="single" size="sm" variant="outline" value={series} onValueChange={(v) => v && router.push(`/plan/${v}`)}>
              {(["F70", "G60", "G70"] as Series[]).map((s) => (
                <ToggleGroupItem key={s} value={s} className="px-2.5">
                  {seriesShort[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button size="sm" onClick={exportCsv}>
              <Download className="size-3.5" /> Export to Codebeamer
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm text-muted-foreground">
            {p.successorName} · SOP {p.sop}
          </span>
          {filters.map(([id, label, t]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn("rounded-full border px-3 py-1 text-sm transition", filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/60")}
            >
              {label} <span className="tabular-nums opacity-70">{reqs.filter((r) => t(r.status)).length}</span>
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="space-y-4 p-6">
        {areas.map((area) => (
          <AreaBlock
            key={area}
            area={area}
            reqs={shown.filter((r) => r.carArea === area)}
            unchanged={p.features.filter((f) => f.carArea === area && f.requirementIds.length === 0)}
            featureOf={featureOf}
            canEdit={canEdit}
            series={series}
            onOpen={setReqId}
          />
        ))}
      </div>
      <RequirementSheet id={reqId} onOpenChange={(o) => !o && setReqId(null)} />
    </div>
  );
}

function AreaBlock({
  area,
  reqs,
  unchanged,
  featureOf,
  canEdit,
  series,
  onOpen,
}: {
  area: CarArea;
  reqs: Requirement[];
  unchanged: PlannedFeature[];
  featureOf: Map<string, PlannedFeature>;
  canEdit: boolean;
  series: Series;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!reqs.length && !unchanged.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{carAreaLabel[area]}</h2>
      <ul className="divide-y">
        {reqs.map((r) => {
          const f = featureOf.get(r.id);
          return (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50">
                <UserAvatar id={r.ownerId} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                </span>
                {f && <Pill t={actionTone[f.action]}>{planActionLabel[f.action]}</Pill>}
                <ReleaseChip release={r.releaseTarget} />
                <Pill>Cost {r.cost.size}</Pill>
                <ReqStatusBadge status={r.status} />
              </button>
            </li>
          );
        })}
      </ul>
      {unchanged.length > 0 && (
        <div className={cn(reqs.length > 0 && "border-t")}>
          <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className={cn("size-3.5 transition", open && "rotate-90")} /> Today&apos;s equipment · {unchanged.length}
          </button>
          {open && (
            <ul className="divide-y border-t bg-muted/20">
              {unchanged.map((f) => (
                <FeatureRow key={f.id} f={f} canEdit={canEdit} series={series} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FeatureRow({ f, canEdit, series }: { f: PlannedFeature; canEdit: boolean; series: Series }) {
  const [action, setAction] = useState<PlanAction | null>(null);
  const patch = useApiMutation("patchPlanFeature", { success: "Plan updated" });
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      {f.protected ? <Lock className="size-3.5 text-positive" aria-label="Protected strength" /> : <span className="size-3.5" />}
      <span className="min-w-0 flex-1 truncate">{f.name}</span>
      <span className="hidden truncate text-xs text-muted-foreground md:block">{f.todayDetail}</span>
      {canEdit ? (
        <Select value={f.action} onValueChange={(v) => setAction(v as PlanAction)}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PlanActions.options.map((a) => (
              <SelectItem key={a} value={a}>
                {planActionLabel[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Pill t={actionTone[f.action]}>{planActionLabel[f.action]}</Pill>
      )}
      <RationaleDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={`${f.name}: ${action ? planActionLabel[action] : ""}`}
        description="Plan changes are logged."
        pending={patch.isPending}
        onSubmit={async (rationale) => {
          await patch.mutateAsync({ params: { series, featureId: f.id }, body: { patch: { action: action! }, rationale } });
          setAction(null);
        }}
      />
    </li>
  );
}
