import type { Case, Dataset, Requirement } from "@/contracts";
import { carAreaLabel, marketLabel } from "@/contracts";

/**
 * Mock "requirement agent": drafts SMART requirements from a confirmed case.
 * Hand-written drafts for the demo's hero cases; a template for the rest.
 * The logic team replaces this with an LLM call that returns the same shape.
 */

type Draft = Pick<
  Requirement,
  "title" | "description" | "marketScope" | "releaseTarget" | "metrics" | "acceptanceCriteria" | "assumptions" | "cost" | "evidenceLevel"
>;

const heroDrafts: Record<string, Draft[]> = {
  "CASE-G60-0001": [
    {
      title: "Driver reaches the 5 most-used functions in ≤ 2 interactions, incl. programmable physical favourite buttons",
      description:
        "The driver can reach the five most-used functions (radio presets, climate temperature and fan, recent calls, drive mode) in at most two interactions without looking at the central display for more than one glance. Includes 8 programmable physical favourite buttons. All derivatives, all markets; shared with the F70 and G70 operating-concept module (Baukasten).",
      marketScope: "global",
      releaseTarget: "next_gen",
      metrics: [
        { id: "m1", question: "How many programmable buttons?", target: "8", basis: "evidence", benchmark: "Predecessor had 1–8; engineering: 8 fit, 6 with haptics" },
        { id: "m2", question: "Interactions to reach a top-5 function", target: "≤ 2", basis: "assumption" },
        { id: "m3", question: "US study 'menu structure' top-2 box", target: "≥ 50% (today 36%)", unit: "%", basis: "assumption" },
      ],
      acceptanceCriteria: ["Buttons programmable for any function or radio station", "Usable with gloves", "Works identically in F70 / G60 / G70 module"],
      assumptions: ["Which functions are 'most used' needs usage telemetry (missing in our data)", "Cost per car pending Finance (Q-0002)"],
      cost: { size: "M", eurBand: "€10–20 per car", source: "ai_estimate", note: "Estimate until Finance answers Q-0002." },
      evidenceLevel: "high",
    },
  ],
  "CASE-G60-0005": [
    {
      title: "Cabin cools from 45 °C to 22 °C in ≤ 6 minutes, with a physical climate bar",
      description:
        "From a hot soak at 45 °C, the cabin reaches 22 °C at head level within 6 minutes. Temperature and fan are adjustable through a physical climate bar below the display. All derivatives, all markets.",
      marketScope: "global",
      releaseTarget: "next_gen",
      metrics: [
        { id: "m1", question: "Cool-down time 45 → 22 °C", target: "≤ 6 min", unit: "min", basis: "evidence", benchmark: "Today ~9 min; Mercedes E-Class ~6 min (engineering benchmark)" },
        { id: "m2", question: "US study 'operation of heater/AC controls' top-2", target: "≥ 45% (today 29%)", unit: "%", basis: "assumption" },
      ],
      acceptanceCriteria: ["Climate bar in the same glass-look surface as the display (design)", "Temperature and fan without opening a menu"],
      assumptions: ["New compressor generation available for SOP"],
      cost: { size: "M", eurBand: "€18–25 per car (climate bar)", source: "finance", note: "Controlling, climate sync 10.10." },
      evidenceLevel: "high",
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the real agent will use the dataset (RAG)
export function draftRequirements(c: Case, d: Dataset): Draft[] {
  if (heroDrafts[c.id]) return heroDrafts[c.id];
  const markets = c.markets.filter((m) => m !== "unknown").map((m) => marketLabel[m]).join(", ");
  const signals = c.signalIds.length;
  const sizeByDepth = { trim_option: "S", software_ota: "S", part_module: "M", platform_powertrain: "L" } as const;
  return [
    {
      title: `${c.featureName}: ${c.type === "fix_improve" ? "fix so that" : "provide so that"} the customer problem is solved`,
      description: `Customer-facing requirement derived from ${c.id}: "${c.summary}" Scope: ${c.scope === "global" ? "all markets" : marketLabel[c.scope === "CN" ? "CN" : "RoW"]} (${markets || "markets to confirm"}). Area: ${carAreaLabel[c.carArea]}. Draft by the requirement agent; targets are assumptions until the PM confirms them.`,
      marketScope: c.scope,
      releaseTarget: c.changeDepth === "software_ota" ? "ota" : c.changeDepth === "platform_powertrain" ? "next_gen" : "next_gen",
      metrics: [
        { id: "m1", question: `Share of complaints about "${c.featureName}"`, target: "−50% vs today", basis: "assumption" },
      ],
      acceptanceCriteria: ["Target validated with engineering", "Evidence linked (" + signals + " signals)"],
      assumptions: ["Targets drafted by AI; confirm with engineering and finance"],
      cost: { size: sizeByDepth[c.changeDepth], eurBand: "to estimate", source: "ai_estimate", note: "Rough size from change depth." },
      evidenceLevel: c.evidenceLevel,
    },
  ];
}
