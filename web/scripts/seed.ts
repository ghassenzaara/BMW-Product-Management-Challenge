/**
 * Builds the synthetic world for the mock backend.
 *
 *   npm run seed
 *
 * Reads the real processed BMW data (docs/02-bmw-data/processed/*.csv) and the
 * hand-written content in src/mock/authored/, and writes
 * src/mock/fixtures/seed.json. Every record is validated against the Zod
 * contract; the script fails on any invalid record.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import {
  Dataset,
  RequirementSnapshot,
  TaxonomyResponse,
  type AgentRun,
  type AuditEvent,
  type Case,
  type CaseState,
  type AspectGroup,
  type CarArea,
  type ChatMessage,
  type Market,
  type MarketFigure,
  type FeedbackEntry,
  type Proposal,
  type Requirement,
  type ScoreSnapshot,
  type SourceRecord,
  type RequirementStatus,
  type RequirementVersion,
  type Series,
  type SeriesBrief,
  type Signal,
  type SignalCluster,
} from "../src/contracts";
import { users, workspaces, weightProfiles, brandProfile } from "../src/mock/authored/people";
import { briefSpecs, stanceSpecs } from "../src/mock/authored/briefs";
import { authoredProvenance, sentences } from "../src/mock/ai/provenance";
import { caseSpecs } from "../src/mock/authored/cases";
import type { StudyRef, VerbatimSelector } from "../src/mock/authored/types";
import {
  NOW,
  alerts,
  balancedV1Change,
  chatSeeds,
  comments,
  conversions,
  heroStory,
  monitorSettings,
  innovation,
  notifications,
  plans,
  quarantine,
  questions,
  referrals,
  requirementSpecs,
  requirementTags,
  unclusteredSelectors,
} from "../src/mock/authored/world";
import { WEB_CLASSIFIER, sha256, webSnapshotRecord, webSpecToSignal } from "../src/mock/convert";
import { caseScore } from "../src/mock/scoring";
import { caseShortTitles, requirementShortTitles, shortFromTitle } from "../src/mock/authored/short-names";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../docs/02-bmw-data/processed");
const outFile = resolve(here, "../src/mock/fixtures/seed.json");
const taxonomyFile = resolve(here, "../../taxonomy/taxonomy.json");
const taxonomyOut = resolve(here, "../src/mock/fixtures/taxonomy.json");

// ---------- Load real data ----------
type Row = Record<string, string>;
const readCsv = (name: string): Row[] => parse(readFileSync(resolve(dataDir, name), "utf8"), { columns: true, skip_empty_lines: true });

const verbatims = readCsv("feedback_verbatims.csv");
const verbatimById = new Map(verbatims.map((r) => [r.id, r]));
const studyCnEu = readCsv("study_cn_eu_2025.csv");
const studyUs = readCsv("study_us_2025.csv");
const sales = readCsv("sales_volumes.csv");

const EU_COUNTRIES = new Set(["GB", "SE", "FR", "DK", "FI", "NO", "ES", "LV", "DE", "IT", "NL", "BE", "AT", "CH", "PL", "PT", "IE"]);
function marketOf(country: string): Market {
  if (country === "US") return "US";
  if (country === "CN") return "CN";
  if (EU_COUNTRIES.has(country)) return "EU";
  return country ? "RoW" : "unknown";
}

function salesKey(series: Series) {
  return series === "G60" ? "G60_G68" : series;
}
function share2030(series: Series, market: Market): number {
  const rows = sales.filter((r) => r.model === salesKey(series));
  const total = rows.reduce((s, r) => s + Number(r.volume_2030), 0);
  const row = rows.find((r) => r.market_code === market);
  return row && total ? Number(row.volume_2030) / total : 0;
}

// ---------- Taxonomy (taxonomy/taxonomy.json, built by taxonomy/build.py) ----------
interface TaxonomyFile {
  version: string;
  car_areas: { id: CarArea; label: string; description: string }[];
  topics: { id: string; label: string; car_area: CarArea; hint: string | null }[];
  aspect_groups: { id: AspectGroup; description: string }[];
  vfc_level2_to_topic: Record<string, string | null>;
  vfc_level3_to_aspect_group: Record<string, AspectGroup>;
}
const taxonomy: TaxonomyFile = JSON.parse(readFileSync(taxonomyFile, "utf8"));
const topicArea = new Map(taxonomy.topics.map((t) => [t.id, t.car_area]));

/** Short UI labels for topics whose BMW label is long or generic. */
const SHORT_LABELS: Record<string, string> = {
  drive_driving_dynamics_and_chassis_overall_technology: "Driving dynamics",
  body_equipment_overall_technology: "Body equipment",
  connecteddrive_and_infotainment_overall_technology: "Infotainment",
  driver_assistance_automated_driving_overall_technology: "Driver assistance",
  air_conditioning_overall_technology: "Air conditioning",
  vehicle_safety_overall_technology: "Safety",
  connecteddrive_services_smartphone_technology_overall: "ConnectedDrive services",
  charge_high_voltage_battery: "Charging the battery",
  vehicle_climatization: "Climate",
  seating_ventilate_heat: "Seat heating & ventilation",
  active_cruise_control: "Cruise control",
  automatic_engine_start_stop_function_msa: "Auto start-stop",
  remote_services_remote_keyless_entry_my_bmw_app_mini_app: "Remote services",
  my_bmw_app_mini_app: "My BMW App",
  non_contact_trunk_lid_opening: "Hands-free tailgate",
};
function shortLabel(id: string, label: string) {
  if (SHORT_LABELS[id]) return SHORT_LABELS[id];
  const cut = label.replace(/\s*\(.*?\)\s*/g, " ").split(/ \/ |, /)[0].trim();
  return cut.length >= 4 ? cut : label;
}

