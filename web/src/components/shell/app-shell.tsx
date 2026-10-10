"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Bell, Box, Car, Inbox, KanbanSquare, LayoutDashboard, Lightbulb, Radar } from "lucide-react";
import { useApi } from "@/lib/api/hooks";
import { getUserId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/common/page";
import { regionLabel, seriesShort } from "@/contracts";
import { PersonaMenu } from "./persona-menu";
import { NotificationBell } from "./notification-bell";
import { SearchCommand } from "./search-command";
import { ThemeToggle } from "./theme-toggle";

const noopSubscribe = () => () => {};

type NavItem = { href: string; label: string; icon: typeof Bell; badge?: number };

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSyncExternalStore(noopSubscribe, getUserId, () => "ssr");
  // Pages render client data (TanStack Query). Rendering them only after hydration avoids
  // server/client mismatches when shell queries resolve before a suspended page hydrates.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const ready = !!userId && userId !== "ssr";
  useEffect(() => {
    if (userId === null) router.replace("/login");
  }, [userId, router]);

  const me = useApi("me", {}, { enabled: ready });
  const referrals = useApi("referrals", {}, { enabled: ready });
  const alerts = useApi("alerts", {}, { enabled: ready });
  const notifications = useApi("notifications", {}, { enabled: ready });
  const user = me.data?.user;

  const pendingIn = (referrals.data ?? []).filter((r) => r.toUserId === user?.id && r.status === "pending").length;
  const myAlerts = (alerts.data ?? []).filter((a) => a.status === "open" && (a.ownerId === user?.id || user?.role === "head")).length;
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;
  const series = me.data?.workspace.series ?? "G60";

  const nav: NavItem[] = [
    { href: "/", label: "My desk", icon: LayoutDashboard, badge: myAlerts + pendingIn },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: unread },
    { href: "/cases", label: "Cases", icon: KanbanSquare },
    { href: "/car", label: "Car map", icon: Box },
    { href: `/plan/${series}`, label: "Vehicle plan", icon: Car },
    { href: "/radar", label: "Signals", icon: Radar },
    { href: "/innovation", label: "Innovation pool", icon: Lightbulb },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/")));
  const link = (i: NavItem) => (
    <Link
      key={i.href}
      href={i.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive(i.href) && "bg-sidebar-accent font-medium text-sidebar-foreground",
      )}
    >
      <i.icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{i.label}</span>
      {!!i.badge && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">{i.badge}</span>}
    </Link>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
        <Link href="/" className="flex h-14 items-center gap-2 border-b px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">RS</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Requirement Studio</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 pt-3">{nav.map(link)}</nav>
        <div className="border-t p-3 text-[10px] leading-relaxed text-muted-foreground">Demo data · BMW feedback, study and sales rows are real</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          {me.data && (
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="font-medium">{seriesShort[me.data.workspace.series]}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{regionLabel[me.data.workspace.region]}</span>
            </div>
          )}
          <div className="flex-1" />
          <SearchCommand />
          <ThemeToggle />
          <NotificationBell />
          {user && <PersonaMenu user={user} />}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/30">{hydrated && ready ? children : <PageSkeleton />}</main>
      </div>
    </div>
  );
}
