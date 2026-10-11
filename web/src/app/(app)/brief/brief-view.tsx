"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardPaste, GitCompare, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  BriefFieldKey as BriefFieldKeys,
  briefFieldLabel,
  briefFieldQuestion,
  changeAmbitionLabel,
  costSensitivityLabel,
  marketLabel,
  positioningLabel,
  regionLabel,
  releaseLabel,
  seriesLabel,
  targetCustomerLabel,
  type BriefFieldKey,
  type BriefImpact,
  type BriefValues,
  type Market,
  type ReleaseTarget,
  type SeriesBrief,
} from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { BRIEF_START, showBriefValue } from "@/lib/brief";
import { sampleStrategyDocs } from "@/lib/demo";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { ProposalCard } from "@/components/common/proposal-card";
import { useUsers } from "@/components/common/people";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Layer 1: the series brief. One shared brief per car project (owned by its lead PM) and a
 * regional overlay per PM that holds only what differs, each difference with a reason.
 * Eight questions, pre-filled from data where possible; a pasted strategy doc becomes proposals.
 */
export function BriefView() {
  const me = useApi("me");
  const bundle = useApi("myBrief");
  const all = useApi("briefs");
  const params = useSearchParams();
  const onboarding = params.get("onboarding") === "1";
  if (!me.data || !bundle.data || !all.data) return <PageSkeleton />;
  const user = me.data.user;
  const { shared, overlay, proposals } = bundle.data;

  if (user.role !== "vehicle_pm") return <ReadOnlyBriefs briefs={all.data} role={user.role} />;
  if (!shared) return <PageHeader title="Product specs" description={`No shared product specs exist for the ${seriesLabel[user.series[0]]} yet. Ask the lead PM to set it up.`} />;

  const isOwner = shared.ownerId === user.id;
  const editable = isOwner ? shared : overlay;
  const pending = proposals.filter((p) => p.status === "pending");

  return (
    <div>
      <PageHeader
        title={onboarding ? `Welcome, ${user.name.split(" ")[0]}: your ${seriesLabel[shared.series]} product specs` : `${seriesLabel[shared.series]} product specs`}
        description={
          isOwner
            ? "The shared product specs for this car project. Every requirement drafted for the series inherits them; a change shows which requirements it affects before anything changes."
            : `Shared product specs by the lead PM, plus your ${regionLabel[user.region]} overlay: only what differs for your region, each with a reason. Differences show on both and the head of product line decides them.`
        }
        actions={
          onboarding ? (
            <span className="text-xs text-muted-foreground">8 questions · most are pre-filled · about 3 minutes</span>
          ) : (
            editable && (
              <span className="text-xs text-muted-foreground">
                v{editable.version} · updated {fromNow(editable.updatedAt)}
              </span>
            )
          )
        }
      />
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {!isOwner && !overlay && <CreateOverlay series={shared.series} region={user.region} shared={shared} />}
        {editable && (
          <>
            <StrategyDoc briefId={editable.id} userId={user.id} />
            {pending.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">From your strategy doc: accept or reject each field ({pending.length})</h2>
                {pending.map((p) => (
                  <ProposalCard key={p.id} p={p} />
                ))}
              </section>
            )}
            <BriefEditor key={`${editable.id}-${editable.version}`} brief={editable} shared={shared} isOverlay={!isOwner} />
          </>
        )}
      </div>
    </div>
  );
}

function CreateOverlay({ series, region, shared }: { series: SeriesBrief["series"]; region: string; shared: SeriesBrief }) {
  const create = useApiMutation("createOverlay", { success: "Regional product specs created: confirm what differs, or paste your strategy doc" });
  const { name } = useUsers();
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <p className="text-sm">
        {name(shared.ownerId)} owns the shared {seriesLabel[series]} brief. You only add what is different for {region === "CN" ? "China" : region}; everything else is inherited.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {BriefFieldKeys.options.slice(0, 4).map((k) => (
          <div key={k} className="rounded-lg border bg-recessed px-3 py-2.5 text-xs">
            <div className="text-muted-foreground">{briefFieldLabel[k]}</div>
            <div className="font-medium">{showBriefValue(k, shared.values[k])}</div>
          </div>
        ))}
      </div>
      <Button onClick={() => create.mutate({ body: { series } })} disabled={create.isPending}>
        <Sparkles className="size-4" /> Create my regional product specs
      </Button>
    </div>
  );
}