/** BMW "Topic : Aspect | Topic : Aspect" -> taxonomy pairs, meta labels dropped. */
function topicPairs(topics: string): { topicId: string; aspectGroup: AspectGroup | null }[] {
  return topics
    .split("|")
    .map((p) => p.split(" : ").map((x) => x.trim()))
    .map(([l2, l3]) => ({ topicId: taxonomy.vfc_level2_to_topic[l2] ?? null, aspectGroup: (l3 && taxonomy.vfc_level3_to_aspect_group[l3]) || null }))
    .filter((p): p is { topicId: string; aspectGroup: AspectGroup | null } => !!p.topicId);
}

// ---------- Helpers ----------
const usedVerbatims = new Set<string>();

function classify(types: string): { kind: Signal["kind"]; severity: Signal["severity"] } {
  if (types.includes("Defect")) return { kind: "complaint", severity: "defect" };
  if (types.includes("Difficult to Use")) return { kind: "complaint", severity: "difficult_to_use" };
  if (types.includes("Wants")) return { kind: "wish", severity: "wish" };
  if (types.includes("Likes")) return { kind: "like", severity: "none" };
  return { kind: "complaint", severity: "none" };
}

function summarize(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  return words.length <= 20 ? clean : words.slice(0, 20).join(" ") + "…";
}

function selectVerbatims(sel: VerbatimSelector): Row[] {
  const topic = sel.topic ? new RegExp(sel.topic, "i") : null;
  const text = sel.text ? new RegExp(sel.text, "i") : null;
  const pinned = (sel.pin ?? []).map((id) => verbatimById.get(id)).filter((r): r is Row => !!r);
  const matches = verbatims.filter(
    (r) =>
      r.model === sel.model &&
      (!topic || topic.test(r.topics)) &&
      (!text || text.test(r.text)) &&
      (!sel.types || sel.types.some((t) => r.feedback_types.includes(t))) &&
      (!sel.engine || r.engine === sel.engine),
  );
  const out: Row[] = [];
  for (const r of [...pinned, ...matches]) {
    if (out.length >= sel.limit) break;
    if (usedVerbatims.has(r.id) || out.some((o) => o.id === r.id)) continue;
    out.push(r);
  }
  out.forEach((r) => usedVerbatims.add(r.id));
  return out;
}

function verbatimSignal(r: Row, caseId: string | null, carArea: CarArea | null, featureHint: string): Signal {
  const { kind, severity } = classify(r.feedback_types);
  const source = r.source.replace("Source ", "");
  const pairs = topicPairs(r.topics);
  // One finding = one topic: prefer a topic in the case's car area.
  const pick = pairs.find((p) => carArea && topicArea.get(p.topicId) === carArea) ?? pairs[0] ?? null;
  const area: CarArea = carArea ?? (pick ? topicArea.get(pick.topicId)! : "interior_comfort");
  const bmwLabel = r.topics
    .split("|")
    .map((seg) => seg.trim())
    .find((seg) => pick && taxonomy.vfc_level2_to_topic[seg.split(" : ")[0].trim()] === pick.topicId);
  return {
    id: r.id,
    kind,
    severity,
    agent: "bmw_data",
    sourceType: "bmw_feedback",
    sourceName: `BMW customer feedback · Source ${source}`,
    trust: "A",
    recordRef: `feedback_verbatims.csv#${r.id}`,
    publishedAt: "2025",
    fetchedAt: "2026-09-01T06:00:00Z",
    series: r.model as Series,
    vehicleRole: "current",
    powertrain: (["ICE", "PHEV", "BEV"].includes(r.engine) ? r.engine : "unknown") as Signal["powertrain"],
    market: marketOf(r.country),
    marketBasis: "stated",
    country: r.country,
    carArea: area,
    topicId: pick?.topicId ?? null,
    aspectGroup: pick?.aspectGroup ?? null,
    featureHint: featureHint || r.topics.split("|")[0].split(" : ")[0],
    summary: summarize(r.text),
    quote: r.text.trim(),
    language: "en",
    audience: source === "C" || source === "D" ? "owner" : "owner",
    caseId,
    status: caseId ? "clustered" : "unclustered",
    classification: bmwLabel
      ? { method: "bmw_label", label: bmwLabel }
      : { method: "llm", label: "no_class_found: to classify from the text (not run in the demo)", ...WEB_CLASSIFIER },
    synthetic: false,
  };
}

