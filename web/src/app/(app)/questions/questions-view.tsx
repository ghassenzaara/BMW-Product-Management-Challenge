"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, Download } from "lucide-react";
import { toast } from "sonner";
import { Addressee as Addressees, addresseeLabel, type Addressee } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { download, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { Button } from "@/components/ui/button";

export function QuestionsView() {
  const { data: questions = [] } = useApi("questions");
  const { data: cases = [] } = useApi("cases");
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const open = questions.filter((q) => q.status === "open");
  const counts = new Map<Addressee, number>();
  open.forEach((q) => counts.set(q.addressee, (counts.get(q.addressee) ?? 0) + 1));
  const first = Addressees.options.find((a) => counts.get(a)) ?? "engineering";
  const [who, setWho] = useState<Addressee | null>(null);
  const active = who ?? first;
  const list = open.filter((q) => q.addressee === active).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));

  const agenda = [
    `# Agenda · ${addresseeLabel[active]} · ${fmtDate(new Date().toISOString())}`,
    "",
    ...list.flatMap((q, i) => {
      const c = caseById.get(q.objectId);
      return [`${i + 1}. **${q.question}**`, `   - Why: ${q.why}`, `   - Case: ${q.objectId}${c ? ` · ${c.title}` : ""}${q.dueDate ? ` · due ${fmtDate(q.dueDate)}` : ""}`, ""];
    }),
  ].join("\n");

  return (
    <div>
      <PageHeader
        title="Meeting prep"
        description="All your open questions across cases, grouped by who has to answer. Take the agenda to the meeting, then paste your notes back into the case and let the AI propose the answers."
      />
      <div className="grid gap-4 p-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          {Addressees.options.map((a) => (
            <button
              key={a}
              onClick={() => setWho(a)}
              className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted", active === a && "bg-muted font-medium")}
            >
              {addresseeLabel[a]}
              <span className="text-xs text-muted-foreground">{counts.get(a) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {addresseeLabel[active]} · {list.length} open
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!list.length}
                onClick={async () => {
                  await navigator.clipboard.writeText(agenda);
                  toast.success("Agenda copied as markdown");
                }}
              >
                <ClipboardCopy className="size-3.5" /> Copy agenda
              </Button>
              <Button size="sm" disabled={!list.length} onClick={() => download(`agenda_${active}.md`, agenda, "text/markdown")}>
                <Download className="size-3.5" /> .md
              </Button>
            </div>
          </div>
          {list.length === 0 && <Empty title={`No open questions for ${addresseeLabel[active]}`} />}
          {list.map((q) => {
            const c = caseById.get(q.objectId);
            return (
              <div key={q.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {q.question}
                  {q.dueDate && <Pill t={q.dueDate < new Date().toISOString().slice(0, 10) ? "red" : "outline"}>due {fmtDate(q.dueDate)}</Pill>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Why: {q.why}</p>
                <Link href={`/cases/${q.objectId}?tab=questions`} className="mt-1 block text-xs text-primary hover:underline">
                  {q.objectId} · {c?.title}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
