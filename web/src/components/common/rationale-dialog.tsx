"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Every human decision needs a short reason; it is stored in the audit trail.
 * `children` can add extra fields (receiver, merge target, …).
 */
export function RationaleDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  pending,
  children,
  canSubmit = true,
  defaultRationale = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  children?: ReactNode;
  canSubmit?: boolean;
  defaultRationale?: string;
  onSubmit: (rationale: string) => void | Promise<void>;
}) {
  const [rationale, setRationale] = useState(defaultRationale);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setRationale(defaultRationale);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!rationale.trim() || !canSubmit) return;
            await onSubmit(rationale.trim());
          }}
        >
          {children}
          <div className="space-y-1.5">
            <Label htmlFor="rationale">Reason (goes into the audit trail)</Label>
            <Textarea id="rationale" autoFocus value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why? e.g. 'Engineering confirmed 8 buttons fit; Baukasten topic'" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!rationale.trim() || !canSubmit || pending}>
              {pending ? "Saving…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
