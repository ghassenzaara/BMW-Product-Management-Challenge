"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CornerUpLeft, MoreHorizontal, Scale } from "lucide-react";
import type { Referral } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { UserAvatar, useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { notificationIcon } from "@/components/shell/notification-bell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** One feed: referrals that wait for an answer on top, then everything else, one line each. */
export function InboxView() {
  const me = useApi("me");
  const { data: referrals = [] } = useApi("referrals");
  const { data: notifications = [] } = useApi("notifications");
  const { data: cases = [] } = useApi("cases");
  const read = useApiMutation("readNotifications", { silent: true });
  const router = useRouter();
  const { name } = useUsers();
  const [showSent, setShowSent] = useState(false);
  const user = me.data?.user;
  const shortOf = new Map(cases.map((c) => [c.id, c.shortTitle]));
  const waiting = referrals.filter((r) => r.toUserId === user?.id && r.status === "pending" && r.kind === "referral");
  const sent = referrals.filter((r) => r.fromUserId === user?.id);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Inbox"
        actions={
          unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => read.mutate({ body: {} })}>
              Mark all read
            </Button>
          )
        }
      />
      <div className="space-y-6 px-6 pt-6 pb-10">
        {waiting.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border-strong bg-card shadow-[inset_2px_0_0_var(--color-ember)]">
            {waiting.map((r) => (
              <ReferralRow key={r.id} r={r} label={shortOf.get(r.caseId) ?? r.caseId} from={name(r.fromUserId)} />
            ))}
          </section>
        )}

        <section className="overflow-hidden rounded-xl border bg-card has-[>p]:border-dashed has-[>p]:border-border-strong has-[>p]:bg-card/60">
          {notifications.length === 0 && <p className="px-6 py-12 text-center text-[15px] font-semibold text-foreground">Nothing yet</p>}
          {notifications.map((n) => {
            const Icon = notificationIcon[n.kind];
            return (
              <Tooltip key={n.id} delayDuration={400}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!n.read) read.mutate({ body: { ids: [n.id] } });
                      router.push(n.link);
                    }}
                    className="flex w-full items-center gap-3 border-b px-5 py-3 text-left text-sm transition-colors duration-150 last:border-0 hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-ember")} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className={cn("min-w-0 flex-1 truncate", !n.read && "font-medium")}>{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fromNow(n.createdAt)}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-sm">
                  {n.body}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </section>

        {sent.length > 0 && (
          <section>
            <button onClick={() => setShowSent(!showSent)} className="flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <ChevronRight className={cn("size-4 transition-transform duration-150", showSent && "rotate-90")} /> Sent by me · {sent.length}
            </button>
            {showSent && (
              <ul className="mt-3 overflow-hidden rounded-xl border bg-card">
                {sent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b px-5 py-2.5 text-sm last:border-0">
                    <UserAvatar id={r.toUserId} size="xs" />
                    <Link href={`/cases/${r.caseId}`} className="min-w-0 flex-1 truncate hover:underline">
                      {shortOf.get(r.caseId) ?? r.caseId}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {r.kind === "escalation" ? "Escalation" : "Referral"} · {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ReferralRow({ r, label, from }: { r: Referral; label: string; from: string }) {
  const [decision, setDecision] = useState<"accept" | "decline" | "escalate" | null>(null);
  const decide = useApiMutation("decideReferral", {
    success: (x) => (x.status === "accepted" ? "Accepted: the case is now on your board" : `Referral ${x.status}`),
  });
  return (
    <div className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0">
      <UserAvatar id={r.fromUserId} size="sm" />
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <Link href={`/cases/${r.caseId}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
            <span className="text-muted-foreground">{from.split(" ")[0]} referred</span> <span className="font-medium">{label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-sm">
          “{r.note}”
        </TooltipContent>
      </Tooltip>
      <Button size="sm" onClick={() => setDecision("accept")}>
        <Check className="size-3.5" /> Accept
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDecision("decline")}>
        <CornerUpLeft className="size-3.5" /> Send back
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDecision("escalate")}>
            <Scale /> Escalate to head of product line
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RationaleDialog
        open={!!decision}
        onOpenChange={(o) => !o && setDecision(null)}
        title={decision === "accept" ? `Accept: ${label}` : decision === "decline" ? `Send back: ${label}` : `Escalate: ${label}`}
        description={decision === "accept" ? "A linked case with all signals lands on your board." : decision === "decline" ? "It goes back to the sender." : "When you two can't agree who owns it."}
        pending={decide.isPending}
        onSubmit={async (rationale) => {
          await decide.mutateAsync({ params: { id: r.id }, body: { decision: decision!, rationale } });
          setDecision(null);
        }}
      />
    </div>
  );
}
