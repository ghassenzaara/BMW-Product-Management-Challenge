"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import {
  Agent as Agents,
  CarArea as CarAreas,
  CaseType as CaseTypes,
  ChangeDepth as ChangeDepths,
  Region as Regions,
  agentLabel,
  carAreaLabel,
  caseTypeLabel,
  changeDepthLabel,
  regionLabel,
  seriesShort,
  type Agent,
  type CarArea,
  type CaseType,
  type ChangeDepth,
  type Region,
  type Series,
  type SignalCluster,
} from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { SignalCard } from "@/components/signals/signal-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function RadarView() {
  const router = useRouter();
  const me = useApi("me");
  const [series, setSeries] = useState<Series | null>(null);
  const activeSeries: Series = series ?? me.data?.workspace.series ?? "G60";
  const [agent, setAgent] = useState<Agent | "all">("all");
  const [onlyLoose, setOnlyLoose] = useState(true);
  const [cluster, setCluster] = useState<SignalCluster | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { data: signals = [] } = useApi("signals", { query: { series: activeSeries } });
  const { data: clusters = [] } = useApi("clusters", { query: { series: activeSeries } });
  const { data: runs = [] } = useApi("agentRuns");
  const { data: quarantine = [] } = useApi("quarantine");
  const refresh = useApiMutation("refresh", { success: (r) => (r.signals.length ? `${r.signals.length} new signals, ${r.notifications} notifications sent` : "No new findings: everything already seen (dedupe)") });

  const feed = signals.filter(
    (s) => (agent === "all" || s.agent === agent) && (!onlyLoose || s.status !== "clustered") && (!cluster || cluster.signalIds.includes(s.id)),
  );
  const maxSize = Math.max(1, ...clusters.map((c) => c.size));

  return (
    <div>
      <PageHeader
        title="Signal radar"
        description="Everything the agents fetched: BMW data plus competitors, customer and public voices, trends and the innovation scout. Clusters become cases when they cross a threshold, or when you start one by hand."
        actions={
          <>
            <Select value={activeSeries} onValueChange={(v) => setSeries(v as Series)}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["G60", "F70", "G70"] as Series[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {seriesShort[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => refresh.mutate({ body: { series: activeSeries } })} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh now
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Section
            title="Theme map"
            actions={
              cluster ? (
                <Button size="xs" variant="ghost" onClick={() => setCluster(null)}>
                  Clear filter: {cluster.label}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">size = signals · colour = sentiment · click: open case, or filter the feed</span>
              )
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {[...clusters]
                .sort((a, b) => b.size - a.size)
                .map((c) => {
                  const d = 28 + Math.sqrt(c.size / maxSize) * 72;
                  const hue = c.sentiment > 0.2 ? "bg-emerald-500/80" : c.sentiment < -0.2 ? "bg-red-500/80" : "bg-amber-500/80";
                  return (
                    <Tooltip key={c.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => (c.caseId ? router.push(`/cases/${c.caseId}`) : setCluster(c))}
                          className={cn("flex shrink-0 items-center justify-center rounded-full p-1 text-center text-[10px] leading-tight font-medium text-white shadow-sm transition hover:scale-105", hue, !c.caseId && "ring-2 ring-primary ring-offset-2 ring-offset-card", cluster?.id === c.id && "outline-3 outline-primary")}
                          style={{ width: d, height: d }}
                        >
                          {d > 54 ? c.label.slice(0, 22) : c.size}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="font-medium">{c.label}</div>
                        <div>
                          {c.size} signals · {carAreaLabel[c.carArea]} · {c.caseId ? `case ${c.caseId}` : "no case yet"}
                        </div>
                        <div>{Object.entries(c.markets).map(([m, n]) => `${m} ${n}`).join(" · ")}</div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Ringed bubbles are clusters without a case yet. Select their signals below and start a case.</p>
          </Section>

          <Section
            title={`Feed (${feed.length})`}
            actions={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={onlyLoose} onCheckedChange={setOnlyLoose} /> Not in a case yet
                </label>
                <Button size="sm" disabled={!selected.length} onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" /> Start case ({selected.length})
                </Button>
              </div>
            }
          >
            <ToggleGroup type="single" size="sm" variant="outline" value={agent} onValueChange={(v) => v && setAgent(v as Agent)} className="mb-3 flex-wrap">
              <ToggleGroupItem value="all" className="px-2.5">
                All agents
              </ToggleGroupItem>
              {Agents.options.map((a) => (
                <ToggleGroupItem key={a} value={a} className="px-2.5">
                  {agentLabel[a]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="space-y-2">
              {feed.slice(0, 80).map((s) => (
                <SignalCard
                  key={s.id}
                  s={s}
                  compact
                  selectable={s.status !== "clustered"}
                  selected={selected.includes(s.id)}
                  onSelect={(v) => setSelected((x) => (v ? [...x, s.id] : x.filter((i) => i !== s.id)))}
                />
              ))}
              {feed.length === 0 && <p className="text-sm text-muted-foreground">No signals for this filter. Switch off “Not in a case yet” to see clustered signals.</p>}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Agent runs">
            <ul className="space-y-2 text-xs">
              {runs.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  {r.status === "ok" ? <CheckCircle2 className="mt-0.5 size-3.5 text-emerald-600" /> : <XCircle className="mt-0.5 size-3.5 text-amber-500" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{agentLabel[r.agent]}</span> · {r.newSignals} new · {r.rejected} rejected · ${r.llmCostUsd.toFixed(2)}
                    <span className="block text-muted-foreground">{fromNow(r.startedAt)}</span>
                    {r.note && <span className="block text-muted-foreground">{r.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title={`Quarantine (${quarantine.length})`} actions={<ShieldAlert className="size-4 text-muted-foreground" />}>
            <p className="mb-2 text-[11px] text-muted-foreground">Findings rejected by the validation gate: they never reach a case. The count stays visible.</p>
            <ul className="space-y-2 text-xs">
              {quarantine.map((q) => (
                <li key={q.id} className="rounded border bg-muted/30 p-2">
                  <span className="font-medium">{q.reason}</span>
                  <span className="block truncate text-muted-foreground">
                    {q.sourceName}: “{q.snippet}”
                  </span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="How signals become cases">
            <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Agents fetch on a daily budget; every record keeps its source, quote and snapshot.</li>
              <li>Validation gate: quote found, no duplicate, dated competitor fact; else quarantine.</li>
              <li>Clustering links the signal to a feature and a case (problem).</li>
              <li>Open threshold reached, or you start a case by hand.</li>
            </ol>
            <div className="mt-2 flex flex-wrap gap-1">
              {Agents.options.map((a) => (
                <Pill key={a}>{agentLabel[a]}</Pill>
              ))}
            </div>
          </Section>
        </div>
      </div>
      <StartCaseDialog open={creating} onOpenChange={setCreating} signalIds={selected} series={activeSeries} region={me.data?.workspace.region ?? "RoW"} onCreated={(id) => router.push(`/cases/${id}`)} />
    </div>
  );
}

function StartCaseDialog({ open, onOpenChange, signalIds, series, region, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; signalIds: string[]; series: Series; region: Region; onCreated: (id: string) => void }) {
  const create = useApiMutation("createCase", { success: (c) => `${c.id} created` });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [scope, setScope] = useState<Region>(region);
  const [area, setArea] = useState<CarArea>("infotainment_hmi");
  const [type, setType] = useState<CaseType>("fix_improve");
  const [depth, setDepth] = useState<ChangeDepth>("part_module");
  return (
    <RationaleDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Start a case from ${signalIds.length} signal${signalIds.length === 1 ? "" : "s"}`}
      description="Name the customer problem (not the solution). The case starts in New and is scored right away."
      confirmLabel="Create case"
      pending={create.isPending}
      canSubmit={title.trim().length > 2}
      onSubmit={async (rationale) => {
        const c = await create.mutateAsync({ body: { title, summary: summary || title, series, scope, carArea: area, type, changeDepth: depth, signalIds, rationale } });
        onOpenChange(false);
        onCreated(c.id);
      }}
    >
      <div className="space-y-1.5">
        <Label>Problem title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Head-up display hard to read with sunglasses" />
      </div>
      <div className="space-y-1.5">
        <Label>One-line summary</Label>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Pick label="Scope" value={scope} onChange={(v) => setScope(v as Region)} options={Regions.options.map((o) => [o, regionLabel[o]])} />
        <Pick label="Car area" value={area} onChange={(v) => setArea(v as CarArea)} options={CarAreas.options.map((o) => [o, carAreaLabel[o]])} />
        <Pick label="Type" value={type} onChange={(v) => setType(v as CaseType)} options={CaseTypes.options.map((o) => [o, caseTypeLabel[o]])} />
        <Pick label="Change depth" value={depth} onChange={(v) => setDepth(v as ChangeDepth)} options={ChangeDepths.options.map((o) => [o, changeDepthLabel[o]])} />
      </div>
    </RationaleDialog>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
