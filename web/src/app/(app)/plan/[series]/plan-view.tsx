"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Download, FileJson, Lock, ShieldCheck } from "lucide-react";
import { PlanAction as PlanActions, carAreaLabel, planActionLabel, seriesShort, type PlanAction, type PlannedFeature, type Series } from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { download } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton, Stat } from "@/components/common/page";
import { Pill, ReleaseChip, ReqStatusBadge, type Tone } from "@/components/common/badges";
import { AvatarStack } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const actionTone: Record<PlanAction, Tone> = { keep: "slate", new: "emerald", improve: "sky", remove: "red" };

export function PlanView() {
  const { series } = useParams<{ series: Series }>();
  const router = useRouter();
  const me = useApi("me");
  const plan = useApi("plan", { params: { series } });
  const { data: reqs = [] } = useApi("requirements", { query: { series } });
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ f: PlannedFeature; action: PlanAction } | null>(null);
  const patch = useApiMutation("patchPlanFeature", { success: "Plan updated" });

  if (!plan.data || !me.data) return <PageSkeleton />;
  const p = plan.data;
  const canEdit = p.ownerIds.includes(me.data.user.id) || me.data.user.role === "head";
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const areas = [...new Set(p.features.map((f) => f.carArea))];
  const count = (a: PlanAction) => p.features.filter((f) => f.action === a).length;
  const signedOff = reqs.filter((r) => r.status === "signed_off");

  const exportAs = async (format: "codebeamer_csv" | "json") => {
    const res = await api("exportRequirements", { body: { series, format } });
    download(res.filename, res.content, res.mime);
    await qc.invalidateQueries();
    toast.success(`${res.count} requirements exported (${res.filename}); planned ones are now marked exported`);
  };

  return (
    <div>
      <PageHeader
        title={`${p.successorName}`}
        description={`The car taking shape: today's equipment (German option list) next to what the successor keeps, adds, improves or removes. Each change traces to a signed-off requirement. SOP ${p.sop}.`}
        actions={
          <>
            <ToggleGroup type="single" size="sm" variant="outline" value={series} onValueChange={(v) => v && router.push(`/plan/${v}`)}>
              {(["F70", "G60", "G70"] as Series[]).map((s) => (
                <ToggleGroupItem key={s} value={s} className="px-2.5">
                  {seriesShort[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button size="sm" variant="outline" onClick={() => exportAs("json")}>
              <FileJson className="size-3.5" /> JSON
            </Button>
            <Button size="sm" onClick={() => exportAs("codebeamer_csv")}>
              <Download className="size-3.5" /> Export to Codebeamer
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Pill t="outline">{p.projectType === "lci" ? "Mid-life update" : "New generation"}</Pill>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            Owners <AvatarStack ids={p.ownerIds} />
          </span>
        </div>
      </PageHeader>
      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="New" value={count("new")} />
          <Stat label="Improve" value={count("improve")} />
          <Stat label="Keep" value={count("keep")} hint={`${p.features.filter((f) => f.protected).length} protected strengths`} />
          <Stat label="Remove" value={count("remove")} />
          <Stat label="Signed off, not planned" value={signedOff.length} hint={signedOff.map((r) => r.id).join(", ") || "—"} />
        </div>

        <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-emerald-600" /> Protect list: strengths the successor must not lose
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {p.features
              .filter((f) => f.protected)
              .map((f) => (
                <span key={f.id} className="text-xs">
                  <b>{f.name}</b> ({f.todayDetail})
                </span>
              ))}
          </div>
        </div>

        {areas.map((area) => (
          <div key={area} className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">{carAreaLabel[area]}</div>
            <div className="grid grid-cols-[1.4fr_1.2fr_130px_140px_1.4fr] gap-3 border-b px-4 py-1.5 text-[11px] text-muted-foreground uppercase">
              <span>Feature</span>
              <span>Today</span>
              <span>Successor</span>
              <span>Release</span>
              <span>Requirements · note</span>
            </div>
            {p.features
              .filter((f) => f.carArea === area)
              .map((f) => (
                <div key={f.id} className={cn("grid grid-cols-[1.4fr_1.2fr_130px_140px_1.4fr] items-center gap-3 border-b px-4 py-2.5 text-sm last:border-0", f.protected && "bg-emerald-50/40 dark:bg-emerald-950/20")}>
                  <span className="flex items-center gap-1.5 font-medium">
                    {f.protected && <Lock className="size-3.5 text-emerald-600" />}
                    {f.name}
                  </span>
                  <span className="text-xs">
                    <Pill t={f.today === "standard" ? "emerald" : f.today === "optional" ? "sky" : "slate"}>{f.today}</Pill> <span className="text-muted-foreground">{f.todayDetail}</span>
                  </span>
                  <span>
                    {canEdit ? (
                      <Select value={f.action} onValueChange={(v) => setEdit({ f, action: v as PlanAction })}>
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
                  </span>
                  <span>
                    <ReleaseChip release={f.release} />
                  </span>
                  <span className="space-y-1 text-xs">
                    {f.requirementIds.map((id) => {
                      const r = reqById.get(id);
                      return (
                        <Link key={id} href={`/requirements/${id}`} className="flex items-center gap-1.5 text-primary hover:underline">
                          <span className="font-mono">{id}</span>
                          {r && <ReqStatusBadge status={r.status} />}
                        </Link>
                      );
                    })}
                    {f.note && <span className="block text-muted-foreground">{f.note}</span>}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <RationaleDialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={`${edit?.f.name}: ${edit ? planActionLabel[edit.action] : ""}`}
        description="Plan changes are logged. Normally a planned change comes from a signed-off requirement."
        pending={patch.isPending}
        onSubmit={async (rationale) => {
          await patch.mutateAsync({ params: { series, featureId: edit!.f.id }, body: { patch: { action: edit!.action }, rationale } });
          setEdit(null);
        }}
      />
    </div>
  );
}
