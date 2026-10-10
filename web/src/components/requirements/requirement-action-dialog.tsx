"use client";

import type { Requirement, RequirementAction } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { RationaleDialog } from "@/components/common/rationale-dialog";

export const reqActionCopy: Record<RequirementAction, { title: string; description: string; confirm: string; destructive?: boolean }> = {
  discuss: { title: "Take into discussion", description: "You are discussing targets and feasibility with engineering and finance.", confirm: "Start discussion" },
  approve: { title: "Approve as PM", description: "Targets and arguments are ready. The head of product line gets a sign-off request.", confirm: "Approve" },
  send_back: { title: "Send back to the PM", description: "Explain what is missing; the PM gets a notification.", confirm: "Send back" },
  sign_off: { title: "Sign off", description: "The requirement goes into the product line's plan for the successor.", confirm: "Sign off" },
  plan: { title: "Plan into the vehicle plan", description: "Adds the requirement as a planned feature of the successor (or links it to an existing feature).", confirm: "Add to plan" },
  export: { title: "Export to Codebeamer", description: "Marks the requirement as handed off to engineering.", confirm: "Export" },
  reject: { title: "Reject the requirement", description: "Kept with the reason, so the next generation can see why.", confirm: "Reject", destructive: true },
  restore: { title: "Restore as draft", description: "Brings a rejected requirement back.", confirm: "Restore" },
};

export function RequirementActionDialog({ r, action, onOpenChange }: { r: Requirement; action: RequirementAction | null; onOpenChange: (o: boolean) => void }) {
  const m = useApiMutation("transitionRequirement", { success: (x) => `${x.id} → ${x.status.replace("_", " ")}` });
  if (!action) return null;
  const t = reqActionCopy[action];
  return (
    <RationaleDialog
      open
      onOpenChange={onOpenChange}
      title={`${t.title} · ${r.id}`}
      description={t.description}
      confirmLabel={t.confirm}
      destructive={t.destructive}
      pending={m.isPending}
      onSubmit={async (rationale) => {
        await m.mutateAsync({ params: { id: r.id }, body: { action, rationale } });
        onOpenChange(false);
      }}
    />
  );
}
