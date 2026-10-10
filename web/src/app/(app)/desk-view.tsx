"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, AtSign, CheckCircle2, CircleDot, ClipboardCheck, CornerUpLeft, Forward, KanbanSquare, MessageSquareReply, Radar, Scale, Signature } from "lucide-react";
import type { Case, Referral, Requirement, RequirementAction } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fmtDate, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CaseStateBadge, ReqStatusBadge } from "@/components/common/badges";
import { useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { useScores } from "@/components/cases/use-scores";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { Button } from "@/components/ui/button";

/**
 * My desk: what needs the PM, sorted by the kind of work it is.
 * Four cards, one line per item, everything clickable.
 */
export function DeskView() {
  const me = useApi("me");
  const { data: cases = [] } = useApi("cases");
  const { data: questions = [] } = useApi("questions");
  const { data: referrals = [] } = useApi("referrals");
  const { data: alerts = [] } = useApi("alerts");
  const { data: notifications = [] } = useApi("notifications");
  const { data: requirements = [] } = useApi("requirements");
  const scores = useScores();
  const { name } = useUsers();
  const [reqId, setReqId] = useState<string | null>(null);
  const user = me.data?.user;
  if (!user) return null;
  const isHead = user.role === "head";
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const rank = (id: string) => scores.cases.get(id)?.rank ?? 999;
  const objectHref = (type: "case" | "requirement", id: string) => (type === "case" ? `/cases/${id}?step=knowledge` : `/requirements/${id}`);

  // Agent flags: monitor alerts on my work, @mentions.
  const flags = [
    ...alerts
      .filter((a) => a.status === "open" && (isHead || a.ownerId === user.id))
      .map((a) => ({ key: a.id, icon: <AlertTriangle className="text-amber-500" />, title: a.title, meta: fromNow(a.createdAt), href: a.caseId ? `/cases/${a.caseId}` : "/inbox" })),
    ...notifications
      .filter((n) => n.kind === "mention" && !n.read)
      .map((n) => ({ key: n.id, icon: <AtSign className="text-primary" />, title: n.title, meta: n.body, href: n.link })),
  ];

  // My cases: active cases I own (the head sees what is ready to decide), plus referrals waiting for me.
  const myCases = cases
    .filter((c) => (isHead ? c.state === "ready" : (c.ownerId === user.id || c.coOwnerIds.includes(user.id)) && c.state !== "decided" && c.state !== "observed"))
    .sort((a, b) => rank(a.id) - rank(b.id));
  const toMe = referrals.filter((r) => r.toUserId === user.id && r.status === "pending" && r.kind === "referral");

  // Review: the head signs off and resolves escalations; a PM reworks what came back and finishes drafts.
  const signOff = requirements.filter((r) => r.status === "pm_approved");
  const escalations = referrals.filter((r) => r.kind === "escalation" && r.status === "pending");
  const sentBack = requirements.filter((r) => r.ownerId === user.id && r.status === "in_discussion" && r.sentBackReason);
  const drafts = requirements.filter((r) => r.ownerId === user.id && (r.status === "draft" || (r.status === "in_discussion" && !r.sentBackReason)));

  // Follow up: answers that came back (file them into the case or requirement), and my open questions by due date.
  const answered = questions.filter((q) => q.status === "answered").sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""));
  const open = questions.filter((q) => q.status === "open").sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Good morning, {user.name.split(" ")[0]}</h1>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card icon={<Radar />} title="Agent flags" count={flags.length}>
          {flags.map((f) => (
            <Row key={f.key} icon={f.icon} title={f.title} meta={f.meta} href={f.href} />
          ))}
        </Card>

        <Card icon={<KanbanSquare />} title={isHead ? "Ready to decide" : "My cases"} count={myCases.length + toMe.length} more={{ href: "/cases", label: "Case board" }}>
          {toMe.map((r) => (
            <Row key={r.id} icon={<Forward className="text-violet-500" />} title={caseById.get(r.caseId)?.title ?? r.caseId} meta={`Referred by ${name(r.fromUserId)}`} href="/inbox" />
          ))}
          {myCases.map((c) => (
            <Row key={c.id} title={c.title} href={`/cases/${c.id}`} right={<CaseStateBadge state={c.state} />} meta={c.id} />
          ))}
        </Card>

        <Card icon={<ClipboardCheck />} title="Review" count={isHead ? signOff.length + escalations.length : sentBack.length + drafts.length}>
          {isHead && signOff.map((r) => <SignOffRow key={r.id} r={r} owner={name(r.ownerId)} onOpen={() => setReqId(r.id)} />)}
          {isHead && escalations.map((e) => <EscalationRow key={e.id} e={e} c={caseById.get(e.caseId)} from={name(e.fromUserId)} />)}
          {!isHead &&
            sentBack.map((r) => (
              <Row key={r.id} icon={<CornerUpLeft className="text-amber-600" />} title={r.title} meta={`Sent back: ${r.sentBackReason}`} onClick={() => setReqId(r.id)} right={<ReqStatusBadge status={r.status} />} />
            ))}
          {!isHead && drafts.map((r) => <Row key={r.id} title={r.title} meta={r.id} onClick={() => setReqId(r.id)} right={<ReqStatusBadge status={r.status} />} />)}
        </Card>

        <Card icon={<MessageSquareReply />} title="Follow up" count={answered.length + open.length}>
          {answered.map((q) => (
            <Row key={q.id} icon={<CheckCircle2 className="text-positive" />} title={q.answer ?? q.question} meta={`${q.addressee} answered · ${q.objectId}`} href={objectHref(q.objectType, q.objectId)} />
          ))}
          {open.map((q) => (
            <Row key={q.id} icon={<CircleDot className="text-muted-foreground" />} title={q.question} meta={`${q.addressee}${q.dueDate ? ` · due ${fmtDate(q.dueDate)}` : ""}`} href={objectHref(q.objectType, q.objectId)} />
          ))}
        </Card>
      </div>
      <RequirementSheet id={reqId} onOpenChange={(o) => !o && setReqId(null)} />
    </div>
  );
}

