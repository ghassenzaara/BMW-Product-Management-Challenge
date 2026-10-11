"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { ArgusMark } from "@/components/brand/marks";
import type { Proposal } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/common/markdown";
import { ProposalCard } from "@/components/common/proposal-card";
import { UserAvatar } from "@/components/common/people";

const caseSuggestions = ["What should I ask engineering?", "Draft a SMART requirement", "What do competitors offer?", "Research what owners say"];
const reqSuggestions = ["Prepare an argument sheet for engineering", "What do competitors offer?", "Why is this ranked so high?"];

export function ChatPanel({
  objectType,
  objectId,
  proposals,
  canEdit,
  onCite,
}: {
  objectType: "case" | "requirement";
  objectId: string;
  proposals: Proposal[];
  canEdit: boolean;
  onCite?: (ref: string) => void;
}) {
  const { data: messages = [] } = useApi("messages", { params: { type: objectType, id: objectId } });
  const { data: segments = [] } = useApi("caseSegments", { params: { id: objectId } }, { enabled: objectType === "case" });
  const post = useApiMutation("postMessage");
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const byId = new Map(proposals.map((p) => [p.id, p]));

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, post.isPending]);

  const send = (content: string, segment?: string) => {
    if (!content.trim()) return;
    post.mutate({ params: { type: objectType, id: objectId }, body: { content, segment } });
    if (!segment) setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong bg-recessed p-4 text-sm text-muted-foreground">
            <ArgusMark className="mb-2 size-5 text-primary" />
            Ask Argus about this {objectType}. Answers cite the evidence; changes come back as proposals you accept or reject.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <UserAvatar id={m.role === "assistant" ? "agent:argus" : m.authorId} size="xs" className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={m.role === "user" ? "rounded-lg bg-muted px-3 py-2 text-sm" : "border-l-2 border-border-strong pl-3"}>
                {m.role === "assistant" ? <Markdown className="prose-chat" onCite={onCite}>{m.content}</Markdown> : m.content}
              </div>
              {m.proposalIds.map((pid) => {
                const p = byId.get(pid);
                return p ? <ProposalCard key={pid} p={p} canDecide={canEdit} /> : null;
              })}
              <div className="text-xs text-muted-foreground">{fromNow(m.createdAt)}</div>
            </div>
          </div>
        ))}
        {post.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking with the case evidence…
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="space-y-2.5 border-t p-4">
        {segments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" title="Answers use only real BMW verbatims from that segment">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3" /> Ask owners:
            </span>
            {segments.map((s) => (
              <button
                key={s.key}
                onClick={() => send(`What do ${s.label} say?`, s.key)}
                disabled={post.isPending}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs transition-colors duration-150 hover:border-foreground/40 hover:text-foreground",
                  s.verbatims ? "border-border-strong bg-card text-foreground" : "border-dashed border-border-strong text-muted-foreground",
                )}
              >
                {s.label.replace(/ owners$/, "")} <span className="tabular-nums text-muted-foreground">({s.verbatims})</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(objectType === "case" ? caseSuggestions : reqSuggestions).map((s) => (
            <button key={s} onClick={() => send(s)} disabled={post.isPending} className="rounded-full border bg-recessed px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/40 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={2}
            placeholder="Ask, or tell it what you learned in a meeting…"
            className="min-h-0 resize-none"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || post.isPending} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
