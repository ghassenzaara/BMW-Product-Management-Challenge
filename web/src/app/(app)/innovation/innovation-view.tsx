"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Lightbulb, ThumbsUp } from "lucide-react";
import { horizonLabel, seriesShort, type InnovationEntry, type Series } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { Pill } from "@/components/common/badges";
import { AvatarStack } from "@/components/common/people";
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
      <div className="grid gap-5 px-6 pt-6 pb-10 md:grid-cols-2 xl:grid-cols-3">
        {data.map((e) => (
          <InnovationCard key={e.case.id} e={e} userId={me.data?.user.id} mySeries={me.data?.user.series ?? []} />
        ))}
      </div>
    </div>
  );
}

function InnovationCard({ e, userId, mySeries }: { e: InnovationEntry; userId?: string; mySeries: Series[] }) {
  const router = useRouter();
  const vote = useApiMutation("voteInnovation", { silent: true });
  const pull = useApiMutation("pullInnovation", { success: (c) => `Pulled into ${c.series} as ${c.id}` });
  const [open, setOpen] = useState(false);
  const [series, setSeries] = useState<Series>(mySeries[0] ?? "G60");
  const voted = !!userId && e.meta.votes.includes(userId);
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg border border-tone-fuchsia-bd bg-tone-fuchsia-bg text-tone-fuchsia-fg">
          <Lightbulb className="size-4 stroke-[1.75]" />
        </span>
        <span className="flex-1" />
        <Pill t="fuchsia">{horizonLabel[e.meta.horizon]}</Pill>
      </div>
      <Link href={`/cases/${e.case.id}`} title={e.case.title} className="mt-4 text-[17px] leading-snug font-semibold underline-offset-2 hover:underline">
        {e.case.shortTitle}
      </Link>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground" title={e.meta.pitch}>
        {e.meta.pitch}
      </p>
      {e.meta.pulledInto.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Pulled into {e.meta.pulledInto.length} series</p>}
      <div className="mt-auto flex items-center gap-2 pt-5">
        <Button size="sm" variant={voted ? "default" : "outline"} onClick={() => vote.mutate({ params: { caseId: e.case.id }, body: {} })}>
          <ThumbsUp className={cn("size-3.5", voted && "fill-current")} /> {e.meta.votes.length}
        </Button>
        <AvatarStack ids={e.meta.votes} max={4} />
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ArrowDownToLine className="size-3.5" /> Pull in
        </Button>
      </div>
      <RationaleDialog
        open={open}
        onOpenChange={setOpen}
        title="Pull into your series"
        description="A linked case with all signals lands on your board."
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
