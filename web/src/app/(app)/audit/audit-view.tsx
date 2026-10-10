"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useApi } from "@/lib/api/hooks";
import { download } from "@/lib/format";
import { PageHeader } from "@/components/common/page";
import { AuditTimeline } from "@/components/common/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function AuditView() {
  const [actor, setActor] = useState<"all" | "human" | "ai">("all");
  const [objectId, setObjectId] = useState("");
  const { data: events = [] } = useApi("audit", { query: { actorType: actor === "all" ? undefined : actor, objectId: objectId.trim() || undefined } });
  return (
    <div>
      <PageHeader
        title="Audit trail"
        actions={
          <Button size="sm" variant="outline" onClick={() => download("audit.json", JSON.stringify(events, null, 2), "application/json")}>
            <Download className="size-3.5" /> Export JSON
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={actor} onValueChange={(v) => v && setActor(v as "all")}>
            <ToggleGroupItem value="all" className="px-2.5">
              Everyone
            </ToggleGroupItem>
            <ToggleGroupItem value="human" className="px-2.5">
              People
            </ToggleGroupItem>
            <ToggleGroupItem value="ai" className="px-2.5">
              AI agents
            </ToggleGroupItem>
          </ToggleGroup>
          <Input value={objectId} onChange={(e) => setObjectId(e.target.value)} placeholder="Object ID, e.g. CASE-G60-0001 or REQ-G60-0004" className="h-8 w-80" />
          <span className="text-xs text-muted-foreground">{events.length} events</span>
        </div>
      </PageHeader>
      <div className="p-6 pl-10">
        <AuditTimeline events={events.slice(0, 300)} />
      </div>
    </div>
  );
}
