"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, FileText, Globe, MessageSquareText, MessagesSquare, Newspaper, PlaySquare, Rss, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sayLabel, type SankeyGraph, type SankeyNode, type SayType, type Tone } from "@/lib/sankey";

/**
 * Three-column Sankey drawn as cards plus SVG bands (no layout library).
 * Card heights follow the value with a minimum, so small facts stay readable;
 * band thickness is to scale, so the strength of each signal is visible at a glance.
 */

const sourceIcon: Record<string, LucideIcon> = {
  "src:feedback": MessageSquareText,
  "src:study": ClipboardList,
  "src:option": FileText,
  "src:reviews": Newspaper,
  "src:video": PlaySquare,
  "src:forum": MessagesSquare,
  "src:news": Rss,
  "src:competitor": Globe,
};

const toneBorder: Record<Tone, string> = {
  customer: "border-l-primary",
  study: "border-l-chart-2",
  web: "border-l-sky-500",
  competitor: "border-l-chart-5",
  fact: "border-l-muted-foreground/50",
};
const toneFill: Record<Tone, string> = {
  customer: "fill-primary",
  study: "fill-chart-2",
  web: "fill-sky-500",
  competitor: "fill-chart-5",
  fact: "fill-muted-foreground",
};
export const sayText: Record<SayType, string> = {
  defect: "text-negative",
  hard_to_use: "text-amber-700 dark:text-amber-400",
  wish: "text-primary",
  like: "text-positive",
  complaint: "text-negative",
  trend: "text-chart-5",
};

const HEADER = 30;
const GAP = 10;
const MIN_H = 52;

