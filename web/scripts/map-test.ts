/**
 * Unit tests for the adapter's vocabulary mapping (src/backend/map.ts).
 * Run: npm run map-test
 */
import assert from "node:assert/strict";
import { Market, ReleaseTarget, RequirementStatus } from "../src/contracts";
import {
  agentFromBackend,
  sourceTypeFromBackend,
  trustFromBackend,
  brandFitFromBackend,
  brandFitToBackend,
  evidenceFromBackend,
  evidenceToBackend,
  marketFromBackend,
  marketToBackend,
  regionFromRequirementMarket,
  releaseFromBackend,
  releaseToBackend,
  requirementStatusFromBackend,
  rewriteCitations,
  weightsFromBackend,
  weightsToBackend,
} from "../src/backend/map";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

t("market round trip", () => {
  for (const m of Market.options) assert.equal(marketFromBackend(marketToBackend(m)), m);
  assert.equal(marketToBackend("RoW"), "Rest of World");
  assert.equal(marketFromBackend("Mars"), "unknown");
});

t("release round trip", () => {
  for (const r of ReleaseTarget.options) assert.equal(releaseFromBackend(releaseToBackend(r)), r);
  assert.equal(releaseToBackend("lci"), "current_car");
});

t("evidence level", () => {
  for (const e of ["bmw_data", "web", "assumption"]) assert.equal(evidenceToBackend(evidenceFromBackend(e)), e);
});

t("requirement scope", () => {
  assert.equal(regionFromRequirementMarket(null), "global");
  assert.equal(regionFromRequirementMarket("China"), "CN");
  assert.equal(regionFromRequirementMarket("USA"), "RoW");
});

t("requirement status with sign-off layer", () => {
  assert.equal(requirementStatusFromBackend("approved"), "pm_approved");
  assert.equal(requirementStatusFromBackend("signed_off"), "signed_off");
  assert.equal(requirementStatusFromBackend("in_discussion"), "in_discussion");
  for (const s of ["draft", "in_discussion", "approved", "rejected"]) assert.ok(RequirementStatus.options.includes(requirementStatusFromBackend(s)));
});

t("weights keep reach and drop brand_fit", () => {
  const backend = { distinct_customers: 0.25, severity: 0.2, satisfaction_gap: 0.15, competitor_gap: 0.15, market_volume: 0.1, removed_vs_predecessor: 0.05, reach: 0.05, trend: 0.05 };
  const ui = weightsFromBackend(backend);
  assert.equal(ui.customers, 0.25);
  assert.equal(ui.regression, 0.05);
  assert.equal(ui.brand_fit, 0);
  const back = weightsToBackend({ ...ui, customers: 0.4, brand_fit: 1 }, backend);
  assert.equal(back.distinct_customers, 0.4);
  assert.equal(back.reach, 0.05);
  assert.equal("brand_fit" in back, false);
});

t("brand fit tag round trip", () => {
  for (const tag of ["fits", "neutral", "off_brand"]) assert.equal(brandFitToBackend(brandFitFromBackend(tag)), tag);
});

t("citations", () => {
  assert.equal(rewriteCitations("see [signal:0a1b2c3d-0000-4000-8000-000000000001]."), "see [0a1b2c3d-0000-4000-8000-000000000001].");
});

t("evidence a PM added by hand", () => {
  for (const [source, type, trust] of [["pm_upload", "pm_upload", "C"], ["pm_link", "pm_link", "D"], ["pm_note", "pm_note", "E"]] as const) {
    assert.equal(agentFromBackend("market", source, "complaint"), "pm");
    assert.equal(sourceTypeFromBackend(source, null), type);
    assert.equal(trustFromBackend(source, null), trust);
  }
  assert.equal(agentFromBackend("bmw_customer", "bmw_feedback", "complaint"), "bmw_data");
});

console.log(`${n} map tests passed`);