function studySignal(ref: StudyRef, id: string, caseId: string, series: Series, carArea: CarArea, featureHint: string, topicId: string | null): Signal | null {
  const base = {
    topicId: ref.topicId ?? topicId,
    aspectGroup: null,
    agent: "bmw_data" as const,
    sourceType: "bmw_study" as const,
    trust: "A" as const,
    publishedAt: "2025",
    fetchedAt: "2026-09-01T06:00:00Z",
    series,
    vehicleRole: "current" as const,
    powertrain: "unknown" as const,
    marketBasis: "stated" as const,
    carArea,
    featureHint,
    language: "en",
    audience: "owner" as const,
    caseId,
    status: "clustered" as const,
    classification: { method: "bmw_label" as const, label: `Study attribute: ${ref.attribute.trim()}` },
    synthetic: false,
  };
  if (ref.market === "US") {
    const row = studyUs.find((r) => r.attribute === ref.attribute && r.model === ref.model);
    if (!row || !row.top2_box) return null;
    const top2 = Math.round(Number(row.top2_box) * 100);
    const bottom3 = Math.round(Number(row.bottom3_box) * 100);
    const low = top2 < 45 || bottom3 >= 12;
    const text = `US study 2025 · ${ref.attribute} (${ref.model}): top-2 ${top2}%, bottom-3 ${bottom3}%`;
    return {
      ...base,
      id,
      kind: low ? "complaint" : "like",
      severity: low ? "difficult_to_use" : "none",
      sourceName: "BMW customer study 2025 · US",
      recordRef: `study_us_2025.csv#${ref.attribute}|${ref.model}`,
      market: "US",
      summary: text,
      quote: text,
    };
  }
  const market = ref.market === "EU" ? "EU" : "China";
  const row = studyCnEu.find((r) => r.attribute === ref.attribute && r.model === ref.model && r.market === market);
  if (!row) return null;
  const score = Number(row.mean_score_10);
  const low = score < 8;
  const text = `${market} study 2025 · ${ref.attribute.trim()} (${ref.model}): ${score.toFixed(2)} / 10`;
  return {
    ...base,
    id,
    kind: low ? "complaint" : "like",
    severity: low ? "difficult_to_use" : "none",
    sourceName: `BMW customer study 2025 · ${market}`,
    recordRef: `study_cn_eu_2025.csv#${ref.attribute.trim()}|${market}|${ref.model}`,
    market: ref.market === "EU" ? "EU" : "CN",
    summary: text,
    quote: text,
  };
}

function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}
function between(a: string, b: string, f: number) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return new Date(ta + (tb - ta) * f).toISOString();
}

/** Three short bullets from the case page: problem, who is affected, competition. */
function deriveHighlights(bodyMd: string, competitorOffer: string[]): string[] {
  const section = (name: string) => {
    const m = bodyMd.match(new RegExp(`## ${name}\\s*\\n+([^#]+)`));
    const text = m?.[1].replace(/^(?:[-*]|\d+\.)\s+/gm, "").replace(/\s+/g, " ").trim() ?? "";
    const first = text.split(/(?<=[.!?])\s/)[0] ?? "";
    return first.length > 160 ? first.slice(0, 157).trimEnd() + "…" : first;
  };
  const offer = competitorOffer.find((o) => o.trim() && o.trim() !== "—");
  return [section("Problem"), section("Who is affected"), offer ? `Competition: ${offer}` : section("Competitors")].filter((h) => h && h !== "—" && !h.startsWith("_"));
}

// ---------- Build signals and cases ----------
const signals = new Map<string, Signal>();
const cases: Case[] = [];

