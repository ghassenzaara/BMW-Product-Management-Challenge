"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, BookMarked, Building2, FileSpreadsheet, MessageSquareText, Pin } from "lucide-react";
import {
  FactorKey as FactorKeys,
  factorHint,
  factorLabel,
  marketLabel,
  seriesShort,
  type Case,
  type ContextItem,
  type FactorKey,
  type ScoredCase,
  type Signal,
} from "@/contracts";
import { agentLabel } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fmtDate, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AreaChip, DepthChip, EvidenceBadge, Pill, RegionChip, TypeChip } from "@/components/common/badges";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-2.5 border-b px-5 py-4 last:border-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CaseDetails({ c, scored, signals, canEdit }: { c: Case; scored?: ScoredCase; signals: Signal[]; canEdit: boolean }) {
  const me = useApi("me");
  const weights = me.data?.weightProfile.weights;
  const patch = useApiMutation("patchCase", { success: "Saved" });
  const [brandOpen, setBrandOpen] = useState(false);
  const [brand, setBrand] = useState(c.brandFit.value);
  const [rankOpen, setRankOpen] = useState(false);
  const [rank, setRank] = useState<string>(c.manualRank?.toString() ?? "");
  const byAgent = new Map<string, number>();
  signals.forEach((s) => byAgent.set(s.agent, (byAgent.get(s.agent) ?? 0) + 1));

  return (
    <div className="text-sm">
      <Block
        title="Importance score"
        action={
          canEdit && (
            <Button variant="ghost" size="xs" onClick={() => setRankOpen(true)}>
              <Pin className="size-3" /> {c.manualRank ? `Manual #${c.manualRank}` : "Override rank"}
            </Button>
          )
        }
      >
        <div className="flex items-end gap-3">
          <span className="text-3xl font-semibold tabular-nums">{scored ? scored.score.toFixed(2) : "—"}</span>
          {scored && <span className="pb-1 text-xs text-muted-foreground">rank #{scored.rank} under “{me.data?.weightProfile.name}”</span>}
        </div>
        {c.manualRank != null && <p className="text-xs text-tone-violet-fg">Manual rank #{c.manualRank}: {c.manualRankReason}</p>}
        <div className="space-y-1.5 pt-1">
          {FactorKeys.options.map((f: FactorKey) => (
            <Tooltip key={f}>
              <TooltipTrigger asChild>
                <div className="grid cursor-help grid-cols-[110px_1fr_52px] items-center gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{factorLabel[f]}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground/80" style={{ width: `${c.factors[f] * 100}%` }} />
                  </div>
                  <span className="text-right font-mono tabular-nums">
                    {c.factors[f].toFixed(2)}
                    <span className="text-muted-foreground"> ×{weights?.[f].toFixed(1)}</span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                {factorHint[f]} {scored && `Contributes +${scored.contributions[f].toFixed(3)}.`}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <EvidenceBadge level={c.evidenceLevel} />
          <span className="text-xs text-muted-foreground">No cost here: a problem has no cost. Cost lives on the requirement.</span>
        </div>
      </Block>

      <Block title="Markets">
        {c.marketConflict && (
          <div className="flex gap-2 rounded-lg border border-tone-amber-bd bg-tone-amber-bg p-2.5 text-xs">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <span>{c.marketConflict.note}</span>
          </div>
        )}
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="font-normal">Market</th>
              <th className="text-right font-normal" title="Distinct customer signals">Cust.</th>
              <th className="text-right font-normal" title="Complaints / wishes / likes">C / W / L</th>
              <th className="text-right font-normal">Study</th>
              <th className="text-right font-normal" title="Share of 2030 sales volume">Vol.</th>
            </tr>
          </thead>
          <tbody>
            {c.figures.perMarket.map((m) => (
              <tr key={m.market} className="border-t">
                <td className="py-1">
                  <span className={cn("mr-1 inline-block size-2 rounded-full", m.sentiment > 0.2 ? "bg-tone-emerald-dot" : m.sentiment < -0.2 ? "bg-tone-red-dot" : "bg-tone-slate-dot")} />
                  {marketLabel[m.market]}
                </td>
                <td className="text-right font-mono">{m.customers}</td>
                <td className="text-right font-mono text-muted-foreground">
                  {m.complaints}/{m.wishes}/{m.likes}
                </td>
                <td className="text-right font-mono whitespace-nowrap" title={m.studyScore ? `${m.studyLabel}: ${m.studyScore}` : undefined}>
                  {shortStudy(m.studyScore)}
                </td>
                <td className="text-right font-mono">{pct(m.salesShare2030)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.figures.perMarket.some((m) => m.market === "CN") && <p className="text-xs text-muted-foreground">No Chinese verbatims exist in BMW&apos;s feedback data: China evidence is study + web only.</p>}
      </Block>

      <Block
        title="Brand fit"
        action={
          canEdit && (
            <Button variant="ghost" size="xs" onClick={() => setBrandOpen(true)}>
              {c.brandFit.confirmedBy ? "Change" : "Confirm"}
            </Button>
          )
        }
      >
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{c.brandFit.value.toFixed(2)}</span>
          {c.brandFit.confirmedBy ? (
            <Pill t="emerald">
              <BadgeCheck className="size-3" /> PM-confirmed
            </Pill>
          ) : (
            <Pill t="amber">AI proposal</Pill>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{c.brandFit.reason}</p>
      </Block>

      <Block title="Classification">
        <div className="flex flex-wrap gap-1">
          <RegionChip region={c.scope} />
          <AreaChip area={c.carArea} />
          <TypeChip type={c.type} />
          <DepthChip depth={c.changeDepth} />
          <Pill>{seriesShort[c.series]}</Pill>
          {c.relatedSeries.map((s) => (
            <Pill key={s} t="outline">
              also {seriesShort[s]}
            </Pill>
          ))}
        </div>
        <p className="text-xs">
          <span className="text-muted-foreground">Feature: </span>
          {c.featureName}
        </p>
      </Block>

      <Block title="Today's car and competitors">
        <p className="text-xs">
          <Building2 className="mr-1 inline size-3 text-muted-foreground" />
          {c.figures.equipmentToday}
        </p>
        {c.figures.competitorOffer.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {c.figures.competitorOffer.map((x) => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
        )}
        {c.figures.trend && <p className="text-xs text-muted-foreground">Trend: {c.figures.trend}</p>}
      </Block>

      <Block title="Context pack · what the AI and you work from">
        <ContextGroup icon={BookMarked} label="Preset context" items={c.context.preset} />
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <FileSpreadsheet className="size-3.5 text-muted-foreground" /> Fetched signals ({signals.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {[...byAgent.entries()].map(([a, n]) => (
              <Pill key={a}>
                {agentLabel[a as keyof typeof agentLabel]} {n}
              </Pill>
            ))}
          </div>
        </div>
        <ContextGroup icon={MessageSquareText} label="Your inputs" items={c.context.pmInputs} empty="Notes, meeting notes, answers and accepted AI edits appear here." />
      </Block>

      <RationaleDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        title="Confirm brand fit"
        description="BMW brand pillars: driving dynamics, sportiness, design, premium quality, efficiency. Frequency alone is not relevance."
        confirmLabel="Save"
        pending={patch.isPending}
        defaultRationale={c.brandFit.reason}
        onSubmit={async (reason) => {
          await patch.mutateAsync({ params: { id: c.id }, body: { patch: { brandFit: { value: brand, reason, confirmedBy: me.data!.user.id } }, rationale: `Brand fit ${brand.toFixed(2)}` } });
          setBrandOpen(false);
        }}
      >
        <div className="space-y-2">
          <Label>Brand fit: {brand.toFixed(2)}</Label>
          <Slider min={0} max={1} step={0.05} value={[brand]} onValueChange={([v]) => setBrand(v)} />
        </div>
      </RationaleDialog>
      <RationaleDialog
        open={rankOpen}
        onOpenChange={setRankOpen}
        title="Override the rank"
        description="A manual rank wins over the computed score. Leave empty to go back to the score."
        confirmLabel="Save"
        pending={patch.isPending}
        defaultRationale={c.manualRankReason ?? ""}
        onSubmit={async (reason) => {
          const n = rank ? Number(rank) : null;
          await patch.mutateAsync({ params: { id: c.id }, body: { patch: { manualRank: n, manualRankReason: n ? reason : undefined }, rationale: reason } });
          setRankOpen(false);
        }}
      >
        <div className="space-y-1.5">
          <Label>Manual rank</Label>
          <Input type="number" min={1} value={rank} onChange={(e) => setRank(e.target.value)} placeholder="e.g. 1" />
        </div>
      </RationaleDialog>
    </div>
  );
}

/** "top-2 36%, bottom-3 13%" → "T2 36%"; "8.26 / 10" → "8.26". Full text in the tooltip. */
function shortStudy(s?: string) {
  if (!s) return "—";
  const top2 = s.match(/top-2 (\d+%)/);
  if (top2) return `T2 ${top2[1]}`;
  return s.replace(" / 10", "");
}

function ContextGroup({ icon: Icon, label, items, empty }: { icon: typeof BookMarked; label: string; items: ContextItem[]; empty?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5 text-muted-foreground" /> {label} ({items.length})
      </div>
      {items.length === 0 && empty && <p className="text-xs text-muted-foreground">{empty}</p>}
      <ul className="space-y-1.5">
        {items.map((i, idx) => (
          <li key={idx} className="rounded-lg border bg-recessed px-2.5 py-1.5 text-xs">
            <span className="font-medium">{i.label}</span>
            {i.at && <span className="text-muted-foreground"> · {fmtDate(i.at)}</span>}
            <span className="block text-muted-foreground">{i.detail}</span>
            {i.ref && <span className="block truncate font-mono text-xs text-muted-foreground">{i.ref}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
