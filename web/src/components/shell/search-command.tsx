"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, KanbanSquare, MessageSquareQuote, Search, UserRound } from "lucide-react";
import { useApi } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const icons = { case: KanbanSquare, requirement: FileText, signal: MessageSquareQuote, user: UserRound };

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const { data = [] } = useApi("search", { query: { q } }, { enabled: q.trim().length > 1 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = (["case", "requirement", "signal", "user"] as const).map((t) => ({ t, items: data.filter((r) => r.type === t) })).filter((g) => g.items.length);

  return (
    <>
      <Button variant="outline" size="sm" className="w-64 min-w-0 shrink justify-start gap-2 font-normal text-muted-foreground max-md:w-auto max-md:flex-1" onClick={() => setOpen(true)}>
        <Search className="size-3.5" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-left">Search cases, IDs, people</span>
        <kbd className="rounded-sm border bg-recessed px-1.5 font-sans text-xs leading-4 text-muted-foreground max-md:hidden">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search">
        <Command shouldFilter={false}>
        <CommandInput placeholder="Try 'buttons', 'G60-1430', 'REQ-G60-0004', 'Wei'…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{q.trim().length > 1 ? "No results." : "Type to search."}</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.t} heading={g.t === "case" ? "Cases" : g.t === "requirement" ? "Requirements" : g.t === "signal" ? "Signals" : "People"}>
              {g.items.map((r) => {
                const Icon = icons[r.type];
                return (
                  <CommandItem
                    key={r.type + r.id}
                    value={r.type + r.id}
                    onSelect={() => {
                      setOpen(false);
                      router.push(r.href);
                    }}
                  >
                    <Icon className="size-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