function StrategyDoc({ briefId, userId }: { briefId: string; userId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const extract = useApiMutation("extractBrief", { success: (p) => (p.length ? `${p.length} field proposals from your doc` : "Nothing new in the doc") });
  const demo = sampleStrategyDocs[userId];
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4" /> Paste your strategy doc
      </Button>
    );
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Paste your strategy doc</h2>
        <span className="text-xs text-muted-foreground">The AI proposes values for the fields it finds; you accept or reject each.</span>
        {demo && (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setText(demo.text)}>
            Use demo doc
          </Button>
        )}
      </div>
      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a strategy paper, product line memo or meeting minutes…" />
      <div className="flex gap-2">
        <Button
          disabled={text.trim().length < 20 || extract.isPending}
          onClick={async () => {
            await extract.mutateAsync({ params: { id: briefId }, body: { text } });
            setOpen(false);
            setText("");
          }}
        >
          <Sparkles className="size-4" /> {extract.isPending ? "Reading…" : "Propose values"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BriefEditor({ brief, shared, isOverlay }: { brief: SeriesBrief; shared: SeriesBrief; isOverlay: boolean }) {
  const resolvedValues: BriefValues = { ...BRIEF_START, ...shared.values, ...(isOverlay ? brief.values : {}) };
  // Questions the shared brief does not answer yet: what the form shows for them is saved with it.
  const unanswered = isOverlay ? [] : BriefFieldKeys.options.filter((k) => shared.values[k] === undefined);
  const [values, setValues] = useState<BriefValues>(resolvedValues);
  const [dirty, setDirty] = useState<Set<BriefFieldKey>>(new Set());
  const [reasons, setReasons] = useState<Partial<Record<BriefFieldKey, string>>>({});
  const [clear, setClear] = useState<Set<BriefFieldKey>>(new Set());
  const [impact, setImpact] = useState<BriefImpact[] | null>(null);
  const [result, setResult] = useState<BriefImpact[] | null>(null);
  const save = useApiMutation("saveBrief", { success: (r) => (r.impact.length ? `Product specs saved · ${r.impact.length} requirement${r.impact.length === 1 ? "" : "s"} affected` : "Product specs saved") });

  const metaOf = (k: BriefFieldKey) => (isOverlay && brief.values[k] !== undefined ? brief.meta[k] : shared.meta[k]);
  const unconfirmed = BriefFieldKeys.options.filter((k) => (isOverlay ? brief.values[k] !== undefined && !brief.meta[k]?.confirmed : !shared.meta[k]?.confirmed));
  const differs = (k: BriefFieldKey) => JSON.stringify(values[k]) !== JSON.stringify(shared.values[k]);
  const missingReasons = isOverlay ? [...dirty].filter((k) => differs(k) && !reasons[k]?.trim() && !brief.meta[k]?.reason) : [];
  const set = <K extends BriefFieldKey>(k: K, v: BriefValues[K]) => {
    setValues({ ...values, [k]: v });
    setDirty(new Set(dirty).add(k));
    const c = new Set(clear);
    c.delete(k);
    setClear(c);
  };
  const body = () => ({
    values: Object.fromEntries([...new Set([...dirty, ...unanswered])].filter((k) => !clear.has(k)).map((k) => [k, values[k]])) as Partial<BriefValues>,
    reasons,
    confirm: unconfirmed,
    clear: [...clear],
  });

  const submit = async () => {
    const r = await save.mutateAsync({ params: { id: brief.id }, body: body() });
    setImpact(null);
    setResult(r.impact);
    setDirty(new Set());
  };

  return (
    <div className="space-y-3">
      {BriefFieldKeys.options.map((k, i) => {
        const meta = metaOf(k);
        const fromOverlay = isOverlay && (brief.values[k] !== undefined || dirty.has(k)) && !clear.has(k);
        const conflict = isOverlay && fromOverlay && differs(k);
        return (
          <section key={k} className={cn("rounded-xl border bg-card p-5", conflict && "border-tone-fuchsia-dot/70")}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
              <h3 className="text-[15px] font-semibold">{briefFieldLabel[k]}</h3>
              <SourceBadge source={fromOverlay ? (meta?.source === "doc" ? "doc" : "regional") : meta?.source ?? "pm"} />
              {meta && !meta.confirmed && <Pill t="amber">confirm?</Pill>}
              {conflict && (
                <Pill t="fuchsia">
                  <GitCompare className="mr-1 size-3" /> differs from shared{meta?.resolution?.status === "regional_variant" ? " · accepted as regional" : " · head decides"}
                </Pill>
              )}
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">{briefFieldQuestion[k]}</p>
            <FieldEditor field={k} value={values[k]} onChange={(v) => set(k, v as never)} />
            {isOverlay && conflict && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-muted-foreground">Shared: {showBriefValue(k, shared.values[k])}</p>
                <div className="flex items-center gap-2">
                  <Input value={reasons[k] ?? meta?.reason ?? ""} onChange={(e) => setReasons({ ...reasons, [k]: e.target.value })} placeholder="Why is your region different?" aria-label={`Reason for ${briefFieldLabel[k]}`} />
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setValues({ ...values, [k]: shared.values[k] });
                      setClear(new Set(clear).add(k));
                      const dd = new Set(dirty);
                      dd.delete(k);
                      setDirty(dd);
                    }}
                  >
                    <Undo2 className="size-3" /> Use shared
                  </Button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-background/95 py-4 backdrop-blur">
        {missingReasons.length > 0 && <span className="text-xs font-medium text-tone-amber-fg">Say why {missingReasons.map((k) => briefFieldLabel[k].toLowerCase()).join(", ")} differs.</span>}
        <span className="flex-1" />
        {(dirty.size > 0 || clear.size > 0 || unconfirmed.length > 0) && (
          <Button
            disabled={missingReasons.length > 0 || save.isPending}
            onClick={async () => {
              if (dirty.size === 0 && clear.size === 0) return submit();
              const preview = await api("previewBriefImpact", { params: { id: brief.id }, body: { values: body().values } });
              if (preview.length) setImpact(preview);
              else await submit();
            }}
          >
            <CheckCircle2 className="size-4" /> {dirty.size || clear.size ? "Save product specs" : `Confirm ${unconfirmed.length} answer${unconfirmed.length === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>

      <Dialog open={!!impact} onOpenChange={(o) => !o && setImpact(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>This changes {impact?.length} requirement{impact?.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Nothing changes silently: each requirement gets a proposal for its next version that its owner accepts or rejects.</DialogDescription>
          </DialogHeader>
          <ImpactList items={impact ?? []} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImpact(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              Save and propose new versions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!result?.length} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Product specs saved</DialogTitle>
            <DialogDescription>Open a requirement to accept or reject its proposed version.</DialogDescription>
          </DialogHeader>
          <ImpactList items={result ?? []} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImpactList({ items }: { items: BriefImpact[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.requirementId} className="rounded-lg border px-3 py-2.5">
          <Link href={`/requirements/${i.requirementId}`} className="font-mono text-xs font-medium text-foreground underline decoration-border-strong underline-offset-2 transition-colors duration-150 hover:decoration-foreground" onClick={() => toast.dismiss()}>
            {i.requirementId}
          </Link>{" "}
          <span className="font-medium">{i.title}</span>
          <p className="text-xs text-muted-foreground">{i.summary}</p>
          <p className="text-xs text-muted-foreground">Uses: {i.fields.map((f) => briefFieldLabel[f].toLowerCase()).join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label: Record<string, [string, "slate" | "sky" | "violet" | "teal" | "fuchsia"]> = {
    data: ["from data", "sky"],
    brand: ["from the brand profile", "violet"],
    doc: ["from your strategy doc", "teal"],
    pm: ["your answer", "slate"],
    regional: ["regional", "fuchsia"],
  };
  const [text, t] = label[source] ?? label.pm;
  return <Pill t={t}>{text}</Pill>;
}

const toggleItem = "px-3";

function FieldEditor({ field, value, onChange }: { field: BriefFieldKey; value: BriefValues[BriefFieldKey]; onChange: (v: unknown) => void }) {
  switch (field) {
    case "thesis":
      return <Textarea rows={2} value={value as string} onChange={(e) => onChange(e.target.value)} />;
    case "targetCustomer": {
      const v = value as BriefValues["targetCustomer"];
      return (
        <div className="flex flex-wrap gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={v.who} onValueChange={(x) => x && onChange({ ...v, who: x })}>
            {(["keep_owners", "conquest", "both"] as const).map((x) => (
              <ToggleGroupItem key={x} value={x} className={toggleItem}>
                {targetCustomerLabel[x]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup type="single" variant="outline" size="sm" value={v.positioning} onValueChange={(x) => x && onChange({ ...v, positioning: x })}>
            {(["base", "premium", "luxury"] as const).map((x) => (
              <ToggleGroupItem key={x} value={x} className={toggleItem}>
                {positioningLabel[x]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      );
    }
    case "marketWeights": {
      const v = value as BriefValues["marketWeights"];
      return (
        <div className="flex flex-wrap gap-3">
          {(["EU", "US", "CN", "RoW"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <span className="w-24 text-muted-foreground">{marketLabel[m as Market]}</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="w-20"
                value={Math.round(v[m] * 100)}
                onChange={(e) => onChange({ ...v, [m]: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                aria-label={`${marketLabel[m as Market]} weight`}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </label>
          ))}
        </div>
      );
    }
    case "changeAmbition": {
      const v = value as BriefValues["changeAmbition"];
      return (
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={v.level} onValueChange={(x) => x && onChange({ ...v, level: x })}>
            {(["evolution", "balanced", "revolution"] as const).map((x) => (
              <ToggleGroupItem key={x} value={x} className={toggleItem}>
                {changeAmbitionLabel[x]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <label className="flex items-center gap-1.5 text-sm">
            <Input type="number" min={0} max={10} className="w-16" value={v.innovationSlots} onChange={(e) => onChange({ ...v, innovationSlots: Math.max(0, Number(e.target.value)) })} aria-label="Real innovations" />
            real innovations
          </label>
        </div>
      );
    }
    case "protectList":
    case "dontFightOn":
      return <Textarea rows={2} value={(value as string[]).join("\n")} onChange={(e) => onChange(e.target.value.split("\n").filter((x) => x.trim()))} placeholder="One per line" />;
    case "givens": {
      const v = value as BriefValues["givens"];
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={v.platform} onChange={(e) => onChange({ ...v, platform: e.target.value })} placeholder="Platform" aria-label="Platform" />
            <Input value={v.sop} onChange={(e) => onChange({ ...v, sop: e.target.value })} placeholder="SOP" aria-label="SOP" />
          </div>
          <Textarea rows={1} value={v.frozen.join("\n")} onChange={(e) => onChange({ ...v, frozen: e.target.value.split("\n").filter((x) => x.trim()) })} placeholder="Frozen (one per line)" aria-label="Frozen" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">Still open:</span>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={v.openReleases}
              onValueChange={(xs) => xs.length && onChange({ ...v, openReleases: (["next_gen", "lci", "ota"] as const).filter((r) => xs.includes(r)) as ReleaseTarget[] })}
            >
              {(["next_gen", "lci", "ota"] as const).map((r) => (
                <ToggleGroupItem key={r} value={r} className={toggleItem}>
                  {releaseLabel[r]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">Cycle:</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={v.cycle} onValueChange={(x) => x && onChange({ ...v, cycle: x })}>
              {(["WLTP", "EPA", "CLTC"] as const).map((c) => (
                <ToggleGroupItem key={c} value={c} className={toggleItem}>
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      );
    }
    case "costEnvelope": {
      const v = value as BriefValues["costEnvelope"];
      return (
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={v.sensitivity} onValueChange={(x) => x && onChange({ ...v, sensitivity: x })}>
            {(["low", "medium", "high"] as const).map((x) => (
              <ToggleGroupItem key={x} value={x} className={toggleItem}>
                {costSensitivityLabel[x]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Input className="max-w-xs" value={v.perCarBand} onChange={(e) => onChange({ ...v, perCarBand: e.target.value })} aria-label="Budget per car" />
        </div>
      );
    }
  }
}

function ReadOnlyBriefs({ briefs, role }: { briefs: SeriesBrief[]; role: string }) {
  const { name } = useUsers();
  return (
    <div>
      <PageHeader
        title="Product specs"
        description={
          role === "head"
            ? "Every car project's shared product specs and the regional overlays. Differences between them are decided on your desk (Review)."
            : "Product specs belong to vehicle PMs. When you draft on a case, the product specs of the case's series are used."
        }
      />
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        {briefs.map((b) => (
          <section key={b.id} className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold">
                {seriesLabel[b.series]} · {b.kind === "shared" ? "shared" : `${regionLabel[b.region]} overlay`}
              </h3>
              <span className="text-xs text-muted-foreground">
                {name(b.ownerId)} · v{b.version}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {(Object.keys(b.values) as BriefFieldKey[]).map((k) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-muted-foreground">{briefFieldLabel[k]}</dt>
                  <dd>{showBriefValue(k, b.values[k])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
