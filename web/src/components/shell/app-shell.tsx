"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  Bell,
  BookOpenCheck,
  Car,
  ClipboardCheck,
  FileClock,
  Gauge,
  Inbox,
  KanbanSquare,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Radar,
  Settings,
} from "lucide-react";
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

type NavItem = { href: string; label: string; icon: typeof Bell; headOnly?: boolean; badge?: number };

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
  const questions = useApi("questions", {}, { enabled: ready });
  const user = me.data?.user;
  const isHead = user?.role === "head";

  const pendingIn = (referrals.data ?? []).filter((r) => r.toUserId === user?.id && r.status === "pending").length;
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open").length;
  const openQs = (questions.data ?? []).filter((q) => q.status === "open").length;
  const series = me.data?.workspace.series ?? "G60";

  const work: NavItem[] = [
    { href: "/", label: "My desk", icon: Gauge },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: pendingIn + openAlerts },
    { href: "/radar", label: "Signal radar", icon: Radar },
    { href: "/cases", label: "Cases", icon: KanbanSquare },
    { href: "/requirements", label: "Requirements", icon: ListChecks },
    { href: `/plan/${series}`, label: "Vehicle plan", icon: Car },
    { href: "/innovation", label: "Innovation pool", icon: Lightbulb },
    { href: "/questions", label: "Meeting prep", icon: MessagesSquare, badge: openQs },
  ];
  const lead: NavItem[] = [
    { href: "/portfolio", label: "Portfolio", icon: BookOpenCheck, headOnly: true },
    { href: "/approvals", label: "Approvals", icon: ClipboardCheck, headOnly: true },
  ];
  const system: NavItem[] = [
    { href: "/audit", label: "Audit trail", icon: FileClock },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/")));
  const link = (i: NavItem) => (
    <Link
      key={i.href}
      href={i.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
            <span className="block text-[10px] text-muted-foreground">Signals → Cases → Requirements</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          <div className="space-y-0.5">{work.map(link)}</div>
          {isHead && (
            <div className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Product line</div>
              {lead.map(link)}
            </div>
          )}
          <div className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Traceability</div>
            {system.map(link)}
          </div>
        </nav>
        <div className="border-t p-3 text-[10px] leading-relaxed text-muted-foreground">
          Hackathon demo · synthetic people, web signals and decisions. BMW feedback, study and sales rows are real.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          {me.data && (
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="font-medium">{seriesShort[me.data.workspace.series]}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{regionLabel[me.data.workspace.region]}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{me.data.workspace.projectType === "lci" ? "Mid-life update" : "New generation"}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Weights: {me.data.weightProfile.name}</span>
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
