import type { ArgusAskResponse, Case, ChatMessage, Dataset, Requirement, Signal, User } from "@/contracts";
import { caseStateLabel, marketLabel, sourceTypeLabel } from "@/contracts";
import { scriptedReply } from "./chat";
import { liveChatEnabled, liveReply } from "./live";

/**
 * The global Argus chat (the bubble). Answers about the dragged-in cases, requirements
 * and signals with the same assistant as the case chat; with nothing attached it finds
 * the cases a question is about. It only answers: edits and research happen on the
 * object's own page, where the PM can accept them.
 */

type Turn = { role: "user" | "assistant"; content: string };
type Cite = ArgusAskResponse["citations"][number];

const STOP = new Set("what which where when does have with that this about from they them their there should would could into than then your mine show tell give list find cases case requirement requirements most more much many".split(" "));

export const signalHref = (s: { id: string; caseId?: string | null }) => (s.caseId ? `/cases/${s.caseId}?signal=${s.id}` : `/radar?signal=${s.id}`);

function caseLine(c: Case) {
  const customers = c.figures.perMarket.reduce((s, m) => s + m.customers, 0);
  return `- [${c.id}] **${c.shortTitle}**: ${c.title} · ${caseStateLabel[c.state]}, ${customers} customers`;
}

/** Fold the bubble's turns into the case chat's history shape, so the live assistant sees the thread. */
function asHistory(history: Turn[], c: Case): ChatMessage[] {
  return history.map((t, i) => ({ id: `ARGUS-${i}`, objectType: "case", objectId: c.id, role: t.role, content: t.content, citations: [], proposalIds: [], createdAt: new Date(0).toISOString() }));
}

async function aboutCase(d: Dataset, c: Case, r: Requirement | undefined, content: string, history: Turn[], user: User, nowIso: string, cites: Cite[]) {
  const objectType = r ? "requirement" : "case";
  const scripted = scriptedReply(d, { objectType, c, r }, content, user.id, nowIso);
  if (scripted.proposals.length || scripted.newSignals.length) {
    return `That would change ${r?.id ?? c.id}. Open it and use **Ask Argus** there, so you can accept the change on the page.`;
  }
  const signals = c.signalIds.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s);
  let text = scripted.text;
  if (liveChatEnabled()) text = (await liveReply(c, signals, asHistory(history, c), content, r)) ?? text;
  for (const id of new Set([...text.matchAll(/\[([A-Z][A-Z0-9]*-[A-Za-z0-9-]+)\]/g)].map((m) => m[1]))) {
    const s = d.signals.find((x) => x.id === id);
    if (s) cites.push({ ref: s.id, label: `${s.id} · ${s.sourceType === "bmw_feedback" ? "verbatim" : sourceTypeLabel[s.sourceType]}`, href: signalHref(s) });
  }
  return text;
}

function aboutSignal(d: Dataset, s: Signal, cites: Cite[]) {
  cites.push({ ref: s.id, label: s.id, href: signalHref(s) });
  const c = s.caseId ? d.cases.find((x) => x.id === s.caseId) : undefined;
  if (c) cites.push({ ref: c.id, label: c.id, href: `/cases/${c.id}` });
  return [
    `[${s.id}] · ${s.sourceName}, ${marketLabel[s.market]}${s.publishedAt ? `, ${s.publishedAt}` : ""}`,
    "",
    `> ${s.quoteEn ?? s.quote}`,
    "",
    s.summary,
    c ? `It is evidence in [${c.id}] *${c.title}*.` : "It is not part of a case yet.",
  ].join("\n");
}

/** No attachment: match the question against the cases, else show the asker's top cases. */
function aboutWorkspace(d: Dataset, content: string, user: User, cites: Cite[]) {
  const words = content.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  const hits = words.length
    ? d.cases
        .map((c) => ({ c, n: words.filter((w) => `${c.title} ${c.shortTitle} ${c.featureName} ${c.summary}`.toLowerCase().includes(w)).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n || b.c.figures.perMarket.length - a.c.figures.perMarket.length)
        .slice(0, 5)
        .map((x) => x.c)
    : [];
  const mine = d.cases.filter((c) => (c.ownerId === user.id || c.coOwnerIds.includes(user.id)) && c.state !== "observed" && c.state !== "decided");
  const top = hits.length
    ? hits
    : [...mine].sort((a, b) => b.figures.perMarket.reduce((s, m) => s + m.customers, 0) - a.figures.perMarket.reduce((s, m) => s + m.customers, 0)).slice(0, 5);
  top.forEach((c) => cites.push({ ref: c.id, label: c.id, href: `/cases/${c.id}` }));
  if (!top.length) return "I found no case for that. Drag a case or requirement here and ask about it.";
  return [
    hits.length ? `These cases match your question:` : `I found no case for that. Your open cases with the most customers:`,
    "",
    ...top.map(caseLine),
    "",
    "_Drag one here to ask about its evidence._",
  ].join("\n");
}

export async function argusReply(d: Dataset, body: { content: string; attachments: { kind: "case" | "requirement" | "signal"; id: string }[]; history: Turn[] }, user: User, nowIso: string): Promise<ArgusAskResponse> {
  const cites: Cite[] = [];
  const parts: { title: string; text: string }[] = [];
  for (const a of body.attachments.slice(0, 3)) {
    if (a.kind === "signal") {
      const s = d.signals.find((x) => x.id === a.id);
      if (s) parts.push({ title: s.id, text: aboutSignal(d, s, cites) });
      continue;
    }
    const r = a.kind === "requirement" ? d.requirements.find((x) => x.id === a.id) : undefined;
    const c = d.cases.find((x) => x.id === (r ? r.caseId : a.id));
    if (c) parts.push({ title: `${r?.id ?? c.id} · ${r?.shortTitle ?? c.shortTitle}`, text: await aboutCase(d, c, r, body.content, body.history, user, nowIso, cites) });
  }
  const content = !parts.length
    ? aboutWorkspace(d, body.content, user, cites)
    : parts.length === 1
      ? parts[0].text
      : parts.map((p) => `**${p.title}**\n\n${p.text}`).join("\n\n---\n\n");
  return { content, citations: [...new Map(cites.map((c) => [c.ref, c])).values()] };
}
