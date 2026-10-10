"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerUpLeft, ExternalLink } from "lucide-react";
import type { RequirementAction } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { Pill, RegionChip, ReleaseChip, ReqStatusBadge } from "@/components/common/badges";
import { ProposalCard } from "@/components/common/proposal-card";
import { ChatPanel } from "@/components/chat/chat-panel";
import { RequirementActionDialog } from "@/components/requirements/requirement-action-dialog";
import { ArgumentSheet, requirementButtons, Spec, TraceChain } from "@/components/requirements/requirement-parts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A requirement in a side panel, so the list or case behind it stays in view. */
export function RequirementSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl">{id && <Body id={id} />}</SheetContent>
    </Sheet>
  );
}

function Body({ id }: { id: string }) {
  const bundle = useApi("requirementBundle", { params: { id } });
  const me = useApi("me");
  const router = useRouter();
  const [action, setAction] = useState<RequirementAction | null>(null);
  if (!bundle.data || !me.data)
    return (
      <div className="space-y-3 p-6">
        <SheetTitle className="sr-only">Loading requirement</SheetTitle>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  const b = bundle.data;
  const r = b.requirement;
  const user = me.data.user;
  const canEdit = user.id === r.ownerId || user.role === "head";
  const onCite = (ref: string) => router.push(ref.startsWith("CASE-") ? `/cases/${ref}` : `/cases/${b.case.id}?signal=${ref}`);

  return (
    <>
      <SheetHeader className="gap-2 border-b px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
          <span className="font-mono">{r.id}</span>
          <ReqStatusBadge status={r.status} />
          <ReleaseChip release={r.releaseTarget} />
          <RegionChip region={r.marketScope} />
          <Pill>Cost {r.cost.size}</Pill>
          <Link href={`/requirements/${r.id}`} className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
            Full page <ExternalLink className="size-3" />
          </Link>
        </div>
        <SheetTitle className="text-lg leading-snug">{r.title}</SheetTitle>
        <SheetDescription className="sr-only">Requirement {r.id}</SheetDescription>
        {requirementButtons(r, user).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {requirementButtons(r, user).map(([a, label, variant]) => (
              <Button key={a} size="sm" variant={variant} onClick={() => setAction(a)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </SheetHeader>
      <div className="space-y-3 px-6 pt-4">
        {r.sentBackReason && r.status === "in_discussion" && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-amber-600" /> “{r.sentBackReason}”
          </div>
        )}
        <TraceChain b={b} />
        {b.proposals
          .filter((p) => p.status === "pending")
          .map((p) => (
            <ProposalCard key={p.id} p={p} canDecide={canEdit} />
          ))}
      </div>
      <Tabs defaultValue="spec" className="px-6 py-4">
        <TabsList>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="argument">Argument sheet</TabsTrigger>
          <TabsTrigger value="chat">Harden with AI</TabsTrigger>
        </TabsList>
        <TabsContent value="spec" className="pt-3">
          <Spec key={r.id + r.updatedAt} r={r} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="argument" className="pt-3">
          <ArgumentSheet b={b} />
        </TabsContent>
        <TabsContent value="chat" className="h-[60vh] overflow-hidden rounded-lg border pt-0">
          <ChatPanel objectType="requirement" objectId={r.id} proposals={b.proposals} canEdit={canEdit} onCite={onCite} />
        </TabsContent>
      </Tabs>
      <RequirementActionDialog r={r} action={action} onOpenChange={(o) => !o && setAction(null)} />
    </>
  );
}
