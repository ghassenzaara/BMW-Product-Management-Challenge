"use client";

import { TriangleAlert } from "lucide-react";
import { checkKindLabel, type Requirement, type RequirementAction, type RequirementCheck } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { Pill } from "@/components/common/badges";
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

export function RequirementActionDialog({
  r,
  check,
  action,
  onOpenChange,
}: {
  r: Requirement;
  /** Latest quality check; open issues are shown before PM approval. */
  check?: RequirementCheck | null;
  action: RequirementAction | null;
  onOpenChange: (o: boolean) => void;
}) {
  const m = useApiMutation("transitionRequirement", { success: (x) => `${x.id} → ${x.status.replace("_", " ")}` });
  if (!action) return null;
  const t = reqActionCopy[action];
  const issues = action === "approve" ? (check?.issues ?? []) : [];
  const red = issues.filter((i) => i.severity === "red");
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
    >
      {issues.length > 0 && (
        <div className="space-y-2 rounded-lg border border-tone-amber-bd bg-tone-amber-bg px-4 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="size-4 text-warning" />
            The quality check found {red.length ? `${red.length} issue${red.length === 1 ? "" : "s"} to fix` : `${issues.length} point${issues.length === 1 ? "" : "s"} to review`}
          </p>
          <ul className="space-y-1 pl-1">
            {(red.length ? red : issues).slice(0, 4).map((i) => (
              <li key={i.id} className="flex gap-2">
                <Pill t={i.severity === "red" ? "red" : "amber"} className="shrink-0">
                  {checkKindLabel[i.kind]}
                </Pill>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Engineering runs the same checks in Codebeamer. You can still approve; say why below.</p>
        </div>
      )}
    </RationaleDialog>
  );
}
