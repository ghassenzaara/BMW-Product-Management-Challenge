"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, Inbox, Loader2, Plus, RefreshCw, ShieldAlert, Waves, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CaseType as CaseTypes,
  ChangeDepth as ChangeDepths,
  Region as Regions,
  agentLabel,
  caseTypeLabel,
  changeDepthLabel,
  regionLabel,
  seriesShort,
  type CaseType,
  type ChangeDepth,
  type RefreshResponse,
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
  const [run, setRun] = useState<RefreshResponse | null>(null);
  const refresh = useApiMutation("refresh");
  const onRefresh = async () => {
    const res = await refresh.mutateAsync({ body: { series: activeSeries } });
    setRun(res);
    // The toast comes when the steps have played (instantly with reduced motion).
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        const active = res.ripples.find((r) => r.status === "active");
        if (active) toast.warning(`Competitor fact: ${active.summary}`, { duration: 30000, action: { label: "View ripple", onClick: () => router.push(`/ripple/${active.id}`) } });
        else toast.success(res.signals.length ? `${res.signals.length} new signals` : "Nothing new since the last run");
        const watch = res.ripples.filter((r) => r.status === "watch");
        if (watch.length) toast.info(`${watch.length} low-trust fact${watch.length > 1 ? "s" : ""} on the watch list (no alerts)`);
      },
      reduced ? 0 : (res.run.steps?.length ?? 0) * STEP_MS + 200,
    );
  };

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
            {me.data?.features.agentRefresh ? (
              <Button size="sm" onClick={onRefresh} disabled={refresh.isPending}>
                {refresh.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Agents run daily on the server</span>
            )}
          </>
        }
      >
        <button onClick={() => setOpen({ title: "Not in a case yet", ids: loose.map((s) => s.id) })} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 hover:border-border-strong hover:bg-recessed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Inbox className="size-4 text-muted-foreground" /> {loose.length} not in a case yet
        </button>
      </PageHeader>
      <div className="space-y-6 px-6 pt-6 pb-10">
        {run?.run.steps && <RunSteps key={run.run.id} res={run} onOpen={(id) => router.push(`/ripple/${id}`)} />}
        <div className="rounded-2xl border bg-card p-6">
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

const STEP_MS = 450;

/** The agent run of the last Refresh, step by step: fetch → classify → gate → match metrics → assess impact. */
function RunSteps({ res, onOpen }: { res: RefreshResponse; onOpen: (rippleId: string) => void }) {
  const steps = res.run.steps ?? [];
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Activity className="size-4 text-muted-foreground" /> Agent run {res.run.id}
        <span className="text-xs font-normal text-muted-foreground">
          {res.signals.length} new · ${res.run.llmCostUsd.toFixed(2)}
        </span>
      </p>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li
            key={s.name}
            className="animate-in fade-in slide-in-from-left-2 fill-mode-both rounded-lg border bg-recessed px-3 py-2.5 text-xs duration-300 motion-reduce:animate-none"
            style={{ animationDelay: `${i * STEP_MS}ms` }}
          >
            <p className="flex items-center gap-1.5 font-medium">
              {s.status === "ok" ? <CheckCircle2 className="size-3.5 text-positive" /> : s.status === "failed" ? <XCircle className="size-3.5 text-negative" /> : <span className="size-3.5 rounded-full border border-border-strong" />}
              {i + 1}. {s.name}
            </p>
            <p className="mt-1 text-muted-foreground">{s.detail}</p>
          </li>
        ))}
      </ol>
      {res.ripples.length > 0 && (
        <div className="animate-in fade-in fill-mode-both mt-3 flex flex-wrap gap-2 duration-300 motion-reduce:animate-none" style={{ animationDelay: `${steps.length * STEP_MS}ms` }}>
          {res.ripples.map((r) => (
            <Button key={r.id} size="sm" variant={r.status === "active" ? "default" : "outline"} onClick={() => onOpen(r.id)}>
              <Waves className={r.status === "active" ? "size-3.5 text-ember" : "size-3.5"} /> {r.summary}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function RunsPopover({ runs }: { runs: { id: string; agent: keyof typeof agentLabel; status: string; newSignals: number; rejected: number; llmCostUsd: number; startedAt: string; rippleId?: string | null }[] }) {
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
              {r.rippleId && (
                <Link href={`/ripple/${r.rippleId}`} className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground">
                  <Waves className="size-3.5 text-ember" /> View ripple
                </Link>
              )}
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
        <p className="mb-1 text-xs text-muted-foreground">Rejected by the validation gate; never part of a case.</p>
        <ul className="space-y-2.5 text-xs">
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
  const [type, setType] = useState<CaseType>("fix_improve");
  const [depth, setDepth] = useState<ChangeDepth>("part_module");
  return (
    <RationaleDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Start a case from ${signalIds.length} signal${signalIds.length === 1 ? "" : "s"}`}
      description="Name the customer problem, not the solution. Pick signals of one topic and one aspect: the case takes both, and its car area, from them."
      confirmLabel="Create case"
      pending={create.isPending}
      canSubmit={title.trim().length > 2}
      onSubmit={async (rationale) => {
        const c = await create.mutateAsync({ body: { title, summary: summary || title, series, scope, type, changeDepth: depth, signalIds, rationale } });
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
