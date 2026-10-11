"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import type { AuditEvent } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { auditAction, auditLines } from "@/lib/audit";
import { fmtDateTime, fromNow } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, useUsers } from "./people";
import { Pill } from "./badges";

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  const { name } = useUsers();
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {events.map((e) => {
        const lines = auditLines(e, name);
        return (
          <li key={e.seq} className="relative">
            <span className="absolute top-0.5 -left-[27px]">
              <UserAvatar id={e.actorId} size="xs" />
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium">{name(e.actorId)}</span>
              <Pill t={e.actorType === "ai" ? "sky" : "outline"}>
                {e.actorType === "ai" && <Bot className="size-3" />}
                <span title={e.action}>{auditAction(e.action)}</span>
              </Pill>
              {!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(e.objectId) && <span className="font-mono text-muted-foreground">{e.objectId}</span>}
              <span className="text-muted-foreground" title={fmtDateTime(e.at)}>
                {fromNow(e.at)}
              </span>
            </div>
            {e.rationale && <p className="mt-0.5 text-sm">“{e.rationale}”</p>}
            {lines.length > 0 && (
              <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {lines.map((l) => (
                  <div key={l.label} className="flex flex-wrap gap-x-1.5">
                    <dt className="font-medium text-foreground/70">{l.label}:</dt>
                    <dd className="min-w-0 break-words">
                      {l.from !== undefined && (
                        <>
                          <span className="line-through decoration-muted-foreground/50">{l.from}</span>
                          <span className="px-1">→</span>
                        </>
                      )}
                      <span className="text-foreground/90">{l.to}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
      {events.length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
    </ol>
  );
}

export function CommentThread({ objectType, objectId }: { objectType: "case" | "requirement"; objectId: string }) {
  const { data: comments = [] } = useApi("comments", { query: { objectType, objectId } });
  const add = useApiMutation("addComment", { success: "Comment posted" });
  const { name, users } = useUsers();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <UserAvatar id={c.authorId} />
          <div className="min-w-0 flex-1 rounded-lg border bg-card px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">{name(c.authorId)}</span>
              <span className="text-muted-foreground">{fromNow(c.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-sm whitespace-pre-wrap">
              {c.body.split(/(@[A-Z][a-z]+(?: [A-Z][a-z]+)?)/g).map((part, i) =>
                part.startsWith("@") ? (
                  <span key={i} className="rounded-sm bg-muted px-1 font-medium text-foreground">
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </p>
          </div>
        </div>
      ))}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          add.mutate({ body: { objectType, objectId, body } }, { onSuccess: () => setBody("") });
        }}
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={`Comment… mention with @Name, e.g. @${users[1]?.name ?? "Wei Zhang"}`} />
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={!body.trim() || add.isPending}>
            <Send className="size-3.5" /> Comment
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ObjectActivity({ objectType, objectId }: { objectType: "case" | "requirement"; objectId: string }) {
  const { data: events = [] } = useApi("audit", { query: { objectId } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-[15px] font-semibold">Discussion</h3>
        <CommentThread objectType={objectType} objectId={objectId} />
      </div>
      <div>
        <h3 className="mb-3 text-[15px] font-semibold">Audit trail · who or what changed what, when and why</h3>
        <AuditTimeline events={events} />
      </div>
    </div>
  );
}