for (const spec of caseSpecs) {
  const caseSignals: Signal[] = [];
  for (const sel of spec.verbatims) {
    for (const r of selectVerbatims(sel)) caseSignals.push(verbatimSignal(r, spec.id, spec.carArea, spec.featureName));
  }
  // Main topic: the authored one, else the most frequent verbatim topic in the case's area.
  if (spec.topicId && !topicArea.has(spec.topicId)) throw new Error(`${spec.id}: unknown topicId ${spec.topicId}`);
  const topicCount = new Map<string, number>();
  caseSignals.forEach((s) => s.topicId && topicArea.get(s.topicId) === spec.carArea && topicCount.set(s.topicId, (topicCount.get(s.topicId) ?? 0) + 1));
  const mainTopic = spec.topicId ?? [...topicCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  spec.study.forEach((ref, i) => {
    const s = studySignal(ref, `SIG-${spec.id}-S${i}`, spec.id, spec.series, spec.carArea, spec.featureName, mainTopic);
    if (s) caseSignals.push(s);
    else console.warn(`  study row not found: ${ref.attribute} / ${ref.model} / ${ref.market}`);
  });
  spec.web.forEach((w, i) =>
    caseSignals.push(
      webSpecToSignal(w, {
        id: `SIG-${spec.id}-W${i}`,
        series: spec.series,
        carArea: spec.carArea,
        featureHint: spec.featureName,
        caseId: spec.id,
        topicId: w.kind === "competitor_fact" ? null : mainTopic,
        fetchedAt: addDays(w.publishedAt.length > 7 ? `${w.publishedAt}T00:00:00Z` : "2026-09-01T00:00:00Z", 2),
      }),
    ),
  );
  caseSignals.forEach((s) => signals.set(s.id, s));

  // Per-market figures from the signals (customer evidence only; study rows add the score label).
  const markets = new Set<Market>(spec.markets ?? []);
  caseSignals.forEach((s) => s.market !== "unknown" && markets.add(s.market));
  const perMarket: MarketFigure[] = [...markets].map((m) => {
    const inMarket = caseSignals.filter((s) => s.market === m && s.sourceType !== "bmw_study" && s.kind !== "competitor_fact");
    const complaints = inMarket.filter((s) => s.kind === "complaint").length;
    const wishes = inMarket.filter((s) => s.kind === "wish").length;
    const likes = inMarket.filter((s) => s.kind === "like").length;
    const study = caseSignals.find((s) => s.market === m && s.sourceType === "bmw_study");
    const total = complaints + wishes + likes;
    const sentiment = total ? Math.max(-1, Math.min(1, (likes - complaints - 0.5 * wishes) / total)) : study?.kind === "like" ? 0.5 : study ? -0.5 : 0;
    return {
      market: m,
      customers: inMarket.length,
      complaints,
      wishes,
      likes,
      studyLabel: study ? study.summary.split(" · ")[1]?.split(" (")[0] : undefined,
      studyScore: study ? study.summary.split(": ").slice(-1)[0] : undefined,
      salesShare2030: m === "unknown" ? undefined : Math.round(share2030(spec.series, m) * 1000) / 1000,
      sentiment: Math.round(sentiment * 100) / 100,
    };
  });

  const customerCount = caseSignals.filter((s) => s.sourceType !== "bmw_study" && s.kind !== "competitor_fact" && s.kind !== "trend").length;
  const customers = spec.factors.customers ?? Math.min(1, Math.log10(1 + customerCount) / Math.log10(1 + 60));
  const marketVolume =
    spec.factors.market_volume ?? Math.min(1, [...markets].filter((m) => m !== "unknown").reduce((s, m) => s + share2030(spec.series, m), 0));

  const { verbatims: _v, study: _s, web: _w, equipmentToday, competitorOffer, trend, powertrainHint: _p, highlights, ...rest } = spec;
  const updatedAt = spec.updatedAt ?? between(spec.createdAt, NOW, 0.8);
  cases.push({
    ...rest,
    shortTitle: caseShortTitles[spec.id] ?? shortFromTitle(spec.featureName),
    highlights: highlights ?? deriveHighlights(spec.bodyMd, competitorOffer),
    topicId: mainTopic,
    stances: stanceSpecs[spec.id] ?? spec.stances ?? [],
    relatedSeries: spec.relatedSeries ?? [],
    coOwnerIds: spec.coOwnerIds ?? [],
    watcherIds: spec.watcherIds ?? [],
    markets: [...markets],
    signalIds: caseSignals.map((s) => s.id),
    figures: { perMarket, equipmentToday, competitorOffer, trend },
    factors: {
      ...spec.factors,
      customers: Math.round(customers * 100) / 100,
      market_volume: Math.round(marketVolume * 100) / 100,
    },
    originCaseId: spec.originCaseId ?? null,
    mergedInto: spec.mergedInto ?? null,
    requirementIds: [],
    manualRank: null,
    newSignalCount: spec.newSignalCount ?? 0,
    bodyVersion: 1,
    updatedAt,
    synthetic: true,
  });
}

// Unclustered signals for the radar; the car area comes from the taxonomy topic.
for (const sel of unclusteredSelectors) {
  for (const r of selectVerbatims(sel)) {
    const s = verbatimSignal(r, null, null, "");
    signals.set(s.id, s);
  }
}

// ---------- Requirements ----------
/** Strongest BMW customer records of a case: complaints and wishes first, the evidence a requirement cites. */
function topSignals(caseId: string, n = 3): string[] {
  const c = cases.find((x) => x.id === caseId);
  const rank = { complaint: 0, wish: 1, like: 2 } as Record<string, number>;
  return (c?.signalIds ?? [])
    .map((id) => signals.get(id)!)
    .filter((s) => s && s.agent === "bmw_data" && s.sourceType === "bmw_feedback")
    .sort((a, b) => (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3))
    .slice(0, n)
    .map((s) => s.id);
}

const briefIdOf = (series: Series) => `BRIEF-${series}`;
const requirements: Requirement[] = requirementSpecs.map((r): Requirement => {
  const tags = requirementTags[r.id];
  if (!tags) throw new Error(`${r.id}: missing requirementTags (provenance)`);
  const descriptionParts = sentences(r.description);
  return {
    ...r,
    shortTitle: requirementShortTitles[r.id] ?? shortFromTitle(r.title),
    descriptionParts,
    provenance: authoredProvenance(r, descriptionParts, tags, topSignals(r.caseId)),
    version: 1,
    shapeAnswers: [],
    briefId: briefIdOf(r.series),
    drafter: "authored",
    updatedAt: r.updatedAt ?? r.createdAt,
    manualRank: null,
    synthetic: true,
  };
});
for (const r of requirements) cases.find((c) => c.id === r.caseId)?.requirementIds.push(r.id);

const requirementVersions: RequirementVersion[] = requirements.map((r): RequirementVersion => ({
  requirementId: r.id,
  version: 1,
  snapshot: RequirementSnapshot.parse(r),
  cause: "draft",
  rationale: "First version, written before provenance tagging (tags added by hand)",
  createdAt: r.createdAt,
  createdBy: r.ownerId,
}));

// The replay hero has a real history: v1 matched the A6 e-tron, engineering feedback gave v2.
const feedback: FeedbackEntry[] = [];
{
  const hero = requirements.find((r) => r.id === heroStory.requirementId)!;
  const v1Parts = sentences(heroStory.v1.description);
  const v1 = RequirementSnapshot.parse({
    ...hero,
    title: heroStory.v1.title,
    description: heroStory.v1.description,
    descriptionParts: v1Parts,
    metrics: hero.metrics.map((m) => (m.targetSpec ? { ...m, target: heroStory.v1.target, targetSpec: { ...m.targetSpec, value: heroStory.v1.value } } : m)),
    assumptions: ["Next-generation cells arrive in time for SOP"],
    provenance: authoredProvenance(hero, v1Parts, requirementTags[hero.id], topSignals(hero.caseId)),
  });
  const first = requirementVersions.find((v) => v.requirementId === hero.id)!;
  Object.assign(first, { snapshot: v1, rationale: `Drafted from confirmed ${hero.caseId}: match the best competitor (Audi A6 e-tron)`, createdAt: heroStory.v1.at, createdBy: "agent:requirement_writer" });
  const fb = heroStory.feedback;
  requirementVersions.push({ requirementId: hero.id, version: 2, snapshot: RequirementSnapshot.parse(hero), cause: "feedback", feedbackId: fb.id, rationale: fb.pmRationale, createdAt: addDays(fb.at, 0.001), createdBy: hero.ownerId });
  hero.version = 2;
  feedback.push({ id: fb.id, requirementId: hero.id, from: fb.from, text: fb.text, response: fb.response, pmRationale: fb.pmRationale, signalIds: [], proposalId: null, resultingVersion: 2, createdAt: fb.at, createdBy: hero.ownerId });
}

// ---------- Source records (the raw text every quote must be found in) ----------
const sourceRecords: SourceRecord[] = [];
{
  const seen = new Set<string>();
  const add = (rec: Omit<SourceRecord, "sha256">) => {
    if (seen.has(rec.ref)) return;
    seen.add(rec.ref);
    sourceRecords.push({ ...rec, sha256: sha256(rec.text) });
  };
  const rowText = (row: Row) => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join("\n");
  for (const s of signals.values()) {
    if (!s.recordRef) continue;
    if (s.sourceType === "bmw_feedback") {
      const row = verbatimById.get(s.id);
      if (row) add({ ref: s.recordRef, sourceName: "feedback_verbatims.csv", text: rowText(row), fetchedAt: s.fetchedAt, synthetic: false });
    } else if (s.sourceType === "bmw_study") {
      const [file, key] = s.recordRef.split("#");
      const [attribute, a, b] = key.split("|");
      const row =
        file === "study_us_2025.csv"
          ? studyUs.find((r) => r.attribute === attribute && r.model === a)
          : studyCnEu.find((r) => r.attribute.trim() === attribute && r.market === a && r.model === b);
      if (row) add({ ref: s.recordRef, sourceName: file, text: rowText(row), fetchedAt: s.fetchedAt, synthetic: false });
    } else {
      add(webSnapshotRecord(s));
    }
  }
}

// ---------- Score snapshots: the case score as it was on a decision day ----------
const defaultProfile = weightProfiles.find((p) => p.id === "wp-balanced")!;
function weightsOn(at: string) {
  return at < balancedV1Change.at ? { ...defaultProfile.weights, [balancedV1Change.field]: balancedV1Change.before } : defaultProfile.weights;
}
function snapshotOf(caseId: string, at: string): ScoreSnapshot {
  const weights = weightsOn(at);
  const ranked = cases
    .filter((c) => c.state !== "observed" && !(c.state === "decided" && (c.outcome === "rejected" || c.outcome === "merged")))
    .map((c) => ({ c, ...caseScore(c, weights) }))
    .sort((a, b) => b.score - a.score);
  const i = ranked.findIndex((x) => x.c.id === caseId);
  const me = ranked[i];
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    caseId,
    profileId: defaultProfile.id,
    profileName: defaultProfile.name,
    profileVersion: at < balancedV1Change.at ? 1 : 2,
    weights,
    factors: me.c.factors,
    contributions: Object.fromEntries(Object.entries(me.contributions).map(([k, v]) => [k, r3(v)])) as ScoreSnapshot["contributions"],
    score: r3(me.score),
    rank: i + 1,
    of: ranked.length,
    at,
  };
}

