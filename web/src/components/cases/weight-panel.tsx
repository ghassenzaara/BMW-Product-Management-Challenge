"use client";

import { RotateCcw, Save } from "lucide-react";
import { FactorKey as FactorKeys, factorHint, factorLabel, type FactorKey, type WeightProfile } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function WeightPanel({
  weights,
  onChange,
  dirty,
  onReset,
}: {
  weights: Record<FactorKey, number>;
  onChange: (w: Record<FactorKey, number>) => void;
  dirty: boolean;
  onReset: () => void;
}) {
  const me = useApi("me");
  const profiles = useApi("weightProfiles");
  const updateWs = useApiMutation("updateWorkspace", { success: "Weight profile switched" });
  const create = useApiMutation("createWeightProfile", { silent: true });
  const visible = (profiles.data ?? []).filter((p) => p.isDefault || p.ownerId === me.data?.user.id);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Weight profile</Label>
        <Select value={me.data?.workspace.weightProfileId} onValueChange={(id) => updateWs.mutate({ body: { weightProfileId: id } })}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visible.map((p: WeightProfile) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? "" : " (mine)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{me.data?.weightProfile.description}</p>
      </div>
      <div className="space-y-3">
        {FactorKeys.options.map((f) => (
          <div key={f} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <Tooltip>
                <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">{factorLabel[f]}</TooltipTrigger>
                <TooltipContent className="max-w-xs">{factorHint[f]}</TooltipContent>
              </Tooltip>
              <span className="font-mono tabular-nums">{weights[f].toFixed(1)}</span>
            </div>
            <Slider min={0} max={1} step={0.1} value={[weights[f]]} onValueChange={([v]) => onChange({ ...weights, [f]: v })} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!dirty} onClick={onReset} className="flex-1">
          <RotateCcw className="size-3.5" /> Reset
        </Button>
        <Button
          size="sm"
          disabled={!dirty || create.isPending}
          className="flex-1"
          onClick={async () => {
            const base = me.data!.weightProfile;
            const p = await create.mutateAsync({
              body: { name: `${me.data!.user.name.split(" ")[0]}'s what-if ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, description: `Saved from the ranked list, based on ${base.name}.`, weights, costMultiplier: base.costMultiplier },
            });
            await updateWs.mutateAsync({ body: { weightProfileId: p.id } });
            onReset();
          }}
        >
          <Save className="size-3.5" /> Save as mine
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Score = weighted mean of the factors (0..1). Cost is not part of a case score; it adjusts the requirement rank. Evidence level is shown separately.
      </p>
    </div>
  );
}
