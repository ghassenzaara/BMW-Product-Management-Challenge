"use client";

import type { User } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot } from "lucide-react";
import { ArgusMark } from "@/components/brand/marks";

export function useUsers() {
  const { data } = useApi("users", {}, { staleTime: Infinity });
  const byId = new Map((data ?? []).map((u) => [u.id, u]));
  return { users: data ?? [], byId, name: (id?: string) => (id ? (byId.get(id)?.name ?? (id.startsWith("agent:") ? agentLabel(id) : id)) : "—") };
}

/** The chat agent is Argus; background agents keep their role name. */
const agentLabel = (id: string) => (id === "agent:argus" ? "Argus" : id.replace("agent:", "AI · "));

export function Avatar({ user, size = "sm", className }: { user?: User; size?: "xs" | "sm" | "md"; className?: string }) {
  const s = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs" }[size];
  if (!user) return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-muted", s, className)}>?</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card saturate-[.75]", s, className)} style={{ backgroundColor: user.color }}>
          {user.initials}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {user.name} · {user.title}
      </TooltipContent>
    </Tooltip>
  );
}

export function UserAvatar({ id, size, className }: { id?: string; size?: "xs" | "sm" | "md"; className?: string }) {
  const { byId } = useUsers();
  if (id?.startsWith("agent:"))
    return (
      <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-foreground", size === "xs" && "size-5", className)} title={agentLabel(id)}>
        {id === "agent:argus" ? <ArgusMark className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>
    );
  return <Avatar user={id ? byId.get(id) : undefined} size={size} className={className} />;
}

export function AvatarStack({ ids, max = 4 }: { ids: string[]; max?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {ids.slice(0, max).map((id) => (
        <UserAvatar key={id} id={id} size="xs" />
      ))}
      {ids.length > max && <span className="ml-2 text-xs text-muted-foreground">+{ids.length - max}</span>}
    </span>
  );
}
