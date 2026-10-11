"use client";

import { regionLabel, releaseLabel, type Requirement } from "@/contracts";
import { useUsers } from "@/components/common/people";
import { ProvChip, provenanceMap } from "@/components/requirements/provenance";
import { cn } from "@/lib/utils";

/**
 * Same case, different PM context: the global requirement next to a regional variant.
 * Each row shows both values and where each came from, differing rows highlighted.
 */
export function VariantsCompare({ r, others, onOpen, onCite }: { r: Requirement; others: Requirement[]; onOpen: (id: string) => void; onCite?: (ref: string) => void }) {
  const { name } = useUsers();
  const other = others.find((x) => x.caseId === r.caseId && x.ownerId !== r.ownerId && x.status !== "rejected");
  if (!other) return null;
  const [a, b] = r.marketScope === "global" ? [r, other] : [other, r];
  const pa = provenanceMap(a);
  const pb = provenanceMap(b);
  const rows: [string, string, string, string][] = [
    ["Target", a.metrics[0]?.target ?? "—", b.metrics[0]?.target ?? "—", `metrics.${a.metrics[0]?.id ?? "m1"}.target`],
    ["Scope", regionLabel[a.marketScope], regionLabel[b.marketScope], "marketScope"],
    ["Release", releaseLabel[a.releaseTarget], releaseLabel[b.releaseTarget], "releaseTarget"],
    ["Cost", a.cost.size, b.cost.size, "cost"],
    ["Evidence", a.evidenceLevel, b.evidenceLevel, ""],
  ];
  return (
    <div className="rounded-lg border bg-card text-sm">
      <div className="border-b px-4 py-2.5 text-[13px] font-semibold">Same case, two sets of product specs: why the requirements differ</div>
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-normal" />
            {[a, b].map((x) => (
              <th key={x.id} className="px-3 py-1.5 font-normal">
                <button type="button" onClick={() => onOpen(x.id)} className={cn("font-mono text-foreground transition-colors duration-150", x.id === r.id ? "font-semibold hover:underline" : "underline decoration-border-strong underline-offset-2 hover:decoration-foreground")}>
                  {x.id}
                </button>{" "}
                · {name(x.ownerId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, va, vb, path]) => (
            <tr key={label} className={cn("border-t align-top", va !== vb && "bg-tone-violet-bg")}>
              <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
              <td className="px-3 py-1.5">
                <div className="font-medium">{va}</div>
                {path && <ProvChip p={pa.get(path)} onCite={onCite} className="mt-0.5" />}
              </td>
              <td className="px-3 py-1.5">
                <div className="font-medium">{vb}</div>
                {path && <ProvChip p={pb.get(path)} onCite={onCite} className="mt-0.5" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
