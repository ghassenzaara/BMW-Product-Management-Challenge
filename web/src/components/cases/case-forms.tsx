"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Link2, Sparkles, StickyNote } from "lucide-react";
import {
  CarArea as CarAreas,
  CaseType as CaseTypes,
  ChangeDepth as ChangeDepths,
  Region as Regions,
  carAreaLabel,
  caseTypeLabel,
  changeDepthLabel,
  marketLabel,
  regionLabel,
  signalKindLabel,
  type AspectGroup,
  type Case,
  type Market,
  type SignalKind,
} from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { guessColumns, parseCsv, toKind, toMarket } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const MARKETS: Market[] = ["EU", "US", "CN", "RoW"];
const KINDS: SignalKind[] = ["complaint", "wish", "like", "competitor_fact", "trend"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Pick<T extends string>({ value, options, onChange, className }: { value: T; options: [T, string][]; onChange: (v: T) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className={cn("w-full", className)}>
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
  );
}

const areaOptions = CarAreas.options.map((o) => [o, carAreaLabel[o]] as [Case["carArea"], string]);
const aspectName = (id: string) => (id[0].toUpperCase() + id.slice(1)).replace(/_/g, " / ");
const typeOptions = CaseTypes.options.map((o) => [o, caseTypeLabel[o]] as [Case["type"], string]);
const depthOptions = ChangeDepths.options.map((o) => [o, changeDepthLabel[o]] as [Case["changeDepth"], string]);
const scopeOptions = Regions.options.map((o) => [o, regionLabel[o]] as [Case["scope"], string]);
const kindOptions = KINDS.map((k) => [k, signalKindLabel[k]] as [SignalKind, string]);
const marketOptions = [...MARKETS, "unknown" as Market].map((m) => [m, m === "unknown" ? "Not sure" : marketLabel[m]] as [Market, string]);

/** A PM starts a case by hand (no radar signals yet), then adds evidence on the case page. */
export function NewCaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const me = useApi("me");
  const create = useApiMutation("createCase", { success: (c) => `${c.id} created. Add your evidence next.` });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  // Fixed taxonomy: a case is one topic and one aspect. The car area only narrows the topic list.
  const taxonomy = useApi("taxonomy");
  const [carArea, setCarArea] = useState<Case["carArea"]>(CarAreas.options[0]);
  const [topicId, setTopicId] = useState("");
  const [aspect, setAspect] = useState<AspectGroup>("function");
  const [type, setType] = useState<Case["type"]>("fix_improve");
  const [depth, setDepth] = useState<Case["changeDepth"]>("part_module");
  const [scope, setScope] = useState<Case["scope"] | null>(null);
  const series = me.data?.workspace.series;
  const effectiveScope = scope ?? me.data?.user.region ?? "global";
  const topicOptions = (taxonomy.data?.topics ?? []).filter((t) => t.carArea === carArea && t.id !== "other").map((t) => [t.id, t.label] as [string, string]);
  const aspectOptions = (taxonomy.data?.aspectGroups ?? []).map((a) => [a.id, aspectName(a.id)] as [AspectGroup, string]);
  const aspectHint = taxonomy.data?.aspectGroups.find((a) => a.id === aspect)?.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription>Start from a problem you know about. You add evidence (files, links, notes) on the next screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="What's the problem?" hint="One sentence from the customer's point of view.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rear passengers can't charge their phones" autoFocus />
          </Field>
          <Field label="Short description">
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Who is affected, when it happens and why it matters." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Car area">
              <Pick
                value={carArea}
                options={areaOptions}
                onChange={(v) => {
                  setCarArea(v);
                  setTopicId("");
                }}
              />
            </Field>
            <Field label="Topic">
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick the topic" />
                </SelectTrigger>
                <SelectContent>
                  {topicOptions.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="What about it?" hint={aspectHint}>
            <Pick value={aspect} options={aspectOptions.length ? aspectOptions : [[aspect, aspectName(aspect)]]} onChange={setAspect} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Pick value={type} options={typeOptions} onChange={setType} />
            </Field>
            <Field label="Change depth">
              <Pick value={depth} options={depthOptions} onChange={setDepth} />
            </Field>
            <Field label="Market scope">
              <Pick value={effectiveScope} options={scopeOptions} onChange={setScope} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={title.trim().length < 3 || !series || !topicId || create.isPending}
            onClick={async () => {
              const c = await create.mutateAsync({
                body: { title: title.trim(), summary: summary.trim() || title.trim(), series: series!, scope: effectiveScope, topicId, aspectGroup: aspect, type, changeDepth: depth, signalIds: [], rationale: "Started by hand by the PM" },
              });
              onOpenChange(false);
              setTitle("");
              setSummary("");
              router.push(`/cases/${c.id}?evidence=1`);
            }}
          >
            Create case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit the case's names and classification. */
export function EditCaseDialog({ c, open, onOpenChange }: { c: Case; open: boolean; onOpenChange: (o: boolean) => void }) {
  const patch = useApiMutation("patchCase", { success: "Details saved" });
  const [d, setD] = useState(() => pickEditable(c));
  const set = <K extends keyof ReturnType<typeof pickEditable>>(k: K, v: ReturnType<typeof pickEditable>[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setD(pickEditable(c));
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>{c.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Short name">
            <Input value={d.shortTitle} onChange={(e) => set("shortTitle", e.target.value)} />
          </Field>
          <Field label="Problem">
            <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Summary">
            <Textarea rows={3} value={d.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Pick value={d.type} options={typeOptions} onChange={(v) => set("type", v)} />
            </Field>
            <Field label="Change depth">
              <Pick value={d.changeDepth} options={depthOptions} onChange={(v) => set("changeDepth", v)} />
            </Field>
            <Field label="Market scope">
              <Pick value={d.scope} options={scopeOptions} onChange={(v) => set("scope", v)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {c.featureName} · {carAreaLabel[c.carArea]}
            {c.markets.length ? ` · ${c.markets.map((m) => marketLabel[m]).join(", ")}` : ""}. Topic and car area come from the fixed taxonomy, markets from the signals; they are not edited here.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={d.title.trim().length < 3 || !d.shortTitle.trim() || patch.isPending}
            onClick={async () => {
              const before = pickEditable(c);
              const changed = Object.fromEntries(Object.entries(d).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof typeof before])));
              if (Object.keys(changed).length) await patch.mutateAsync({ params: { id: c.id }, body: { patch: changed, rationale: "Edited the case details" } });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pickEditable(c: Case) {
  return { shortTitle: c.shortTitle, title: c.title, summary: c.summary, type: c.type, changeDepth: c.changeDepth, scope: c.scope };
}

type Tab = "file" | "link" | "note";
interface CsvState {
  name: string;
  header: string[];
  rows: string[][];
  text: number;
  title: number;
  market: number;
  kind: number;
}

/** The PM adds their own evidence: rows of a CSV file, a link, or a note. Each becomes a signal on the case. */
export function AddEvidenceDialog({ c, open, onOpenChange, onResearch }: { c: Case; open: boolean; onOpenChange: (o: boolean) => void; onResearch: () => void }) {
  const add = useApiMutation("addCaseEvidence", { success: (r) => `${r.added.length} ${r.added.length === 1 ? "signal" : "signals"} added to the case` });
  const [tab, setTab] = useState<Tab>("file");
  const [kind, setKind] = useState<SignalKind>("complaint");
  const [market, setMarket] = useState<Market>(c.markets[0] ?? "unknown");
  const [csv, setCsv] = useState<CsvState | null>(null);
  const [csvError, setCsvError] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const reset = () => {
    setCsv(null);
    setCsvError("");
    setUrl("");
    setTitle("");
    setText("");
  };

  const csvItems = csv
    ? csv.rows
        .map((r) => ({
          type: "csv_row" as const,
          text: (r[csv.text] ?? "").trim(),
          title: csv.title >= 0 ? r[csv.title]?.trim() || undefined : undefined,
          source: csv.name,
          kind: csv.kind >= 0 ? toKind(r[csv.kind], kind) : kind,
          market: csv.market >= 0 ? toMarket(r[csv.market], market) : market,
        }))
        .filter((x) => x.text)
        .slice(0, 200)
    : [];
  const urlOk = /^https?:\/\/\S+\.\S+/.test(url.trim());
  const items =
    tab === "file"
      ? csvItems
      : tab === "link"
        ? urlOk
          ? [{ type: "link" as const, url: url.trim(), title: title.trim() || undefined, text: text.trim() || title.trim() || url.trim(), kind, market }]
          : []
        : text.trim()
          ? [{ type: "note" as const, text: text.trim(), title: title.trim() || undefined, kind, market }]
          : [];

  async function readFile(file: File) {
    setCsvError("");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setCsvError("That file has no data rows. It needs a header row and at least one row below it.");
    const [header, ...body] = rows;
    setCsv({ name: file.name, header, rows: body, ...guessColumns(header, body) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>Your own data counts as evidence too. Each row, link or note becomes a signal on this case.</DialogDescription>
        </DialogHeader>

        <ToggleGroup type="single" variant="outline" size="sm" value={tab} onValueChange={(v) => v && setTab(v as Tab)} className="w-full">
          <ToggleGroupItem value="file" className="flex-1 gap-1.5">
            <FileUp className="size-3.5" /> CSV file
          </ToggleGroupItem>
          <ToggleGroupItem value="link" className="flex-1 gap-1.5">
            <Link2 className="size-3.5" /> Link
          </ToggleGroupItem>
          <ToggleGroupItem value="note" className="flex-1 gap-1.5">
            <StickyNote className="size-3.5" /> Note
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="space-y-4">
          {tab === "file" && (
            <>
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm transition-colors duration-150 hover:border-foreground/40">
                <FileUp className="size-5 text-muted-foreground" />
                <span className="font-medium">{csv ? csv.name : "Choose a CSV file"}</span>
                <span className="text-xs text-muted-foreground">{csv ? `${csv.rows.length} rows found` : "Survey exports, dealer reports, social listening. Up to 200 rows."}</span>
                <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </label>
              {csvError && <p className="text-xs font-medium text-destructive">{csvError}</p>}
              {csv && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Column with the customer text">
                      <Pick value={String(csv.text)} options={csv.header.map((h, i) => [String(i), h || `Column ${i + 1}`])} onChange={(v) => setCsv({ ...csv, text: Number(v) })} />
                    </Field>
                    <Field label="Column with the market">
                      <Pick value={String(csv.market)} options={[["-1", "None, use the default"], ...csv.header.map((h, i) => [String(i), h || `Column ${i + 1}`] as [string, string])]} onChange={(v) => setCsv({ ...csv, market: Number(v) })} />
                    </Field>
                  </div>
                  <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border bg-recessed p-3 text-xs">
                    {csvItems.slice(0, 4).map((x, i) => (
                      <li key={i} className="line-clamp-2">
                        <span className="mr-1.5 text-muted-foreground">{marketLabel[x.market] ?? x.market}</span>
                        {x.text}
                      </li>
                    ))}
                    {csvItems.length > 4 && <li className="text-muted-foreground">and {csvItems.length - 4} more</li>}
                  </ul>
                </>
              )}
            </>
          )}
          {tab === "link" && (
            <>
              <Field label="Link">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.example.com/review" autoFocus />
              </Field>
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Car magazine test: rear seats too tight" />
              </Field>
              <Field label="What it says" hint="Paste the key passage, so the AI and your colleagues can quote it.">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
            </>
          )}
          {tab === "note" && (
            <>
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dealer meeting Munich, 12 Oct" autoFocus />
              </Field>
              <Field label="Note" hint="What you heard or saw. Notes count as assumptions until backed by data.">
                <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tab === "file" ? "Default type" : "Type"}>
              <Pick value={kind} options={kindOptions} onChange={setKind} />
            </Field>
            <Field label={tab === "file" ? "Default market" : "Market"}>
              <Pick value={market} options={marketOptions} onChange={setMarket} />
            </Field>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onResearch();
            }}
          >
            <Sparkles className="size-3.5" /> Let the AI find sources
          </Button>
          <Button
            disabled={!items.length || add.isPending}
            onClick={async () => {
              await add.mutateAsync({ params: { id: c.id }, body: { items, rationale: tab === "file" ? `Uploaded ${items.length} rows from ${csv?.name}` : tab === "link" ? `Added a link: ${url.trim()}` : "Added a note" } });
              reset();
              onOpenChange(false);
            }}
          >
            {tab === "file" && items.length ? `Add ${items.length} ${items.length === 1 ? "row" : "rows"}` : "Add to case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
