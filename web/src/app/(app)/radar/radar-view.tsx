"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, Inbox, Loader2, Plus, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import {
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
  type CarArea,
  type CaseType,
  type ChangeDepth,
  type Region,
  type Series,
} from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { overviewSankey, type SankeyNode } from "@/lib/sankey";
import { PageHeader } from "@/components/common/page";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { SankeyChart } from "@/components/sankey/sankey-chart";
import { SignalCard } from "@/components/signals/signal-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Signals: everything the agents fetched, as one Sankey (sources → car areas → cases). */
export function RadarView() {
  const router = useRouter();
  const me = useApi("me");
  const [series, setSeries] = useState<Series | null>(null);
  const activeSeries: Series = series ?? me.data?.workspace.series ?? "G60";
  const [open, setOpen] = useState<{ title: string; ids: string[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { data: signals = [] } = useApi("signals", { query: { series: activeSeries } });
  const { data: cases = [] } = useApi("cases", { query: { series: activeSeries } });
  const { data: runs = [] } = useApi("agentRuns");
  const { data: quarantine = [] } = useApi("quarantine");
  const refresh = useApiMutation("refresh", { success: (r) => (r.signals.length ? `${r.signals.length} new signals` : "Nothing new since the last run") });

  const graph = overviewSankey(signals, cases);
  const loose = signals.filter((s) => s.status !== "clustered");
  const list = open ? signals.filter((s) => open.ids.includes(s.id)) : [];
  const onNode = (n: SankeyNode) => (n.href ? router.push(n.href) : setOpen({ title: n.label, ids: n.signalIds }));

  return (
    <div>
      <PageHeader
        title="Signals"
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
            <RunsPopover runs={runs} />
            <QuarantinePopover items={quarantine} />
            <Button size="sm" onClick={() => refresh.mutate({ body: { series: activeSeries } })} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh
            </Button>
          </>
        }
      >
        <button onClick={() => setOpen({ title: "Not in a case yet", ids: loose.map((s) => s.id) })} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-xs transition hover:border-primary/60">
          <Inbox className="size-4 text-muted-foreground" /> {loose.length} not in a case yet
        </button>
      </PageHeader>
      <div className="p-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SankeyChart graph={graph} titles={["Sources", "Car area", "Cases"]} onSelect={onNode} />
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && (setOpen(null), setSelected([]))}>
        <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>{open?.title}</SheetTitle>
            <SheetDescription>{list.length} signals</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {list.slice(0, 100).map((s) => (
              <SignalCard
                key={s.id}
                s={s}
                compact
                selectable={s.status !== "clustered"}
                selected={selected.includes(s.id)}
                onSelect={(v) => setSelected((x) => (v ? [...x, s.id] : x.filter((i) => i !== s.id)))}
              />
            ))}
          </div>
          {list.some((s) => s.status !== "clustered") && (
            <SheetFooter className="border-t">
              <Button disabled={!selected.length} onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Start case from {selected.length} selected
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
      <StartCaseDialog open={creating} onOpenChange={setCreating} signalIds={selected} series={activeSeries} region={me.data?.workspace.region ?? "RoW"} onCreated={(id) => router.push(`/cases/${id}`)} />
    </div>
  );
}

function RunsPopover({ runs }: { runs: { id: string; agent: keyof typeof agentLabel; status: string; newSignals: number; rejected: number; llmCostUsd: number; startedAt: string }[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Activity className="size-3.5" /> Agent runs
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <ul className="space-y-2 text-xs">
          {runs.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              {r.status === "ok" ? <CheckCircle2 className="size-3.5 text-positive" /> : <XCircle className="size-3.5 text-warning" />}
              <span className="min-w-0 flex-1 truncate">
                <b className="font-medium">{agentLabel[r.agent]}</b> · {r.newSignals} new · ${r.llmCostUsd.toFixed(2)}
              </span>
              <span className="text-muted-foreground">{fromNow(r.startedAt)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function QuarantinePopover({ items }: { items: { id: string; reason: string; sourceName: string; snippet: string }[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldAlert className="size-3.5" /> Quarantine {items.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-xs text-muted-foreground">Rejected by the validation gate; never part of a case.</p>
        <ul className="space-y-2 text-xs">
          {items.map((q) => (
            <li key={q.id}>
              <span className="font-medium">{q.reason}</span>
              <span className="block truncate text-muted-foreground">
                {q.sourceName}: “{q.snippet}”
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
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
      description="Name the customer problem, not the solution."
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
