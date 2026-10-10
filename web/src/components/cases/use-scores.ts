"use client";

import { useMemo } from "react";
import type { FactorKey, Series } from "@/contracts";
import { useApi } from "@/lib/api/hooks";

/** Ranking of cases and requirements under my workspace's weight profile (or a what-if). */
export function useScores(series?: Series, whatIf?: Partial<Record<FactorKey, number>> | null) {
  const saved = useApi("scores", { query: { series } });
  const preview = useApi("previewScores", { body: { weights: whatIf ?? {}, series } }, { enabled: !!whatIf });
  const active = whatIf ? (preview.data ?? saved.data) : saved.data;
  return useMemo(() => {
    const cases = new Map((active?.cases ?? []).map((s) => [s.caseId, s]));
    const savedCases = new Map((saved.data?.cases ?? []).map((s) => [s.caseId, s]));
    const reqs = new Map((active?.requirements ?? []).map((s) => [s.requirementId, s]));
    return { data: active, saved: saved.data, cases, savedCases, reqs, loading: saved.isLoading };
  }, [active, saved.data, saved.isLoading]);
}
