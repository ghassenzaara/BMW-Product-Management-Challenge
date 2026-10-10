"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Lightbulb, ThumbsUp } from "lucide-react";
import { horizonLabel, seriesShort, type InnovationEntry, type Series } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { AreaChip, EvidenceBadge, Pill } from "@/components/common/badges";
import { AvatarStack, UserAvatar, useUsers } from "@/components/common/people";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InnovationView() {
  const { data = [] } = useApi("innovation");
  const me = useApi("me");
  return (
    <div>
      <PageHeader title="Innovation pool" />
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {data.map((e) => (
          <InnovationCard key={e.case.id} e={e} userId={me.data?.user.id} mySeries={me.data?.user.series ?? []} />
        ))}
      </div>
    </div>
  );
}

function InnovationCard({ e, userId, mySeries }: { e: InnovationEntry; userId?: string; mySeries: Series[] }) {
  const router = useRouter();
  const { name } = useUsers();
  const vote = useApiMutation("voteInnovation", { silent: true });
  const pull = useApiMutation("pullInnovation", { success: (c) => `Pulled into ${c.series} as ${c.id}` });
  const [open, setOpen] = useState(false);
  const [series, setSeries] = useState<Series>(mySeries[0] ?? "G60");
  const voted = !!userId && e.meta.votes.includes(userId);
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Lightbulb className="size-3.5 text-fuchsia-500" />
        <span className="font-mono">{e.case.id}</span>
        <Pill t="fuchsia">{horizonLabel[e.meta.horizon]}</Pill>
        <span className="flex-1" />
        {e.case.createdBy.startsWith("agent:") ? <Pill t="sky">innovation scout</Pill> : <span>by {name(e.case.ownerId)}</span>}
      </div>
      <Link href={`/cases/${e.case.id}`} className="mt-2 text-base leading-snug font-semibold hover:underline">
        {e.case.title}
      </Link>
      <p className="mt-1 text-sm text-muted-foreground">{e.meta.pitch}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        <AreaChip area={e.case.carArea} />
        <EvidenceBadge level={e.case.evidenceLevel} />
        {e.meta.interestedSeries.map((s) => (
          <Pill key={s}>{seriesShort[s]}</Pill>
        ))}
      </div>
      {e.case.figures.competitorOffer.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Competitors: {e.case.figures.competitorOffer.join(" · ")}</p>}
      {e.meta.pulledInto.length > 0 && (
        <p className="mt-2 text-xs">
          Pulled into:{" "}
          {e.meta.pulledInto.map((id) => (
            <Link key={id} href={`/cases/${id}`} className="mr-1 font-mono text-primary hover:underline">
              {id}
            </Link>
          ))}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button size="sm" variant={voted ? "default" : "outline"} onClick={() => vote.mutate({ params: { caseId: e.case.id }, body: {} })}>
          <ThumbsUp className={cn("size-3.5", voted && "fill-current")} /> {e.meta.votes.length}
        </Button>
        <AvatarStack ids={e.meta.votes} max={5} />
        <span className="flex-1" />
        <UserAvatar id={e.case.ownerId} size="xs" />
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ArrowDownToLine className="size-3.5" /> Pull into my series
        </Button>
      </div>
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title="Pull into your series"
        description="Creates a linked case in your workspace with all signals. The original owner is notified."
        confirmLabel="Pull"
        pending={pull.isPending}
        onSubmit={async (rationale) => {
          const c = await pull.mutateAsync({ params: { caseId: e.case.id }, body: { series, rationale } });
          setOpen(false);
          router.push(`/cases/${c.id}`);
        }}
      >
        <div className="space-y-1.5">
          <Label>Series</Label>
          <Select value={series} onValueChange={(v) => setSeries(v as Series)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["G60", "F70", "G70"] as Series[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {seriesShort[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </RationaleDialog>
    </div>
  );
}
