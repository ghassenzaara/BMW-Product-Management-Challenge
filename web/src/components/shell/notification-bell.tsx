"use client";

import Link from "next/link";
import { AlertTriangle, AtSign, Bell, CheckCircle2, CornerUpLeft, Forward, Megaphone, Radar, Scale } from "lucide-react";
import type { NotificationKind } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const notificationIcon: Record<NotificationKind, typeof Bell> = {
  alert: AlertTriangle,
  mention: AtSign,
  referral: Forward,
  question_answered: CheckCircle2,
  sign_off_request: Megaphone,
  sent_back: CornerUpLeft,
  new_signals: Radar,
  escalation: Scale,
};

export function NotificationBell() {
  const { data = [] } = useApi("notifications", {}, { refetchInterval: 20_000 });
  const read = useApiMutation("readNotifications", { silent: true });
  const unread = data.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="xs" onClick={() => read.mutate({ body: {} })} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p>}
          {data.slice(0, 30).map((n) => {
            const Icon = notificationIcon[n.kind];
            return (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => !n.read && read.mutate({ body: { ids: [n.id] } })}
                className={cn("flex gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-muted/60", !n.read && "bg-primary/5")}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", n.kind === "alert" ? "text-amber-500" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{n.body}</span>
                  <span className="block text-[10px] text-muted-foreground">{fromNow(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
