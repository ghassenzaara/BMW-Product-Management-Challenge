"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp, Pencil, Undo2 } from "lucide-react";
import { ArgusMark } from "@/components/brand/marks";
import {
  ambitionLabel,
  costSensitivityLabel,
  marketLabel,
  releaseLabel,
  targetCustomerLabel,
  type Ambition,
  type Case,
  type CaseStance,
  type CostSensitivity,
  type Market,
  type ReleaseTarget,
  type ResolvedBrief,
  type TargetCustomer,
} from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { Pill } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Overrides = CaseStance["overrides"];

const uid = () => Math.random().toString(36).slice(2, 8);

/**
 * Step 2 of a case: the PM's stance (layer 2). Everything the product specs (series brief) already
 * say is inherited and shown; the PM only adds what is different for this case (with a reason),
 * one free-text note for the AI (priorities and inside knowledge) and the ambition.
 */
export function StanceForm({ c, brief, userId, canEdit, onSaved }: { c: Case; brief: ResolvedBrief | null; userId: string; canEdit: boolean; onSaved: () => void }) {
  const mine = c.stances.find((s) => s.authorId === userId) ?? null;
  const [overrides, setOverrides] = useState<Overrides>(mine?.overrides ?? {});
  const [reasons, setReasons] = useState<CaseStance["overrideReasons"]>(mine?.overrideReasons ?? {});
  const [notes, setNotes] = useState(() => [...(mine?.evidenceTakes ?? []).map((t) => t.text), ...(mine?.inside ?? []).map((x) => x.text)].filter((t) => t.trim()).join("\n"));
  const [ambition, setAmbition] = useState<Ambition | null>(mine?.ambition ?? null);
  const [editing, setEditing] = useState<"costEnvelope" | "targetCustomer" | "givens" | null>(null);
  const save = useApiMutation("saveCaseStance", { success: "Context saved. Argus has a question." });
  const v = brief?.values;
  const missingReason = (Object.keys(overrides) as (keyof Overrides)[]).some((k) => overrides[k] && !reasons[k]?.trim());

  const setOverride = <K extends keyof Overrides>(k: K, value: Overrides[K] | undefined) =>
    setOverrides((o) => {
      const next = { ...o };
      if (value === undefined) delete next[k];
      else next[k] = value;
      return next;
    });

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6">
      {/* Inherited from the brief */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Inherited from your product specs</h3>
          {v ? (
            <Link href="/brief" className="text-xs font-medium text-foreground underline decoration-muted-foreground underline-offset-2 transition-colors duration-150 hover:decoration-foreground">
              Open product specs
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">No product specs for you yet, so the drafter uses defaults (shown as assumptions).</span>
          )}
        </div>
        {v && (
          <div className="flex flex-wrap gap-2">
            <InheritedChip
              label="Markets"
              value={(Object.entries(v.marketWeights) as [Market, number][])
                .filter(([, w]) => w > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([m, w]) => `${marketLabel[m]} ${Math.round(w * 100)}%`)
                .join(" · ")}
              origin={brief.origin.marketWeights}
            />
            <InheritedChip
              label="Customer"
              value={targetCustomerLabel[(overrides.targetCustomer ?? v.targetCustomer).who]}
              origin={brief.origin.targetCustomer}
              overridden={!!overrides.targetCustomer}
              onEdit={canEdit ? () => setEditing(editing === "targetCustomer" ? null : "targetCustomer") : undefined}
            />
            <InheritedChip
              label="Cost"
              value={costSensitivityLabel[(overrides.costEnvelope ?? v.costEnvelope).sensitivity]}
              origin={brief.origin.costEnvelope}
              overridden={!!overrides.costEnvelope}
              onEdit={canEdit ? () => setEditing(editing === "costEnvelope" ? null : "costEnvelope") : undefined}
            />
            <InheritedChip
              label="Open releases"
              value={(overrides.givens ?? v.givens).openReleases.map((r) => releaseLabel[r]).join(", ")}
              origin={brief.origin.givens}
              overridden={!!overrides.givens}
              onEdit={canEdit ? () => setEditing(editing === "givens" ? null : "givens") : undefined}
            />
            {v.dontFightOn.length > 0 && <InheritedChip label="Don't fight on" value={v.dontFightOn[0]} origin={brief.origin.dontFightOn} />}
          </div>
        )}
        {v && editing && (
          <div className="mt-3 space-y-3 rounded-lg border border-dashed border-border-strong bg-recessed p-4">
            {editing === "costEnvelope" && (
              <Choice<CostSensitivity>
                label="Cost sensitivity for this case"
                value={(overrides.costEnvelope ?? v.costEnvelope).sensitivity}
                options={(["low", "medium", "high"] as const).map((x) => [x, costSensitivityLabel[x]])}
                onChange={(x) => setOverride("costEnvelope", x === v.costEnvelope.sensitivity ? undefined : { ...v.costEnvelope, sensitivity: x })}
              />
            )}
            {editing === "targetCustomer" && (
              <Choice<TargetCustomer>
                label="Target customer for this case"
                value={(overrides.targetCustomer ?? v.targetCustomer).who}
                options={(["keep_owners", "conquest", "both"] as const).map((x) => [x, targetCustomerLabel[x]])}
                onChange={(x) => setOverride("targetCustomer", x === v.targetCustomer.who ? undefined : { ...v.targetCustomer, who: x })}
              />
            )}
            {editing === "givens" && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Open releases for this case</div>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  value={(overrides.givens ?? v.givens).openReleases}
                  onValueChange={(xs) => {
                    const open = (["next_gen", "lci", "ota"] as const).filter((r) => xs.includes(r)) as ReleaseTarget[];
                    setOverride("givens", JSON.stringify(open) === JSON.stringify(v.givens.openReleases) || !open.length ? undefined : { ...v.givens, openReleases: open });
                  }}
                >
                  {(["next_gen", "lci", "ota"] as const).map((r) => (
                    <ToggleGroupItem key={r} value={r} className="px-3">
                      {releaseLabel[r]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}
            {overrides[editing] && (
              <div className="flex items-center gap-2">
                <Input value={reasons[editing] ?? ""} onChange={(e) => setReasons({ ...reasons, [editing]: e.target.value })} placeholder="Why is this case different from your product specs?" aria-label="Override reason" />
                <Button size="icon-xs" variant="ghost" aria-label="Back to the product specs value" onClick={() => setOverride(editing, undefined)}>
                  <Undo2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Q1: what the AI should know (priorities + inside knowledge, one point per line) */}
      <Question n={1} title="What should the AI know about this case?" hint="Your priorities and what you know that the data can't show. One point per line." help={<NotesHelp />}>
        <Textarea
          rows={4}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={"Focus on BEV owners in Europe, they buy the most\nEngineering is already testing a fix for the next facelift"}
          aria-label="What the AI should know"
        />
      </Question>

      {/* Q2: ambition */}
      <Question n={2} title="How far do you want to go on this problem?" hint={v ? `Left empty, your product specs decide (${v.changeAmbition.level}, ${targetCustomerLabel[v.targetCustomer.who].toLowerCase()}).` : "Left empty, the drafter picks from the evidence."}>
        <ToggleGroup type="single" variant="outline" size="sm" value={ambition ?? ""} disabled={!canEdit} onValueChange={(x) => setAmbition((x || null) as Ambition | null)}>
          {(["fix", "match", "beat"] as const).map((a) => (
            <ToggleGroupItem key={a} value={a} className="px-3">
              {ambitionLabel[a]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Question>

      <div className="flex items-center gap-3">
        {mine && <span className="text-xs text-muted-foreground">Saved {fromNow(mine.updatedAt)}</span>}
        {missingReason && <span className="text-xs font-medium text-warning">Every override needs a reason.</span>}
        <span className="flex-1" />
        {canEdit && (
          <Button
            disabled={save.isPending || missingReason}
            onClick={async () => {
              await save.mutateAsync({
                params: { id: c.id },
                body: {
                  overrides,
                  overrideReasons: Object.fromEntries(Object.entries(reasons).filter(([k]) => k in overrides)),
                  evidenceTakes: [],
                  inside: notes
                    .split("\n")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((text) => ({ id: `IN-${uid()}`, kind: "other" as const, text })),
                  ambition,
                },
              });
              setEditing(null);
              onSaved();
            }}
          >
            <ArgusMark className="size-4" /> Save context and ask Argus
          </Button>
        )}
      </div>
    </div>
  );
}

function InheritedChip({ label, value, origin, overridden, onEdit }: { label: string; value: string; origin: string; overridden?: boolean; onEdit?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${overridden ? "border-tone-violet-bd bg-tone-violet-bg" : "bg-recessed"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
      <Pill className="px-1.5 py-0">{overridden ? "this case" : origin === "overlay" ? "regional" : origin === "data" ? "from data" : origin === "brand" ? "brand" : "specs"}</Pill>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Override ${label}`} className="rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <Pencil className="size-3" />
        </button>
      )}
    </span>
  );
}

function Question({ n, title, hint, help, children }: { n: number; title: string; hint: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="text-muted-foreground">{n}.</span>
          {title}
          {help && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="What to write here" className="rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground">
                  <CircleHelp className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 text-sm">
                {help}
              </PopoverContent>
            </Popover>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function NotesHelp() {
  return (
    <div className="space-y-2.5">
      <p className="font-medium">Write it like a note to a colleague, one point per line.</p>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Who matters most</p>
        <p className="text-xs">&ldquo;Focus on BEV owners in Europe&rdquo; · &ldquo;Ignore fleet drivers, they don&apos;t choose the car&rdquo;</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">What you know that the data doesn&apos;t</p>
        <p className="text-xs">&ldquo;Engineering is already testing a fix&rdquo; · &ldquo;We tried this in 2019 and customers didn&apos;t pay for it&rdquo; · &ldquo;A supplier has the part ready&rdquo;</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Limits</p>
        <p className="text-xs">&ldquo;Must work without new hardware&rdquo; · &ldquo;Keep it under the price of the comfort package&rdquo;</p>
      </div>
      <p className="text-xs text-muted-foreground">The AI uses every line when it drafts the requirements and marks it as your assumption, so engineers can see where it came from.</p>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(x) => x && onChange(x as T)}>
        {options.map(([id, text]) => (
          <ToggleGroupItem key={id} value={id} className="px-3">
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
