"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import type { Proposal } from "@/contracts";
import { useApi, useApiMutation } from "@/lib/api/hooks";
import { fromNow } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/common/markdown";
import { ProposalCard } from "@/components/common/proposal-card";
import { UserAvatar } from "@/components/common/people";

const caseSuggestions = [
  "Why is this ranked so high?",
  "Compare the markets",
  "What do competitors offer?",
  "What should I ask engineering and finance?",
  "Draft a SMART requirement",
  "Research what owners say",
  "Prepare an argument sheet for engineering",
];
const reqSuggestions = ["Prepare an argument sheet for engineering", "What do competitors offer?", "Set the target to 800 km", "Why is this ranked so high?", "Compare the markets"];

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
  const post = useApiMutation("postMessage");
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const byId = new Map(proposals.map((p) => [p.id, p]));

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, post.isPending]);

  const send = (content: string) => {
    if (!content.trim()) return;
    post.mutate({ params: { type: objectType, id: objectId }, body: { content } });
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Bot className="mb-2 size-5 text-primary" />
            Ask about this {objectType}. Answers use only the evidence in the context pack and cite it, e.g. [G60-1430]. Edits come back as proposals you accept or reject; nothing changes without you.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <UserAvatar id={m.role === "assistant" ? "agent:assistant" : m.authorId} size="xs" className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={m.role === "user" ? "rounded-lg bg-muted px-3 py-2 text-sm" : ""}>
                {m.role === "assistant" ? <Markdown className="prose-chat" onCite={onCite}>{m.content}</Markdown> : m.content}
              </div>
              {m.proposalIds.map((pid) => {
                const p = byId.get(pid);
                return p ? <ProposalCard key={pid} p={p} canDecide={canEdit} /> : null;
              })}
              <div className="text-[10px] text-muted-foreground">{fromNow(m.createdAt)}</div>
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
      <div className="space-y-2 border-t p-3">
        <div className="flex flex-wrap gap-1.5">
          {(objectType === "case" ? caseSuggestions : reqSuggestions).map((s) => (
            <button key={s} onClick={() => send(s)} disabled={post.isPending} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/60 hover:text-foreground">
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
