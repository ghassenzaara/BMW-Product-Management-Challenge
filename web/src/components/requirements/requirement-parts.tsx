"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCopy, MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CostSize as CostSizes,
  CostSource as CostSources,
  EvidenceLevel as EvidenceLevels,
  MetricBasis as MetricBases,
  Region as Regions,
  ReleaseTarget as ReleaseTargets,
  evidenceLabel,
  marketLabel,
  regionLabel,
  releaseLabel,
  type Requirement,
  type RequirementAction,
  type RequirementBundle,
  type User,
} from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { EvidenceBadge, Pill, RegionChip, ReleaseChip } from "@/components/common/badges";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


/** Status buttons a user may press on a requirement (owner moves it, the head signs off). */
export function requirementButtons(r: Requirement, user: User): [RequirementAction, string, "default" | "outline" | "destructive"][] {
  const isOwner = user.id === r.ownerId;
  const isHead = user.role === "head";
  const canEdit = isOwner || isHead;
  const buttons: [RequirementAction, string, "default" | "outline" | "destructive"][] = [];
  if (isOwner && r.status === "draft") buttons.push(["discuss", "Take into discussion", "outline"]);
  if (isOwner && ["draft", "in_discussion"].includes(r.status)) buttons.push(["approve", "Approve as PM", "default"]);
  if (isHead && r.status === "pm_approved") buttons.push(["send_back", "Send back", "outline"], ["sign_off", "Sign off", "default"]);
  if (canEdit && r.status === "signed_off") buttons.push(["plan", "Add to vehicle plan", "default"]);
  if (canEdit && r.status === "planned") buttons.push(["export", "Mark exported", "outline"]);
  if (canEdit && r.status !== "rejected" && r.status !== "exported") buttons.push(["reject", "Reject", "destructive"]);
  if (canEdit && r.status === "rejected") buttons.push(["restore", "Restore", "outline"]);
  return buttons;
}

export function TraceChain({ b }: { b: RequirementBundle }) {
  const bmw = b.signals.filter((s) => s.agent === "bmw_data").length;
  const web = b.signals.length - bmw;
  const step = "flex min-w-0 flex-1 flex-col rounded-md border bg-card px-3 py-2";
  return (
    <div className="flex items-stretch gap-2 text-xs">
      <Link href={`/cases/${b.case.id}`} className={step + " hover:border-primary/50"}>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MessageSquareQuote className="size-3" /> Signals
        </span>
        <span className="font-medium">
          {bmw} BMW records · {web} web
        </span>
      </Link>
      <ArrowRight className="size-4 self-center text-muted-foreground" />
      <Link href={`/cases/${b.case.id}`} className={step + " hover:border-primary/50"}>
        <span className="text-muted-foreground">Case (problem)</span>
        <span className="truncate font-medium">{b.case.id}</span>
      </Link>
      <ArrowRight className="size-4 self-center text-muted-foreground" />
      <div className={step + " border-primary/50 bg-primary/5"}>
        <span className="text-muted-foreground">Requirement (solution)</span>
        <span className="truncate font-medium">{b.requirement.id}</span>
      </div>
      <ArrowRight className="size-4 self-center text-muted-foreground" />
      <Link href={`/plan/${b.requirement.series}`} className={step + " hover:border-primary/50"}>
        <span className="text-muted-foreground">Planned feature</span>
        <span className="truncate font-medium">{b.plannedFeature?.name ?? "not yet"}</span>
      </Link>
    </div>
  );
}

