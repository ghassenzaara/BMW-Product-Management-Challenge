"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  Info,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { ArgusMark } from "@/components/brand/marks";
import type { Alert, Case, Requirement, Signal } from "@/contracts";
import { caseStateLabel, marketLabel } from "@/contracts";
import { api } from "@/lib/api/client";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { download, fromNow } from "@/lib/format";
import { caseSankey, isCustomer, sayLabel, topicLabels, type SankeyNode } from "@/lib/sankey";
import { cn } from "@/lib/utils";
import { CaseStateBadge, EvidenceBars, MarketChip, OutcomeBadge, Pill, ReqStatusDot } from "@/components/common/badges";
import { Markdown } from "@/components/common/markdown";
import { PageSkeleton } from "@/components/common/page";
import { UserAvatar, useUsers } from "@/components/common/people";
import { ObjectActivity } from "@/components/common/activity";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { CaseActionDialog, type UiCaseAction } from "@/components/cases/case-action-dialog";
import { CaseDetails } from "@/components/cases/case-details";
import { AddEvidenceDialog, EditCaseDialog } from "@/components/cases/case-forms";
import { StanceForm } from "@/components/cases/stance-form";
import { ShapeForm } from "@/components/cases/shape-form";
import { QuestionsPanel } from "@/components/cases/questions-panel";
import { useScores } from "@/components/cases/use-scores";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useHideArgusBubble } from "@/components/argus/store";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { SankeyChart } from "@/components/sankey/sankey-chart";
import { SignalCard } from "@/components/signals/signal-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Step = "evidence" | "knowledge" | "requirements";
const releaseShort = { next_gen: "Next gen", lci: "LCI", ota: "OTA" } as const;
type Drawer = "details" | "activity" | null;
interface QuoteSet {
  title: string;
  sub?: string;
  signalIds: string[];
}