// ---------- Series briefs (layer 1) ----------
const briefs: SeriesBrief[] = briefSpecs.map((spec): SeriesBrief => {
  const plan = plans.find((p) => p.series === spec.series);
  const weights = { EU: 0, US: 0, CN: 0, RoW: 0 };
  for (const m of ["EU", "US", "CN", "RoW"] as const) weights[m] = Math.round(share2030(spec.series, m) * 100) / 100;
  const at = spec.createdAt;
  const meta = (source: "data" | "brand" | "pm") => ({ source, confirmed: true, updatedAt: at, updatedBy: spec.ownerId });
  return {
    id: spec.id,
    series: spec.series,
    kind: "shared",
    region: "global",
    parentId: null,
    ownerId: spec.ownerId,
    values: {
      ...spec.values,
      marketWeights: weights,
      protectList: plan?.features.filter((f) => f.protected).map((f) => f.name) ?? [],
      givens: { ...spec.values.givens, sop: plan?.sop ?? "to confirm" },
    },
    meta: {
      thesis: meta("pm"),
      targetCustomer: meta("pm"),
      marketWeights: meta("data"),
      changeAmbition: meta("pm"),
      protectList: meta("data"),
      dontFightOn: meta(spec.inheritedFromBrand.includes("dontFightOn") ? "brand" : "pm"),
      givens: meta("pm"),
      costEnvelope: meta("pm"),
    },
    version: 1,
    createdAt: at,
    updatedAt: at,
    synthetic: true,
  };
});