export function Spec({ r, canEdit }: { r: Requirement; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Requirement>(r);
  const [save, setSave] = useState(false);
  const patch = useApiMutation("patchRequirement", { success: "Requirement updated" });
  const d = editing ? draft : r;
  const set = <K extends keyof Requirement>(k: K, v: Requirement[K]) => setDraft((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SMART specification</h3>
        {canEdit && !editing && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setDraft(r);
              setEditing(true);
            }}
          >
            <Pencil className="size-3" /> Edit
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={() => setSave(true)}>
              Save
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (specific, customer-facing)</Label>
            <Textarea rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Release" value={d.releaseTarget} options={ReleaseTargets.options.map((o) => [o, releaseLabel[o]])} onChange={(v) => set("releaseTarget", v as Requirement["releaseTarget"])} />
            <SelectField label="Market scope" value={d.marketScope} options={Regions.options.map((o) => [o, regionLabel[o]])} onChange={(v) => set("marketScope", v as Requirement["marketScope"])} />
            <SelectField label="Evidence level" value={d.evidenceLevel} options={EvidenceLevels.options.map((o) => [o, evidenceLabel[o]])} onChange={(v) => set("evidenceLevel", v as Requirement["evidenceLevel"])} />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{d.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <ReleaseChip release={d.releaseTarget} />
            <RegionChip region={d.marketScope} />
            <EvidenceBadge level={d.evidenceLevel} />
          </div>
        </>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Measurable targets</h4>
          {editing && (
            <Button size="xs" variant="ghost" onClick={() => set("metrics", [...d.metrics, { id: `m${d.metrics.length + 1}`, question: "", target: "", basis: "assumption" }])}>
              <Plus className="size-3" /> Metric
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] text-muted-foreground">
            <tr>
              <th className="pb-1 font-normal">Metric question</th>
              <th className="pb-1 font-normal">Target</th>
              <th className="pb-1 font-normal">Basis</th>
              <th className="pb-1 font-normal">Benchmark</th>
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {d.metrics.map((m, i) => (
              <tr key={m.id} className="border-t align-top">
                {editing ? (
                  <>
                    <td className="py-1 pr-2">
                      <Input value={m.question} onChange={(e) => set("metrics", d.metrics.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input value={m.target} onChange={(e) => set("metrics", d.metrics.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} />
                    </td>
                    <td className="py-1 pr-2">
                      <Select value={m.basis} onValueChange={(v) => set("metrics", d.metrics.map((x, j) => (j === i ? { ...x, basis: v as "evidence" } : x)))}>
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MetricBases.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1 pr-2">
                      <Input value={m.benchmark ?? ""} onChange={(e) => set("metrics", d.metrics.map((x, j) => (j === i ? { ...x, benchmark: e.target.value || undefined } : x)))} />
                    </td>
                    <td className="py-1">
                      <Button size="icon-xs" variant="ghost" onClick={() => set("metrics", d.metrics.filter((_, j) => j !== i))} aria-label="Remove metric">
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 pr-2">{m.question}</td>
                    <td className="py-1.5 pr-2 font-semibold">
                      {m.target} {m.unit && !m.target.includes(m.unit) ? m.unit : ""}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Pill t={m.basis === "evidence" ? "emerald" : "red"}>{m.basis}</Pill>
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">{m.benchmark ?? "—"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ListField title="Acceptance criteria" items={d.acceptanceCriteria} editing={editing} onChange={(v) => set("acceptanceCriteria", v)} />
        <ListField title="Assumptions & uncertainties" items={d.assumptions} editing={editing} onChange={(v) => set("assumptions", v)} />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rough cost</h4>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectField label="Size" value={d.cost.size} options={CostSizes.options.map((o) => [o, o])} onChange={(v) => set("cost", { ...d.cost, size: v as "S" })} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label>€ band</Label>
              <Input value={d.cost.eurBand} onChange={(e) => set("cost", { ...d.cost, eurBand: e.target.value })} />
            </div>
            <SelectField label="Source" value={d.cost.source} options={CostSources.options.map((o) => [o, o.replace("_", " ")])} onChange={(v) => set("cost", { ...d.cost, source: v as "pm" })} />
          </div>
        ) : (
          <p className="text-sm">
            <Pill>Size {d.cost.size}</Pill> {d.cost.eurBand} <span className="text-muted-foreground">({d.cost.source.replace("_", " ")}: {d.cost.note})</span>
          </p>
        )}
      </div>

      <RationaleDialog
        open={save}
        onOpenChange={setSave}
        title="Save changes"
        description="Every edit is stored with before/after in the audit trail."
        pending={patch.isPending}
        onSubmit={async (rationale) => {
          const { title, description, releaseTarget, marketScope, evidenceLevel, metrics, acceptanceCriteria, assumptions, cost } = draft;
          await patch.mutateAsync({ params: { id: r.id }, body: { patch: { title, description, releaseTarget, marketScope, evidenceLevel, metrics, acceptanceCriteria, assumptions, cost }, rationale } });
          setSave(false);
          setEditing(false);
        }}
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ListField({ title, items, editing, onChange }: { title: string; items: string[]; editing: boolean; onChange: (v: string[]) => void }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {editing ? (
        <Textarea rows={4} value={items.join("\n")} onChange={(e) => onChange(e.target.value.split("\n").filter((x) => x.trim()))} placeholder="One per line" />
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
          {items.length === 0 && <li className="list-none text-muted-foreground">—</li>}
        </ul>
      )}
    </div>
  );
}

export function ArgumentSheet({ b }: { b: RequirementBundle }) {
  const c = b.case;
  const strongest = b.signals.filter((s) => s.agent === "bmw_data" && s.sourceType === "bmw_feedback" && s.kind !== "like").slice(0, 3);
  const study = b.signals.filter((s) => s.sourceType === "bmw_study");
  const comp = b.signals.filter((s) => s.kind === "competitor_fact");
  const lines = [
    `# ${b.requirement.id} · ${b.requirement.title}`,
    "",
    `**Why customers need it:** ${c.summary}`,
    ...strongest.map((s) => `- "${s.quote.slice(0, 180)}${s.quote.length > 180 ? "…" : ""}" (${s.id}, ${marketLabel[s.market]})`),
    "",
    `**Study:** ${study.map((s) => s.summary).join("; ") || "no linked attribute"}`,
    `**Competition:** ${comp.map((s) => `${s.competitor}: ${s.summary}`).join("; ") || c.figures.competitorOffer.join("; ") || "not researched"}`,
    `**Markets:** ${c.figures.perMarket.map((m) => `${marketLabel[m.market]} ${m.customers} customers${m.salesShare2030 ? ` (${Math.round(m.salesShare2030 * 100)}% of 2030 volume)` : ""}`).join(", ")}`,
    `**Brand fit:** ${c.brandFit.value.toFixed(2)}: ${c.brandFit.reason}`,
    `**Target:** ${b.requirement.metrics.map((m) => `${m.question} → ${m.target} (${m.basis})`).join("; ")}`,
    `**Rough cost:** ${b.requirement.cost.size}, ${b.requirement.cost.eurBand} (${b.requirement.cost.source.replace("_", " ")})`,
    `**Release:** ${releaseLabel[b.requirement.releaseTarget]} · **Evidence:** ${evidenceLabel[b.requirement.evidenceLevel]}`,
    `**Open assumptions:** ${b.requirement.assumptions.join("; ") || "none"}`,
  ];
  const text = lines.join("\n");
  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Argument sheet for the engineering meeting</h3>
          <p className="text-xs text-muted-foreground">Complaint · wish · competition · cost, every line traceable. Engineers will challenge it, so it shows assumptions too.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Copied as markdown");
          }}
        >
          <ClipboardCopy className="size-3.5" /> Copy
        </Button>
      </div>
      <pre className="rounded-md bg-muted/50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{text}</pre>
    </div>
  );
}
