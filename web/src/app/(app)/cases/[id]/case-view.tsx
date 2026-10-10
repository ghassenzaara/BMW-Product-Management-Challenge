"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  Info,
  PanelRight,
  Pencil,
  Scale,
  Sparkles,
} from "lucide-react";
import type { Alert, Case, Signal, SignalKind } from "@/contracts";
import { marketLabel, signalKindLabel } from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { download, fmtDate, fromNow } from "@/lib/format";
import { CaseStateBadge, OutcomeBadge, Pill, RegionChip } from "@/components/common/badges";
import { Markdown } from "@/components/common/markdown";
import { PageSkeleton } from "@/components/common/page";
import { AvatarStack, UserAvatar, useUsers } from "@/components/common/people";
import { ObjectActivity } from "@/components/common/activity";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { CaseActionDialog, type UiCaseAction } from "@/components/cases/case-action-dialog";
import { CaseDetails } from "@/components/cases/case-details";
import { QuestionsPanel } from "@/components/cases/questions-panel";
import { useScores } from "@/components/cases/use-scores";
import { ChatPanel } from "@/components/chat/chat-panel";
import { RequirementCard } from "@/components/requirements/requirement-card";
import { SignalCard } from "@/components/signals/signal-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Tab = "overview" | "signals" | "questions" | "requirements" | "activity";