// ---------- Clusters (theme map) ----------
const clusters: SignalCluster[] = [];
for (const c of cases) {
  const sigs = c.signalIds.map((id) => signals.get(id)!).filter(Boolean);
  const marketsCount: Record<string, number> = {};
  sigs.forEach((s) => (marketsCount[s.market] = (marketsCount[s.market] ?? 0) + 1));
  const sent = c.figures.perMarket.length ? c.figures.perMarket.reduce((s, m) => s + m.sentiment, 0) / c.figures.perMarket.length : 0;
  clusters.push({
    id: `CL-${c.id}`,
    label: c.featureName,
    series: c.series,
    carArea: c.carArea,
    size: sigs.length,
    sentiment: Math.round(sent * 100) / 100,
    markets: marketsCount,
    caseId: c.id,
    signalIds: c.signalIds,
  });
}
const unclustered = [...signals.values()].filter((s) => s.status === "unclustered");
const byHint = new Map<string, Signal[]>();
unclustered.forEach((s) => byHint.set(`${s.series}|${s.featureHint}`, [...(byHint.get(`${s.series}|${s.featureHint}`) ?? []), s]));
let clusterNo = 1;
for (const [key, sigs] of byHint) {
  const [series, hint] = key.split("|");
  const likes = sigs.filter((s) => s.kind === "like").length;
  const marketsCount: Record<string, number> = {};
  sigs.forEach((s) => (marketsCount[s.market] = (marketsCount[s.market] ?? 0) + 1));
  clusters.push({
    id: `CL-U-${String(clusterNo++).padStart(3, "0")}`,
    label: hint,
    series: series as Series,
    carArea: sigs[0].carArea,
    size: sigs.length,
    sentiment: Math.round(((likes - (sigs.length - likes)) / sigs.length) * 100) / 100,
    markets: marketsCount,
    caseId: null,
    signalIds: sigs.map((s) => s.id),
  });
}

// ---------- Agent runs ----------
const agentRuns: AgentRun[] = [];
const runAgents = ["competitor", "customer_public", "trends", "innovation_scout"] as const;
for (let d = 6; d >= 0; d--) {
  runAgents.forEach((agent, i) => {
    const start = addDays("2026-10-04T21:00:00Z", 6 - d).replace(/T21/, `T2${i}`);
    const valid = [6, 14, 3, 1][i] + ((d * 7 + i * 3) % 5);
    agentRuns.push({
      id: `RUN-${agent}-${String(7 - d).padStart(2, "0")}`,
      agent,
      series: "G60",
      startedAt: start,
      endedAt: addDays(start, 0.01),
      status: d === 2 && agent === "customer_public" ? "partial" : "ok",
      valid,
      rejected: (d + i) % 3,
      newSignals: Math.max(0, valid - 4),
      llmCostUsd: Math.round((0.4 + valid * 0.07) * 100) / 100,
      note: d === 2 && agent === "customer_public" ? "dongchedi.com returned 403 for 12 pages (login wall)" : undefined,
    });
  });
}
agentRuns.unshift({
  id: "RUN-bmw_data-import",
  agent: "bmw_data",
  series: "G60",
  startedAt: "2026-09-01T06:00:00Z",
  endedAt: "2026-09-01T06:04:00Z",
  status: "ok",
  valid: 10128,
  rejected: 0,
  newSignals: 10128,
  llmCostUsd: 0,
  note: "One-time import of feedback, study, sales and option lists (seed).",
});

// ---------- Proposals (one pending AI suggestion for the hero case) ----------
const hero = cases.find((c) => c.id === "CASE-G60-0001")!;
const heroAfter = hero.bodyMd.replace(
  "3. Software-only: 'favourites' widget pinned to the home screen (OTA)",
  "3. Software-only: 'favourites' widget pinned to the home screen (OTA)\n\n> Engineering (08.10.): 8 buttons fit the current centre stack; 6 if haptic feedback is added.",
);
const proposals: Proposal[] = [
  {
    id: "P-0001",
    objectType: "case",
    objectId: hero.id,
    source: "meeting_note",
    kind: "body",
    summary: "Add the engineering answer (8 buttons, 6 with haptics) to 'Options considered'",
    changes: [{ field: "bodyMd", before: hero.bodyMd, after: heroAfter }],
    questionId: "Q-0001",
    citations: ["Q-0001"],
    status: "pending",
    createdAt: "2026-10-08T10:01:00Z",
  },
];

// ---------- Chat messages ----------
const messages: ChatMessage[] = chatSeeds.map((m, i) => ({ ...m, id: `MSG-${String(i + 1).padStart(4, "0")}`, proposalIds: m.proposalIds ?? [] }));

// ---------- Audit history ----------
type Draft = Omit<AuditEvent, "seq">;
const audit: Draft[] = [];
const ai = (actorId: string): Pick<Draft, "actorId" | "actorType"> => ({ actorId, actorType: "ai" });
const human = (actorId: string): Pick<Draft, "actorId" | "actorType"> => ({ actorId, actorType: "human" });

audit.push({ at: "2026-09-01T06:04:00Z", ...ai("agent:importer"), action: "data.imported", objectType: "signal", objectId: "RUN-bmw_data-import", rationale: "Seed: feedback, study, sales, option lists" });
audit.push({ at: brandProfile.updatedAt, ...human("u-katrin"), action: "brand_profile.updated", objectType: "profile", objectId: "brand-profile", before: { version: 2 }, after: { version: 3 }, rationale: "Added 'honest sportiness' and the 'don't fight every attribute' rule" });

