"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Bell, Car, Inbox, KanbanSquare, LayoutDashboard, Lightbulb, Radar } from "lucide-react";
import { ArgonMark } from "@/components/brand/marks";
import { useApi } from "@/lib/api/hooks";
import { getUserId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/common/page";
import { ArgusBubble } from "@/components/argus/argus-bubble";
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
  // First login of a vehicle PM without a confirmed brief: onboarding (layer 1) instead of the desk.
  // Deep links (an alert, a ripple, a requirement) still open directly.
  const onboarding = me.data?.needsOnboarding;
  useEffect(() => {
    if (onboarding && pathname === "/") router.replace("/brief?onboarding=1");
  }, [onboarding, pathname, router]);

  const pendingIn = (referrals.data ?? []).filter((r) => r.toUserId === user?.id && r.status === "pending").length;
  const myAlerts = (alerts.data ?? []).filter((a) => a.status === "open" && (a.ownerId === user?.id || user?.role === "head")).length;
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;
  const series = me.data?.workspace.series ?? "G60";

  const nav: NavItem[] = [
    { href: "/", label: "My desk", icon: LayoutDashboard, badge: myAlerts + pendingIn },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: unread },
    { href: "/cases", label: "Cases", icon: KanbanSquare },
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
        "relative flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-sm text-sidebar-foreground/80 outline-none transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/40 max-md:justify-center md:px-2.5",
        isActive(i.href) &&
          "border-sidebar-border bg-sidebar-accent font-medium text-sidebar-foreground before:absolute before:top-1/2 before:-left-[9px] before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-ember",
      )}
    >
      <i.icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate max-md:sr-only">{i.label}</span>
      {!!i.badge && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1.5 text-xs leading-none font-semibold text-obsidian tabular-nums max-md:absolute max-md:top-0.5 max-md:right-0.5 max-md:h-4 max-md:min-w-4 max-md:px-1 max-md:text-[10px] max-md:ring-2 max-md:ring-sidebar">
          {i.badge}
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:w-56">
        <Link href="/" className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset md:px-4">
          <ArgonMark className="size-7" />
          <span className="leading-tight max-md:sr-only">
            <span className="block text-sm font-semibold">Argon</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 pt-3">{nav.map(link)}</nav>
        <div className="border-t border-sidebar-border px-4 py-3 text-xs leading-relaxed text-muted-foreground max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-sidebar max-md:px-3 max-md:py-2 max-md:text-center max-md:leading-4">Demo data · BMW feedback, study and sales rows are real</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:gap-3 md:px-6">
          {me.data && (
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="font-medium">{seriesShort[me.data.workspace.series]}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{regionLabel[me.data.workspace.region]}</span>
            </div>
          )}
          <div className="flex-1 max-md:hidden" />
          <SearchCommand />
          <ThemeToggle />
          <NotificationBell />
          {user && <PersonaMenu user={user} />}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-background max-md:mb-[33px]">{hydrated && ready ? children : <PageSkeleton />}</main>
      </div>
      {hydrated && ready && <ArgusBubble />}
    </div>
  );
}
