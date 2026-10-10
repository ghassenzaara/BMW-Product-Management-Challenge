"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LogOut, RotateCcw } from "lucide-react";
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
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
        <Avatar user={user} size="md" />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block max-w-56 truncate text-[11px] text-muted-foreground">{user.title}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch persona (demo)</DropdownMenuLabel>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => switchTo(u.id)} className="gap-2">
            <Avatar user={u} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{u.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{u.title}</span>
            </span>
            {u.id === user.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
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
