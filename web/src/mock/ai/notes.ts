import type { Case, OpenQuestion, Requirement } from "@/contracts";
import type { ProposalDraft } from "./chat";

/**
 * Mock meeting-note extractor: matches note lines to the case's open questions
 * by addressee and keyword overlap, and proposes answers plus field updates.
 * The PM accepts or rejects every proposal. Real implementation: LLM extraction.
 */

const addresseeWords: Record<string, string[]> = {
  engineering: ["engineering", "engineer", "technical", "powertrain", "systems"],
  finance: ["controlling", "finance", "cost", "€", "eur", "budget", "margin"],
  design: ["design", "designer"],
  quality: ["quality", "field data"],
  market_pm: ["market", "rest of world", "china pm", "row"],
  purchasing: ["purchasing", "supplier"],
  other: [],
};

const stop = new Set(["the", "a", "an", "of", "to", "in", "for", "and", "or", "is", "be", "can", "with", "what", "how", "we", "our", "today", "per", "car", "below"]);
const words = (s: string) => s.toLowerCase().match(/[a-z0-9€°]+/g)?.filter((w) => w.length > 2 && !stop.has(w)) ?? [];

export function extractFromNote(c: Case, questions: OpenQuestion[], requirements: Requirement[], text: string): ProposalDraft[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\s]+/, "").trim())
    .filter((l) => l.length > 8);
  const proposals: ProposalDraft[] = [];
  const used = new Set<string>();

  for (const q of questions.filter((q) => q.status === "open")) {
    let best: { line: string; score: number } | null = null;
    const qWords = new Set(words(q.question));
    for (const line of lines) {
      if (used.has(line)) continue;
      const lw = line.toLowerCase();
      const overlap = words(line).filter((w) => qWords.has(w)).length;
      const byWho = (addresseeWords[q.addressee] ?? []).some((w) => lw.includes(w)) ? 2 : 0;
      const score = overlap + byWho;
      if (score >= 2 && (!best || score > best.score)) best = { line, score };
    }
    if (best) {
      used.add(best.line);
      const answer = best.line.replace(/^[A-Za-z /]+:\s*/, "");
      proposals.push({
        objectType: q.objectType,
        objectId: q.objectId,
        source: "meeting_note",
        kind: "question_answer",
        summary: `Answer "${q.question}"`,
        changes: [{ field: "answer", before: null, after: answer }],
        questionId: q.id,
        citations: [q.id],
      });
    }
  }

  // Cost line → propose a cost update on the case's draft requirement, if one exists.
  const costLine = lines.find((l) => /€\s?\d|\d+\s?€|eur\b/i.test(l));
  const req = requirements.find((r) => r.caseId === c.id && r.status !== "rejected");
  if (costLine && req) {
    const band = costLine.match(/€\s?[\d.,]+\s?[-–]\s?[\d.,]+|€\s?[\d.,]+/)?.[0] ?? costLine;
    proposals.push({
      objectType: "requirement",
      objectId: req.id,
      source: "meeting_note",
      kind: "field",
      summary: `Update cost band of ${req.id} to ${band} per car (source: finance)`,
      changes: [{ field: "cost", before: req.cost, after: { ...req.cost, eurBand: `${band} per car`, source: "finance", note: "From meeting note" } }],
      citations: [],
    });
  }

  // Next steps → add to the case's decision log.
  const next = lines.find((l) => /^next\b|to do|action/i.test(l));
  if (next) {
    const after = c.bodyMd.replace("## Decision log", `## Decision log\n\n- Meeting: ${next}`).replace("\n\n_No decisions yet._", "");
    proposals.push({
      objectType: "case",
      objectId: c.id,
      source: "meeting_note",
      kind: "body",
      summary: "Add the meeting's next step to the decision log",
      changes: [{ field: "bodyMd", before: c.bodyMd, after }],
      citations: [],
    });
  }
  return proposals;
}
