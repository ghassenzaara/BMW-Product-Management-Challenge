"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Download, Lock, Presentation } from "lucide-react";
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
import { downloadDeck } from "@/lib/deck";
import { download } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CarPreview } from "@/components/car/car-preview";
import { PageHeader, PageSkeleton } from "@/components/common/page";
import { Pill, ReqStatusDot, type Tone } from "@/components/common/badges";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const actionTone: Record<PlanAction, Tone> = { keep: "slate", new: "emerald", improve: "sky", remove: "red" };
const actionText: Record<PlanAction, string> = { keep: "text-muted-foreground", new: "text-tone-emerald-fg", improve: "text-tone-sky-fg", remove: "text-tone-red-fg" };
const releaseShort = { next_gen: "Next gen", lci: "LCI", ota: "OTA" } as const;

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
  const [deckPending, setDeckPending] = useState(false);

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

  const exportDeck = async () => {
    setDeckPending(true);
    try {
      const deck = await api("requirementDeck", { params: { series }, body: {} });
      if (!deck.slides.length) {
        toast.info("No signed-off or planned requirements yet: nothing to present.");
        return;
      }
      await downloadDeck(deck);
      await qc.invalidateQueries();
      toast.success(`Deck with ${deck.slides.length} requirements saved as ${deck.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deck export failed");
    } finally {
      setDeckPending(false);
    }
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
            <Button size="sm" variant="outline" onClick={exportDeck} disabled={deckPending} title="One slide per signed-off requirement: SMART text, quotes, score, competition, decisions">
              <Presentation className="size-3.5" /> {deckPending ? "Building deck…" : "Download deck"}
            </Button>
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
              className={cn("rounded-full border px-3 py-1 text-sm transition-colors duration-150", filter === id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-border-strong hover:bg-muted")}
            >
              {label} <span className="tabular-nums opacity-70">{reqs.filter((r) => t(r.status)).length}</span>
            </button>
          ))}
        </div>
      </PageHeader>
      <CarPreview series={series} reqs={shown} onOpenRequirement={setReqId} />
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="border-b px-5 py-3 text-[15px] font-semibold">{carAreaLabel[area]}</h2>
      <ul className="divide-y">
        {reqs.map((r) => {
          const f = featureOf.get(r.id);
          return (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} title={r.title} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60 md:grid-cols-[minmax(0,1fr)_90px_120px_130px]">
                <span className="truncate text-sm font-medium">{r.shortTitle}</span>
                <span className={cn("text-xs font-medium", f ? actionText[f.action] : "text-muted-foreground")}>{f ? planActionLabel[f.action] : "–"}</span>
                <span className="text-xs text-muted-foreground">
                  {releaseShort[r.releaseTarget]} · Cost {r.cost.size}
                </span>
                <ReqStatusDot status={r.status} />
              </button>
            </li>
          );
        })}
      </ul>
      {unchanged.length > 0 && (
        <div className={cn(reqs.length > 0 && "border-t")}>
          <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-5 py-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground">
            <ChevronRight className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} /> Today&apos;s equipment · {unchanged.length}
          </button>
          {open && (
            <ul className="divide-y border-t bg-recessed">
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
    <li className="flex items-center gap-3 px-5 py-2 text-sm">
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