for (const b of briefs) {
  audit.push({ at: b.createdAt, ...human(b.ownerId), action: "brief.created", objectType: "brief", objectId: b.id, after: { series: b.series, kind: b.kind }, rationale: "Onboarding: series brief confirmed" });
}
for (const c of cases) {
  for (const s of c.stances) {
    audit.push({ at: s.updatedAt, ...human(s.authorId), action: "case.stance_saved", objectType: "case", objectId: c.id, after: { ambition: s.ambition, overrides: Object.keys(s.overrides) }, rationale: Object.values(s.overrideReasons)[0] ?? "Stance saved" });
  }
}

const statePath: CaseState[] = ["new", "investigating", "awaiting_answers", "ready"];
for (const c of cases) {
  const isAgent = c.createdBy.startsWith("agent:");
  audit.push({ at: c.createdAt, ...(isAgent ? ai(c.createdBy) : human(c.createdBy)), action: "case.created", objectType: "case", objectId: c.id, after: { title: c.title, signals: c.signalIds.length }, rationale: isAgent ? "Open threshold reached" : "Opened by hand" });
  if (isAgent) audit.push({ at: addDays(c.createdAt, 0.01), ...ai("agent:scorer"), action: "case.scored", objectType: "case", objectId: c.id, after: c.factors });
  if (c.state === "observed") continue;
  const target = c.state === "decided" ? statePath.length : statePath.indexOf(c.state) + 1;
  const end = c.updatedAt;
  for (let i = 1; i < target; i++) {
    audit.push({
      at: between(c.createdAt, end, i / (target + 1)),
      ...human(c.ownerId),
      action: "case.state_changed",
      objectType: "case",
      objectId: c.id,
      before: { state: statePath[i - 1] },
      after: { state: statePath[i] },
      rationale: ["Evidence looks relevant", "Open questions sent", "Answers in, ready to decide"][i - 1],
    });
  }
  if (c.state === "decided") {
    audit.push({
      at: end,
      ...human(c.ownerId),
      action: "case.decided",
      objectType: "case",
      objectId: c.id,
      before: { state: "ready" },
      after: { state: "decided", outcome: c.outcome },
      rationale: c.outcomeNote ?? "Decided",
      scoreSnapshot: c.outcome === "confirmed" ? snapshotOf(c.id, end) : undefined,
    });
  }
}

audit.push({
  at: balancedV1Change.at,
  ...human("u-katrin"),
  action: "weight_profile.updated",
  objectType: "profile",
  objectId: defaultProfile.id,
  before: { [balancedV1Change.field]: balancedV1Change.before, version: 1 },
  after: { [balancedV1Change.field]: balancedV1Change.after, version: 2 },
  rationale: balancedV1Change.rationale,
});

const reqPath: RequirementStatus[] = ["draft", "in_discussion", "pm_approved", "signed_off", "planned", "exported"];
const reqCase = (r: Requirement) => cases.find((c) => c.id === r.caseId)!;
for (const r of requirements) {
  const isHero = r.id === heroStory.requirementId;
  audit.push({
    at: isHero ? heroStory.v1.at : r.createdAt,
    ...ai("agent:requirement_writer"),
    action: "requirement.drafted",
    objectType: "requirement",
    objectId: r.id,
    after: { title: isHero ? heroStory.v1.title : r.title, version: 1 },
    rationale: `Generated from confirmed ${r.caseId}`,
  });
  if (isHero) {
    const fb = heroStory.feedback;
    audit.push({ at: addDays(heroStory.v1.at, 0.001), ...human(r.ownerId), action: "requirement.shape_answered", objectType: "requirement", objectId: r.id, after: { benchmark: "match" }, rationale: "Benchmark: match the best competitor (Audi A6 e-tron)" });
    audit.push({ at: fb.at, ...human(r.ownerId), action: "requirement.feedback_recorded", objectType: "requirement", objectId: r.id, after: { feedbackId: fb.id, from: fb.from, response: fb.response, text: fb.text }, rationale: fb.pmRationale });
    audit.push({ at: addDays(fb.at, 0.001), ...human(r.ownerId), action: "requirement.version_created", objectType: "requirement", objectId: r.id, before: { version: 1, target: heroStory.v1.target }, after: { version: 2, target: r.metrics[0].target, cause: "feedback" }, rationale: "Engineering feedback accepted: 760 → 690 km WLTP" });
  }
  const idx = reqPath.indexOf(r.status);
  const at = (i: number) => (isHero ? ({ 1: "2026-09-15T10:00:00Z", 2: "2026-09-22T10:00:00Z", 3: r.updatedAt } as Record<number, string>)[i] : between(r.createdAt, r.updatedAt, i / (idx + 1)));
  for (let i = 1; i <= idx; i++) {
    const actor = reqPath[i] === "signed_off" ? "u-katrin" : r.ownerId;
    audit.push({
      at: at(i),
      ...human(actor),
      action: "requirement.status_changed",
      objectType: "requirement",
      objectId: r.id,
      before: { status: reqPath[i - 1] },
      after: { status: reqPath[i] },
      rationale: (isHero ? heroStory.rationales[reqPath[i]] : undefined) ?? ["Discussed with engineering", "Targets agreed", "Fits the product line plan", "Added to vehicle plan", "Exported"][i - 1],
      scoreSnapshot: reqPath[i] === "signed_off" ? snapshotOf(reqCase(r).id, at(i)) : undefined,
    });
  }
}
audit.push({ at: "2026-09-25T10:00:00Z", ...human("u-lena"), action: "requirement.edited", objectType: "requirement", objectId: "REQ-G60-0004", before: { metrics: [{ id: "m1", target: "≥ 90%" }] }, after: { metrics: [{ id: "m1", target: "≥ 95%" }] }, rationale: "Quality baseline is 72%; 90% would not remove the complaints" });

