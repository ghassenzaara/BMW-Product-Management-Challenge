"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import type { Case, CostSensitivity, MarketFocus, Positioning, ReleaseTarget } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { useUsers } from "@/components/common/people";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Choice<T extends string> = [T, string][];
const marketFocus: Choice<MarketFocus> = [
  ["global", "Global"],
  ["US", "US"],
  ["EU", "Europe"],
  ["CN", "China"],
];
const cost: Choice<CostSensitivity> = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];
const positioning: Choice<Positioning> = [
  ["base", "Base"],
  ["premium", "Premium"],
  ["luxury", "Luxury"],
];
const timing: Choice<ReleaseTarget> = [
  ["next_gen", "Next generation"],
  ["lci", "Mid-life update"],
  ["ota", "Software update"],
];

/**
 * Step 2 of a case: what the PM knows that the data doesn't show.
 * One click per question; the AI answers with follow-up questions in the chat.
 */
export function KnowledgeForm({ c, canEdit, onSaved }: { c: Case; canEdit: boolean; onSaved: () => void }) {
  const { name } = useUsers();
  const [v, setV] = useState({
    marketFocus: c.pmContext?.marketFocus ?? null,
    costSensitivity: c.pmContext?.costSensitivity ?? null,
    positioning: c.pmContext?.positioning ?? null,
    timing: c.pmContext?.timing ?? null,
    note: c.pmContext?.note ?? "",
  });
  const save = useApiMutation("savePmContext", { success: "Saved. Your AI colleague has a question." });
  const dirty =
    v.marketFocus !== (c.pmContext?.marketFocus ?? null) ||
    v.costSensitivity !== (c.pmContext?.costSensitivity ?? null) ||
    v.positioning !== (c.pmContext?.positioning ?? null) ||
    v.timing !== (c.pmContext?.timing ?? null) ||
    v.note !== (c.pmContext?.note ?? "");

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <Row label="Market focus" value={v.marketFocus} options={marketFocus} disabled={!canEdit} onChange={(x) => setV({ ...v, marketFocus: x })} />
        <Row label="Cost sensitivity" value={v.costSensitivity} options={cost} disabled={!canEdit} onChange={(x) => setV({ ...v, costSensitivity: x })} />
        <Row label="Positioning" value={v.positioning} options={positioning} disabled={!canEdit} onChange={(x) => setV({ ...v, positioning: x })} />
        <Row label="Timing" value={v.timing} options={timing} disabled={!canEdit} onChange={(x) => setV({ ...v, timing: x })} />
      </div>
      <Textarea
        id={`pm-note-${c.id}`}
        aria-label="Anything else you know"
        value={v.note}
        disabled={!canEdit}
        onChange={(e) => setV({ ...v, note: e.target.value })}
        placeholder="Anything else you know that the data doesn't show"
        rows={2}
        className="mt-5"
      />
      <div className="mt-3 flex items-center gap-3">
        {c.pmContext && (
          <span className="text-xs text-muted-foreground">
            Saved by {name(c.pmContext.updatedBy)} {fromNow(c.pmContext.updatedAt)}
          </span>
        )}
        <span className="flex-1" />
        {canEdit && (
          <Button
            disabled={!dirty || save.isPending}
            onClick={async () => {
              await save.mutateAsync({ params: { id: c.id }, body: v });
              onSaved();
            }}
          >
            <Bot className="size-4" /> Save and ask the AI
          </Button>
        )}
      </div>
    </div>
  );
}

function Row<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T | null; options: Choice<T>; disabled: boolean; onChange: (v: T | null) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <ToggleGroup type="single" variant="outline" size="sm" value={value ?? ""} disabled={disabled} onValueChange={(x) => onChange((x || null) as T | null)} className="flex-wrap">
        {options.map(([id, text]) => (
          <ToggleGroupItem key={id} value={id} className="px-3 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