interface Placed extends SankeyNode {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface PlacedLink {
  source: string;
  target: string;
  value: number;
  tone: Tone;
  t: number;
  sy: number;
  ty: number;
}

function layout(graph: SankeyGraph, width: number) {
  const byCol = [0, 1, 2].map((c) => graph.nodes.filter((n) => n.column === c));
  const nonHero = graph.nodes.filter((n) => !n.hero);
  const total = Math.max(1, ...[0, 1, 2].map((c) => byCol[c].reduce((s, n) => s + n.value, 0)));
  const maxNode = Math.max(1, ...nonHero.map((n) => n.value));
  const k = Math.min(4, 100 / maxNode, 440 / total);

  const leftW = Math.min(230, Math.max(150, width * 0.22));
  const midW = Math.min(290, Math.max(190, width * 0.29));
  const rightW = Math.min(240, Math.max(160, width * 0.22));
  const xs = [0, leftW + (width - leftW - midW - rightW) / 2, width - rightW];
  const ws = [leftW, midW, rightW];

  const height = (n: SankeyNode) => (n.hero ? Math.max(220, total * k + 48) : Math.max(MIN_H, n.value * k));
  const colHeight = (nodes: SankeyNode[]) => nodes.reduce((s, n) => s + height(n), 0) + GAP * Math.max(0, nodes.length - 1);
  const H = Math.max(...byCol.map(colHeight));

  const placed = new Map<string, Placed>();
  const stack = (nodes: SankeyNode[], col: number) => {
    let y = HEADER + (H - colHeight(nodes)) / 2;
    for (const n of nodes) {
      const h = height(n);
      placed.set(n.id, { ...n, x: xs[col], y, w: ws[col], h });
      y += h + GAP;
    }
  };
  // Middle keeps the given order; the outer columns follow the middle (barycenter) to limit crossings.
  stack(byCol[1], 1);
  const center = (id: string) => {
    const p = placed.get(id)!;
    return p.y + p.h / 2;
  };
  const bary = (n: SankeyNode) => {
    const ls = graph.links.filter((l) => (l.source === n.id && placed.has(l.target)) || (l.target === n.id && placed.has(l.source)));
    const sum = ls.reduce((s, l) => s + l.value, 0) || 1;
    return ls.reduce((s, l) => s + center(l.source === n.id ? l.target : l.source) * l.value, 0) / sum;
  };
  stack([...byCol[0]].sort((a, b) => bary(a) - bary(b)), 0);
  stack([...byCol[2]].sort((a, b) => bary(a) - bary(b)), 2);

  // Bands: stacked and centred on each node, ordered by the far end to avoid crossings.
  const links: PlacedLink[] = graph.links
    .filter((l) => placed.has(l.source) && placed.has(l.target))
    .map((l) => ({ ...l, t: Math.max(1.5, l.value * k), sy: 0, ty: 0 }));
  for (const n of placed.values()) {
    const out = links.filter((l) => l.source === n.id).sort((a, b) => center(a.target) - center(b.target));
    let y = n.y + n.h / 2 - out.reduce((s, l) => s + l.t, 0) / 2;
    for (const l of out) {
      l.sy = y + l.t / 2;
      y += l.t;
    }
    const inc = links.filter((l) => l.target === n.id).sort((a, b) => center(a.source) - center(b.source));
    y = n.y + n.h / 2 - inc.reduce((s, l) => s + l.t, 0) / 2;
    for (const l of inc) {
      l.ty = y + l.t / 2;
      y += l.t;
    }
  }
  return { placed, links, height: H + HEADER + 4, xs, ws };
}

function band(l: PlacedLink, x0: number, x1: number) {
  const xm = (x0 + x1) / 2;
  const a = l.t / 2;
  return `M${x0},${l.sy - a} C${xm},${l.sy - a} ${xm},${l.ty - a} ${x1},${l.ty - a} L${x1},${l.ty + a} C${xm},${l.ty + a} ${xm},${l.sy + a} ${x0},${l.sy + a} Z`;
}

export function SankeyChart({
  graph,
  heroValue,
  titles = ["Sources", "What they say", "Case"],
  selectedId,
  onSelect,
  className,
}: {
  graph: SankeyGraph;
  /** Big number shown in the hero node (e.g. distinct customers). */
  heroValue?: number;
  titles?: [string, string, string];
  selectedId?: string | null;
  onSelect?: (n: SankeyNode) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width > 0 && width < 680;
  const L = width && !narrow ? layout(graph, width) : null;
  const focus = hover ?? selectedId ?? null;
  const touches = (l: { source: string; target: string }) => !focus || l.source === focus || l.target === focus;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {narrow && <SankeyList graph={graph} onSelect={onSelect} selectedId={selectedId} />}
      {L && (
        <div className="relative" style={{ height: L.height }}>
          {titles.map((t, i) => (
            <div key={t} className="absolute top-0 text-xs font-medium text-muted-foreground" style={{ left: L.xs[i] }}>
              {t}
            </div>
          ))}
          <svg className="absolute inset-0 overflow-visible" width={width} height={L.height} aria-hidden>
            {L.links.map((l) => {
              const s = L.placed.get(l.source)!;
              const t = L.placed.get(l.target)!;
              const on = touches(l);
              return (
                <path
                  key={`${l.source}>${l.target}`}
                  d={band(l, s.x + s.w, t.x)}
                  className={cn(toneFill[l.tone], "transition-opacity duration-150 motion-reduce:transition-none")}
                  style={{ opacity: focus ? (on ? 0.5 : 0.07) : l.tone === "fact" ? 0.18 : 0.24 }}
                />
              );
            })}
          </svg>
          {[...L.placed.values()].map((n) => (
            <NodeCard
              key={n.id}
              n={n}
              heroValue={heroValue}
              selected={selectedId === n.id}
              dimmed={!!focus && focus !== n.id && !L.links.some((l) => (l.source === focus && l.target === n.id) || (l.target === focus && l.source === n.id))}
              onHover={setHover}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeCard({
  n,
  heroValue,
  selected,
  dimmed,
  onHover,
  onSelect,
}: {
  n: Placed;
  heroValue?: number;
  selected: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect?: (n: SankeyNode) => void;
}) {
  const Icon = sourceIcon[n.id];
  const common = {
    title: n.sub && !n.say ? `${n.label} · ${n.sub}` : n.label,
    style: { left: n.x, top: n.y, width: n.w, height: n.h },
    onMouseEnter: () => onHover(n.id),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover(n.id),
    onBlur: () => onHover(null),
    onClick: () => onSelect?.(n),
  };
  if (n.hero)
    return (
      <button
        {...common}
        className={cn(
          "absolute flex flex-col justify-center gap-1 rounded-xl bg-foreground px-5 text-left text-background shadow-sm transition hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          selected && "ring-2 ring-primary",
        )}
      >
        <span className="text-4xl font-semibold tabular-nums">{heroValue ?? n.value}</span>
        <span className="text-sm opacity-70">{n.sub}</span>
        <span className="mt-2 line-clamp-3 text-sm font-medium">{n.label}</span>
      </button>
    );
  return (
    <button
      {...common}
      className={cn(
        "absolute flex items-center gap-2.5 rounded-lg border bg-card px-3 text-left shadow-xs transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        n.column === 0 && cn("border-l-[3px]", toneBorder[n.tone]),
        selected && "border-primary ring-1 ring-primary",
        dimmed && "opacity-45",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{n.label}</span>
        {n.say && <span className={cn("block truncate text-xs", sayText[n.say])}>{sayLabel[n.say]}</span>}
        {!n.say && n.sub && <span className="block truncate text-xs text-muted-foreground">{n.sub}</span>}
      </span>
      {(n.column !== 1 || n.tone === "customer") && <span className="shrink-0 text-sm font-semibold tabular-nums">{n.value}</span>}
    </button>
  );
}

/** Phone width: the same information as a ranked list. */
function SankeyList({ graph, onSelect, selectedId }: { graph: SankeyGraph; onSelect?: (n: SankeyNode) => void; selectedId?: string | null }) {
  const mids = graph.nodes.filter((n) => n.column === 1);
  const max = Math.max(1, ...mids.map((n) => n.value));
  const sources = graph.nodes.filter((n) => n.column === 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((n) => (
          <button key={n.id} onClick={() => onSelect?.(n)} className="rounded-full border bg-card px-2.5 py-1 text-xs">
            {n.label} <b className="tabular-nums">{n.value}</b>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {mids.map((n) => (
          <button
            key={n.id}
            onClick={() => onSelect?.(n)}
            className={cn("flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left", selectedId === n.id && "border-primary")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{n.label}</span>
              <span className="mt-1 block h-1.5 rounded-full bg-primary/30" style={{ width: `${(n.value / max) * 100}%` }} />
            </span>
            {n.say && <span className={cn("text-xs", sayText[n.say])}>{sayLabel[n.say]}</span>}
            <span className="text-sm font-semibold tabular-nums">{n.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
