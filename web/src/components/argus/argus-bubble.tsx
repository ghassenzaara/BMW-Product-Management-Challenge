"use client";

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, FileText, KanbanSquare, Loader2, MessageSquareQuote, Paperclip, SquarePen, X } from "lucide-react";
import { ArgusMark } from "@/components/brand/marks";
import type { ArgusAskResponse } from "@/contracts";
import { api, type CallOptions } from "@/lib/api/client";
import { useApi } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Markdown } from "@/components/common/markdown";
import { attachToArgus, parseAttachment, setArgusDrag, setArgusOpen, setPending, useArgus, type Attachment } from "./store";

/**
 * Argus, the global assistant: a bubble bottom right on every page. Only the conversation
 * and its attachments; drag a case, requirement or signal onto it to add it as context.
 * The thread lives in this tab (sessionStorage); the server stores nothing.
 */

type Msg = { id: string; role: "user" | "assistant"; content: string; attachments?: Attachment[]; citations?: ArgusAskResponse["citations"]; failed?: boolean };

const KEY = "argus-thread";
const kindIcon = { case: KanbanSquare, requirement: FileText, signal: MessageSquareQuote };

function load(): Msg[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Msg[];
  } catch {
    return [];
  }
}

export function ArgusBubble() {
  const { open, pending, dragging, over, hiddenBy } = useArgus();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(load);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const ask = useMutation({ mutationFn: (body: NonNullable<CallOptions<"argusAsk">["body"]>) => api("argusAsk", { body }) });

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* private mode: the thread just isn't kept */
    }
  }, [messages]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, ask.isPending, open]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open, pending.length]);

  // Name the chips: a dropped link only carries its ID.
  useEffect(() => {
    const unnamed = pending.filter((p) => !p.title);
    if (!unnamed.length) return;
    let live = true;
    Promise.all(unnamed.map((p) => api("search", { query: { q: p.id } }).then((r) => [p.id, r.find((x) => x.id === p.id)?.title] as const).catch(() => [p.id, undefined] as const))).then((names) => {
      if (!live) return;
      const byId = new Map(names);
      setPending(pending.map((p) => (p.title ? p : { ...p, title: byId.get(p.id) ?? p.id })));
    });
    return () => {
      live = false;
    };
  }, [pending]);

  // Links dragged anywhere on the page light up the bubble.
  useEffect(() => {
    const start = (e: DragEvent) => {
      const href = (e.target as Element | null)?.closest?.("a[href]")?.getAttribute("href");
      if (href && parseAttachment(href)) setArgusDrag(true);
    };
    const stop = () => setArgusDrag(false);
    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  const send = () => {
    const content = text.trim();
    if (!content || ask.isPending) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content, attachments: pending.length ? pending : undefined };
    // Context is every attachment of the conversation so far, so follow-ups keep it.
    const context = [...new Map([...messages, userMsg].flatMap((m) => m.attachments ?? []).map((a) => [a.id, a])).values()].slice(-5);
    const history = messages.filter((m) => !m.failed).slice(-20).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, userMsg]);
    setText("");
    setPending([]);
    ask.mutate(
      { content, attachments: context.map(({ kind, id }) => ({ kind, id })), history },
      {
        onSuccess: (r) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: r.content, citations: r.citations }]),
        onError: (e) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: `I couldn't answer: ${e.message}`, failed: true }]),
      },
    );
  };

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault();
    const a = parseAttachment(e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain"));
    setArgusDrag(false);
    if (a) attachToArgus(a);
  };
  const dropProps = {
    "data-argus-drop": "",
    onDragOver: (e: ReactDragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setArgusDrag(true, true);
    },
    onDragLeave: (e: ReactDragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArgusDrag(dragging, false);
    },
    onDrop,
  };

  if (hiddenBy > 0 && !dragging) return null;

  return (
    <>
      {open && (
        <section
          {...dropProps}
          aria-label="Argus"
          className="fixed right-5 bottom-20 z-50 flex h-[min(600px,calc(100dvh-7rem))] w-[380px] flex-col overflow-hidden rounded-xl border bg-card shadow-xl max-md:inset-x-3 max-md:bottom-[6.5rem] max-md:h-[min(600px,calc(100dvh-8.5rem))] max-md:w-auto"
          onKeyDown={(e) => e.key === "Escape" && setArgusOpen(false)}
        >
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <ArgusMark className="size-4 text-primary" />
            <h2 className="flex-1 text-sm font-semibold">Argus</h2>
            {messages.length > 0 && (
              <Button size="icon-sm" variant="ghost" aria-label="New chat" title="New chat" onClick={() => (setMessages([]), setPending([]))}>
                <SquarePen className="size-4" />
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setArgusOpen(false)}>
              <X className="size-4" />
            </Button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                <ArgusMark className="size-6 text-primary" />
                <p>Ask about your cases and requirements. Drag one here to add it as context.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex flex-col items-end gap-1.5">
                      {m.attachments && (
                        <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
                          {m.attachments.map((a) => (
                            <Chip key={a.id} a={a} onClick={() => router.push(hrefOf(a))} />
                          ))}
                        </div>
                      )}
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ) : (
                    <div key={m.id} className={cn("text-sm", m.failed && "text-destructive")}>
                      <Markdown className="prose-chat" onCite={(ref) => router.push(m.citations?.find((c) => c.ref === ref)?.href ?? `/cases/${ref}`)}>
                        {m.content}
                      </Markdown>
                    </div>
                  ),
                )}
                {ask.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Thinking…
                  </div>
                )}
                <div ref={end} />
              </div>
            )}
            {dragging && (
              <div className={cn("absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed bg-card/90 text-sm font-medium backdrop-blur-sm transition-colors", over ? "border-primary text-foreground" : "border-border-strong text-muted-foreground")}>
                Drop to add as context
              </div>
            )}
          </div>

          <form
            className="shrink-0 p-3 pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="rounded-xl border bg-background focus-within:border-border-strong">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2.5 pt-2.5">
                  {pending.map((a) => (
                    <Chip key={a.id} a={a} onRemove={() => setPending(pending.filter((p) => p.id !== a.id))} />
                  ))}
                </div>
              )}
              <textarea
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Ask Argus…"
                aria-label="Message Argus"
                className="block max-h-40 w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <AttachPicker attached={pending} />
                <Button type="submit" size="icon-sm" className="rounded-full" disabled={!text.trim() || ask.isPending} aria-label="Send">
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      <button
        {...dropProps}
        type="button"
        onClick={() => setArgusOpen(!open)}
        aria-label={open ? "Close Argus" : "Ask Argus"}
        aria-expanded={open}
        className={cn(
          "fixed right-5 bottom-5 z-50 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 outline-none hover:shadow-xl focus-visible:ring-3 focus-visible:ring-ring/40 max-md:bottom-12",
          dragging && !open ? "px-5 ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : "w-12",
          over && "scale-105",
        )}
      >
        {open ? <ChevronDown className="size-5" /> : <ArgusMark className="size-7" />}
        {dragging && !open && <span className="text-sm font-medium">Drop to ask Argus</span>}
      </button>
    </>
  );
}

