"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowRight, Bell, Eye, Info, ListChecks, RotateCcw, Save, Waves } from "lucide-react";
import {
  CarArea as CarAreas,
  PortfolioRow as PortfolioRows,
  carAreaLabel,
  gapPct,
  normalize,
  portfolioRowLabel,
  rippleDecisionLabel,
  verdictLabel,
  verdictOf,
  verdictSeverity,
  type CarArea,
  type CycleConversion,
  type ImpactVerdict,
  type PortfolioRow,
  type Ripple,
  type RippleDecisionKind,
  type RippleItem,
  type User,
} from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { Pill, TrustBadge } from "@/components/common/badges";
import { UserAvatar, useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const verdictCell: Record<ImpactVerdict, string> = {
  behind: "border-tone-red-dot/70 border-l-tone-red-dot bg-tone-red-bg text-tone-red-fg hover:border-tone-red-dot",
  at_par: "border-tone-amber-bd border-l-tone-amber-dot bg-tone-amber-bg text-tone-amber-fg hover:border-tone-amber-dot",
  still_ahead: "border-tone-emerald-bd border-l-tone-emerald-dot bg-tone-emerald-bg text-tone-emerald-fg hover:border-tone-emerald-dot",
  not_comparable: "border-tone-slate-bd border-l-tone-slate-dot bg-tone-slate-bg text-tone-slate-fg hover:border-tone-slate-dot",
};
const verdictPill: Record<ImpactVerdict, "red" | "amber" | "emerald" | "slate"> = { behind: "red", at_par: "amber", still_ahead: "emerald", not_comparable: "slate" };
const pulseColor: Record<ImpactVerdict, string> = { behind: "rgb(255 90 0 / 0.45)", at_par: "rgb(255 90 0 / 0.4)", still_ahead: "rgb(255 90 0 / 0.3)", not_comparable: "rgb(255 90 0 / 0.2)" };

type Live = { verdict: ImpactVerdict; gap: number | null; theirs: number | null; low: number | null; high: number | null; cycle: string | null };

/** Recomputes an item with a what-if factor (same rule as the backend, contracts/compare.ts). */
function liveOf(it: RippleItem, r: Ripple, table: CycleConversion[], override: Record<string, number>): Live {
  const server: Live = { verdict: it.verdict, gap: it.gapPct, theirs: it.theirsNormalized?.value ?? null, low: it.theirsNormalized?.low ?? null, high: it.theirsNormalized?.high ?? null, cycle: it.theirsNormalized?.cycle ?? null };
  const ours =
    it.ours ?? (it.theirsNormalized && it.gapPct !== null ? { value: Math.round(it.theirsNormalized.value * (1 + it.gapPct / 100)), unit: it.theirsNormalized.unit, cycle: it.theirsNormalized.cycle, comparator: "gte" as const } : null);
  if (!ours || it.verdict === "not_comparable") return server;
  const n = normalize(r.fact.value, r.fact.cycle, ours.cycle, table, override);
  if (!n) return server;
  const gap = gapPct(ours.value, n.value, ours.comparator);
  return { verdict: verdictOf(gap, r.tolerancePct), gap, theirs: n.value, low: n.low, high: n.high, cycle: ours.cycle };
}

export function RippleView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const q = useApi("ripple", { params: { id } });
  const me = useApi("me");
  const [override, setOverride] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);
  const [drawer, setDrawer] = useState<{ row?: PortfolioRow; area?: CarArea } | null>(search.get("item") ? {} : null);
  if (q.error)
    return (
      <div className="space-y-2 p-6 text-sm">
        <p className="text-muted-foreground">{q.error.message}</p>
        <p className="text-muted-foreground">Ripples live in the demo store, so after Reset demo data an old link points to a ripple that no longer exists. Run the agents again to create it.</p>
        <Link href="/radar" className="inline-flex items-center gap-1 font-medium underline decoration-border-strong underline-offset-2 hover:decoration-foreground">
          Signals → Refresh <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  if (!q.data || !me.data) return <div className="p-6 text-sm text-muted-foreground">Loading the ripple…</div>;
  const { ripple: r, conversions, settings } = q.data;
  const user = me.data.user;
  const live = new Map(r.items.map((it) => [it.id, liveOf(it, r, conversions, override)]));
  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Waves className="size-6 text-ember" /> World changed: {r.fact.competitor} {r.fact.value} {r.fact.unit} {r.fact.cycle}
          </span>
        }
        description={`${r.fact.summary} · ${r.fact.sourceName} · ${fmtDate(r.createdAt)}`}
        actions={
          <>
            <TrustBadge trust={r.fact.trust} />
            <Pill t={r.status === "watch" ? "slate" : "amber"}>{r.status === "watch" ? "Watch list only" : "Active"}</Pill>
            <Button size="sm" onClick={() => setDrawer({})}>
              <ListChecks className="size-3.5" /> Impact list ({r.items.length})
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {r.statusReason}
        </p>
      </PageHeader>
      <div className="space-y-6 p-6">
        <NormalizationBand ripple={r} conversions={conversions} override={override} setOverride={setOverride} user={user} />
        <PortfolioGrid ripple={r} live={live} user={user} showAll={showAll} setShowAll={setShowAll} onOpen={(row, area) => setDrawer({ row, area })} />
        <p className="text-xs text-muted-foreground">
          At par = within ±{r.tolerancePct}% after conversion. A kept target stays muted until the gap grows by more than {settings.muteThresholdPct} points (Settings). Nothing changes until an owner decides; every decision needs a reason and goes into the audit trail.
        </p>
      </div>
      <ImpactDrawer ripple={r} live={live} user={user} filter={drawer} focusItem={search.get("item")} onOpenChange={(o) => !o && setDrawer(null)} />
    </div>
  );
}

