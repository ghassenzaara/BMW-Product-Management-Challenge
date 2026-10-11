"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, AtSign, Check, CheckCircle2, CircleDot, ClipboardCheck, CornerUpLeft, Forward, GitCompare, KanbanSquare, MessageSquareReply, Radar, Scale, Waves } from "lucide-react";
import { CaseState as CaseStates, addresseeLabel, briefFieldLabel, caseStateLabel, seriesShort, verdictLabel, type Case, type Referral, type Requirement, type RequirementAction, type ResponseOf } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { showBriefValue } from "@/lib/brief";
import { fmtDate, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CaseStateDot, ReqStatusDot, caseStateTone } from "@/components/common/badges";
import { useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { useScores } from "@/components/cases/use-scores";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * My desk: what needs the PM, sorted by the kind of work.
 * One line per item, short names, details one click away.
 */
export function DeskView() {
  const me = useApi("me");
  const { data: cases = [] } = useApi("cases");
  const { data: questions = [] } = useApi("questions");
  const { data: referrals = [] } = useApi("referrals");
  const { data: alerts = [] } = useApi("alerts");
  const { data: notifications = [] } = useApi("notifications");
  const { data: requirements = [] } = useApi("requirements");
  const { data: briefConflicts = [] } = useApi("briefConflicts", {}, { enabled: me.data?.user.role === "head" });
  const scores = useScores();
  const { name } = useUsers();
  const [reqId, setReqId] = useState<string | null>(null);
  const user = me.data?.user;
  if (!user) return null;
  const isHead = user.role === "head";
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const short = (type: "case" | "requirement", id: string) => (type === "case" ? caseById.get(id)?.shortTitle : reqById.get(id)?.shortTitle) ?? id;
  const rank = (id: string) => scores.cases.get(id)?.rank ?? 999;
  const first = (n?: string) => n?.split(" ")[0] ?? "";

  const openAlerts = alerts.filter((a) => a.status === "open" && (isHead || a.ownerId === user.id));
  // A competitor ripple is one row per fact (it may touch many items), opening the ripple screen.
  const rippleRows = Object.values(Object.groupBy(openAlerts.filter((a) => a.rippleId), (a) => a.rippleId!)).map((xs) => {
    const a = xs![0];
    const items = new Set(xs!.map((x) => x.requirementId ?? x.caseId));
    const counts = (["behind", "at_par", "still_ahead"] as const).map((v) => [v, xs!.filter((x) => x.itemVerdict === v).length] as const).filter(([, n]) => n > 0);
    const summary = counts.map(([v, n]) => `${n} ${verdictLabel[v].toLowerCase()}`).join(" · ");
    return (
      <Row
        key={a.rippleId}
        icon={<Waves className="text-warning" />}
        label={a.title.split(":")[0]}
        hint={`${items.size} of ${isHead ? "the portfolio's" : "your"} items: ${[...items].join(", ")}`}
        right={<span className="shrink-0 text-xs font-medium text-tone-amber-fg">{summary}</span>}
        href={`/ripple/${a.rippleId}`}
      />
    );
  });
  const flags = [
    ...rippleRows,
    ...openAlerts
      .filter((a) => !a.rippleId)
      .map((a) => (
        <Row
          key={a.id}
          icon={<AlertTriangle className="text-warning" />}
          label={a.caseId ? short("case", a.caseId) : a.title}
          hint={a.title}
          right={<span className="shrink-0 text-xs font-medium text-tone-amber-fg">{a.verdict === "raises_the_bar" ? "Bar raised" : "Contradicts"}</span>}
          href={a.caseId ? `/cases/${a.caseId}` : "/inbox"}
        />
      )),
    ...notifications
      .filter((n) => n.kind === "mention" && !n.read)
      .map((n) => {
        const caseId = n.link.match(/CASE-[A-Z0-9-]+/)?.[0];
        return <Row key={n.id} icon={<AtSign className="text-ember" />} label={caseId ? short("case", caseId) : n.title} hint={n.body} right={<Muted>{first(name(n.actorId ?? ""))} · {fromNow(n.createdAt)}</Muted>} href={n.link} />;
      }),
  ];

  const mine = cases.filter((c) => (isHead ? c.state === "ready" : (c.ownerId === user.id || c.coOwnerIds.includes(user.id)) && c.state !== "decided" && c.state !== "observed")).sort((a, b) => rank(a.id) - rank(b.id));
  const toMe = referrals.filter((r) => r.toUserId === user.id && r.status === "pending" && r.kind === "referral");
  const myCases = [
    ...toMe.map((r) => <Row key={r.id} icon={<Forward className="text-tone-violet-dot" />} label={short("case", r.caseId)} hint={r.note} right={<Muted>from {first(name(r.fromUserId))}</Muted>} href="/inbox" />),
    ...mine.map((c) => <Row key={c.id} label={c.shortTitle} hint={c.title} right={<CaseStateDot state={c.state} />} href={`/cases/${c.id}`} />),
  ];

  const signOff = requirements.filter((r) => r.status === "pm_approved");
  const escalations = referrals.filter((r) => r.kind === "escalation" && r.status === "pending");
  const review = isHead
    ? [
        ...Object.values(Object.groupBy(briefConflicts.filter((x) => x.status === "open"), (x) => x.overlayId)).map((xs) => (
          <BriefConflictRow key={xs![0].overlayId} xs={xs!} owner={name(xs![0].ownerId)} />
        )),
        ...signOff.map((r) => <SignOffRow key={r.id} r={r} onOpen={() => setReqId(r.id)} />),
        ...escalations.map((e) => <EscalationRow key={e.id} e={e} c={caseById.get(e.caseId)} />),
      ]
    : requirements
        .filter((r) => r.ownerId === user.id && (r.status === "draft" || r.status === "in_discussion"))
        .sort((a, b) => Number(!!b.sentBackReason) - Number(!!a.sentBackReason))
        .map((r) => (
          <Row
            key={r.id}
            icon={r.sentBackReason ? <CornerUpLeft className="text-warning" /> : undefined}
            label={r.shortTitle}
            hint={r.sentBackReason ? `Sent back: ${r.sentBackReason}` : r.title}
            right={<ReqStatusDot status={r.status} />}
            onClick={() => setReqId(r.id)}
          />
        ));

  const answered = questions.filter((q) => q.status === "answered").sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""));
  const open = questions.filter((q) => q.status === "open").sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const href = (type: "case" | "requirement", id: string) => (type === "case" ? `/cases/${id}?step=knowledge` : `/requirements/${id}`);
  const followUp = [
    ...answered.map((q) => (
      <Row key={q.id} icon={<CheckCircle2 className="text-positive" />} label={short(q.objectType, q.objectId)} hint={q.answer} right={<Muted>{addresseeLabel[q.addressee]} answered</Muted>} href={href(q.objectType, q.objectId)} />
    )),
    ...open.map((q) => (
      <Row key={q.id} icon={<CircleDot className="text-muted-foreground" />} label={short(q.objectType, q.objectId)} hint={q.question} right={<Muted>{addresseeLabel[q.addressee]}{q.dueDate ? ` · ${fmtDate(q.dueDate)}` : ""}</Muted>} href={href(q.objectType, q.objectId)} />
    )),
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-7 pb-10">
      <h1 className="text-2xl leading-tight font-semibold text-foreground md:text-title">Good morning, {first(user.name)}</h1>
      <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card icon={<Radar />} title="Agent flags" items={flags} />
        <Card icon={<KanbanSquare />} title={isHead ? "Ready to decide" : "My cases"} items={myCases} more={{ href: "/cases", label: "Board" }}>
          {!isHead && <StageBar cases={mine} />}
        </Card>
        <Card icon={<ClipboardCheck />} title="Review" items={review} />
        <Card icon={<MessageSquareReply />} title="Follow up" items={followUp}>
          {(answered.length > 0 || open.length > 0) && (
            <div className="flex gap-4 px-5 pb-1 text-xs text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground tabular-nums">{answered.length}</b> answers back
              </span>
              <span>
                <b className="font-semibold text-foreground tabular-nums">{open.length}</b> open questions
              </span>
            </div>
          )}
        </Card>
      </div>
      <RequirementSheet id={reqId} onOpenChange={(o) => !o && setReqId(null)} />
    </div>
  );
}

