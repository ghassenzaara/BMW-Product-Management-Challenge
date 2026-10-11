import { marketLabel, type ReplayResponse } from "@/contracts";

/**
 * Markdown dossier of one requirement's chain. Same sections as the backend's
 * `audit_chain.render` (sources and signals, case, scores, human decisions, audit
 * events), plus the score of every decision day and the integrity checks.
 */

const cut = (t: string | null | undefined, n = 160) => {
  const s = (t ?? "").replace(/\n/g, " ").replace(/\|/g, "/");
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
};
const day = (iso: string) => iso.slice(0, 16).replace("T", " ");

export function renderDossier(x: ReplayResponse, name: (id: string) => string): string {
  const r = x.requirement;
  const c = x.case;
  const quotes = x.quoteIds.map((id) => x.signals.find((s) => s.id === id)!).filter(Boolean);
  const records = new Map(x.sourceRecords.map((rec) => [rec.ref, rec]));
  const lines: string[] = [
    `# Audit chain: ${r.id}`,
    "",
    `Requirement **${r.id}** (${r.status}, v${r.version}): ${r.title}  `,
    `Line ${r.series}${r.marketScope !== "global" ? ` / ${r.marketScope}` : ""}; release target ${r.releaseTarget}; evidence level ${r.evidenceLevel}; cost ${r.cost.size} (${r.cost.source}); owner ${name(r.ownerId)}; drafter ${r.drafter ?? "—"}.`,
    "",
    `Generated ${day(x.generatedAt)} from the stored rows and the append-only audit log. Synthetic demo data is marked as such.`,
    "",
    "## 1. Source records and signals",
    "",
    `- ${x.counts.customers} customer voices in ${x.counts.markets.map((m) => marketLabel[m]).join(", ") || "no market"}; ${x.counts.bmwRecords} BMW records, ${x.counts.webRecords} web records, ${x.counts.sources} sources`,
    "",
    `Sample of ${quotes.length} signals (defects first), each with its stored source record:`,
    "",
    "| Signal | Kind | Market | Quote | Source record | SHA-256 | Classified |",
    "|---|---|---|---|---|---|---|",
    ...quotes.map((s) => {
      const rec = s.recordRef ? records.get(s.recordRef) : undefined;
      const cls = s.classification ? (s.classification.method === "bmw_label" ? `BMW label: ${s.classification.label}` : `${s.classification.model} · ${s.classification.promptVersion}`) : "—";
      return `| \`${s.id}\` | ${s.kind} / ${s.severity} | ${s.market} | "${cut(s.quoteEn ?? s.quote, 120)}" | \`${s.recordRef ?? "—"}\`${rec?.synthetic ? " (synthetic)" : ""} | \`${rec?.sha256.slice(0, 12) ?? "—"}…\` | ${cut(cls, 60)} |`;
    }),
    "",
    "## 2. Case",
    "",
    `**${c.id}**: ${c.title} (topic ${c.topicId ?? "—"}, car area ${c.carArea}; created by ${c.createdBy}). State **${c.state}**${c.outcome ? `, outcome ${c.outcome}` : ""}${c.outcomeNote ? `: ${c.outcomeNote}` : ""}.`,
    "",
    "## 3. Scores (at each decision, under the profile active then)",
    "",
    "| When | Event | Profile | Score | Rank |",
    "|---|---|---|---|---|",
    ...x.events
      .filter((e) => e.scoreSnapshot)
      .map((e) => `| ${day(e.at)} | ${e.label} | ${e.scoreSnapshot!.profileName} v${e.scoreSnapshot!.profileVersion} | ${e.scoreSnapshot!.score.toFixed(3)} | ${e.scoreSnapshot!.rank} of ${e.scoreSnapshot!.of} |`),
    `| today | — | ${x.scoreToday.profileName} | ${x.scoreToday.score.toFixed(3)} | ${x.scoreToday.rank} of ${x.scoreToday.of} |`,
    "",
    "## 4. Decisions (human)",
    "",
    "| When | Actor | Object | Action | Rationale |",
    "|---|---|---|---|---|",
    ...x.events.filter((e) => e.actorType === "human").map((e) => `| ${day(e.at)} | ${e.actorName} | ${e.objectType} ${e.objectId} | ${e.action} | ${cut(e.rationale)} |`),
    "",
    "## 5. Audit events (append-only log)",
    "",
    "| Seq | When | Actor | Type | Action | Object | Rationale |",
    "|---|---|---|---|---|---|---|",
    ...x.events.map((e) => `| ${e.seq} | ${day(e.at)} | ${e.actorName} | ${e.actorType} | ${e.action} | ${e.objectType} ${cut(e.objectId, 40)} | ${cut(e.rationale)} |`),
    "",
    "## 6. Integrity checks",
    "",
    ...x.integrity.flatMap((ch) => [`- ${ch.ok ? "PASS" : "FAIL"} · ${ch.label}: ${ch.detail}`, ...ch.failures.map((f) => `  - ${f}`)]),
    "",
  ];
  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
