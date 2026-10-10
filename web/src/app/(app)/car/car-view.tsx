"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Info, MessageSquareQuote, RotateCcw, X } from "lucide-react";
import { Series as SeriesEnum, marketLabel, seriesShort, type Case, type Series } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { carModels, getZone, zoneForCase, type ZoneId } from "@/lib/car/zones";
import { cn } from "@/lib/utils";
import { CaseStateBadge, EvidenceBadge, MarketChip, OutcomeBadge, Pill, ScoreBar } from "@/components/common/badges";
import { PageHeader } from "@/components/common/page";
import { useScores } from "@/components/cases/use-scores";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const CarScene = dynamic(() => import("@/components/car/car-scene"), { ssr: false });

export function CarView() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useApi("me");
  const { data: cases = [] } = useApi("cases");
  const scores = useScores();

  const caseId = params.get("case");
  const selected = cases.find((c) => c.id === caseId) ?? null;
  const seriesParam = SeriesEnum.safeParse(params.get("series"));
  const series: Series = seriesParam.success ? seriesParam.data : (selected?.series ?? me.data?.workspace.series ?? "G60");
  const model = carModels[series];
  const zoneParam = params.get("zone") as ZoneId | null;
  const zone: ZoneId | null = selected ? zoneForCase(selected) : zoneParam;

  const go = (next: { series?: Series; case?: string | null; zone?: ZoneId | null }) => {
    const q = new URLSearchParams();
    q.set("series", next.series ?? series);
    if (next.case) q.set("case", next.case);
    else if (next.zone) q.set("zone", next.zone);
    router.replace(`/car?${q}`, { scroll: false });
  };

  // Every case that applies to this car line, with the zone it sits in.
  const placed = cases
    .filter((c) => (c.series === series || c.relatedSeries.includes(series)) && c.outcome !== "rejected" && c.outcome !== "merged")
    .map((c) => ({ c, zone: zoneForCase(c), score: scores.cases.get(c.id)?.score }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const count = new Map<ZoneId, number>();
  for (const p of placed) count.set(p.zone, (count.get(p.zone) ?? 0) + 1);
  const hotspots = [...count].map(([z, n]) => ({ zone: z, count: n }));
  const listed = zone && !selected ? placed.filter((p) => p.zone === zone) : placed;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Car map"
        description="Every case placed on the car. Pick a case to fly to the part it concerns, or pick a number on the car to see the cases there."
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={series} onValueChange={(v) => v && go({ series: v as Series })}>
            {SeriesEnum.options.map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-2.5">
                {seriesShort[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <aside className="flex min-h-0 flex-col border-r bg-background">
          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            {zone && !selected ? (
              <>
                <Pill t="amber">{getZone(zone, model.body).label}</Pill>
                <span>{listed.length} cases</span>
                <button className="ml-auto flex items-center gap-1 hover:text-foreground" onClick={() => go({})}>
                  <X className="size-3" /> All zones
                </button>
              </>
            ) : (
              <span>
                {placed.length} cases on the {seriesShort[series]}, by score
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {listed.map(({ c, zone: z, score }) => (
              <button
                key={c.id}
                onClick={() => go({ case: c.id })}
                className={cn(
                  "block w-full rounded-lg border bg-card p-2.5 text-left transition hover:border-primary/50",
                  c.id === selected?.id && "border-orange-500 ring-1 ring-orange-500/50",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{c.id}</span>
                  <span className="flex-1" />
                  <Pill>{getZone(z, model.body).label}</Pill>
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-snug font-medium">{c.title}</div>
                {score !== undefined && <ScoreBar value={score} className="mt-2" />}
              </button>
            ))}
            {listed.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No cases for this car line yet.</p>}
          </div>
        </aside>

        <div className="relative min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#3a4354_0%,#1a1f2b_55%,#0e1118_100%)]">
          <CarScene model={model} active={zone} hotspots={selected ? [] : hotspots} insetRight={selected ? 360 : 0} onPick={(z) => go({ zone: z })} />

          {selected && zone && <IssueCard c={selected} zoneLabel={getZone(zone, model.body).label} score={scores.cases.get(selected.id)?.score} onClose={() => go({})} />}

          {(selected || zone) && (
            <Button size="sm" variant="secondary" className="absolute top-3 left-3" onClick={() => go({})}>
              <RotateCcw className="size-3.5" /> Whole car
            </Button>
          )}
          <p className="absolute right-3 bottom-2 left-3 flex items-start gap-1.5 text-[11px] leading-snug text-slate-300/80">
            <Info className="mt-px size-3 shrink-0" />
            <span>
              {model.note} {model.credit}.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ c, zoneLabel, score, onClose }: { c: Case; zoneLabel: string; score?: number; onClose: () => void }) {
  const bundle = useApi("caseBundle", { params: { id: c.id } });
  // The customer's own words first: complaints and wishes, not likes or competitor facts.
  const quotes = (bundle.data?.signals ?? []).filter((s) => s.kind === "complaint" || s.kind === "wish").slice(0, 2);
  const markets = c.figures.perMarket.filter((m) => m.customers > 0);
  return (
    <div className="absolute top-3 right-3 w-[340px] rounded-lg border bg-card/95 p-3.5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="size-2 rounded-full bg-orange-500" />
        <span className="font-medium text-foreground">{zoneLabel}</span>
        <span className="font-mono">{c.id}</span>
        <button className="ml-auto rounded p-0.5 hover:bg-muted" onClick={onClose} aria-label="Close">
          <X className="size-3.5" />
        </button>
      </div>
      <h2 className="mt-1.5 text-sm leading-snug font-semibold">{c.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <CaseStateBadge state={c.state} />
        {c.outcome && <OutcomeBadge outcome={c.outcome} />}
        <EvidenceBadge level={c.evidenceLevel} />
        {c.synthetic && <Pill>synthetic case</Pill>}
      </div>
      {score !== undefined && (
        <div className="mt-3">
          <div className="text-[11px] text-muted-foreground">Importance score</div>
          <ScoreBar value={score} className="mt-1" />
        </div>
      )}
      {markets.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] text-muted-foreground">Distinct customers by market</div>
          {markets.map((m) => (
            <div key={m.market} className="flex items-center gap-2 text-xs">
              <MarketChip market={m.market} />
              <span className="tabular-nums">{m.customers}</span>
              <span className="text-muted-foreground">
                {m.complaints} complaints · {m.wishes} wishes · {m.likes} likes
              </span>
            </div>
          ))}
        </div>
      )}
      {quotes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {quotes.map((s) => (
            <Link key={s.id} href={`/cases/${c.id}?tab=signals&signal=${s.id}`} className="block rounded-md border bg-muted/40 p-2 text-xs hover:border-primary/50">
              <span className="line-clamp-3">“{s.quoteEn ?? s.quote}”</span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{s.id}</span>
                {marketLabel[s.market]}
                {s.synthetic && <span>· synthetic</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/cases/${c.id}`}>
            Open case <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/cases/${c.id}?tab=signals`}>
            <MessageSquareQuote className="size-3.5" /> {c.signalIds.length} signals
          </Link>
        </Button>
      </div>
    </div>
  );
}