export function CaseView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const bundle = useApi("caseBundle", { params: { id } });
  const me = useApi("me");
  const taxonomy = useApi("taxonomy");
  const scores = useScores();
  const { name } = useUsers();
  const step = (params.get("step") as Step | null) ?? "evidence";
  const [chat, setChat] = useState(params.get("chat") === "1");
  useHideArgusBubble(chat);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [quotes, setQuotes] = useState<QuoteSet | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [action, setAction] = useState<UiCaseAction | null>(null);
  const [evidence, setEvidence] = useState(params.get("evidence") === "1");
  const [editDetails, setEditDetails] = useState(false);
  const research = useApiMutation("postMessage", { success: "The assistant is looking for more sources" });
  const patchWatch = useApiMutation("patchCase", { silent: true });

  if (bundle.isLoading || !bundle.data || !me.data) return <PageSkeleton />;
  const { case: c, signals, questions, requirements, referrals, alerts, proposals, linkedCases } = bundle.data;
  const user = me.data.user;
  const canEdit = user.id === c.ownerId || c.coOwnerIds.includes(user.id) || user.role === "head";
  // PMs of the same series work the case under their own brief (stance + their own regional requirement).
  const canDraft = canEdit || (user.role === "vehicle_pm" && user.series.includes(c.series));
  const myStance = c.stances.find((s) => s.authorId === user.id);
  const watching = c.watcherIds.includes(user.id);
  // Competitor ripples alert the requirement (its page links to the ripple), not the case.
  const openAlerts = alerts.filter((a) => a.status === "open" && !a.rippleId);
  const pending = proposals.filter((p) => p.status === "pending").length;
  const openQuestions = questions.filter((q) => q.status === "open").length;

  const graph = caseSankey(c, signals, topicLabels(taxonomy.data));
  const customers = signals.filter(isCustomer).length;
  // A cited signal (?signal=) opens its quote directly.
  const cited = params.get("signal");
  const quoteSet: QuoteSet | null = quotes ?? (cited && signals.some((s) => s.id === cited) ? { title: "Cited source", signalIds: [cited] } : null);

  const go = (s: Step) => router.replace(`/cases/${c.id}?step=${s}`, { scroll: false });
  const onCite = (ref: string) => {
    if (ref.startsWith("Q-")) return go("knowledge");
    if (ref.startsWith("REQ-")) return setReqId(ref);
    if (ref.startsWith("CASE-")) return router.push(`/cases/${ref}`);
    setQuotes({ title: "Cited source", signalIds: [ref] });
  };
  const onNode = (n: SankeyNode) => {
    if (n.hero) return go("requirements");
    setSelected(n.id);
    setQuotes({ title: n.label, sub: n.say ? sayLabel[n.say] : n.sub, signalIds: n.signalIds });
  };

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 px-6 pt-4 pb-10">
        {/* Header */}
        <Link href="/cases" className="inline-flex items-center gap-1 font-mono text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {c.id}
        </Link>
        <div className="mt-1 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-title font-semibold max-md:text-2xl">{c.shortTitle}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label={watching ? "Stop watching" : "Watch"} onClick={() => toggleWatch()}>
              {watching ? <EyeOff /> : <Eye />}
            </IconButton>
            {canEdit && (
              <IconButton label="Edit details" onClick={() => setEditDetails(true)}>
                <Pencil />
              </IconButton>
            )}
            <IconButton label="Details and score" onClick={() => setDrawer("details")}>
              <Info />
            </IconButton>
            <IconButton label="Comments and history" onClick={() => setDrawer("activity")}>
              <MessageSquare />
            </IconButton>
            <MoreMenu c={c} onAction={setAction} canEdit={canEdit} />
            <Button variant={chat ? "secondary" : "outline"} size="sm" className="ml-1" onClick={() => setChat(!chat)}>
              <ArgusMark className="size-4" /> Ask Argus
            </Button>
            {canEdit && c.state !== "decided" && c.state !== "observed" && <DecideMenu onAction={setAction} />}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StateControl c={c} canEdit={canEdit} onAction={setAction} />
          {c.outcome && <OutcomeBadge outcome={c.outcome} />}
          <span className="flex items-center gap-1.5 text-sm">
            <UserAvatar id={c.ownerId} size="xs" /> {name(c.ownerId)}
          </span>
          <EvidenceBars level={c.evidenceLevel} />
          <span className="flex gap-1">
            {c.markets.map((m) => (
              <MarketChip key={m} market={m} muted />
            ))}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MarketsPopover c={c} />
          {canEdit && (
            <PillButton icon={<Plus />} dashed onClick={() => setEvidence(true)}>
              Add evidence
            </PillButton>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {openAlerts.map((a) => (
            <AlertBanner key={a.id} a={a} canResolve={a.ownerId === user.id || user.role === "head"} onCite={onCite} />
          ))}
          <LinkBanner c={c} referrals={referrals} linkedCases={linkedCases} />
        </div>

        {/* Three steps */}
        <nav className="mt-5 flex flex-wrap items-center gap-1 border-b" aria-label="Case steps">
          <StepTab n={1} active={step === "evidence"} onClick={() => go("evidence")} label="Evidence" meta={`${signals.length}`} done />
          <StepTab n={2} active={step === "knowledge"} onClick={() => go("knowledge")} label="Your context" meta={openQuestions ? `${openQuestions} open` : undefined} done={!!myStance} badge={pending} />
          <StepTab n={3} active={step === "requirements"} onClick={() => go("requirements")} label="Requirements" meta={requirements.length ? `${requirements.length}` : undefined} done={requirements.length > 0} />
        </nav>

        <div className="pt-5">
          {step === "evidence" && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-card p-5">
                <SankeyChart graph={graph} heroValue={customers} selectedId={selected} onSelect={onNode} />
              </div>
              <Highlights c={c} canEdit={canEdit} onCite={onCite} />
              <NextButton onClick={() => go("knowledge")}>Next: your context</NextButton>
            </div>
          )}
          {step === "knowledge" && (
            <div className="space-y-6">
              <StanceForm key={myStance?.updatedAt ?? "new"} c={c} brief={me.data.brief} userId={user.id} canEdit={canDraft} onSaved={() => setChat(true)} />
              <section>
                <h2 className="mb-3 text-lg font-semibold">Open questions</h2>
                <QuestionsPanel caseId={c.id} questions={questions} proposals={proposals} canEdit={canEdit} />
              </section>
              <NextButton onClick={() => go("requirements")}>Next: requirements</NextButton>
            </div>
          )}
          {step === "requirements" && (
            <RequirementsStep c={c} requirements={requirements} canEdit={canEdit} canDraft={canDraft} userId={user.id} onOpen={setReqId} onConfirm={() => setAction("confirm")} onChat={() => setChat(true)} />
          )}
        </div>
      </div>

      {chat && (
        <aside className="sticky top-0 flex h-[calc(100dvh-3.5rem)] w-[360px] shrink-0 flex-col border-l bg-card 2xl:w-[420px]">
          <div className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
            <ArgusMark className="size-4 text-primary" /> Argus
            <span className="flex-1" />
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setChat(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel objectType="case" objectId={c.id} proposals={proposals} canEdit={canEdit} onCite={onCite} />
          </div>
        </aside>
      )}

      <QuotesSheet set={quoteSet} signals={signals} onClose={() => {
        setQuotes(null);
        setSelected(null);
        if (cited) router.replace(`/cases/${c.id}?step=${step}`, { scroll: false });
      }} />
      <Sheet open={drawer !== null} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{drawer === "details" ? "Details and score" : "Comments and history"}</SheetTitle>
            <SheetDescription className="sr-only">{c.title}</SheetDescription>
          </SheetHeader>
          {drawer === "details" && <CaseDetails c={c} scored={scores.cases.get(c.id)} signals={signals} canEdit={canEdit} />}
          {drawer === "activity" && (
            <div className="p-4">
              <ObjectActivity objectType="case" objectId={c.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
      <RequirementSheet id={reqId} onOpenChange={(o) => !o && setReqId(null)} />
      <CaseActionDialog c={c} action={action} onOpenChange={(o) => !o && setAction(null)} />
      <EditCaseDialog c={c} open={editDetails} onOpenChange={setEditDetails} />
      <AddEvidenceDialog
        c={c}
        open={evidence}
        onOpenChange={(o) => {
          setEvidence(o);
          if (!o && params.get("evidence")) router.replace(`/cases/${c.id}?step=${step}`, { scroll: false });
        }}
        onResearch={() => {
          setChat(true);
          research.mutate({ params: { type: "case", id: c.id }, body: { content: "Research what owners say" } });
        }}
      />
    </div>
  );

  function toggleWatch() {
    patchWatch.mutate({ params: { id: c.id }, body: { patch: { watcherIds: watching ? c.watcherIds.filter((w) => w !== user.id) : [...c.watcherIds, user.id] } } });
  }
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="[&_svg]:size-4.5">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PillButton({ icon, children, onClick, disabled, dashed }: { icon: React.ReactNode; children: React.ReactNode; onClick?: () => void; disabled?: boolean; dashed?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors duration-150 hover:border-border-strong disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        dashed && "border-dashed border-border-strong bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function StepTab({ n, label, meta, active, done, badge, onClick }: { n: number; label: string; meta?: string; active: boolean; done?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150", active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
    >
      <span className={cn("grid size-5 place-items-center rounded-full text-xs font-semibold", active ? "bg-primary text-primary-foreground" : done ? "bg-border-strong text-foreground" : "border border-border-strong text-muted-foreground")}>
        {done && !active ? <Check className="size-3" strokeWidth={2.5} /> : n}
      </span>
      {label}
      {meta && <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>}
      {!!badge && (
        <span className="rounded-full bg-ember px-1.5 text-xs leading-5 font-semibold text-obsidian tabular-nums" title="AI proposals waiting">
          {badge}
        </span>
      )}
    </button>
  );
}

function NextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onClick}>
        {children} <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function StateControl({ c, canEdit, onAction }: { c: Case; canEdit: boolean; onAction: (a: UiCaseAction) => void }) {
  const next: Partial<Record<Case["state"], [UiCaseAction, string]>> = {
    observed: ["open", "Open case"],
    new: ["start", "Start investigating"],
    investigating: ["await", "Waiting for answers"],
    awaiting_answers: ["ready", "Ready to decide"],
    decided: ["reopen", "Reopen"],
  };
  const step = next[c.state];
  if (!canEdit || !step) return <CaseStateBadge state={c.state} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`State: ${caseStateLabel[c.state]}. Change`}>
        <CaseStateBadge state={c.state} />
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onAction(step[0])}>{step[1]}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DecideMenu({ onAction }: { onAction: (a: UiCaseAction) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          Decide <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => onAction("confirm")}>Confirm → requirements</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("refer")}>Refer to another PM</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("innovation")}>Innovation pool</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("park")}>Park and keep watching</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("merge")}>Merge into another case</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onAction("reject")}>
          Reject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMenu({ c, canEdit, onAction }: { c: Case; canEdit: boolean; onAction: (a: UiCaseAction) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More" className="[&_svg]:size-4.5">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={async () => {
            const r = await api("exportCaseMd", { params: { id: c.id } });
            download(r.filename, r.content, "text/markdown");
          }}
        >
          <Download /> Export as .md
        </DropdownMenuItem>
        {c.marketConflict && c.state !== "decided" && (
          <DropdownMenuItem onClick={() => onAction("escalate")}>
            <Scale /> Escalate market conflict
          </DropdownMenuItem>
        )}
        {canEdit && c.state === "decided" && <DropdownMenuItem onClick={() => onAction("reopen")}>Reopen</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MarketsPopover({ c }: { c: Case }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors duration-150 hover:border-border-strong">
          Markets {c.marketConflict && <AlertTriangle className="size-3.5 text-warning" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Market</th>
              <th className="px-2 py-2 text-right font-medium">Customers</th>
              <th className="px-2 py-2 text-right font-medium">Study</th>
              <th className="px-3 py-2 text-right font-medium">Sales 2030</th>
            </tr>
          </thead>
          <tbody>
            {c.figures.perMarket.map((m) => (
              <tr key={m.market} className="border-b last:border-0">
                <td className="px-3 py-2">{marketLabel[m.market]}</td>
                <td className="px-2 py-2 text-right tabular-nums">{m.customers}</td>
                <td className="px-2 py-2 text-right tabular-nums">{m.studyScore ?? "–"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.salesShare2030 !== undefined ? `${Math.round(m.salesShare2030 * 100)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.marketConflict && <p className="border-t px-3 py-2 text-xs text-muted-foreground">{c.marketConflict.note}</p>}
      </PopoverContent>
    </Popover>
  );
}

function Highlights({ c, canEdit, onCite }: { c: Case; canEdit: boolean; onCite: (r: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-6">
      <ul className="space-y-2.5">
        {c.highlights.map((h, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-6">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground" />
            {h}
          </li>
        ))}
      </ul>
      <button onClick={() => setOpen(!open)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-150 hover:decoration-foreground">
        <FileText className="size-3.5" /> {open ? "Hide full analysis" : "Read full analysis"}
      </button>
      {open && <CaseDocument c={c} canEdit={canEdit} onCite={onCite} />}
    </div>
  );
}

function CaseDocument({ c, canEdit, onCite }: { c: Case; canEdit: boolean; onCite: (r: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.bodyMd);
  const [saveOpen, setSaveOpen] = useState(false);
  const patch = useApiMutation("patchCase", { success: "Page saved" });
  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        Version {c.bodyVersion}
        <span className="flex-1" />
        {canEdit && !editing && (
          <Button size="xs" variant="ghost" onClick={() => (setDraft(c.bodyMd), setEditing(true))}>
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
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[420px] font-mono text-xs" />
      ) : (
        <Markdown onCite={onCite}>{c.bodyMd}</Markdown>
      )}
      <RationaleDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save the case page"
        description="A new version is stored; the history keeps the old text."
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

function RequirementsStep({
  c,
  requirements,
  canEdit,
  canDraft,
  userId,
  onOpen,
  onConfirm,
  onChat,
}: {
  c: Case;
  requirements: Requirement[];
  canEdit: boolean;
  canDraft: boolean;
  userId: string;
  onOpen: (id: string) => void;
  onConfirm: () => void;
  onChat: () => void;
}) {
  const confirmed = c.outcome === "confirmed";
  const [shapingState, setShaping] = useState<boolean | null>(null);
  const shaping = shapingState ?? (confirmed && canDraft && canEdit && requirements.length === 0);
  const mine = requirements.filter((r) => r.ownerId === userId && r.status !== "rejected");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!confirmed && canEdit && c.state !== "decided" && c.state !== "observed" && (
          <Button onClick={onConfirm}>
            <Sparkles className="size-4" /> Confirm case
          </Button>
        )}
        {confirmed && canDraft && !shaping && (
          <Button onClick={() => setShaping(true)} variant={mine.length ? "outline" : "default"}>
            <Sparkles className="size-4" /> {mine.length ? "Draft another" : requirements.length && !canEdit ? "Draft my regional variant" : "Create requirements"}
          </Button>
        )}
        {requirements.length > 0 && (
          <Button variant="outline" onClick={onChat}>
            <ArgusMark className="size-4" /> Ask Argus
          </Button>
        )}
        {!confirmed && !canEdit && <p className="text-sm text-muted-foreground">No requirements yet.</p>}
        {!confirmed && canEdit && <p className="text-sm text-muted-foreground">Confirm the case, then answer up to three questions; the draft uses your product specs and context.</p>}
      </div>
      {shaping && (
        <ShapeForm
          caseId={c.id}
          onCancel={() => setShaping(false)}
          onCreated={(ids) => {
            setShaping(false);
            if (ids[0]) onOpen(ids[0]);
          }}
        />
      )}
      {requirements.length > 0 && (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {requirements.map((r) => (
            <button key={r.id} onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-muted/60">
              <UserAvatar id={r.ownerId} size="xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={r.title}>
                {r.shortTitle}
              </span>
              {r.marketScope !== "global" && <Pill>{r.marketScope}</Pill>}
              {r.version > 1 && <Pill>v{r.version}</Pill>}
              <span className="text-xs text-muted-foreground">
                {releaseShort[r.releaseTarget]} · {r.cost.size}
              </span>
              <ReqStatusDot status={r.status} />
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuotesSheet({ set, signals, onClose }: { set: QuoteSet | null; signals: Signal[]; onClose: () => void }) {
  const list = set ? signals.filter((s) => set.signalIds.includes(s.id)) : [];
  return (
    <Sheet open={!!set} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{set?.title}</SheetTitle>
          <SheetDescription>
            {list.length} source{list.length === 1 ? "" : "s"}
            {set?.sub && ` · ${set.sub}`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-4">
          {list.map((s) => (
            <SignalCard key={s.id} s={s} compact />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AlertBanner({ a, canResolve, onCite }: { a: Alert; canResolve: boolean; onCite: (ref: string) => void }) {
  const [mode, setMode] = useState<"dismissed" | "rework" | null>(null);
  const resolve = useApiMutation("resolveAlert", { success: (r) => (r.status === "rework" ? "Sent back for rework" : "Alert dismissed") });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tone-amber-bd bg-tone-amber-bg px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <button onClick={() => a.signalIds[0] && onCite(a.signalIds[0])} className="min-w-0 flex-1 text-left text-sm">
        <span className="font-medium">{a.title}</span>
        <span className="ml-2 text-xs text-muted-foreground">{fromNow(a.createdAt)}</span>
      </button>
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
        description={a.detail}
        pending={resolve.isPending}
        onSubmit={async (rationale) => {
          await resolve.mutateAsync({ params: { id: a.id }, body: { status: mode!, rationale } });
          setMode(null);
        }}
      />
    </div>
  );
}

function LinkBanner({ c, referrals, linkedCases }: { c: Case; referrals: { id: string; kind: string; caseId: string; toUserId: string; fromUserId: string; status: string; linkedCaseId: string | null }[]; linkedCases: Case[] }) {
  const { name } = useUsers();
  const items: React.ReactNode[] = [];
  const origin = linkedCases.find((x) => x.id === c.originCaseId);
  if (origin) items.push(<CaseLink key="o" id={origin.id} prefix={`Linked from ${name(origin.ownerId)}`} />);
  if (c.mergedInto) items.push(<CaseLink key="m" id={c.mergedInto} prefix="Merged into" />);
  for (const r of referrals.filter((r) => r.caseId === c.id))
    items.push(
      <span key={r.id}>
        {r.kind === "escalation" ? "Escalated" : "Referred"} to {name(r.toUserId)} · {r.status}
        {r.linkedCaseId && <CaseLink id={r.linkedCaseId} prefix=" →" />}
      </span>,
    );
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <GitBranch className="size-4" />
      {items}
    </div>
  );
}

function CaseLink({ id, prefix }: { id: string; prefix: string }) {
  return (
    <span>
      {prefix}{" "}
      <Link className="font-mono text-foreground underline decoration-border-strong underline-offset-2 transition-colors duration-150 hover:decoration-foreground" href={`/cases/${id}`}>
        {id}
      </Link>
    </span>
  );
}
