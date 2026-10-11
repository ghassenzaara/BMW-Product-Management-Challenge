"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, CircleX, RefreshCw, TriangleAlert } from "lucide-react";
import { checkKindLabel, type Requirement, type RequirementCheck } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { Pill } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The checks engineering runs in Codebeamer, run before the PM approves. Warns, never blocks. */
export function QualityCheck({ r, check }: { r: Requirement; check: RequirementCheck | null }) {
  const run = useApiMutation("runRequirementCheck", { success: (c) => (c.issues.length ? `${c.issues.length} issue${c.issues.length === 1 ? "" : "s"} found` : "No issues found") });
  const issues = check?.issues ?? [];
  const red = issues.filter((i) => i.severity === "red").length;
  const amber = issues.length - red;
  const [open, setOpen] = useState(red > 0);

  return (
    <div className={cn("rounded-lg border bg-card text-sm", red ? "border-tone-red-dot/70" : amber ? "border-tone-amber-dot/80" : "")}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} disabled={!issues.length}>
          {red ? <CircleX className="size-4 shrink-0 text-negative" /> : amber ? <TriangleAlert className="size-4 shrink-0 text-warning" /> : <CircleCheck className="size-4 shrink-0 text-positive" />}
          <span className="font-medium">Quality check</span>
          <span className={cn("truncate", red ? "font-medium text-tone-red-fg" : amber ? "font-medium text-tone-amber-fg" : "text-muted-foreground")}>
            {!check ? "not run yet" : issues.length ? [red && `${red} to fix`, amber && `${amber} to review`].filter(Boolean).join(" · ") : "ready for engineering"}
          </span>
          {issues.length > 0 && <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
        </button>
        {check && (
          <span className="hidden text-xs text-muted-foreground sm:inline" title={check.engine === "rules+llm" ? "Rules plus LLM review" : "Rules only"}>
            {check.engine === "rules+llm" ? "rules + AI" : "rules"} · {fromNow(check.ranAt)}
          </span>
        )}
        <Button size="xs" variant="ghost" onClick={() => run.mutate({ params: { id: r.id }, body: {} })} disabled={run.isPending}>
          <RefreshCw className={cn("size-3", run.isPending && "animate-spin")} /> {run.isPending ? "Checking" : "Re-run"}
        </Button>
      </div>
      {open && issues.length > 0 && (
        <ul className="space-y-2.5 border-t px-4 py-3">
          {issues.map((i) => (
            <li key={i.id} className="flex gap-2">
              <Pill t={i.severity === "red" ? "red" : "amber"} className="mt-0.5 shrink-0">
                {checkKindLabel[i.kind]}
              </Pill>
              <div className="min-w-0">
                <p>
                  {i.message}{" "}
                  {i.relatedId && (
                    <Link href={i.relatedId.startsWith("REQ-") ? `/requirements/${i.relatedId}` : `/plan/${r.series}`} className="font-mono text-xs text-foreground underline decoration-border-strong underline-offset-2 transition-colors duration-150 hover:decoration-foreground">
                      {i.relatedId}
                    </Link>
                  )}
                </p>
                {i.suggestion && <p className="text-xs text-muted-foreground">{i.suggestion}</p>}
              </div>
            </li>
          ))}
          <li className="text-xs text-muted-foreground">The same checks engineering runs in Codebeamer. You can approve with open issues; your reason is logged.</li>
        </ul>
      )}
    </div>
  );
}
