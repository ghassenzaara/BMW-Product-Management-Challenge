"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, Columns3, Eye, EyeOff, ListOrdered, Minus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import {
  CarArea,
  CaseState as CaseStates,
  carAreaLabel,
  caseStateLabel,
  factorLabel,
  marketLabel,
  seriesShort,
  type Case,
  type CaseState,
  type FactorKey,
  type Market,
  type Series,
} from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { CaseStateBadge, Pill, ScoreBar, caseStateTone } from "@/components/common/badges";
import { useUsers } from "@/components/common/people";
import { CaseCard } from "@/components/cases/case-card";
import { CaseActionDialog, type UiCaseAction } from "@/components/cases/case-action-dialog";
import { useScores } from "@/components/cases/use-scores";
import { WeightPanel } from "@/components/cases/weight-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Scope = "mine" | "series" | "all";

const ALL = "__all";

export function CasesView() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useApi("me");
  const user = me.data?.user;
  const [view, setView] = useState<"board" | "ranked">((params.get("view") as "board") ?? "board");
  const [scopeChoice, setScope] = useState<Scope | null>(null);
  const [series, setSeries] = useState<string>(ALL);
  const [market, setMarket] = useState<string>(ALL);
  const [area, setArea] = useState<string>(ALL);
  const [owner, setOwner] = useState<string>(params.get("owner") ?? ALL);
  const [showObserved, setShowObserved] = useState(false);
  const [whatIf, setWhatIf] = useState<Record<FactorKey, number> | null>(null);

  const scope: Scope = scopeChoice ?? ((params.get("scope") as Scope | null) ?? (params.get("owner") || user?.role === "head" ? "all" : "mine"));

  const { data: cases = [] } = useApi("cases");
  const scores = useScores(undefined, whatIf);
  const { users } = useUsers();

  const filtered = useMemo(() => {
    if (!user) return [];
    return cases.filter((c) => {
      if (scope === "mine" && c.ownerId !== user.id && !c.coOwnerIds.includes(user.id)) return false;
      if (scope === "series" && !user.series.some((s) => c.series === s || c.relatedSeries.includes(s))) return false;
      if (series !== ALL && c.series !== series && !c.relatedSeries.includes(series as Series)) return false;
      if (market !== ALL && !c.markets.includes(market as Market)) return false;
      if (area !== ALL && c.carArea !== area) return false;
      if (owner !== ALL && c.ownerId !== owner) return false;
      return true;
    });
  }, [cases, user, scope, series, market, area, owner]);

  const activeFilters = [series, market, area, owner].filter((v) => v !== ALL).length;
  const setViewUrl = (v: "board" | "ranked") => {
    setView(v);
    router.replace(`/cases?view=${v}`, { scroll: false });
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Cases"
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setViewUrl(v as "board")}>
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
          <ToggleGroup type="single" variant="outline" size="sm" value={scope} onValueChange={(v) => v && setScope(v as Scope)}>
            <ToggleGroupItem value="mine" className="px-2.5">
              Mine
            </ToggleGroupItem>
            <ToggleGroupItem value="series" className="px-2.5">
              My series
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="px-2.5">
              All PMs
            </ToggleGroupItem>
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(activeFilters > 0 && "border-primary/60 text-primary")}>
                <SlidersHorizontal className="size-3.5" /> Filters{activeFilters > 0 && ` · ${activeFilters}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-64 gap-2">
              <FilterSelect value={series} onChange={setSeries} label="Series" options={(["G60", "F70", "G70"] as Series[]).map((s) => [s, seriesShort[s]])} />
              <FilterSelect value={market} onChange={setMarket} label="Market" options={(["EU", "US", "CN", "RoW"] as Market[]).map((m) => [m, marketLabel[m]])} />
              <FilterSelect value={area} onChange={setArea} label="Car area" options={CarArea.options.map((a) => [a, carAreaLabel[a]])} />
              <FilterSelect value={owner} onChange={setOwner} label="Owner" options={users.map((u) => [u.id, u.name])} />
            </PopoverContent>
          </Popover>
          {view === "board" && (
            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => setShowObserved((s) => !s)}>
              {showObserved ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} Observed {filtered.filter((c) => c.state === "observed").length}
            </Button>
          )}
        </div>
      </PageHeader>
      {view === "board" ? (
        <Board cases={filtered} scores={scores.cases} showObserved={showObserved} />
      ) : (
        <Ranked cases={filtered} scores={scores} whatIf={whatIf} setWhatIf={setWhatIf} baseWeights={me.data?.weightProfile.weights} />
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={cn("w-full", value !== ALL && "border-primary/60 text-primary")}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All · {label}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Kanban ----------
const actionFor: Partial<Record<CaseState, UiCaseAction>> = { new: "open", investigating: "start", awaiting_answers: "await", ready: "ready" };

function Board({ cases, scores, showObserved }: { cases: Case[]; scores: Map<string, { score: number; rank: number }>; showObserved: boolean }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pending, setPending] = useState<{ c: Case; action: UiCaseAction } | null>(null);
  const [decide, setDecide] = useState<Case | null>(null);
  const columns = CaseStates.options.filter((s) => showObserved || s !== "observed");

  const onDragEnd = (e: DragEndEvent) => {
    const c = cases.find((x) => x.id === e.active.id);
    const to = e.over?.id as CaseState | undefined;
    if (!c || !to || to === c.state) return;
    if (to === "decided") return setDecide(c);
    if (to === "observed") return;
    const action = c.state === "decided" && to === "investigating" ? "reopen" : actionFor[to];
    if (action) setPending({ c, action });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {columns.map((state) => {
          const col = cases.filter((c) => c.state === state).sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0));
          return <Column key={state} state={state} cases={col} scores={scores} />;
        })}
      </div>
      {pending && <CaseActionDialog c={pending.c} action={pending.action} onOpenChange={(o) => !o && setPending(null)} />}
      <Dialog open={!!decide} onOpenChange={(o) => !o && setDecide(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide {decide?.id}</DialogTitle>
            <DialogDescription>How does this case end? Every outcome keeps the evidence and the reason.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(
              [
                ["confirm", "Confirm → build requirement(s)", "Next generation, mid-life update or OTA"],
                ["refer", "Refer to another PM", "Other series or attribute owner"],
                ["innovation", "Innovation pool", "For a future series or new product"],
                ["park", "Park and keep watching", "Reopens on new evidence"],
                ["merge", "Merge into another case", "Same problem"],
                ["reject", "Reject", "Not worth solving, reason kept"],
              ] as [UiCaseAction, string, string][]
            ).map(([a, label, hint]) => (
              <button
                key={a}
                className="rounded-md border px-3 py-2 text-left hover:border-primary/60 hover:bg-muted/50"
                onClick={() => {
                  setPending({ c: decide!, action: a });
                  setDecide(null);
                }}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

function Column({ state, cases, scores }: { state: CaseState; cases: Case[]; scores: Map<string, { score: number; rank: number }> }) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  const toneDot = { slate: "bg-slate-400", sky: "bg-sky-500", violet: "bg-violet-500", amber: "bg-amber-500", emerald: "bg-emerald-500" } as Record<string, string>;
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/60 transition", isOver && "bg-primary/10 ring-2 ring-primary/40")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", toneDot[caseStateTone[state]] ?? "bg-slate-400")} />
        <span className="text-sm font-semibold">{caseStateLabel[state]}</span>
        <span className="text-xs text-muted-foreground">{cases.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        {cases.map((c) => (
          <DraggableCard key={c.id} c={c} score={scores.get(c.id)?.score} rank={scores.get(c.id)?.rank} />
        ))}
        {cases.length === 0 && <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">Drop a case here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ c, score, rank }: { c: Case; score?: number; rank?: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, position: "relative" } : undefined} {...attributes} {...listeners}>
      <CaseCard c={c} score={score} rank={rank} dragging={isDragging} />
    </div>
  );
}

// ---------- Ranked ----------
function Ranked({
  cases,
  scores,
  whatIf,
  setWhatIf,
  baseWeights,
}: {
  cases: Case[];
  scores: ReturnType<typeof useScores>;
  whatIf: Record<FactorKey, number> | null;
  setWhatIf: (w: Record<FactorKey, number> | null) => void;
  baseWeights?: Record<FactorKey, number>;
}) {
  const profiles = useApi("weightProfiles");
  const defaults = (profiles.data ?? []).filter((p) => p.isDefault);
  const robustness = useQueries({
    queries: defaults.map((p) => ({ queryKey: ["scores", null, { profileId: p.id }, null], queryFn: () => api("scores", { query: { profileId: p.id } }) })),
  });
  const ids = new Set(cases.map((c) => c.id));
  const ranked = (scores.data?.cases ?? []).filter((s) => ids.has(s.caseId));
  const byId = new Map(cases.map((c) => [c.id, c]));
  const localRank = new Map(ranked.map((s, i) => [s.caseId, i + 1]));
  const savedLocal = new Map((scores.saved?.cases ?? []).filter((s) => ids.has(s.caseId)).map((s, i) => [s.caseId, i + 1]));
  const topIn = (caseId: string) =>
    robustness.filter((q) => {
      const list = (q.data?.cases ?? []).filter((s) => ids.has(s.caseId));
      const idx = list.findIndex((s) => s.caseId === caseId);
      return idx >= 0 && idx < 5;
    }).length;

  return (
    <div className="flex-1 space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(whatIf && "border-primary/60 text-primary")}>
              <SlidersHorizontal className="size-3.5" /> Weights{whatIf && " · what-if"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            {baseWeights && <WeightPanel weights={whatIf ?? baseWeights} onChange={setWhatIf} dirty={!!whatIf} onReset={() => setWhatIf(null)} />}
          </PopoverContent>
        </Popover>
        {whatIf && <span className="text-xs text-muted-foreground">Arrows show how each case moved</span>}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="grid grid-cols-[56px_1fr_160px_110px] gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase">
          <span>Rank</span>
          <span>Case</span>
          <span>Score</span>
          <span title="In the top 5 under how many default weight profiles">Robust</span>
        </div>
        {ranked.map((s) => {
          const c = byId.get(s.caseId)!;
          const r = localRank.get(c.id)!;
          const before = savedLocal.get(c.id);
          const delta = whatIf && before ? before - r : 0;
          const top = (Object.entries(s.contributions) as [FactorKey, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2);
          const why = whatIf && baseWeights && delta !== 0 ? movedBecause(c, baseWeights, whatIf, delta > 0) : null;
          const robust = topIn(c.id);
          return (
            <Link key={c.id} href={`/cases/${c.id}`} className="grid grid-cols-[56px_1fr_160px_110px] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/40">
              <span className="flex items-center gap-1 font-mono text-sm font-semibold">
                {r}
                {delta > 0 && (
                  <span className="flex items-center text-[11px] text-emerald-600">
                    <ArrowUp className="size-3" />
                    {delta}
                  </span>
                )}
                {delta < 0 && (
                  <span className="flex items-center text-[11px] text-red-600">
                    <ArrowDown className="size-3" />
                    {-delta}
                  </span>
                )}
                {whatIf && delta === 0 && <Minus className="size-3 text-muted-foreground" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.title}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{c.id}</span>
                  <CaseStateBadge state={c.state} />
                  {c.manualRank != null && <Pill t="violet">Manual rank</Pill>}
                </span>
                {why && <span className="block text-[11px] text-primary">{why}</span>}
              </span>
              <span title={top.map(([f, v]) => `${factorLabel[f]} +${v.toFixed(2)}`).join(" · ")}>
                <ScoreBar value={s.score} />
              </span>
              <span className="flex items-center gap-1 text-xs">
                {robust === defaults.length && defaults.length > 0 ? (
                  <Pill t="emerald">
                    <ShieldCheck className="size-3" /> Always top 5
                  </Pill>
                ) : (
                  <span className="text-muted-foreground">
                    {robust}/{defaults.length}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
        {ranked.length === 0 && <p className="p-6 text-sm text-muted-foreground">No ranked cases for this filter.</p>}
      </div>
    </div>
  );
}

function movedBecause(c: Case, base: Record<FactorKey, number>, next: Record<FactorKey, number>, up: boolean) {
  const changes = (Object.keys(next) as FactorKey[])
    .map((f) => ({ f, d: (next[f] - base[f]) * c.factors[f] }))
    .filter((x) => Math.abs(x.d) > 0.001)
    .sort((a, b) => (up ? b.d - a.d : a.d - b.d));
  const top = changes[0];
  if (!top) return null;
  const dir = next[top.f] > base[top.f] ? "↑" : "↓";
  return `${up ? "Moved up" : "Moved down"} because ${factorLabel[top.f]} weight ${dir} and this case scores ${c.factors[top.f].toFixed(2)} on it`;
}
