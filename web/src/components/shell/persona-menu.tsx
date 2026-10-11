"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Compass, FileClock, LogOut, RotateCcw, Settings } from "lucide-react";
import type { User } from "@/contracts";
import { api } from "@/lib/api/client";
import { setUserId } from "@/lib/session";
import { Avatar, useUsers } from "@/components/common/people";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PersonaMenu({ user }: { user: User }) {
  const { users } = useUsers();
  const qc = useQueryClient();
  const router = useRouter();

  const switchTo = (id: string) => {
    setUserId(id);
    qc.clear();
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 outline-none transition-colors duration-150 hover:border-border hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:border-border aria-expanded:bg-card">
        <Avatar user={user} size="md" />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block max-w-64 truncate text-xs text-muted-foreground">{user.title}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Switch persona (demo)</DropdownMenuLabel>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => switchTo(u.id)} className="gap-2.5">
            <Avatar user={u} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{u.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{u.title}</span>
            </span>
            {u.id === user.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/brief")}>
          <Compass className="size-4" /> My product specs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4" /> Settings and weights
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/audit")}>
          <FileClock className="size-4" /> Audit trail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await api("reset", { body: {} });
            await qc.invalidateQueries();
            toast.success("Demo data reset to the seed");
          }}
        >
          <RotateCcw className="size-4" /> Reset demo data
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setUserId(null);
            qc.clear();
            router.push("/login");
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
