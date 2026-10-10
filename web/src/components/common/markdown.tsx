"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Markdown renderer. `[ID]` citations (e.g. [G60-1430], [SIG-…]) become
 * clickable chips that call onCite.
 */
export function Markdown({ children, className, onCite }: { children: string; className?: string; onCite?: (ref: string) => void }) {
  const text = onCite ? children.replace(/\[([A-Z][A-Z0-9]*-[A-Za-z0-9-]+)\](?!\()/g, "[$1](cite:$1)") : children;
  return (
    <div className={cn("prose-doc", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("cite:") ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href, children: c }) =>
            href?.startsWith("cite:") ? (
              <button
                type="button"
                onClick={() => onCite?.(href.slice(5))}
                className="mx-0.5 inline-flex items-center rounded border border-primary/30 bg-primary/5 px-1 font-mono text-[11px] text-primary hover:bg-primary/15"
              >
                {c}
              </button>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {c}
              </a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