function NormalizationBand({ ripple: r, conversions, override, setOverride, user }: { ripple: Ripple; conversions: CycleConversion[]; override: Record<string, number>; setOverride: (o: Record<string, number>) => void; user: User }) {
  const used = conversions.filter((c) => r.conversionIds.includes(c.id));
  const [saving, setSaving] = useState<CycleConversion | null>(null);
  const save = useApiMutation("saveConversion", { success: "Team factor saved; open ripples re-assessed" });
  if (!used.length)
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        No cycle conversion needed: every comparable target uses the fact&apos;s cycle ({r.fact.cycle}).
      </div>
    );
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      {used.map((c) => {
        const f = override[c.id] ?? c.factor;
        const value = Math.round(r.fact.value * (c.from === r.fact.cycle ? f : 1 / f));
        const to = c.from === r.fact.cycle ? c.to : c.from;
        const edited = override[c.id] !== undefined && override[c.id] !== c.factor;
        return (
          <div key={c.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-lg font-semibold tabular-nums">
                {r.fact.value} {r.fact.unit} {r.fact.cycle} ≈ {value} {r.fact.unit} {to}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">factor</span>
                <input
                  type="range"
                  min={c.range[0]}
                  max={c.range[1]}
                  step={0.01}
                  value={f}
                  onChange={(e) => setOverride({ ...override, [c.id]: Number(e.target.value) })}
                  className="w-40 accent-ember"
                  aria-label={`${c.from} to ${c.to} factor`}
                />
                <span className="w-10 font-mono tabular-nums">{f.toFixed(2)}</span>
              </label>
              <span className="text-xs text-muted-foreground">
                range {c.range[0]}–{c.range[1]} → {Math.round(r.fact.value * (c.from === r.fact.cycle ? c.range[0] : 1 / c.range[1]))}–{Math.round(r.fact.value * (c.from === r.fact.cycle ? c.range[1] : 1 / c.range[0]))} {r.fact.unit} {to}
              </span>
              {c.isAssumption && <Pill t="amber">Assumption</Pill>}
              {edited && (
                <>
                  <Button size="xs" variant="ghost" onClick={() => setOverride({ ...override, [c.id]: c.factor })}>
                    <RotateCcw className="size-3" /> Team value {c.factor}
                  </Button>
                  {user.role === "head" && (
                    <Button size="xs" variant="outline" onClick={() => setSaving(c)}>
                      <Save className="size-3" /> Save as team assumption
                    </Button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {c.source} {edited && user.role !== "head" ? "Your factor is a what-if for this screen only; the head of product line owns the team value." : ""}
            </p>
          </div>
        );
      })}
      <RationaleDialog
        open={!!saving}
        onOpenChange={(o) => !o && setSaving(null)}
        title={`Change the ${saving?.from}→${saving?.to} factor to ${saving ? (override[saving.id] ?? saving.factor).toFixed(2) : ""}`}
        description="It stays a labelled assumption. Every open ripple is re-assessed with it; no alert is re-sent."
        confirmLabel="Save factor"
        pending={save.isPending}
        onSubmit={async (rationale) => {
          if (!saving) return;
          await save.mutateAsync({ params: { id: saving.id }, body: { factor: override[saving.id] ?? saving.factor, rationale } });
          setOverride({});
          setSaving(null);
        }}
      />
    </div>
  );
}

function PortfolioGrid({ ripple: r, live, user, showAll, setShowAll, onOpen }: { ripple: Ripple; live: Map<string, Live>; user: User; showAll: boolean; setShowAll: (v: boolean) => void; onOpen: (row: PortfolioRow, area: CarArea) => void }) {
  const affected = [...new Set(r.items.map((i) => i.carArea))];
  const areas = showAll ? CarAreas.options : CarAreas.options.filter((a) => affected.includes(a));
  const rows = PortfolioRows.options;
  const cell = (row: PortfolioRow, area: CarArea) => r.items.filter((i) => i.carArea === area && (i.row === row || i.alsoRows.includes(row)));
  // The fact comes in on the China row when it is a China fact; the pulse spreads from there.
  const srcRow = rows.indexOf(r.fact.market === "CN" ? "G60_CN" : "G60");
  const srcCol = Math.max(0, areas.indexOf(affected[0]));
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg font-semibold">Portfolio</p>
        <span className="text-xs text-muted-foreground">Series × car area. Your cells are outlined; colleagues&apos; cells show their avatar. Click a cell for its items.</span>
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Only affected areas" : `Show all ${CarAreas.options.length}`}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th className="w-44" />
              {areas.map((a) => (
                <th key={a} className="min-w-36 text-left text-xs font-medium text-muted-foreground">
                  {carAreaLabel[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row}>
                <th className="text-left text-xs font-medium whitespace-nowrap">{portfolioRowLabel[row]}</th>
                {areas.map((area, ci) => {
                  const items = cell(row, area);
                  if (!items.length) return <td key={area} className="h-16 rounded-lg border border-dashed border-border-strong/70" />;
                  // Targets decide the colour; a case without a target (today's car) only when the cell has no target.
                  const targets = items.filter((i) => i.kind === "requirement");
                  const cases = items.filter((i) => i.kind === "case");
                  const worst = (targets.length ? targets : cases).map((i) => live.get(i.id)!.verdict).sort((a, b) => verdictSeverity[b] - verdictSeverity[a])[0];
                  const moved = cases.filter((i) => i.rankBefore !== null && i.rankAfter !== null && i.rankAfter < i.rankBefore);
                  const mine = items.some((i) => i.ownerId === user.id || i.coOwnerIds.includes(user.id));
                  const owners = [...new Set(items.map((i) => i.ownerId))].filter((o) => o !== user.id);
                  const distance = Math.abs(ri - srcRow) + Math.abs(ci - srcCol);
                  return (
                    <td key={area} className="h-16 p-0">
                      <button
                        onClick={() => onOpen(row, area)}
                        className={cn("ripple-cell flex h-full w-full flex-col justify-between rounded-lg border border-l-4 px-2.5 py-1.5 text-left transition-colors duration-150", verdictCell[worst], mine && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                        style={{ ["--ripple-delay" as string]: `${distance * 280}ms`, ["--ripple-color" as string]: pulseColor[worst] }}
                        aria-label={`${portfolioRowLabel[row]}, ${carAreaLabel[area]}: ${verdictLabel[worst]}, ${items.length} items`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          {verdictLabel[worst]}
                          {items.some((i) => i.muted) && <span className="font-normal">· muted</span>}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          {targets.length ? `${targets.length} target${targets.length > 1 ? "s" : ""}` : "no target"}
                          {targets.some((i) => i.alsoRows.includes(row)) && " · Baukasten"}
                          {moved.length > 0 && ` · ${moved.length} case re-ranked ↑`}
                          <span className="ml-auto flex -space-x-1">
                            {owners.slice(0, 2).map((o) => (
                              <UserAvatar key={o} id={o} size="xs" />
                            ))}
                          </span>
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImpactDrawer({ ripple: r, live, user, filter, focusItem, onOpenChange }: { ripple: Ripple; live: Map<string, Live>; user: User; filter: { row?: PortfolioRow; area?: CarArea } | null; focusItem: string | null; onOpenChange: (o: boolean) => void }) {
  const items = useMemo(
    () =>
      r.items
        .filter((i) => !filter?.row || i.row === filter.row || i.alsoRows.includes(filter.row))
        .filter((i) => !filter?.area || i.carArea === filter.area)
        .sort((a, b) => (a.id === focusItem ? -1 : b.id === focusItem ? 1 : verdictSeverity[live.get(b.id)!.verdict] - verdictSeverity[live.get(a.id)!.verdict])),
    [r.items, filter, focusItem, live],
  );
  return (
    <Sheet open={!!filter} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>Impact list{filter?.row ? ` · ${portfolioRowLabel[filter.row]}` : ""}{filter?.area ? ` · ${carAreaLabel[filter.area]}` : ""}</SheetTitle>
          <SheetDescription>
            {items.length} items · {r.fact.competitor} {r.fact.value} {r.fact.unit} {r.fact.cycle}, trust {r.fact.trust}
          </SheetDescription>
        </SheetHeader>
        <ul className="divide-y">
          {items.map((it) => (
            <ItemRow key={it.id} ripple={r} it={it} live={live.get(it.id)!} user={user} focused={it.id === focusItem} />
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function ItemRow({ ripple: r, it, live, user, focused }: { ripple: Ripple; it: RippleItem; live: Live; user: User; focused: boolean }) {
  const { name } = useUsers();
  const [kind, setKind] = useState<RippleDecisionKind | null>(null);
  const [value, setValue] = useState("");
  const decide = useApiMutation("decideRippleItem", { success: (x) => (x.proposal ? `Proposal ${x.proposal.id} created: the owner accepts it on the requirement` : "Decision recorded") });
  const owner = user.id === it.ownerId || it.coOwnerIds.includes(user.id) || user.role === "head";
  const series = it.row === "G60_CN" ? "G60" : it.row;
  const regional = user.region !== "global" && user.series.includes(series as User["series"][number]);
  const comparable = !!it.ours && live.verdict !== "not_comparable";
  const suggest = live.theirs ? Math.ceil((live.theirs * (1 + (r.tolerancePct + 1) / 100)) / 10) * 10 : null;
  const actions: RippleDecisionKind[] = [];
  if (owner && !it.decision) {
    if (it.kind === "requirement" && comparable) actions.push("raise_target");
    actions.push("keep", "reopen_case");
  }
  if (regional && !it.variant && it.kind === "requirement" && it.ours?.market === "global" && user.region === "CN") actions.push("market_variant");
  const href = it.kind === "requirement" ? `/requirements/${it.objectId}` : `/cases/${it.objectId}`;
  return (
    <li className={cn("space-y-2 px-6 py-5", focused && "bg-recessed shadow-[inset_3px_0_0_var(--color-ember)]")}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} className="font-mono text-xs font-medium underline decoration-border-strong underline-offset-2 transition-colors duration-150 hover:decoration-foreground">
          {it.objectId}
        </Link>
        <Pill t={verdictPill[live.verdict]}>{verdictLabel[live.verdict]}</Pill>
        {live.verdict !== it.verdict && <span className="text-xs text-muted-foreground">(server: {verdictLabel[it.verdict].toLowerCase()} at the team factor)</span>}
        {it.muted && <Pill t="slate">Muted</Pill>}
        <span className="text-xs text-muted-foreground">
          {portfolioRowLabel[it.row]}
          {it.alsoRows.length > 0 && ` + ${it.alsoRows.map((x) => portfolioRowLabel[x]).join(", ")} (Baukasten)`} · {it.status.replace(/_/g, " ")}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          <UserAvatar id={it.ownerId} size="xs" /> {name(it.ownerId)}
        </span>
      </div>
      <p className="text-sm leading-snug font-medium">{it.title}</p>
      <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Ours: </span>
          {it.ours?.text ?? "No target yet"}
        </p>
        <p>
          <span className="text-muted-foreground">Competitor, normalized: </span>
          {live.theirs !== null ? (
            <>
              {live.theirs} km {live.cycle} {live.low !== live.high && <span className="text-muted-foreground">({live.low}–{live.high})</span>} · gap {live.gap! > 0 ? "+" : ""}
              {live.gap}%
            </>
          ) : (
            "—"
          )}
        </p>
        <p className="sm:col-span-2 text-muted-foreground">{it.reason}</p>
        <p>
          <span className="text-muted-foreground">Rank: </span>
          {it.rankBefore !== null ? `${it.rankBefore} → ${it.rankAfter}` : "—"}
          {it.movedBecause && <span className="block text-muted-foreground">{it.movedBecause}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">Notified: </span>
          {it.notified.length ? (
            it.notified.map((n) => (
              <span key={n.userId + n.kind} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5">
                {n.kind === "fyi" ? <Eye className="size-3" /> : <Bell className="size-3" />}
                {name(n.userId).split(" ")[0]} · {n.kind === "head" ? "head (signed off)" : n.kind}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">nobody{it.muted ? " (muted)" : r.status === "watch" ? " (watch list)" : ""}</span>
          )}
        </p>
      </div>
      {(it.decision || it.variant) && (
        <div className="space-y-1 rounded-lg border bg-recessed px-3 py-2.5 text-xs">
          {it.decision && (
            <p>
              <span className="font-medium">{rippleDecisionLabel[it.decision.kind]}</span> by {name(it.decision.by)} · “{it.decision.rationale}”
              {it.decision.proposalId && <ProposalLink id={it.decision.proposalId} href={href} />}
            </p>
          )}
          {it.variant && (
            <p>
              <span className="font-medium">Market variant proposed</span> by {name(it.variant.by)} · “{it.variant.rationale}”
              {it.variant.proposalId && <ProposalLink id={it.variant.proposalId} href="/requirements" />}
            </p>
          )}
        </div>
      )}
      {actions.length > 0 && r.status === "active" && (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <Button key={a} size="xs" variant={a === "keep" ? "default" : "outline"} onClick={() => (setValue(suggest ? String(a === "market_variant" ? Math.ceil((r.fact.value * (1 + (r.tolerancePct + 1) / 100)) / 10) * 10 : suggest) : ""), setKind(a))}>
              {rippleDecisionLabel[a]}
            </Button>
          ))}
        </div>
      )}
      <RationaleDialog
        open={!!kind}
        onOpenChange={(o) => !o && setKind(null)}
        title={kind ? `${rippleDecisionLabel[kind]}: ${it.objectId}` : ""}
        description={
          kind === "raise_target"
            ? `Creates a proposal for the next version${["signed_off", "planned", "exported"].includes(it.status) ? "; it needs a new sign-off by the head" : ""}. Nothing changes until the owner accepts it.`
            : kind === "market_variant"
              ? "Proposes a China variant (CLTC) of this global requirement. The China requirement's owner accepts or rejects it."
              : kind === "keep"
                ? `Keeps the target. Repeats are muted for ${it.objectId} until the gap grows by more than the threshold; your reason goes into the monitor's context.`
                : "Moves the case back to investigating; the decision and your reason are logged."
        }
        confirmLabel={kind ? rippleDecisionLabel[kind] : "Confirm"}
        pending={decide.isPending}
        onSubmit={async (rationale) => {
          if (!kind) return;
          await decide.mutateAsync({ params: { id: r.id, itemId: it.id }, body: { kind, rationale, ...(value && (kind === "raise_target" || kind === "market_variant") ? { value: Number(value) } : {}) } });
          setKind(null);
        }}
      >
        {(kind === "raise_target" || kind === "market_variant") && (
          <div className="space-y-1.5">
            <Label htmlFor="ripple-value">New target ({kind === "market_variant" ? "km CLTC" : `${it.ours?.unit} ${it.ours?.cycle}`})</Label>
            <Input id="ripple-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            <p className="text-xs text-muted-foreground">Suggested: just past the competitor (tolerance + 1 point). Engineering confirms feasibility.</p>
          </div>
        )}
      </RationaleDialog>
    </li>
  );
}

function ProposalLink({ id, href }: { id: string; href: string }) {
  return (
    <Link href={href} className="ml-1 inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-border-strong underline-offset-2 transition-colors duration-150 hover:decoration-foreground">
      {id} pending <ArrowRight className="size-3" />
    </Link>
  );
}
