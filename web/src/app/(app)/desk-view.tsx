"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, AtSign, CircleDot, Forward, Gauge, Scale, Signature } from "lucide-react";
import { CaseState as CaseStates, caseStateLabel, marketLabel, agentLabel, type Market } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { fmtDate, fromNow } from "@/lib/format";
import { PageHeader, Section, Stat } from "@/components/common/page";
import { CaseStateBadge, Pill, ScoreBar } from "@/components/common/badges";
import { useUsers } from "@/components/common/people";
import { AuditTimeline } from "@/components/common/activity";
import { useScores } from "@/components/cases/use-scores";
import { Progress } from "@/components/ui/progress";

export function DeskView() {
  const me = useApi("me");
  const { data: cases = [] } = useApi("cases");
  const { data: questions = [] } = useApi("questions");
  const { data: referrals = [] } = useApi("referrals");
  const { data: alerts = [] } = useApi("alerts");
  const { data: notifications = [] } = useApi("notifications");
  const { data: requirements = [] } = useApi("requirements");
  const series = me.data?.workspace.series;
  const { data: signals = [] } = useApi("signals", { query: { series } }, { enabled: !!series });
  const { data: events = [] } = useApi("audit", { query: { limit: 8 } });
  const scores = useScores();
  const { name } = useUsers();
  const user = me.data?.user;
  if (!user) return null;
  const isHead = user.role === "head";

  const mine = cases.filter((c) => c.ownerId === user.id || c.coOwnerIds.includes(user.id));
  const active = mine.filter((c) => c.state !== "decided" && c.state !== "observed");
  const openQs = questions.filter((q) => q.status === "open").sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const toMe = referrals.filter((r) => r.toUserId === user.id && r.status === "pending");
  const openAlerts = alerts.filter((a) => a.status === "open");
  const mentions = notifications.filter((n) => n.kind === "mention" && !n.read);
  const signOff = requirements.filter((r) => r.status === "pm_approved");
  const top = (scores.data?.cases ?? []).filter((s) => (isHead ? true : mine.some((c) => c.id === s.caseId))).slice(0, 6);
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const byMarket = new Map<Market, number>();
  const byAgent = new Map<string, number>();
  signals.forEach((s) => {
    byMarket.set(s.market, (byMarket.get(s.market) ?? 0) + 1);
    byAgent.set(s.agent, (byAgent.get(s.agent) ?? 0) + 1);
  });
  const maxM = Math.max(1, ...byMarket.values());

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user.name.split(" ")[0]}`}
        description={isHead ? "Portfolio across the 1, 5 and 7 Series. Sign-offs and escalations wait for you." : `${user.title}. Here is what needs you today.`}
        actions={
          <Link href="/cases" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Open the case board <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {isHead ? (
            <>
              <Stat label="Waiting for sign-off" value={signOff.length} hint="PM-approved requirements" />
              <Stat label="Escalations" value={referrals.filter((r) => r.kind === "escalation" && r.status === "pending").length} hint="China vs RoW and contested referrals" />
            </>
          ) : (
            <>
              <Stat label="My active cases" value={active.length} hint={`${mine.length} owned in total`} />
              <Stat label="Referrals to me" value={toMe.length} hint="accept or send back" />
            </>
          )}
          <Stat label="Open questions" value={openQs.length} hint={openQs[0]?.dueDate ? `next due ${fmtDate(openQs[0].dueDate)}` : "none due"} />
          <Stat label="Monitor alerts" value={openAlerts.length} hint="competitor raises the bar, contradictions" />
          <Stat label="Unread mentions" value={mentions.length} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Needs you" className="lg:col-span-2">
            <ul className="divide-y text-sm">
              {openAlerts.map((a) => (
                <Row key={a.id} icon={<AlertTriangle className="size-4 text-amber-500" />} href={a.caseId ? `/cases/${a.caseId}` : "/inbox"} title={a.title} meta={`Monitor · ${fromNow(a.createdAt)}`} />
              ))}
              {toMe.map((r) => (
                <Row
                  key={r.id}
                  icon={r.kind === "escalation" ? <Scale className="size-4 text-violet-500" /> : <Forward className="size-4 text-violet-500" />}
                  href={isHead ? "/approvals" : "/inbox"}
                  title={`${r.kind === "escalation" ? "Escalation" : "Referral"} from ${name(r.fromUserId)}: ${caseById.get(r.caseId)?.title ?? r.caseId}`}
                  meta={r.note}
                />
              ))}
              {isHead &&
                signOff.map((r) => <Row key={r.id} icon={<Signature className="size-4 text-sky-500" />} href="/approvals" title={`Sign off ${r.id}: ${r.title}`} meta={`by ${name(r.ownerId)}`} />)}
              {mentions.map((n) => (
                <Row key={n.id} icon={<AtSign className="size-4 text-primary" />} href={n.link} title={n.title} meta={n.body} />
              ))}
              {openQs.slice(0, 5).map((q) => (
                <Row key={q.id} icon={<CircleDot className="size-4 text-amber-500" />} href={`/cases/${q.objectId}?tab=questions`} title={q.question} meta={`${q.addressee} · ${q.objectId}${q.dueDate ? ` · due ${fmtDate(q.dueDate)}` : ""}`} />
              ))}
              {!openAlerts.length && !toMe.length && !mentions.length && !openQs.length && <li className="py-6 text-center text-muted-foreground">Nothing waiting. Nice.</li>}
            </ul>
          </Section>

          <Section title={isHead ? "Top cases (all series)" : "Top of my ranking"} actions={<Link href="/cases?view=ranked" className="text-xs text-primary hover:underline">Ranked view</Link>}>
            <ul className="space-y-2.5">
              {top.map((s) => {
                const c = caseById.get(s.caseId);
                if (!c) return null;
                return (
                  <li key={s.caseId}>
                    <Link href={`/cases/${c.id}`} className="block rounded-md p-1 hover:bg-muted/60">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">#{s.rank}</span>
                        <span className="font-mono">{c.id}</span>
                        <CaseStateBadge state={c.state} />
                      </div>
                      <div className="truncate text-sm">{c.title}</div>
                      <ScoreBar value={s.score} className="mt-1" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="My cases by stage">
            <div className="space-y-2">
              {CaseStates.options.map((st) => {
                const n = (isHead ? cases : mine).filter((c) => c.state === st).length;
                return (
                  <Link key={st} href="/cases" className="flex items-center gap-3 text-sm hover:underline">
                    <span className="w-36 text-muted-foreground">{caseStateLabel[st]}</span>
                    <Progress value={(n / Math.max(1, (isHead ? cases : mine).length)) * 100} className="h-1.5 flex-1" />
                    <span className="w-6 text-right font-mono">{n}</span>
                  </Link>
                );
              })}
            </div>
          </Section>

          <Section title={`Coverage meter · ${series ?? ""}`} actions={<Gauge className="size-4 text-muted-foreground" />}>
            <div className="space-y-2">
              {(["US", "EU", "CN", "RoW", "unknown"] as Market[]).map((m) => (
                <div key={m} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-muted-foreground">{marketLabel[m]}</span>
                  <Progress value={((byMarket.get(m) ?? 0) / maxM) * 100} className="h-1.5 flex-1" />
                  <span className="w-8 text-right font-mono">{byMarket.get(m) ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {[...byAgent.entries()].map(([a, n]) => (
                <Pill key={a}>
                  {agentLabel[a as keyof typeof agentLabel]} {n}
                </Pill>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Honest gaps: no Chinese verbatims in BMW feedback; 5 and 7 Series verbatims are 90–95% US. Weight by market volume, not verbatim volume.</p>
          </Section>

          <Section title="Recent activity" actions={<Link href="/audit" className="text-xs text-primary hover:underline">Audit trail</Link>}>
            <AuditTimeline events={events} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, href, title, meta }: { icon: React.ReactNode; href: string; title: string; meta?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 py-2.5 hover:bg-muted/40">
        <span className="mt-0.5">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
        </span>
        <ArrowRight className="mt-1 size-3.5 text-muted-foreground" />
      </Link>
    </li>
  );
}
