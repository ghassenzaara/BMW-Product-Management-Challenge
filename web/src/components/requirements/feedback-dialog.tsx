"use client";

import { useState } from "react";
import { addresseeLabel, feedbackResponseLabel, type Addressee, type FeedbackResponse, type Requirement } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Layer 4: record what engineering or finance said and how you respond. The drafter proposes the next version. */
export function FeedbackDialog({ r, open, onOpenChange }: { r: Requirement; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [from, setFrom] = useState<Addressee>("engineering");
  const [text, setText] = useState("");
  const [response, setResponse] = useState<FeedbackResponse>("compromise");
  const [rationale, setRationale] = useState("");
  const add = useApiMutation("addFeedback", { success: (x) => `Proposal ready: ${x.proposal.summary}` });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Feedback on {r.id}</DialogTitle>
          <DialogDescription>Your response is context too: the drafter proposes the next version, you accept or reject it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Select value={from} onValueChange={(v) => setFrom(v as Addressee)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["engineering", "finance", "design", "quality"] as const).map((a) => (
                  <SelectItem key={a} value={a}>
                    {addresseeLabel[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-text">What they said</Label>
            <Textarea id="fb-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. "${r.metrics[0]?.target ?? "The target"} is only possible with the next-gen cells; 700 km is the maximum for the current pack."`} />
          </div>
          <div className="space-y-1.5">
            <Label>Your response</Label>
            <ToggleGroup type="single" variant="outline" size="sm" value={response} onValueChange={(v) => v && setResponse(v as FeedbackResponse)}>
              {(["accept", "compromise", "push_back"] as const).map((x) => (
                <ToggleGroupItem key={x} value={x} className="px-3">
                  {feedbackResponseLabel[x]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-why">Why (goes into the audit trail and the next version)</Label>
            <Textarea id="fb-why" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="e.g. Customers compare with the A6 e-tron; keep the gap small." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={text.trim().length < 3 || !rationale.trim() || add.isPending}
            onClick={async () => {
              await add.mutateAsync({ params: { id: r.id }, body: { from, text, response, rationale } });
              setText("");
              setRationale("");
              onOpenChange(false);
            }}
          >
            {add.isPending ? "Drafting…" : "Propose next version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
