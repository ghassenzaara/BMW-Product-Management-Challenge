"""Case pipeline: python -m app.cases.pipeline [--initial]

LLM classification of signals without a topic -> grouping by topic + aspect
group (initial or incremental) -> figures -> tags ->
conflict flag -> open rules. One agent_run per run; every write audited.
"""

from __future__ import annotations

import argparse
import json

from app import audit, db
from app.cases import cluster, feature_link, figures, lifecycle, tags
from app.signals import reclassify

ACTOR = "agent:cases"
WRITE_BATCH = 25  # cases per write transaction


def thresholds_for(conn, vehicle: str | None = None) -> dict:
    """Thresholds of the vehicle's configs (the strictest open minimum wins when they differ)."""
    rows = conn.execute("select thresholds from config where active" + (" and vehicle = %s" if vehicle else ""),
                        (vehicle,) if vehicle else ()).fetchall()
    merged: dict = {}
    for r in rows:
        for k, v in (r["thresholds"] or {}).items():
            if k in ("open_min_customers", "open_min_defects", "open_min_web_signals"):
                merged[k] = max(merged.get(k, 0), v)
            else:
                merged.setdefault(k, v)
    return merged


def update_case(conn, case_id: str, *, run_id=None, brand_profile: str = "", fig: dict | None = None) -> dict:
    th = thresholds_for(conn)
    fig = fig or figures.compute(conn, case_id, reach_cap=int(th.get("reach_cap", 100000)))
    audit.update(conn, "case_item", {"id": case_id}, {"figures": fig}, actor=ACTOR, run_id=run_id,
                 rationale="case figures recomputed")
    case = conn.execute("select * from case_item where id = %s", (case_id,)).fetchone()
    feature = conn.execute("select name, car_area from feature where id = %s", (case["feature_id"],)).fetchone()
    opened = 0
    for cv in conn.execute("select * from case_vehicle where case_id = %s", (case_id,)).fetchall():
        v = cv["vehicle"]
        vth = thresholds_for(conn, v) or th
        vf = fig["by_vehicle"].get(v, {})
        is_conflict, why = figures.conflict(vf.get("markets", {}), int(vth.get("conflict_min_customers", 5)),
                                            float(vth.get("conflict_negative_share", 0.6)))
        changes = {}
        if is_conflict != cv["market_conflict"]:
            changes["market_conflict"] = is_conflict
        if cv["release_fit_source"] != "pm":
            t = tags.propose(case, feature, fig, v, brand_profile)
            changes.update(release_fit=t["release_fit"], release_fit_reason=t["release_fit_reason"],
                           release_fit_source="ai")
            case_changes = {}
            if case["segment_source"] != "pm":
                case_changes.update(segment=t["segment"], segment_source="ai")
            if case["brand_fit_source"] != "pm" and t["brand_fit"]:
                case_changes.update(brand_fit=t["brand_fit"], brand_fit_source="ai",
                                    brand_fit_reason=t["brand_fit_reason"])
            for tag in ("case_type", "change_depth"):
                if case[f"{tag}_source"] != "pm" and t.get(tag):
                    case_changes.update({tag: t[tag], f"{tag}_source": "ai"})
            if case_changes:
                case = audit.update(conn, "case_item", {"id": case_id}, case_changes, actor=ACTOR, run_id=run_id,
                                    rationale=f"tags proposed ({t['source']})")
        if changes:
            audit.update(conn, "case_vehicle", {"case_id": case_id, "vehicle": v}, changes, actor=ACTOR,
                         run_id=run_id, rationale=why or "release fit proposed")
        if is_conflict and not cv["market_conflict"]:
            audit.insert(conn, "notification", {
                "type": "market_conflict", "object_type": "case", "object_id": case_id, "vehicle": v,
                "message": f"{case_id} ({v}): market conflict. {why}",
            }, actor=ACTOR, run_id=run_id)
        opened += lifecycle.evaluate(conn, case_id, v, vf, vth, run_id=run_id)
    return {"opened": opened}


