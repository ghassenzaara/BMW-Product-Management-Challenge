"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Case, CaseAction, InnovationHorizon } from "@/contracts";
import { horizonLabel } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { RationaleDialog } from "@/components/common/rationale-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsers } from "@/components/common/people";

export type UiCaseAction = CaseAction | "escalate";

const copy: Record<UiCaseAction, { title: string; description: string; confirm: string; destructive?: boolean }> = {
  open: { title: "Open this case", description: "Moves it from the radar onto the board.", confirm: "Open case" },
  start: { title: "Start investigating", description: "You are looking into the evidence.", confirm: "Start" },
  await: { title: "Waiting for answers", description: "Open questions are out with engineering, finance or other teams.", confirm: "Move" },
  ready: { title: "Ready to decide", description: "Evidence and answers are in.", confirm: "Move" },
  reopen: { title: "Reopen the case", description: "Clears the decision and moves the case back to Investigating.", confirm: "Reopen" },
  confirm: {
    title: "Confirm: build requirement(s)",
    description: "The problem is real and worth solving. Next, answer up to three questions and the AI drafts SMART requirement(s) from your product specs and context; you then edit, discuss with engineering and approve.",
    confirm: "Confirm case",
  },
  refer: { title: "Refer to another PM", description: "Hand the case to the PM who owns the series or attribute. You stay linked; they accept or send it back.", confirm: "Refer" },
  escalate: {
    title: "Escalate to the head of product line",
    description: "For conflicts you cannot resolve with the other PM (e.g. China vs Rest of World). The head decides: one market, a variant, or keep both.",
    confirm: "Escalate",
  },
  innovation: { title: "Move to the innovation pool", description: "Valuable, but not for this programme. Any PM can pull it into a future series.", confirm: "Move to pool" },
  park: { title: "Park and keep watching", description: "Not now. Signals keep collecting and the case shows up again when new evidence arrives.", confirm: "Park" },
  merge: { title: "Merge into another case", description: "Same problem as another case. Signals move to the target case; this one keeps a pointer.", confirm: "Merge" },
  reject: { title: "Reject the case", description: "Not worth solving. The reason is kept so the next generation can see why.", confirm: "Reject", destructive: true },
};

export function CaseActionDialog({ c, action, onOpenChange }: { c: Case; action: UiCaseAction | null; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { users } = useUsers();
  const me = useApi("me");
  const cases = useApi("cases", {}, { enabled: action === "merge" });
  const [toUserId, setToUserId] = useState<string>("");
  const [mergeIntoId, setMergeIntoId] = useState<string>("");
  const [horizon, setHorizon] = useState<InnovationHorizon>("next_gen");
  const mutation = useApiMutation("transitionCase", {
    success: (r) => (action === "escalate" ? "Escalated to the head of product line" : `${r.id}: ${action === "confirm" ? "confirmed, ready to draft" : "updated"}`),
  });

  if (!action) return null;
  const t = copy[action];
  const receivers = users.filter((u) => u.id !== me.data?.user.id && u.role !== "head").sort((a, b) => (a.role === "attribute_pm" ? -1 : 0) - (b.role === "attribute_pm" ? -1 : 0));
  const mergeTargets = (cases.data ?? []).filter((x) => x.id !== c.id && x.state !== "decided");
  const canSubmit = action === "refer" ? !!toUserId : action === "merge" ? !!mergeIntoId : true;

  return (
    <RationaleDialog
      open={!!action}
      onOpenChange={(o) => {
        if (!o) {
          setToUserId("");
          setMergeIntoId("");
        }
        onOpenChange(o);
      }}
      title={t.title}
      description={t.description}
      confirmLabel={t.confirm}
      destructive={t.destructive}
      pending={mutation.isPending}
      canSubmit={canSubmit}
      onSubmit={async (rationale) => {
        const body =
          action === "escalate"
            ? { action: "refer" as const, escalate: true, rationale }
            : { action, rationale, toUserId: toUserId || undefined, mergeIntoId: mergeIntoId || undefined, horizon: action === "innovation" ? horizon : undefined };
        const res = await mutation.mutateAsync({ params: { id: c.id }, body });
        onOpenChange(false);
        if (action === "confirm" && res.requirementIds.length) router.push(`/cases/${c.id}?step=requirements`);
      }}
    >
      {action === "refer" && (
        <div className="space-y-1.5">
          <Label>Receiver</Label>
          <Select value={toUserId} onValueChange={setToUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a PM" />
            </SelectTrigger>
            <SelectContent>
              {receivers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {u.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {action === "merge" && (
        <div className="space-y-1.5">
          <Label>Merge into</Label>
          <Select value={mergeIntoId} onValueChange={setMergeIntoId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose the target case" />
            </SelectTrigger>
            <SelectContent>
              {mergeTargets.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.id} · {x.title.slice(0, 70)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {action === "innovation" && (
        <div className="space-y-1.5">
          <Label>Horizon</Label>
          <Select value={horizon} onValueChange={(v) => setHorizon(v as InnovationHorizon)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(horizonLabel) as InnovationHorizon[]).map((h) => (
                <SelectItem key={h} value={h}>
                  {horizonLabel[h]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </RationaleDialog>
  );
}