const hrefOf = (a: Attachment) => (a.kind === "requirement" ? `/requirements/${a.id}` : a.kind === "case" ? `/cases/${a.id}` : `/radar?signal=${a.id}`);

function Chip({ a, onRemove, onClick }: { a: Attachment; onRemove?: () => void; onClick?: () => void }) {
  const Icon = kindIcon[a.kind];
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-recessed py-0.5 pr-1 pl-1.5 text-xs">
      <Icon className="size-3 shrink-0 text-muted-foreground" />
      <button type="button" onClick={onClick} disabled={!onClick} className="min-w-0 truncate text-left enabled:hover:underline" title={a.title ?? a.id}>
        <span className="font-mono">{a.id}</span>
        {a.title && a.title !== a.id && <span className="text-muted-foreground"> · {a.title}</span>}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${a.id}`} className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Paperclip: the page you're on, or search for a case, requirement or signal. */
function AttachPicker({ attached }: { attached: Attachment[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const pathname = usePathname();
  const { data = [] } = useApi("search", { query: { q } }, { enabled: q.trim().length > 1 });
  const here = parseAttachment(pathname);
  const taken = new Set(attached.map((a) => a.id));
  const results = data.filter((r) => r.type !== "user" && !taken.has(r.id)).slice(0, 12);
  const pick = (a: Attachment) => {
    attachToArgus(a);
    setOpen(false);
    setQ("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Attach a case, requirement or signal" title="Attach">
          <Paperclip className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search cases, requirements, signals…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{q.trim().length > 1 ? "Nothing found." : "Type to search."}</CommandEmpty>
            {here && !taken.has(here.id) && (
              <CommandGroup heading="This page">
                <CommandItem value={`here-${here.id}`} onSelect={() => pick(here)}>
                  {(() => {
                    const Icon = kindIcon[here.kind];
                    return <Icon className="size-4" />;
                  })()}
                  <span className="font-mono text-xs">{here.id}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((r) => {
                  const kind = r.type as Attachment["kind"];
                  const Icon = kindIcon[kind];
                  return (
                    <CommandItem key={r.type + r.id} value={r.type + r.id} onSelect={() => pick({ kind, id: r.id, title: r.title })}>
                      <Icon className="size-4" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
