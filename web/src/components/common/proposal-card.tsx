"use client";

import { diffLines, diffWords } from "diff";
import { Check, Sparkles, X } from "lucide-react";
import type { Proposal } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pill } from "./badges";

const sourceLabel = { chat: "from chat", meeting_note: "from meeting note", monitor: "from monitor" } as const;

function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && "target" in x))
    return v.map((m: { question: string; target: string }) => `• ${m.question}: ${m.target}`).join("\n");
  if (typeof v === "object" && v && "eurBand" in v) {
    const c = v as { size: string; eurBand: string; source: string };
    return `${c.size} · ${c.eurBand} (${c.source})`;
  }
  if (typeof v === "object" && v && "question" in v) {
    const q = v as { addressee: string; question: string; why: string };
    return `${q.addressee}: ${q.question}\nWhy: ${q.why}`;
  }
  if (typeof v === "object" && v && "title" in v && "description" in v) {
    const r = v as { title: string; description: string; metrics?: { question: string; target: string; basis: string }[] };
    return `${r.title}\n\n${r.description}${r.metrics ? "\n\n" + r.metrics.map((m) => `• ${m.question}: ${m.target} (${m.basis})`).join("\n") : ""}`;
  }
  return JSON.stringify(v, null, 1);
}

function Diff({ before, after }: { before: string; after: string }) {
  const long = before.length > 300 || after.length > 300;
  const parts = long ? diffLines(before, after) : diffWords(before, after);
  const shown = long ? parts.filter((p, i) => p.added || p.removed || (parts[i - 1]?.added || parts[i - 1]?.removed || parts[i + 1]?.added || parts[i + 1]?.removed)) : parts;
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 font-sans text-xs leading-relaxed whitespace-pre-wrap">
      {shown.map((p, i) => (
        <span key={i} className={cn(p.added && "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200", p.removed && "bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200", !p.added && !p.removed && long && "text-muted-foreground")}>
          {long && !p.added && !p.removed ? p.value.split("\n").slice(-3).join("\n") : p.value}
        </span>
      ))}
    </pre>
  );
}

export function ProposalCard({ p, canDecide = true }: { p: Proposal; canDecide?: boolean }) {
  const decide = useApiMutation("decideProposal", { success: (r) => (r.status === "accepted" ? "Applied and logged in the audit trail" : "Proposal rejected") });
  return (
    <div className={cn("rounded-lg border p-3", p.status === "pending" ? "border-primary/40 bg-primary/5" : "opacity-70")}>
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{p.summary}</span>
            <Pill>{sourceLabel[p.source]}</Pill>
            {p.status !== "pending" && <Pill t={p.status === "accepted" ? "emerald" : "red"}>{p.status}</Pill>}
          </div>
          {p.changes.map((c, i) =>
            c.before === null || c.before === undefined ? (
              <pre key={i} className="max-h-64 overflow-auto rounded-md bg-emerald-50 p-2 font-sans text-xs leading-relaxed whitespace-pre-wrap dark:bg-emerald-950/40">
                {show(c.after)}
              </pre>
            ) : (
              <div key={i} className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Field: {c.field}</div>
                <Diff before={show(c.before)} after={show(c.after)} />
              </div>
            ),
          )}
          {p.status === "pending" && canDecide && (
            <div className="flex gap-2">
              <Button size="xs" onClick={() => decide.mutate({ params: { id: p.id }, body: { decision: "accept" } })} disabled={decide.isPending}>
                <Check className="size-3" /> Accept
              </Button>
              <Button size="xs" variant="ghost" onClick={() => decide.mutate({ params: { id: p.id }, body: { decision: "reject" } })} disabled={decide.isPending}>
                <X className="size-3" /> Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