for (const q of questions.filter((q) => q.status === "answered")) {
  audit.push({ at: q.answeredAt!, ...human(q.askedBy), action: "question.answered", objectType: "question", objectId: q.id, after: { answer: q.answer }, rationale: `Answer from ${q.answerSource}` });
}
for (const a of alerts) {
  audit.push({ at: a.createdAt, ...ai("agent:monitor"), action: "alert.raised", objectType: a.requirementId ? "requirement" : "case", objectId: a.requirementId ?? a.caseId!, after: { verdict: a.verdict, title: a.title } });
  if (a.status !== "open") audit.push({ at: addDays(a.createdAt, 0.2), ...human(a.ownerId), action: `alert.${a.status}`, objectType: "case", objectId: a.caseId!, rationale: a.resolution });
}
for (const r of referrals) {
  audit.push({ at: r.createdAt, ...human(r.fromUserId), action: `${r.kind}.created`, objectType: "case", objectId: r.caseId, after: { to: r.toUserId }, rationale: r.note });
  if (r.status === "accepted") audit.push({ at: r.decidedAt!, ...human(r.toUserId), action: "referral.accepted", objectType: "case", objectId: r.caseId, after: { linkedCaseId: r.linkedCaseId }, rationale: "Shared module" });
}
for (const p of proposals) {
  audit.push({ at: p.createdAt, ...ai("agent:note_extractor"), action: "proposal.created", objectType: p.objectType, objectId: p.objectId, rationale: p.summary });
}

const sortedAudit: AuditEvent[] = audit
  .sort((a, b) => a.at.localeCompare(b.at))
  .map((e, i) => ({ ...e, seq: i + 1 }));

// ---------- Validate and write ----------
const dataset = {
  generatedAt: NOW,
  users,
  workspaces,
  weightProfiles,
  brandProfile,
  signals: [...signals.values()],
  clusters,
  agentRuns,
  quarantine,
  cases,
  questions,
  meetingNotes: [],
  proposals,
  requirements,
  referrals,
  innovation,
  plans,
  messages,
  comments,
  notifications,
  alerts,
  briefs,
  requirementVersions,
  feedback,
  sourceRecords,
  conversions,
  ripples: [],
  rippleMutes: [],
  monitorSettings,
  audit: sortedAudit,
};

const parsed = Dataset.safeParse(dataset);
if (!parsed.success) {
  console.error("Seed failed contract validation:");
  for (const issue of parsed.error.issues.slice(0, 30)) console.error(" -", issue.path.join("."), issue.message);
  process.exit(1);
}

// Referential checks the schema cannot express.
const caseIds = new Set(cases.map((c) => c.id));
const problems: string[] = [];
for (const s of signals.values()) if (s.caseId && !caseIds.has(s.caseId)) problems.push(`signal ${s.id} → unknown case ${s.caseId}`);
for (const a of alerts) for (const id of a.signalIds) if (!signals.has(id)) problems.push(`alert ${a.id} → unknown signal ${id}`);
for (const r of referrals) if (!caseIds.has(r.caseId)) problems.push(`referral ${r.id} → unknown case`);
for (const m of innovation) if (!caseIds.has(m.caseId)) problems.push(`innovation → unknown case ${m.caseId}`);
for (const q of questions) if (q.objectType === "case" && !caseIds.has(q.objectId)) problems.push(`question ${q.id} → unknown case`);
for (const c of cases) if (c.signalIds.length === 0 && c.state !== "observed") problems.push(`case ${c.id} has no signals`);
if (problems.length) {
  console.error("Referential problems:\n - " + problems.join("\n - "));
  process.exit(1);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(parsed.data, null, 1));

// Slim taxonomy for the mock /taxonomy endpoint (the backend serves it from its TOPIC table).
const taxonomyPayload = TaxonomyResponse.parse({
  version: taxonomy.version,
  carAreas: taxonomy.car_areas.map((a) => ({ id: a.id, label: a.label, description: a.description })),
  topics: taxonomy.topics.map((t) => ({ id: t.id, label: t.label, shortLabel: shortLabel(t.id, t.label), carArea: t.car_area, hint: t.hint })),
  aspectGroups: taxonomy.aspect_groups,
});
writeFileSync(taxonomyOut, JSON.stringify(taxonomyPayload, null, 1));
const untagged = [...signals.values()].filter((s) => !s.topicId && s.kind !== "competitor_fact").length;
const real = [...signals.values()].filter((s) => !s.synthetic).length;
console.log(
  `seed.json written: ${cases.length} cases, ${signals.size} signals (${real} real BMW records, ${signals.size - real} synthetic), ${requirements.length} requirements, ${sortedAudit.length} audit events; taxonomy ${taxonomy.version}, ${untagged} signals without topic`,
);