function Card({ icon, title, items, more, children }: { icon: ReactNode; title: string; items: ReactNode[]; more?: { href: string; label: string }; children?: ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <section className="flex flex-col rounded-xl border bg-card">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="grid size-8 place-items-center rounded-lg border bg-recessed text-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]">{icon}</span>
        <h2 className="text-lg leading-snug font-semibold">{title}</h2>
        <span className="ml-auto text-2xl leading-none font-semibold tabular-nums">{items.length}</span>
      </header>
      {children}
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pt-1 pb-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-positive" /> All clear
        </p>
      ) : (
        <ul className="px-3 pb-3">{shown}</ul>
      )}
      {(items.length > 3 || more) && (
        <div className="mt-auto flex items-center border-t px-5 py-2.5 text-sm">
          {items.length > 3 && (
            <button onClick={() => setAll(!all)} className="rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              {all ? "Show less" : `+${items.length - 3} more`}
            </button>
          )}
          {more && (
            <Link href={more.href} className="ml-auto text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {more.label} →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

/** One line: icon, short name, one quiet detail on the right. The full text is in the tooltip. */
function Row({ icon, label, hint, right, href, onClick }: { icon?: ReactNode; label: string; hint?: string; right?: ReactNode; href?: string; onClick?: () => void }) {
  const cls = "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  const body = (
    <>
      <span className="grid size-4 shrink-0 place-items-center [&_svg]:size-4">{icon ?? <span className="size-1.5 rounded-full bg-muted-foreground/40" />}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {right}
    </>
  );
  const el = href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {body}
    </button>
  );
  return (
    <li>
      {hint ? (
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>{el}</TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-sm">
            {hint}
          </TooltipContent>
        </Tooltip>
      ) : (
        el
      )}
    </li>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="shrink-0 text-xs text-muted-foreground">{children}</span>;

const barColor: Record<string, string> = { slate: "bg-tone-slate-dot", sky: "bg-tone-sky-dot", violet: "bg-tone-violet-dot", amber: "bg-tone-amber-dot", emerald: "bg-tone-emerald-dot" };

/** Where my open cases stand, as one segmented bar. */
function StageBar({ cases }: { cases: Case[] }) {
  const stages = CaseStates.options.filter((s) => s !== "observed" && s !== "decided").map((s) => [s, cases.filter((c) => c.state === s).length] as const);
  if (!cases.length) return null;
  return (
    <div className="space-y-2 px-5 pb-2">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {stages.map(([s, n]) => n > 0 && <span key={s} className={barColor[caseStateTone[s]]} style={{ flexGrow: n }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {stages.map(
          ([s, n]) =>
            n > 0 && (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={cn("size-2 rounded-full", barColor[caseStateTone[s]])} />
                {n} {caseStateLabel[s].toLowerCase()}
              </span>
            ),
        )}
      </div>
    </div>
  );
}

function SignOffRow({ r, onOpen }: { r: Requirement; onOpen: () => void }) {
  const [action, setAction] = useState<RequirementAction | null>(null);
  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 text-left text-sm hover:underline">
        <span className="size-4 shrink-0" />
        <span className="truncate font-medium">{r.shortTitle}</span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Send back" onClick={() => setAction("send_back")}>
            <CornerUpLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send back</TooltipContent>
      </Tooltip>
      <Button size="xs" onClick={() => setAction("sign_off")}>
        <Check className="size-3.5" /> Sign off
      </Button>
      <RequirementActionDialog r={r} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </li>
  );
}

const resolutions = [
  ["variant", "Market variant"],
  ["one_market", "Prioritize one market"],
  ["keep_both", "Keep both open"],
] as const;

type Conflict = ResponseOf<"briefConflicts">[number];

type BriefResolution = "regional_variant" | "align";

/** A regional brief that differs from the shared one: per field, accept it as a regional variant or align it. */
function BriefConflictRow({ xs, owner }: { xs: Conflict[]; owner: string }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Partial<Record<Conflict["field"], BriefResolution>>>({});
  const resolve = useApiMutation("resolveBriefConflict");
  const x = xs[0];
  const fields = xs.map((c) => briefFieldLabel[c.field]).join(", ");
  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <Link href="/brief" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 text-sm hover:underline" title={fields}>
        <GitCompare className="size-4 shrink-0 text-tone-fuchsia-dot" />
        <span className="truncate font-medium">{seriesShort[x.series]} product specs</span>
        <span className="truncate text-xs text-muted-foreground">
          {owner} differs on {xs.length === 1 ? briefFieldLabel[x.field].toLowerCase() : `${xs.length} fields`}
        </span>
      </Link>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Decide
      </Button>
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title={`${seriesShort[x.series]} product specs: ${owner}'s regional differences`}
        description="Accept a difference as a regional variant (the overlay keeps it) or align it to the shared product specs. One rationale covers all of them."
        confirmLabel={`Decide ${xs.length === 1 ? "it" : `all ${xs.length}`}`}
        pending={resolve.isPending}
        onSubmit={async (rationale) => {
          for (const c of xs) await resolve.mutateAsync({ params: { id: c.overlayId, field: c.field }, body: { resolution: choice[c.field] ?? "regional_variant", rationale } });
          toast.success(`${xs.length === 1 ? "Product specs difference" : `${xs.length} product specs differences`} resolved`);
          setOpen(false);
        }}
      >
        <ul className="max-h-80 space-y-3 overflow-y-auto">
          {xs.map((c) => (
            <li key={c.field} className="space-y-1 text-sm">
              <p className="font-medium">{briefFieldLabel[c.field]}</p>
              <p className="text-xs text-muted-foreground">Shared: {showBriefValue(c.field, c.sharedValue)}</p>
              <p className="text-xs">
                {owner}: {showBriefValue(c.field, c.overlayValue)}
              </p>
              {c.reason && <p className="text-xs italic text-muted-foreground">Why: {c.reason}</p>}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(
                  [
                    ["regional_variant", "Regional variant"],
                    ["align", "Align to shared"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChoice((s) => ({ ...s, [c.field]: v }))}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-150",
                      (choice[c.field] ?? "regional_variant") === v ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </RationaleDialog>
    </li>
  );
}

function EscalationRow({ e, c }: { e: Referral; c?: Case }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<(typeof resolutions)[number][0]>("variant");
  const decide = useApiMutation("decideReferral", { success: "Escalation resolved" });
  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <Link href={c ? `/cases/${c.id}` : "/cases"} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 text-sm hover:underline">
        <Scale className="size-4 shrink-0 text-tone-violet-dot" />
        <span className="truncate font-medium">{c?.shortTitle ?? e.caseId}</span>
      </Link>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Decide
      </Button>
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title={`Resolve: ${c?.shortTitle ?? e.caseId}`}
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
              className={cn("rounded-full border px-3 py-1 text-sm transition-colors duration-150", resolution === v ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-border-strong hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </RationaleDialog>
    </li>
  );
}
