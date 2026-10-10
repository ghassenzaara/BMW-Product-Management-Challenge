"use client";

import { useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { FactorKey as FactorKeys, Trust as Trusts, factorLabel, regionLabel, seriesShort, type BrandProfile, type Watchlist } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/format";
import { PageHeader, PageSkeleton, Section } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { useUsers } from "@/components/common/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function SettingsView() {
  const me = useApi("me");
  const profiles = useApi("weightProfiles");
  const brand = useApi("brandProfile");
  const update = useApiMutation("updateWorkspace", { success: "Workspace saved" });
  const { name } = useUsers();
  if (!me.data || !brand.data) return <PageSkeleton />;
  const ws = me.data.workspace;
  const isHead = me.data.user.role === "head";

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-4 p-6 xl:grid-cols-2">
        <Section title="Workspace">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Pill t="blue">{seriesShort[ws.series]}</Pill>
              <Pill t="outline">{regionLabel[ws.region]}</Pill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Project type</Label>
                <Select value={ws.projectType} onValueChange={(v) => update.mutate({ body: { projectType: v as "lci" } })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_gen">New generation (everything can change)</SelectItem>
                    <SelectItem value="lci">Mid-life update (trim, parts, software only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Weight profile</Label>
                <Select value={ws.weightProfileId} onValueChange={(v) => update.mutate({ body: { weightProfileId: v } })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(profiles.data ?? [])
                      .filter((p) => p.isDefault || p.ownerId === me.data!.user.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source filter (applies to scores and counts)</Label>
              <label className="flex items-center gap-2">
                <Switch checked={ws.sourceFilter.excludeSocial} onCheckedChange={(v) => update.mutate({ body: { sourceFilter: { ...ws.sourceFilter, excludeSocial: v } } })} /> Exclude social media and video comments
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={ws.sourceFilter.ownersOnly} onCheckedChange={(v) => update.mutate({ body: { sourceFilter: { ...ws.sourceFilter, ownersOnly: v } } })} /> Current owners only
              </label>
              <div className="flex items-center gap-2">
                Minimum trust
                <Select value={ws.sourceFilter.minTrust} onValueChange={(v) => update.mutate({ body: { sourceFilter: { ...ws.sourceFilter, minTrust: v as "D" } } })}>
                  <SelectTrigger size="sm" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Trusts.options.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <WatchlistEditor watchlist={ws.watchlist} onSave={(w) => update.mutate({ body: { watchlist: w } })} />
          </div>
        </Section>

        <Section title="Weight profiles">
          <div className="space-y-3">
            {(profiles.data ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  {p.isDefault ? <Pill t="emerald">default · head of product line</Pill> : <Pill>{name(p.ownerId ?? "")}</Pill>}
                  {p.id === ws.weightProfileId && <Pill t="blue">active</Pill>}
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  {FactorKeys.options.map((f) => (
                    <span key={f} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">{factorLabel[f]}</span>
                      <span className="font-mono">{p.weights[f].toFixed(1)}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cost factor on requirement rank: S ×{p.costMultiplier.S} · M ×{p.costMultiplier.M} · L ×{p.costMultiplier.L}
                </p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Create your own from the ranked case list (“Save as mine”). Defaults are owned by the head of product line.</p>
          </div>
        </Section>

        <Section title={`BMW brand profile · v${brand.data.version}`} className="xl:col-span-2">
          <BrandEditor profile={brand.data} canEdit={isHead} updatedBy={name(brand.data.updatedBy)} />
        </Section>
      </div>
    </div>
  );
}

function WatchlistEditor({ watchlist, onSave }: { watchlist: Watchlist; onSave: (w: Watchlist) => void }) {
  const [w, setW] = useState(watchlist);
  const field = (k: keyof Watchlist, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={w[k].join(", ")} onChange={(e) => setW({ ...w, [k]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
    </div>
  );
  return (
    <div className="space-y-2">
      <Label>Watchlist for the fetch loop</Label>
      {field("competitors", "Competitors")}
      {field("topics", "Topics")}
      {field("domains", "Domains")}
      {field("languages", "Languages")}
      <Button size="sm" variant="outline" onClick={() => onSave(w)} disabled={JSON.stringify(w) === JSON.stringify(watchlist)}>
        Save watchlist
      </Button>
    </div>
  );
}

function BrandEditor({ profile, canEdit, updatedBy }: { profile: BrandProfile; canEdit: boolean; updatedBy: string }) {
  const save = useApiMutation("saveBrandProfile", { success: (b) => `Brand profile v${b.version} saved` });
  const [editing, setEditing] = useState(false);
  const [pillars, setPillars] = useState(profile.pillars.map((p) => `${p.name}: ${p.description}`).join("\n"));
  const [doNot, setDoNot] = useState(profile.doNot.join("\n"));
  const [notes, setNotes] = useState(profile.notesMd);
  if (editing)
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Pillars (one per line, “Name: description”)</Label>
          <Textarea rows={6} value={pillars} onChange={(e) => setPillars(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Don&apos;t (one per line)</Label>
          <Textarea rows={3} value={doNot} onChange={(e) => setDoNot(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              save.mutate(
                {
                  body: {
                    pillars: pillars
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((l) => ({ name: l.split(":")[0].trim(), description: l.split(":").slice(1).join(":").trim() })),
                    doNot: doNot.split("\n").filter((l) => l.trim()),
                    notesMd: notes,
                  },
                },
                { onSuccess: () => setEditing(false) },
              )
            }
          >
            Save new version
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Updated {fmtDate(profile.updatedAt)} by {updatedBy}. Used by the AI for brand-fit proposals and visible in every case&apos;s context pack.
        <span className="flex-1" />
        {canEdit ? (
          <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-3" /> Edit
          </Button>
        ) : (
          <span className="flex items-center gap-1">
            <Lock className="size-3" /> head of product line edits
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {profile.pillars.map((p) => (
          <div key={p.name} className="rounded-lg border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.description}</div>
          </div>
        ))}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        {profile.doNot.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{profile.notesMd}</p>
    </div>
  );
}