export function CaseView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const bundle = useApi("caseBundle", { params: { id } });
  const me = useApi("me");
  const scores = useScores();
  const { name } = useUsers();
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  const highlight = params.get("signal");
  const [side, setSide] = useState<"details" | "chat">(params.get("chat") ? "chat" : "details");
  const [action, setAction] = useState<UiCaseAction | null>(null);

  useEffect(() => {
    if (highlight && tab === "signals") setTimeout(() => document.getElementById(`signal-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  }, [highlight, tab, bundle.data]);

  if (bundle.isLoading || !bundle.data || !me.data) return <PageSkeleton />;
  const { case: c, signals, questions, requirements, referrals, alerts, proposals, linkedCases } = bundle.data;
  const user = me.data.user;
  const canEdit = user.id === c.ownerId || c.coOwnerIds.includes(user.id) || user.role === "head";
  const watching = c.watcherIds.includes(user.id);
  const openAlerts = alerts.filter((a) => a.status === "open");
  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const openQuestions = questions.filter((q) => q.status === "open").length;

  const changeTab = (t: Tab, signal?: string) => router.replace(`/cases/${c.id}?tab=${t}${signal ? `&signal=${signal}` : ""}`, { scroll: false });
  const onCite = (ref: string) => {
    if (ref.startsWith("Q-")) return changeTab("questions");
    if (ref.startsWith("REQ-")) return router.push(`/requirements/${ref}`);
    if (ref.startsWith("CASE-")) return router.push(`/cases/${ref}`);
    changeTab("signals", ref);
  };

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="border-b bg-background px-6 pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/cases" className="hover:underline">
              Cases
            </Link>
            <span>/</span>
            <span className="font-mono">{c.id}</span>
            {c.synthetic && <Pill className="ml-1">synthetic case</Pill>}
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-snug font-semibold tracking-tight">{c.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <CaseStateBadge state={c.state} />
                {c.outcome && <OutcomeBadge outcome={c.outcome} />}
                <RegionChip region={c.scope} />
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserAvatar id={c.ownerId} size="xs" /> {name(c.ownerId)}
                </span>
                {c.watcherIds.length > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="size-3" /> <AvatarStack ids={c.watcherIds} />
                  </span>
                )}
                <span className="text-muted-foreground">
                  created {fromNow(c.createdAt)} by {name(c.createdBy)} · updated {fromNow(c.updatedAt)}
                </span>
              </div>
            </div>
            <CaseActions c={c} canEdit={canEdit} watching={watching} onAction={setAction} userId={user.id} />
          </div>
          {!canEdit && (
            <p className="mt-3 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> Owned by {name(c.ownerId)}. You can read everything, comment, watch, ask the AI and escalate conflicts. Status changes are the owner&apos;s.
            </p>
          )}
        </div>

        <div className="space-y-3 px-6 pt-4">
          {openAlerts.map((a) => (
            <AlertBanner key={a.id} a={a} canResolve={a.ownerId === user.id || user.role === "head"} onCite={onCite} />
          ))}
          <LinkBanners c={c} referrals={referrals} linkedCases={linkedCases} />
          {pendingProposals.length > 0 && tab !== "questions" && (
            <button onClick={() => changeTab("questions")} className="flex w-full items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-left text-sm">
              <Sparkles className="size-4 text-primary" /> {pendingProposals.length} AI proposal{pendingProposals.length > 1 ? "s" : ""} waiting for your decision
              <ArrowRight className="ml-auto size-4" />
            </button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)} className="px-6 py-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="signals">Signals ({signals.length})</TabsTrigger>
            <TabsTrigger value="questions">Open questions {openQuestions > 0 && `(${openQuestions})`}</TabsTrigger>
            <TabsTrigger value="requirements">Requirements ({requirements.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-3">
            <CaseDocument c={c} canEdit={canEdit} onCite={onCite} />
          </TabsContent>
          <TabsContent value="signals" className="pt-3">
            <SignalsTab signals={signals} highlight={highlight} c={c} />
          </TabsContent>
          <TabsContent value="questions" className="pt-3">
            <QuestionsPanel caseId={c.id} questions={questions} proposals={proposals} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="requirements" className="pt-3">
            <RequirementsTab c={c} requirements={requirements} canEdit={canEdit} scores={scores.reqs} onConfirm={() => setAction("confirm")} />
          </TabsContent>
          <TabsContent value="activity" className="pt-3">
            <ObjectActivity objectType="case" objectId={c.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right side: details or AI */}
      <aside className="sticky top-0 flex h-[calc(100dvh-3.5rem)] w-[340px] shrink-0 flex-col border-l bg-background 2xl:w-[420px]">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={side} onValueChange={(v) => v && setSide(v as "details")} className="w-full">
            <ToggleGroupItem value="details" className="flex-1 gap-1.5">
              <PanelRight className="size-3.5" /> Details
            </ToggleGroupItem>
            <ToggleGroupItem value="chat" className="flex-1 gap-1.5">
              <Bot className="size-3.5" /> AI assistant
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {side === "details" ? (
            <CaseDetails c={c} scored={scores.cases.get(c.id)} signals={signals} canEdit={canEdit} />
          ) : (
            <ChatPanel objectType="case" objectId={c.id} proposals={proposals} canEdit={canEdit} onCite={onCite} />
          )}
        </div>
      </aside>
      <CaseActionDialog c={c} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </div>
  );
}

function CaseActions({ c, canEdit, watching, onAction, userId }: { c: Case; canEdit: boolean; watching: boolean; onAction: (a: UiCaseAction) => void; userId: string }) {
  const patch = useApiMutation("patchCase", { success: watching ? "Stopped watching" : "Watching: you'll be notified about new signals" });
  const next: Partial<Record<Case["state"], [UiCaseAction, string]>> = {
    observed: ["open", "Open case"],
    new: ["start", "Start investigating"],
    investigating: ["await", "Waiting for answers"],
    awaiting_answers: ["ready", "Ready to decide"],
  };
  const step = next[c.state];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => patch.mutate({ params: { id: c.id }, body: { patch: { watcherIds: watching ? c.watcherIds.filter((w) => w !== userId) : [...c.watcherIds, userId] } } })}
      >
        {watching ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {watching ? "Unwatch" : "Watch"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          const r = await api("exportCaseMd", { params: { id: c.id } });
          download(r.filename, r.content, "text/markdown");
        }}
      >
        <Download className="size-3.5" /> .md
      </Button>
      {c.marketConflict && c.state !== "decided" && (
        <Button variant="outline" size="sm" onClick={() => onAction("escalate")}>
          <Scale className="size-3.5" /> Escalate
        </Button>
      )}
      {canEdit && step && (
        <Button variant="outline" size="sm" onClick={() => onAction(step[0])}>
          {step[1]}
        </Button>
      )}
      {canEdit && c.state === "decided" && (
        <Button variant="outline" size="sm" onClick={() => onAction("reopen")}>
          Reopen
        </Button>
      )}
      {canEdit && c.state !== "decided" && c.state !== "observed" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              Decide <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem onClick={() => onAction("confirm")}>
              <span>
                <span className="block font-medium">Confirm → build requirement(s)</span>
                <span className="block text-xs text-muted-foreground">Next generation, mid-life update or OTA</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("refer")}>
              <span>
                <span className="block font-medium">Refer to another PM</span>
                <span className="block text-xs text-muted-foreground">Other series or attribute owner (Baukasten)</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("innovation")}>
              <span>
                <span className="block font-medium">Innovation pool</span>
                <span className="block text-xs text-muted-foreground">For a future series or new product</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("park")}>
              <span>
                <span className="block font-medium">Park and keep watching</span>
                <span className="block text-xs text-muted-foreground">Comes back with new evidence</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("merge")}>
              <span>
                <span className="block font-medium">Merge into another case</span>
                <span className="block text-xs text-muted-foreground">Same problem, keep one case</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction("reject")}>
              Reject (reason kept for the next generation)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function AlertBanner({ a, canResolve, onCite }: { a: Alert; canResolve: boolean; onCite: (ref: string) => void }) {
  const [mode, setMode] = useState<"dismissed" | "rework" | null>(null);
  const resolve = useApiMutation("resolveAlert", { success: (r) => (r.status === "rework" ? "Sent back for rework" : "Alert dismissed") });
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/40">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {a.title}
          <Pill t="amber">{a.verdict === "raises_the_bar" ? "Raises the bar" : "Contradicts"}</Pill>
          <span className="text-xs font-normal text-muted-foreground">monitor · {fromNow(a.createdAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{a.detail}</p>
        <div className="mt-1 flex gap-1">
          {a.signalIds.map((s) => (
            <button key={s} onClick={() => onCite(s)} className="rounded border border-primary/30 bg-primary/5 px-1 font-mono text-[11px] text-primary">
              {s}
            </button>
          ))}
        </div>
      </div>
      {canResolve && (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => setMode("dismissed")}>
            Dismiss
          </Button>
          <Button size="xs" onClick={() => setMode("rework")}>
            Rework
          </Button>
        </div>
      )}
      <RationaleDialog
        open={!!mode}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "rework" ? "Send back for rework" : "Dismiss the alert"}
        description="The monitor never edits a case or requirement. You decide, and the decision is logged."
        pending={resolve.isPending}
        onSubmit={async (rationale) => {
          await resolve.mutateAsync({ params: { id: a.id }, body: { status: mode!, rationale } });
          setMode(null);
        }}
      />
    </div>
  );
}

function LinkBanners({ c, referrals, linkedCases }: { c: Case; referrals: { id: string; kind: string; caseId: string; toUserId: string; fromUserId: string; status: string; linkedCaseId: string | null; resolution?: string; declineReason?: string }[]; linkedCases: Case[] }) {
  const { name } = useUsers();
  const items: React.ReactNode[] = [];
  const origin = linkedCases.find((x) => x.id === c.originCaseId);
  if (origin)
    items.push(
      <span key="o">
        Linked from <Link className="font-mono text-primary hover:underline" href={`/cases/${origin.id}`}>{origin.id}</Link> ({name(origin.ownerId)}): {origin.title}
      </span>,
    );
  if (c.mergedInto)
    items.push(
      <span key="m">
        Merged into <Link className="font-mono text-primary hover:underline" href={`/cases/${c.mergedInto}`}>{c.mergedInto}</Link>
      </span>,
    );
  for (const r of referrals.filter((r) => r.caseId === c.id)) {
    if (r.kind === "escalation")
      items.push(
        <span key={r.id}>
          Escalated by {name(r.fromUserId)} to {name(r.toUserId)} · <b>{r.status}</b>
          {r.resolution && `: ${r.resolution}`}
        </span>,
      );
    else
      items.push(
        <span key={r.id}>
          Referred by {name(r.fromUserId)} to {name(r.toUserId)} · <b>{r.status}</b>
          {r.linkedCaseId && (
            <>
              {" "}
              → <Link className="font-mono text-primary hover:underline" href={`/cases/${r.linkedCaseId}`}>{r.linkedCaseId}</Link>
            </>
          )}
          {r.declineReason && ` (${r.declineReason})`}
        </span>,
      );
  }
  for (const x of linkedCases.filter((x) => x.originCaseId === c.id && !referrals.some((r) => r.linkedCaseId === x.id)))
    items.push(
      <span key={x.id}>
        Pulled into <Link className="font-mono text-primary hover:underline" href={`/cases/${x.id}`}>{x.id}</Link> by {name(x.ownerId)}
      </span>,
    );
  if (!items.length) return null;
  return (
    <div className="space-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <GitBranch className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {it}
        </div>
      ))}
    </div>
  );
}

function CaseDocument({ c, canEdit, onCite }: { c: Case; canEdit: boolean; onCite: (r: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.bodyMd);
  const [saveOpen, setSaveOpen] = useState(false);
  const patch = useApiMutation("patchCase", { success: "Page saved (new version)" });
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" /> Case page · version {c.bodyVersion}
        <span className="flex-1" />
        {canEdit && !editing && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setDraft(c.bodyMd);
              setEditing(true);
            }}
          >
            <Pencil className="size-3" /> Edit
          </Button>
        )}
        {editing && (
          <>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="xs" onClick={() => setSaveOpen(true)} disabled={draft === c.bodyMd}>
              Save
            </Button>
          </>
        )}
      </div>
      {editing ? (
        <div className="grid gap-0 lg:grid-cols-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[520px] rounded-none border-0 border-r font-mono text-xs focus-visible:ring-0" />
          <div className="max-h-[520px] overflow-y-auto p-5">
            <Markdown>{draft}</Markdown>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <Markdown onCite={onCite}>{c.bodyMd}</Markdown>
        </div>
      )}
      <RationaleDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save the case page"
        description="A new version is stored; the audit trail keeps the previous text."
        pending={patch.isPending}
        onSubmit={async (rationale) => {
          await patch.mutateAsync({ params: { id: c.id }, body: { patch: { bodyMd: draft }, rationale } });
          setSaveOpen(false);
          setEditing(false);
        }}
      />
    </div>
  );
}

const sourceGroups = { all: "All sources", bmw: "BMW data", web: "Web" } as const;

function SignalsTab({ signals, highlight, c }: { signals: Signal[]; highlight: string | null; c: Case }) {
  const [group, setGroup] = useState<keyof typeof sourceGroups>("all");
  const [kind, setKind] = useState<string>("all");
  const [market, setMarket] = useState<string>("all");
  const [noSocial, setNoSocial] = useState(false);
  const [ownersOnly, setOwnersOnly] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      signals.filter(
        (s) =>
          (group === "all" || (group === "bmw" ? s.agent === "bmw_data" : s.agent !== "bmw_data")) &&
          (kind === "all" || s.kind === kind) &&
          (market === "all" || s.market === market) &&
          (!noSocial || (s.sourceType !== "social" && s.sourceType !== "video")) &&
          (!ownersOnly || s.audience === "owner") &&
          (!q || (s.quote + s.summary + s.id).toLowerCase().includes(q.toLowerCase())),
      ),
    [signals, group, kind, market, noSocial, ownersOnly, q],
  );
  const markets = [...new Set(signals.map((s) => s.market))];
  const kinds = [...new Set(signals.map((s) => s.kind))] as SignalKind[];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" size="sm" variant="outline" value={group} onValueChange={(v) => v && setGroup(v as "all")}>
          {(Object.keys(sourceGroups) as (keyof typeof sourceGroups)[]).map((g) => (
            <ToggleGroupItem key={g} value={g} className="px-2.5">
              {sourceGroups[g]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>
                {signalKindLabel[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={market} onValueChange={setMarket}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {markets.map((m) => (
              <SelectItem key={m} value={m}>
                {marketLabel[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch checked={noSocial} onCheckedChange={setNoSocial} /> Exclude social & video
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch checked={ownersOnly} onCheckedChange={setOwnersOnly} /> Owners only
        </label>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quotes" className="h-7 w-48" />
        <span className="text-xs text-muted-foreground">
          {list.length} of {signals.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Every signal links back to its source: a BMW record (verbatim ID, study row) or a web page with a deep link and a stored snapshot. Counts use distinct customers, never views or likes. Last fetch {fmtDate(c.updatedAt)}.
      </p>
      <div className="space-y-2">
        {list.map((s) => (
          <SignalCard key={s.id} s={s} highlighted={s.id === highlight} />
        ))}
      </div>
    </div>
  );
}

function RequirementsTab({
  c,
  requirements,
  canEdit,
  scores,
  onConfirm,
}: {
  c: Case;
  requirements: import("@/contracts").Requirement[];
  canEdit: boolean;
  scores: Map<string, { score: number; rank: number }>;
  onConfirm: () => void;
}) {
  const generate = useApiMutation("generateRequirements", { success: (r) => `${r.length} requirement draft${r.length === 1 ? "" : "s"} created` });
  return (
    <div className="space-y-3">
      {c.outcome !== "confirmed" && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          <span className="flex-1">Requirements are built from a case once you confirm it: the case is the problem, a requirement is what BMW builds (with target, release and rough cost). One per case, or one per market when markets differ.</span>
          {canEdit && c.state !== "decided" && c.state !== "observed" && (
            <Button size="sm" onClick={onConfirm}>
              Confirm case
            </Button>
          )}
        </div>
      )}
      {c.outcome === "confirmed" && canEdit && (
        <Button size="sm" variant="outline" onClick={() => generate.mutate({ params: { id: c.id }, body: {} })} disabled={generate.isPending}>
          <Sparkles className="size-3.5" /> Draft another requirement with AI
        </Button>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {requirements.map((r) => (
          <RequirementCard key={r.id} r={r} score={scores.get(r.id)?.score} rank={scores.get(r.id)?.rank} />
        ))}
      </div>
    </div>
  );
}

