"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { ambitionLabel, regionLabel, type ShapeKey } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Step 3: the requirement shape (layer 3). At most three adaptive questions, only those
 * this case raises for this PM, each with a default and why it is asked. The same questions
 * are posted once in the case chat; answers given there pre-fill the form.
 */
export function ShapeForm({ caseId, onCreated, onCancel }: { caseId: string; onCreated: (ids: string[]) => void; onCancel: () => void }) {
  const q = useApi("shapeQuestions", { params: { id: caseId } });
  const thread = useApi("messages", { params: { type: "case", id: caseId } });
  const ask = useApiMutation("askShapeQuestions", { silent: true });
  const generate = useApiMutation("generateRequirements", { success: (r) => `${r.length} requirement draft${r.length === 1 ? "" : "s"} created with your context` });
  const [answers, setAnswers] = useState<Partial<Record<ShapeKey, string>>>({});
  const asked = useRef(false);

  // Mirror the questions in the chat once per case (the PM may answer there instead).
  useEffect(() => {
    if (asked.current || !thread.data || !q.data?.questions.length) return;
    asked.current = true;
    if (!thread.data.some((m) => m.role === "assistant" && m.content.startsWith("Before I draft"))) ask.mutate({ params: { id: caseId }, body: {} });
  }, [thread.data, q.data, ask, caseId]);

  if (!q.data) return <Skeleton className="h-48 w-full" />;
  const { questions, brief, stance, variantOf } = q.data;
  const pending = new Map((stance?.pendingShape ?? []).map((a) => [a.key, a.value]));
  const value = (key: ShapeKey, def: string) => answers[key] ?? def;

  return (
    <div className="space-y-4 rounded-xl border border-border-strong bg-recessed p-6">
      <div>
        <h3 className="text-sm font-semibold">Before the draft: {questions.length ? `${questions.length} question${questions.length === 1 ? "" : "s"} only you can answer` : "nothing to ask"}</h3>
        <p className="text-xs text-muted-foreground">
          Drafting with{" "}
          {brief ? (
            <>
              your product specs ({brief.series}
              {brief.overlayId ? `, ${regionLabel[brief.region]} overlay` : ""})
            </>
          ) : (
            "no product specs (defaults, tagged as assumptions)"
          )}
          {stance ? `, your context${stance.ambition ? ` (${ambitionLabel[stance.ambition].toLowerCase()})` : ""}` : ", no context yet"} and the case evidence.
          {variantOf && <> Your draft becomes a {regionLabel[brief?.region ?? "global"]} variant of {variantOf}.</>}
        </p>
      </div>

      {questions.map((x, i) => (
        <div key={x.key} className="space-y-2 rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">
            <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
            {x.question}
          </div>
          <p className="flex gap-1 text-xs text-muted-foreground">
            <HelpCircle className="mt-0.5 size-3 shrink-0" />
            <span>
              <b className="font-medium">Why I&apos;m asking:</b> {x.why}
            </span>
          </p>
          <ToggleGroup type="single" variant="outline" size="sm" value={value(x.key, x.default)} onValueChange={(v) => v && setAnswers({ ...answers, [x.key]: v })} className="flex-wrap">
            {x.options.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="px-3">
                {o.label}
                {o.value === x.default && <span className="ml-1 text-xs font-normal opacity-70">default</span>}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            Default: {x.defaultWhy}
            {pending.has(x.key) && " (from your chat answer)"}
          </p>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          disabled={generate.isPending}
          onClick={async () => {
            // Only what the PM chose (here or in the chat) counts as an answer; the rest stays "default" in the provenance.
            const chosen = questions
              .filter((x) => answers[x.key] !== undefined || pending.has(x.key))
              .map((x) => ({ key: x.key, value: answers[x.key] ?? pending.get(x.key)! }));
            const created = await generate.mutateAsync({ params: { id: caseId }, body: { answers: chosen } });
            onCreated(created.map((r) => r.id));
          }}
        >
          <Sparkles className="size-4" /> {generate.isPending ? "Drafting…" : variantOf ? "Draft my variant" : "Create requirements"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">Every sentence of the draft shows where it came from.</span>
      </div>
    </div>
  );
}
