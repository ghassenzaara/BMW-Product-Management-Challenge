import type { Case, Citation, Dataset, Proposal, Requirement, Signal } from "@/contracts";
import { addresseeLabel, factorLabel, marketLabel, sourceTypeLabel } from "@/contracts";
import { caseScore } from "../scoring";
import { draftRequirements } from "./drafts";
import { webSpecToSignal } from "../convert";

/**
 * Scripted assistant used when no LLM key is configured (offline demo).
 * Picks an intent from the message, answers from the case data with [ID]
 * citations, and returns proposals the PM must accept. Never edits directly.
 */

export type ProposalDraft = Omit<Proposal, "id" | "createdAt" | "status">;

export interface ScriptedReply {
  text: string;
  citations: Citation[];
  proposals: ProposalDraft[];
  newSignals: Signal[];
}

export function cite(s: Signal): Citation {
  return { ref: s.id, label: `${s.id} · ${s.sourceType === "bmw_feedback" ? "verbatim" : sourceTypeLabel[s.sourceType]}` };
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function strongest(signals: Signal[], n: number) {
  const rank = (s: Signal) =>
    (s.sourceType === "bmw_feedback" ? 0 : 1) + ({ defect: 0, difficult_to_use: 0.2, wish: 0.4, none: 0.8 }[s.severity] ?? 1);
  return [...signals].filter((s) => s.kind !== "like" && s.sourceType !== "bmw_study").sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

export function scriptedReply(
  d: Dataset,
  target: { objectType: "case" | "requirement"; c: Case; r?: Requirement },
  content: string,
  userId: string,
  nowIso: string,
): ScriptedReply {
  const { c, r, objectType } = target;
  const objectId = r?.id ?? c.id;
  const msg = content.toLowerCase();
  const signals = c.signalIds.map((id) => d.signals.find((s) => s.id === id)).filter((s): s is Signal => !!s);
  const top = strongest(signals, 3);
  const studies = signals.filter((s) => s.sourceType === "bmw_study");
  const competitors = signals.filter((s) => s.kind === "competitor_fact");
  const out: ScriptedReply = { text: "", citations: [], proposals: [], newSignals: [] };
  const citeRef = (s: Signal) => {
    if (!out.citations.some((x) => x.ref === s.id)) out.citations.push(cite(s));
    return `[${s.id}]`;
  };

  // --- On-demand research (mocked): adds new synthetic signals to the case ---
  if (/\b(research|look up|search|find out|dig into)\b|what do .* say/.test(msg)) {
    const market = msg.includes("china") || msg.includes("chinese") || c.scope === "CN" ? "CN" : msg.includes("europe") ? "EU" : "US";
    const specs = [
      {
        agent: "customer_public" as const,
        sourceType: (market === "CN" ? "review" : "forum") as Signal["sourceType"],
        sourceName: market === "CN" ? "Autohome · 口碑 (research run)" : "Owner forum (research run)",
        url: market === "CN" ? "https://www.autohome.com.cn/" : "https://www.bimmerpost.com/",
        trust: "D" as const,
        kind: "complaint" as const,
        severity: "difficult_to_use" as const,
        market: market as Signal["market"],
        marketBasis: "stated" as const,
        audience: "owner" as const,
        language: market === "CN" ? "zh" : "en",
        publishedAt: nowIso.slice(0, 10),
        summary: `Owner voice on "${c.featureName}" found by the research agent (synthetic)`,
        quote:
          market === "CN"
            ? `关于${c.featureName}，车主普遍希望改进。`
            : `Honestly the ${c.featureName.toLowerCase()} is the one thing I'd change on this car.`,
        quoteEn: market === "CN" ? `Owners generally want ${c.featureName.toLowerCase()} improved.` : undefined,
      },
      {
        agent: "trends" as const,
        sourceType: "news" as const,
        sourceName: "Industry press (research run)",
        url: "https://www.autonews.com/",
        trust: "C" as const,
        kind: "trend" as const,
        market: market as Signal["market"],
        marketBasis: "inferred" as const,
        audience: "public" as const,
        publishedAt: nowIso.slice(0, 10),
        summary: `Segment trend relevant to "${c.featureName}" (synthetic)`,
        quote: `Premium buyers increasingly name ${c.featureName.toLowerCase()} as a purchase criterion.`,
      },
    ];
    specs.forEach((spec, i) => {
      const s = webSpecToSignal(spec, {
        id: `SIG-${c.id}-R${Date.now().toString(36)}${i}`,
        series: c.series,
        carArea: c.carArea,
        featureHint: c.featureName,
        caseId: c.id,
        fetchedAt: nowIso,
      });
      out.newSignals.push(s);
    });
    out.text = `I ran a research job for **${marketLabel[market as "CN"]}** (${specs.length} queries, mock run). Two new signals were added to this case:\n\n- ${out.newSignals[0].summary} ${citeRef(out.newSignals[0])}\n- ${out.newSignals[1].summary} ${citeRef(out.newSignals[1])}\n\nBoth are trust D/C web sources, so they count as weak evidence. They are now in the Signals tab and the score will update.`;
    return out;
  }

  // --- Draft requirement(s) ---
  if (objectType === "case" && /(draft|write|generate|propose).*(requirement|req)|smart/.test(msg)) {
    const drafts = draftRequirements(c, d);
    drafts.forEach((draft) =>
      out.proposals.push({
        objectType: "case",
        objectId,
        source: "chat",
        kind: "new_requirement",
        summary: `New requirement draft: ${draft.title}`,
        changes: [{ field: "requirement", before: null, after: draft }],
        citations: top.map((s) => s.id),
        decidedBy: undefined,
        decidedAt: undefined,
      }),
    );
    out.text = `Here is a SMART draft based on ${signals.length} signals ${top.map(citeRef).join(" ")}. Targets marked *assumption* still need engineering. Accept the proposal below to create it as a **Draft** requirement linked to this case.`;
    return out;
  }

  // --- Draft open questions ---
  if (/question|ask (engineering|finance|design)|what should i ask/.test(msg)) {
    const qs: { addressee: "engineering" | "finance" | "market_pm"; question: string; why: string }[] = [
      { addressee: "engineering" as const, question: `What target for "${c.featureName}" is realistic for the ${c.changeDepth === "platform_powertrain" ? "next platform" : "next generation"}?`, why: "Needed for the metric target." },
      { addressee: "finance" as const, question: `Rough cost per car (or programme) for improving "${c.featureName}"?`, why: "Cost is a rough factor for the requirement rank." },
    ];
    if (c.marketConflict) qs.push({ addressee: "market_pm", question: `Does the other region accept a ${c.scope === "CN" ? "China-only" : "global"} solution?`, why: c.marketConflict.note });
    qs.forEach((q) =>
      out.proposals.push({
        objectType,
        objectId,
        source: "chat",
        kind: "new_question",
        summary: `Ask ${addresseeLabel[q.addressee]}: ${q.question}`,
        changes: [{ field: "question", before: null, after: q }],
        citations: [],
      }),
    );
    out.text = `I suggest ${qs.length} open questions. Accept the ones you want; they appear in *Open questions* with an addressee so you can take them to your next meetings.`;
    return out;
  }

  // --- Change a target on a requirement ---
  const num = msg.match(/(\d[\d.,]*)\s*(km|kw|min|%|s|°c|buttons?)?/);
  if (r && /(set|change|update|raise|lower|make).*(target|to)/.test(msg) && num) {
    const metric = r.metrics.find((m) => (num[2] && m.unit && m.unit.toLowerCase() === num[2].toLowerCase()) || msg.includes(m.question.toLowerCase().split(" ")[0])) ?? r.metrics[0];
    if (metric) {
      const newTarget = `${num[1]}${num[2] ? " " + num[2] : ""}`.trim();
      const after = r.metrics.map((m) => (m.id === metric.id ? { ...m, target: newTarget } : m));
      out.proposals.push({
        objectType: "requirement",
        objectId,
        source: "chat",
        kind: "field",
        summary: `Change target "${metric.question}" from ${metric.target} to ${newTarget}`,
        changes: [{ field: "metrics", before: r.metrics, after }],
        citations: competitors.map((s) => s.id),
      });
      out.text = `Proposed change: **${metric.question}** ${metric.target} → **${newTarget}**.${competitors.length ? ` Benchmarks for context: ${competitors.map((s) => `${s.summary} ${citeRef(s)}`).join("; ")}.` : ""} Accept to apply; the edit is logged with your rationale.`;
      return out;
    }
  }

  // --- Add a note to the page ---
  const add = content.match(/^(?:please )?add (?:a note|this|that)?:?\s*(.+)$/i);
  if (add && objectType === "case") {
    const note = add[1].trim();
    const after = c.bodyMd.replace("## Decision log", `## Decision log\n\n- ${nowIso.slice(0, 10)} · ${note}`).replace("\n\n_No decisions yet._", "");
    out.proposals.push({ objectType: "case", objectId, source: "chat", kind: "body", summary: `Add to decision log: ${note}`, changes: [{ field: "bodyMd", before: c.bodyMd, after }], citations: [] });
    out.text = "I prepared the edit to the page. Accept it to apply.";
    return out;
  }

  // --- Argument sheet for engineering ---
  if (/argument|defend|pitch|convince|engineering meeting|why do we need/.test(msg)) {
    const complaint = top.find((s) => s.kind === "complaint");
    const wish = signals.find((s) => s.kind === "wish");
    const study = studies[0];
    out.text = [
      `**Argument sheet · ${c.featureName}**`,
      complaint ? `- **Complaint:** ${complaint.summary} ${citeRef(complaint)}` : "- **Complaint:** none in the data",
      wish ? `- **Wish:** ${wish.summary} ${citeRef(wish)}` : "- **Wish:** none explicit",
      study ? `- **Study:** ${study.summary} ${citeRef(study)}` : "- **Study:** no linked attribute",
      competitors.length ? `- **Competition:** ${competitors.map((s) => `${s.summary} ${citeRef(s)}`).join("; ")}` : `- **Competition:** ${c.figures.competitorOffer.join("; ") || "not researched"}`,
      `- **Markets:** ${c.figures.perMarket.map((m) => `${marketLabel[m.market]} ${m.customers} customers${m.salesShare2030 ? ` (${pct(m.salesShare2030)} of 2030 volume)` : ""}`).join(", ")}`,
      `- **Brand fit:** ${c.brandFit.value.toFixed(2)}, ${c.brandFit.reason}`,
      r ? `- **Cost:** ${r.cost.size} · ${r.cost.eurBand} (${r.cost.source.replace("_", " ")})` : "- **Cost:** decided on the requirement",
    ].join("\n");
    return out;
  }

  // --- Why ranked? ---
  if (/why|rank|score|priorit|important/.test(msg)) {
    const ws = d.workspaces.find((w) => w.userId === userId);
    const profile = d.weightProfiles.find((p) => p.id === ws?.weightProfileId) ?? d.weightProfiles[0];
    const { score, contributions } = caseScore(c, profile.weights);
    const topF = Object.entries(contributions).sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.text = [
      `With your weights (**${profile.name}**) the case scores **${score.toFixed(2)}**. The biggest contributions:`,
      ...topF.map(([f, v], i) => `${i + 1}. **${factorLabel[f as keyof typeof factorLabel]}** ${c.factors[f as keyof typeof c.factors].toFixed(2)} × weight → +${v.toFixed(2)}`),
      top[0] ? `\nStrongest customer evidence: ${top.map((s) => citeRef(s)).join(" ")}.` : "",
      studies[0] ? `Study: ${studies[0].summary} ${citeRef(studies[0])}.` : "",
      `Evidence level is **${c.evidenceLevel}** and kept separate from the score.`,
      c.figures.perMarket.some((m) => m.market === "US" && m.customers > 0) && c.figures.perMarket.every((m) => m.market === "US" || m.customers < 3)
        ? "Caveat: the verbatims are almost all from the US; Europe is the biggest market by volume."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return out;
  }

  // --- Markets / conflicts ---
  if (/market|china|chinese|europe|\bus\b|america|conflict|region/.test(msg)) {
    out.text = [
      "Per market (distinct customer signals · study · share of 2030 volume):",
      ...c.figures.perMarket.map(
        (m) =>
          `- **${marketLabel[m.market]}**: ${m.customers} customers (${m.complaints} complaints, ${m.wishes} wishes, ${m.likes} likes)${m.studyScore ? ` · study ${m.studyScore}` : ""}${m.salesShare2030 ? ` · ${pct(m.salesShare2030)} of volume` : ""}`,
      ),
      c.marketConflict ? `\n**Conflict:** ${c.marketConflict.note} I won't average this away; it's your call (one market, a variant, or keep both).` : "\nNo market conflict detected.",
      c.figures.perMarket.some((m) => m.market === "CN" && m.customers === 0) || c.scope === "CN"
        ? "Note: there are **no Chinese verbatims** in BMW's feedback data; China evidence is study + web only."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    studies.slice(0, 2).forEach(citeRef);
    return out;
  }

  // --- Competitors ---
  if (/compet|benchmark|rival|mercedes|tesla|xiaomi|audi|nio|li auto/.test(msg)) {
    out.text = competitors.length
      ? `Competitor facts on file:\n${competitors.map((s) => `- ${s.competitor ?? s.sourceName}: ${s.summary} (trust ${s.trust}${s.trust === "E" ? ", announcement = assumption" : ""}) ${citeRef(s)}`).join("\n")}\n\nToday's car: ${c.figures.equipmentToday}.`
      : `No structured competitor facts in this case yet. Known offers: ${c.figures.competitorOffer.join("; ") || "none"}. Ask me to *research competitors* to run the competitor agent.`;
    return out;
  }

  // --- Default: summary ---
  out.text = [
    `**${c.title}**`,
    c.summary,
    `Evidence: ${signals.length} signals (${signals.filter((s) => s.sourceType === "bmw_feedback").length} BMW verbatims, ${studies.length} study rows, ${signals.filter((s) => s.synthetic).length} web/synthetic). Strongest: ${top.map(citeRef).join(" ") || "—"}.`,
    "You can ask me: *why is this ranked high*, *compare markets*, *competitors*, *draft a requirement*, *what should I ask engineering*, *research what owners say*, or *prepare an argument sheet*.",
  ].join("\n\n");
  return out;
}

/**
 * After the PM saves step 2 ("Your knowledge"), the assistant asks 1-2 questions that
 * the data cannot answer, so the requirement draft starts from the PM's judgement.
 */
export function followUpQuestions(_d: Dataset, c: Case): string {
  const ctx = c.pmContext;
  const qs: string[] = [];
  const markets = c.figures.perMarket.filter((m) => m.market !== "unknown");
  const dataMarket = [...markets].sort((a, b) => b.customers - a.customers)[0];
  if (c.marketConflict) {
    qs.push(`${c.marketConflict.note} Should the requirement be **split per market** (${c.marketConflict.markets.map((m) => marketLabel[m]).join(" / ")}) or stay global?`);
  } else if (ctx?.marketFocus && ctx.marketFocus !== "global" && dataMarket && dataMarket.market !== ctx.marketFocus) {
    qs.push(`You focus on **${marketLabel[ctx.marketFocus]}**, but most of the evidence comes from **${marketLabel[dataMarket.market]}** (${dataMarket.customers} customers). Do you expect the same problem in ${marketLabel[ctx.marketFocus]}, or should we look for local evidence first?`);
  }
  if (ctx?.timing && ctx.timing !== "next_gen" && c.changeDepth === "platform_powertrain") {
    qs.push(`This looks like a **platform change**, which usually needs the next generation. Is a partial fix via ${ctx.timing === "ota" ? "OTA" : "the LCI"} acceptable, or should the requirement target the next generation only?`);
  } else if (ctx?.costSensitivity === "high" && c.changeDepth !== "software_ota") {
    qs.push(`You marked cost as **sensitive**. Would you accept this as a **paid option** (like ${c.figures.equipmentToday}) instead of standard equipment?`);
  }
  if (qs.length < 2) {
    const offer = c.figures.competitorOffer[0];
    const target = offer
      ? `Competitors: ${offer}. Should our target **match, beat or deliberately differ** from that?`
      : `What would a customer notice first if we solved this? I will turn it into a measurable target.`;
    qs.push(ctx?.positioning === "luxury" ? `For a **luxury** positioning: ${target}` : target);
  }
  const intro = ctx ? "Thanks, I added your input to the case context. Two things the data can't tell me:" : "Two things the data can't tell me:";
  return [intro, "", ...qs.slice(0, 2).map((q, i) => `${i + 1}. ${q}`), "", "_Answer here and I will use it in the requirement draft._"].join("\n");
}