function Card({ icon, title, count, more, children }: { icon: ReactNode; title: string; count: number; more?: { href: string; label: string }; children: ReactNode[] | ReactNode }) {
  const [all, setAll] = useState(false);
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  const shown = all ? items : items.slice(0, 4);
  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-xs">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto text-2xl font-semibold tabular-nums">{count}</span>
      </header>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pt-1 pb-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-positive" /> All clear
        </p>
      ) : (
        <ul className="divide-y px-2 pb-2">{shown}</ul>
      )}
      {(items.length > 4 || more) && (
        <div className="mt-auto flex items-center border-t px-4 py-2 text-sm">
          {items.length > 4 && (
            <button onClick={() => setAll(!all)} className="text-primary hover:underline">
              {all ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
          {more && (
            <Link href={more.href} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              {more.label} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ icon, title, meta, href, onClick, right }: { icon?: ReactNode; title: string; meta?: string; href?: string; onClick?: () => void; right?: ReactNode }) {
  const body = (
    <>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
      </span>
      {right}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-muted/60";
  return <li>{href ? <Link href={href} className={cls}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>}</li>;
}

function SignOffRow({ r, owner, onOpen }: { r: Requirement; owner: string; onOpen: () => void }) {
  const [action, setAction] = useState<RequirementAction | null>(null);
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <Signature className="size-4 shrink-0 text-sky-500" />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium hover:underline">{r.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {r.id} · {owner}
        </span>
      </button>
      <Button size="xs" variant="outline" onClick={() => setAction("send_back")}>
        Send back
      </Button>
      <Button size="xs" onClick={() => setAction("sign_off")}>
        Sign off
      </Button>
      <RequirementActionDialog r={r} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </li>
  );
}

const resolutions = [
  ["variant", "Build a market variant"],
  ["one_market", "Prioritize one market"],
  ["keep_both", "Keep both open, get more evidence"],
] as const;

function EscalationRow({ e, c, from }: { e: Referral; c?: Case; from: string }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<(typeof resolutions)[number][0]>("variant");
  const decide = useApiMutation("decideReferral", { success: "Escalation resolved; both PMs notified" });
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <Scale className="size-4 shrink-0 text-violet-500" />
      <Link href={c ? `/cases/${c.id}` : "/cases"} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium hover:underline">{c?.title ?? e.caseId}</span>
        <span className="block truncate text-xs text-muted-foreground">Escalated by {from}</span>
      </Link>
      <Button size="xs" onClick={() => setOpen(true)}>
        Decide
      </Button>
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title="Resolve the escalation"
        description={c?.marketConflict?.note ?? e.note}
        confirmLabel="Decide"
        pending={decide.isPending}
        onSubmit={async (rationale) => {
          await decide.mutateAsync({ params: { id: e.id }, body: { decision: "resolve", resolution, rationale } });
          setOpen(false);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {resolutions.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setResolution(v)}
              className={cn("rounded-full border px-3 py-1 text-sm", resolution === v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </RationaleDialog>
    </li>
  );
}
