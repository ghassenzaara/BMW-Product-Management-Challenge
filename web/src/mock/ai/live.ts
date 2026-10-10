import Anthropic from "@anthropic-ai/sdk";
import type { Case, ChatMessage, Requirement, Signal } from "@/contracts";

/**
 * Optional live LLM for the chat. Active only when ANTHROPIC_API_KEY is set
 * (or an `ant auth login` profile exists and LIVE_CHAT=1). Otherwise the
 * scripted assistant answers. Same message contract either way.
 *
 * The team docs name OpenAI as the LLM provider: to switch, replace the body
 * of `liveReply` with an OpenAI call that returns the same `{ text }`.
 */

export function liveChatEnabled() {
  return !!process.env.ANTHROPIC_API_KEY || process.env.LIVE_CHAT === "1";
}

const SYSTEM = `You are the research assistant inside a BMW product-management tool. You help a product manager work on one case (a customer problem) or requirement (the solution) for a successor vehicle.
Rules:
- Answer only from the context provided. Cite evidence with its ID in square brackets, e.g. [G60-1430] or [SIG-...]. If something is not in the context, say it is missing.
- Separate evidence (BMW data, sourced web facts) from assumptions about the future.
- Surface market conflicts; never average them away. The PM decides.
- Customer-facing value only: no regulation, engineering specs or business case. Cost is a rough factor.
- BMW brand: driving dynamics, sportiness, design, premium quality, efficiency.
- Be concise: short paragraphs or bullets, max ~200 words.`;

function contextBlock(c: Case, signals: Signal[], r?: Requirement) {
  const sig = signals
    .slice(0, 40)
    .map((s) => `[${s.id}] (${s.sourceType}, ${s.market}, ${s.kind}, trust ${s.trust}${s.synthetic ? ", synthetic" : ""}) ${s.quoteEn ?? s.quote}`.slice(0, 400))
    .join("\n");
  return [
    `CASE ${c.id}: ${c.title}`,
    `Summary: ${c.summary}`,
    `Scope: ${c.scope}; markets: ${c.markets.join(", ")}; area: ${c.carArea}; type: ${c.type}; change depth: ${c.changeDepth}`,
    `Per market: ${JSON.stringify(c.figures.perMarket)}`,
    `Today: ${c.figures.equipmentToday}. Competitors: ${c.figures.competitorOffer.join("; ")}`,
    c.marketConflict ? `Market conflict: ${c.marketConflict.note}` : "",
    `Brand fit ${c.brandFit.value}: ${c.brandFit.reason}`,
    `Factors (0..1): ${JSON.stringify(c.factors)}; evidence level ${c.evidenceLevel}`,
    `Page:\n${c.bodyMd}`,
    r ? `REQUIREMENT ${r.id}: ${r.title}\n${r.description}\nMetrics: ${JSON.stringify(r.metrics)}\nCost: ${JSON.stringify(r.cost)}` : "",
    `SIGNALS:\n${sig}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function liveReply(c: Case, signals: Signal[], history: ChatMessage[], content: string, r?: Requirement): Promise<string | null> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Context for this conversation:\n${contextBlock(c, signals, r)}` },
    { role: "assistant", content: "Understood. I'll answer from this context and cite IDs." },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content }) as Anthropic.Beta.BetaMessageParam),
    { role: "user", content },
  ];
  try {
    const response = await client.beta.messages.create({
      model: process.env.LLM_MODEL ?? "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });
    if (response.stop_reason === "refusal") return null;
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`Live chat failed (${error.status}): ${error.message}`);
    else console.error("Live chat failed:", error);
    return null; // fall back to the scripted assistant
  }
}