def run(initial: bool = False) -> dict:
    """One pipeline run. The LLM never works inside a database transaction: each
    stage reads what it needs, closes the transaction, lets the LLM calls run in
    parallel into the disk cache, then writes in a short transaction that only
    reads the cache. A dropped connection or a crash loses one stage at most, and
    a re-run pays for no LLM call twice."""
    with db.transaction() as conn:
        run_id = conn.execute("insert into agent_run (agent, mode) values (%s, %s) returning id",
                              (ACTOR, "backfill" if initial else "incremental")).fetchone()["id"]
    try:
        result = _stages(initial, run_id)
    except Exception as exc:
        with db.transaction() as conn:
            conn.execute("update agent_run set status = 'failed', ended_at = now(), error = %s where id = %s",
                         (repr(exc)[:2000], run_id))
        raise
    with db.transaction() as conn:
        conn.execute("update agent_run set status = 'ok', ended_at = now(), params = %s where id = %s",
                     (json.dumps(result, default=str), run_id))
    return result


def _stages(initial: bool, run_id) -> dict:
    # 1. Signals that still have no topic go through the LLM classifier (closed lists). Without an
    #    OpenAI key they wait: a topic is never guessed.
    with db.transaction() as conn:
        waiting = reclassify.pending(conn)
    reclassify.prefetch(waiting)
    with db.transaction() as conn:
        th = thresholds_for(conn)
        classified = reclassify.run(conn)
        sim = feature_link.threshold(th, "similarity_case", 0.55)
        split_min = int(th.get("case_split_min_signals", cluster.SPLIT_MIN))

    # 2. Grouping. The pages of the new cases are written in parallel first (cached).
    if initial:
        with db.transaction() as conn:
            planned = cluster.plan_initial(conn, sim, split_min=split_min, thresholds=th)
        cluster.writer.prefetch(planned)
    else:
        with db.transaction() as conn:
            planned = cluster.plan_incremental(conn, thresholds=th)
        cluster.writer.prefetch(planned)
    with db.transaction() as conn:
        if initial:
            grouped = cluster.initial(conn, sim, run_id=run_id, split_min=split_min, thresholds=th)
        else:
            grouped = cluster.incremental(conn, sim, run_id=run_id, thresholds=th)

    # 3. Figures, then the AI tags of every case and line in parallel (cached), then the writes.
    with db.transaction() as conn:
        profile = conn.execute("select body_md from brand_profile order by version desc limit 1").fetchone()
        brand = profile["body_md"] if profile else ""
        # Cases this run touched, and cases a failed earlier run left without figures.
        touched = [r["id"] for r in conn.execute(
            "select c.id from case_item c where c.figures = '{}'::jsonb"
            " and exists (select 1 from signal s where s.case_id = c.id)"
            " union select distinct s.case_id from signal s where s.case_id is not null"
            " and s.updated_at >= (select started_at from agent_run where id = %s) order by 1",
            (run_id,)).fetchall()]
        figs = {cid: figures.compute(conn, cid, reach_cap=int(th.get("reach_cap", 100000))) for cid in touched}
        jobs = []
        for cid in touched:
            case = conn.execute("select * from case_item where id = %s", (cid,)).fetchone()
            feature = conn.execute("select name, car_area from feature where id = %s", (case["feature_id"],)).fetchone()
            for cv in conn.execute("select vehicle, release_fit_source from case_vehicle where case_id = %s",
                                   (cid,)).fetchall():
                if cv["release_fit_source"] != "pm":
                    jobs.append((case, feature, figs[cid], cv["vehicle"], brand))
    tags.prefetch(jobs)
    # Written in small transactions: one long transaction over all cases (an hour of round
    # trips on a remote database) was closed by the server and lost everything. A case whose
    # batch did not commit still has empty figures, so the next run picks it up again.
    opened = 0
    for i in range(0, len(touched), WRITE_BATCH):
        with db.transaction() as conn:
            for cid in touched[i : i + WRITE_BATCH]:
                opened += update_case(conn, cid, run_id=run_id, brand_profile=brand, fig=figs[cid])["opened"]
    return {"classify": classified, "cluster": grouped, "cases_updated": len(touched), "opened": opened,
            "provider": feature_link.provider_key(), "similarity_case": sim}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--initial", action="store_true", help="cluster all unassigned signals from scratch")
    print(run(parser.parse_args().initial))
