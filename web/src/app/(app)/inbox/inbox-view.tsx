"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CornerUpLeft, Scale } from "lucide-react";
import type { Referral } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { UserAvatar, useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { notificationIcon } from "@/components/shell/notification-bell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InboxView() {
  const me = useApi("me");
  const { data: referrals = [] } = useApi("referrals");
  const { data: alerts = [] } = useApi("alerts");
  const { data: notifications = [] } = useApi("notifications");
  const { data: cases = [] } = useApi("cases");
  const read = useApiMutation("readNotifications", { silent: true });
  const user = me.data?.user;
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const incoming = referrals.filter((r) => r.toUserId === user?.id);
  const outgoing = referrals.filter((r) => r.fromUserId === user?.id);

  return (
    <div>
      <PageHeader title="Inbox" />
      <Tabs defaultValue="routing" className="p-6">
        <TabsList>
          <TabsTrigger value="routing">Referrals ({incoming.filter((r) => r.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="alerts">Agent flags ({alerts.filter((a) => a.status === "open").length})</TabsTrigger>
          <TabsTrigger value="all">Notifications ({notifications.filter((n) => !n.read).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="routing" className="space-y-6 pt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">To me</h3>
            {incoming.length === 0 && <Empty title="No referrals to you" />}
            {incoming.map((r) => (
              <ReferralRow key={r.id} r={r} caseTitle={caseById.get(r.caseId)?.title} incoming />
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">From me</h3>
            {outgoing.length === 0 && <p className="text-sm text-muted-foreground">You haven&apos;t referred or escalated anything.</p>}
            {outgoing.map((r) => (
              <ReferralRow key={r.id} r={r} caseTitle={caseById.get(r.caseId)?.title} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="alerts" className="space-y-2 pt-4">
          {alerts.map((a) => (
            <Link key={a.id} href={a.caseId ? `/cases/${a.caseId}` : "#"} className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 hover:border-primary/50", a.status !== "open" && "opacity-60")}>
              <AlertTriangle className="mt-0.5 size-4 text-amber-500" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {a.title} <Pill t={a.status === "open" ? "amber" : "slate"}>{a.status}</Pill>
                </span>
                <span className="block text-xs text-muted-foreground">{a.detail}</span>
                {a.resolution && <span className="block text-xs">Resolution: {a.resolution}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{fromNow(a.createdAt)}</span>
            </Link>
          ))}
          {alerts.length === 0 && <Empty title="No alerts" />}
        </TabsContent>
        <TabsContent value="all" className="pt-4">
          <div className="mb-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => read.mutate({ body: {} })}>
              Mark all read
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
            {notifications.map((n) => {
              const Icon = notificationIcon[n.kind];
              return (
                <Link key={n.id} href={n.link} className={cn("flex items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/40", !n.read && "bg-primary/5")}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{n.body}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{fromNow(n.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReferralRow({ r, caseTitle, incoming }: { r: Referral; caseTitle?: string; incoming?: boolean }) {
  const { name } = useUsers();
  const [decision, setDecision] = useState<"accept" | "decline" | "escalate" | null>(null);
  const decide = useApiMutation("decideReferral", {
    success: (x) => (x.status === "accepted" ? `Accepted: linked case ${x.linkedCaseId} created in your workspace` : `Referral ${x.status}`),
  });
  const pending = r.status === "pending";
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3">
      <UserAvatar id={incoming ? r.fromUserId : r.toUserId} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill t={r.kind === "escalation" ? "violet" : "sky"}>{r.kind}</Pill>
          <span className="font-medium">{incoming ? `From ${name(r.fromUserId)}` : `To ${name(r.toUserId)}`}</span>
          <Pill t={pending ? "amber" : r.status === "accepted" || r.status === "resolved" ? "emerald" : "slate"}>{r.status}</Pill>
          <span className="text-xs text-muted-foreground">{fromNow(r.createdAt)}</span>
        </div>
        <Link href={`/cases/${r.caseId}`} className="block text-sm text-primary hover:underline">
          {r.caseId} · {caseTitle}
        </Link>
        <p className="text-sm text-muted-foreground">“{r.note}”</p>
        {r.linkedCaseId && (
          <p className="text-xs">
            Linked case: <Link className="font-mono text-primary hover:underline" href={`/cases/${r.linkedCaseId}`}>{r.linkedCaseId}</Link>
          </p>
        )}
        {r.declineReason && <p className="text-xs">Declined: {r.declineReason}</p>}
        {r.resolution && <p className="text-xs">Resolution: {r.resolution}</p>}
      </div>
      {incoming && pending && r.kind === "referral" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setDecision("accept")}>
            <Check className="size-3.5" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDecision("decline")}>
            <CornerUpLeft className="size-3.5" /> Send back
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDecision("escalate")}>
            <Scale className="size-3.5" /> Escalate
          </Button>
        </div>
      )}
      <RationaleDialog
        open={!!decision}
        onOpenChange={(o) => !o && setDecision(null)}
        title={decision === "accept" ? "Accept the referral" : decision === "decline" ? "Send the referral back" : "Escalate to the head of product line"}
        description={
          decision === "accept"
            ? "A linked case is created in your workspace with all signals; the sender stays linked and is notified."
            : decision === "decline"
              ? "The case goes back to the sender's board (Ready to decide)."
              : "If you and the sender disagree on who owns it."
        }
        pending={decide.isPending}
        onSubmit={async (rationale) => {
          await decide.mutateAsync({ params: { id: r.id }, body: { decision: decision!, rationale } });
          setDecision(null);
        }}
      />
    </div>
  );
}
