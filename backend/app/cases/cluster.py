"""Group signals into cases: one case per topic and aspect group.

Initial run: signals are grouped by topic + aspect group, across all BMW lines
(a case can span lines). The aspect groups are neutral, so likes and complaints
about the same aspect land in one case. Only a large group (``split_min``
signals or more) is split further, by average-linkage agglomerative clustering
on the signal embeddings (cosine). Grouping never crosses a topic boundary.
Incremental run: a new signal joins the case of its topic + aspect group; if
that group was split into several cases it joins the most similar one when the
similarity to the case centroid reaches the threshold, else it opens a new
observed case. Case IDs never change; merges and splits go to case_lineage.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from app import audit
from app.cases import writer
from app.llm.embeddings import as_matrix

ACTOR = "agent:cases"
CLUSTER_KINDS = ("complaint", "wish", "like", "competitor_fact", "trend", "innovation")
SPLIT_MIN = 50


def _unit(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    return v / n if n else v


def cluster_labels(vectors: np.ndarray, min_similarity: float) -> np.ndarray:
    if len(vectors) == 1:
        return np.zeros(1, dtype=int)
    model = AgglomerativeClustering(n_clusters=None, metric="cosine", linkage="average",
                                    distance_threshold=1.0 - min_similarity)
    return model.fit_predict(vectors)


def group_labels(vectors: np.ndarray, min_similarity: float, split_min: int = SPLIT_MIN) -> np.ndarray:
    """One case for a topic + aspect group; similarity split only inside large groups."""
    if len(vectors) < split_min:
        return np.zeros(len(vectors), dtype=int)
    return cluster_labels(vectors, min_similarity)


def viable(members: list[dict], thresholds: dict) -> bool:
    """Is this group of signals worth a case? The same bar as the opening rule
    (lifecycle.open_reason), read from the signals: for one BMW line, enough distinct
    customers who complain or wish for something, or enough customers reporting a
    defect; or evidence from a competitor (a possible competitor gap). A group below
    the bar becomes no case: nothing is written, tagged or stored for it, and its
    signals wait without a case until the group grows."""
    from app.cases.lifecycle import OPEN_MIN_CUSTOMERS, OPEN_MIN_DEFECTS

    min_customers = int(thresholds.get("open_min_customers", OPEN_MIN_CUSTOMERS))
    min_defects = int(thresholds.get("open_min_defects", OPEN_MIN_DEFECTS))
    if any(m["evidence_role"] == "competitor" and m["kind"] in ("like", "competitor_fact") for m in members):
        # Competitor evidence alone opens a case only with enough web signals behind it
        # (``open_min_web_signals``, a PM setting; 0 = one competitor signal is enough).
        if sum(1 for m in members if m.get("web")) >= int(thresholds.get("open_min_web_signals", 0)):
            return True
    for vehicle in {m["vehicle"] for m in members if m["vehicle"]}:
        own = [m for m in members if m["evidence_role"] == "bmw_customer" and m["vehicle"] in (vehicle, None)]
        negative = sum(1 for m in own if m["kind"] in ("complaint", "wish"))
        likes = sum(1 for m in own if m["kind"] == "like")
        if len({m["customer_ref"] for m in own}) >= min_customers and negative >= likes:
            return True
        if len({m["customer_ref"] for m in own if m["severity"] == "defect"}) >= min_defects:
            return True
    return False


def _thresholds(conn, thresholds: dict | None) -> dict:
    if thresholds is not None:
        return thresholds
    from app.cases.pipeline import thresholds_for

    return thresholds_for(conn)


def _label(feature: str, aspect_group: str | None) -> str:
    return f"{feature} ({aspect_group})" if aspect_group else feature


def _signals_for(conn, feature_id=None, unassigned_only=True, with_embedding=True) -> list[dict]:
    # The fallback topic "other" waits in the taxonomy review queue and is never clustered.
    where = ["s.validation = 'valid'", "s.scope_tag = 'in_scope'", "s.feature_id is not null",
             "s.embedding is not null", "f.topic_id is distinct from 'other'"]
    params: list = []
    if unassigned_only:
        where.append("s.case_id is null")
    if feature_id:
        where.append("s.feature_id = %s")
        params.append(feature_id)
    return conn.execute(
        "select s.id, s.feature_id, s.kind, s.severity, s.market, s.vehicle, s.customer_ref, s.evidence_role,"
        f" s.quote, {'s.embedding' if with_embedding else 'null as embedding'}, s.aspect_group, f.name as feature,"
        " coalesce((select r.source_id <> 'bmw_feedback' from source_record r where r.record_id = s.record_id),"
        " false) as web"
        " from signal s join feature f on f.id = s.feature_id"
        f" where {' and '.join(where)} order by s.feature_id, s.aspect_group, s.id",
        params,
    ).fetchall()


def create_case(conn, feature_id, feature_name: str, members: list[dict], *, aspect_group: str | None = None,
                run_id=None, rationale: str = "new cluster of signals") -> dict:
    text, model, prompt_version = writer.write(_label(feature_name, aspect_group), members)
    centroid = _unit(np.mean(as_matrix([m["embedding"] for m in members]), axis=0))
    case = audit.insert(conn, "case_item", {
        "feature_id": feature_id, "aspect_group": aspect_group, "title": text.title, "body_md": text.body_md,
        "short_title": text.short_title, "summary": text.summary, "highlights": text.highlights,
        "embedding": centroid,
        "created_by": ACTOR, "tags": [],
    }, actor=ACTOR, run_id=run_id, rationale=f"{rationale} ({prompt_version}{', ' + model if model else ''})")
    audit.insert(conn, "page_version", {"object_type": "case", "object_id": case["id"], "version": 1,
                                        "body_md": text.body_md, "author": ACTOR},
                 actor=ACTOR, key=("object_type", "object_id", "version"), run_id=run_id)
    assign(conn, case["id"], members, run_id=run_id, rationale=rationale)
    return case


def assign(conn, case_id: str, members: list[dict], *, run_id=None, rationale: str) -> None:
    audit.update_many(conn, "signal", [({"id": m["id"]}, {"case_id": case_id}) for m in members],
                      actor=ACTOR, run_id=run_id, rationale=f"assigned to {case_id}: {rationale}")
    vehicles = sorted({m["vehicle"] for m in members if m["vehicle"]})
    existing = {r["vehicle"] for r in conn.execute(
        "select vehicle from case_vehicle where case_id = %s", (case_id,)).fetchall()}
    new_rows = [{"case_id": case_id, "vehicle": v, "state": "observed", "opened_by": None}
                for v in vehicles if v not in existing]
    if new_rows:
        audit.insert_many(conn, "case_vehicle", new_rows, actor=ACTOR, key=("case_id", "vehicle"), run_id=run_id,
                          rationale="case applies to this BMW line (signals from it)")
    # New evidence on a confirmed case only raises the flag; the case never changes by itself.
    for v in vehicles:
        cv = conn.execute("select state, flag_new_evidence from case_vehicle where case_id = %s and vehicle = %s",
                          (case_id, v)).fetchone()
        if cv and cv["state"] == "confirmed":
            n = sum(1 for m in members if m["vehicle"] == v)
            audit.update(conn, "case_vehicle", {"case_id": case_id, "vehicle": v},
                         {"flag_new_evidence": cv["flag_new_evidence"] + n}, actor=ACTOR, run_id=run_id,
                         rationale=f"+{n} signals since confirmation")
            audit.insert(conn, "notification", {
                "type": "new_evidence", "object_type": "case", "object_id": case_id, "vehicle": v,
                "message": f"{case_id}: +{n} new signals since confirmation",
            }, actor=ACTOR, run_id=run_id)
            rivals = [m for m in members if m.get("evidence_role") == "competitor"
                      and m.get("kind") in ("like", "competitor_fact") and m.get("vehicle") in (v, None)]
            if rivals:
                from app.collab import casework

                casework.raise_alert(
                    conn, case_id, v, "raises_the_bar",
                    f"{len(rivals)} new competitor signal{'s' if len(rivals) != 1 else ''} on {case_id}",
                    " ".join((m.get("quote") or "").split())[:300], [m["id"] for m in rivals], run_id=run_id)


def plan_initial(conn, min_similarity: float, *, split_min: int = SPLIT_MIN,
                 thresholds: dict | None = None) -> list[tuple[str, list[dict]]]:
    """The groups ``initial`` will turn into cases, as (label, signals): read-only,
    so their pages can be written by the LLM before the write transaction opens."""
    thresholds = _thresholds(conn, thresholds)
    by_group: dict = defaultdict(list)
    for r in _signals_for(conn):
        by_group[(r["feature_id"], r["feature"], r["aspect_group"])].append(r)
    out = []
    for (_, feature_name, aspect), members in by_group.items():
        labels = group_labels(as_matrix([m["embedding"] for m in members]), min_similarity, split_min)
        groups: dict[int, list[dict]] = defaultdict(list)
        for m, label in zip(members, labels):
            groups[int(label)].append(m)
        out += [(_label(feature_name, aspect), g) for g in groups.values() if viable(g, thresholds)]
    return out


def initial(conn, min_similarity: float, *, split_min: int = SPLIT_MIN, run_id=None,
            thresholds: dict | None = None) -> dict:
    """Group all unassigned signals by topic + aspect group; split only large groups.
    Only groups above the bar (``viable``) become cases."""
    thresholds = _thresholds(conn, thresholds)
    below = waiting = 0
    rows = _signals_for(conn)
    by_group: dict = defaultdict(list)
    for r in rows:
        by_group[(r["feature_id"], r["feature"], r["aspect_group"])].append(r)
    created = split_groups = 0
    planned = []
    for (feature_id, feature_name, aspect), members in by_group.items():
        vectors = as_matrix([m["embedding"] for m in members])
        labels = group_labels(vectors, min_similarity, split_min)
        groups: dict[int, list[dict]] = defaultdict(list)
        for m, label in zip(members, labels):
            groups[int(label)].append(m)
        why = f"topic + aspect group {_label(feature_name, aspect)}"
        if len(members) >= split_min:
            split_groups += 1
            why += f", large group split by cosine >= {min_similarity:.2f}"
        for group in sorted(groups.values(), key=len, reverse=True):
            if not viable(group, thresholds):
                below += 1
                waiting += len(group)
                continue
            planned.append((feature_id, feature_name, aspect, group, why))
    # Case pages are written in parallel first (cached); creating the cases then reads the cache.
    writer.prefetch([(_label(name, aspect), group) for _, name, aspect, group, _ in planned])
    for feature_id, feature_name, aspect, group, why in planned:
        create_case(conn, feature_id, feature_name, group, aspect_group=aspect, run_id=run_id, rationale=why)
        created += 1
    return {"signals": len(rows), "groups": len(by_group), "split_groups": split_groups, "cases": created,
            "groups_below_the_bar": below, "signals_without_a_case": waiting}


def _load_embeddings(conn, rows: list[dict], size: int = 500) -> None:
    """Fill the embedding of these signals, a few hundred per query (thousands of vectors in one
    answer are too much for a remote connection)."""
    todo = [r for r in rows if r["embedding"] is None]
    by_id = {r["id"]: r for r in todo}
    for i in range(0, len(todo), size):
        for e in conn.execute("select id, embedding from signal where id = any(%s)",
                              ([r["id"] for r in todo[i:i + size]],)).fetchall():
            by_id[e["id"]]["embedding"] = e["embedding"]


def _live_cases(conn) -> dict:
    """Centroids of the cases that still hold signals (a merged case holds none), per topic + aspect group."""
    known: dict = defaultdict(list)
    for c in conn.execute(
            "select c.id, c.feature_id, c.aspect_group, c.embedding from case_item c where c.embedding is not null"
            " and exists (select 1 from signal s where s.case_id = c.id) order by c.id").fetchall():
        known[(c["feature_id"], c["aspect_group"])].append((c["id"], _unit(as_matrix([c["embedding"]])[0])))
    return known


def plan_incremental(conn, thresholds: dict | None = None) -> list[tuple[str, list[dict]]]:
    """(label, signals) of the cases ``incremental`` will create for groups that have no case yet,
    so their pages can be written before the write transaction opens."""
    thresholds = _thresholds(conn, thresholds)
    known = _live_cases(conn)
    pools: dict = defaultdict(list)
    for r in _signals_for(conn, with_embedding=False):
        pools[(r["feature_id"], r["aspect_group"])].append(r)
    return [(_label(pool[0]["feature"], key[1]), pool) for key, pool in pools.items()
            if key not in known and viable(pool, thresholds)]


def incremental(conn, min_similarity: float, *, run_id=None, thresholds: dict | None = None) -> dict:
    """Attach new signals to the case of their topic + aspect group. Signals whose
    group has no case yet wait; once the waiting signals of a group pass the bar
    (``viable``) they become a case together."""
    thresholds = _thresholds(conn, thresholds)
    rows = _signals_for(conn, with_embedding=False)
    known = _live_cases(conn)  # compared in memory: one query per signal is too slow on a remote database
    created = 0
    done: set = set()
    joins: dict = defaultdict(list)  # (case id, rationale) -> signals
    pools: dict = defaultdict(list)
    for r in rows:
        pools[(r["feature_id"], r["aspect_group"])].append(r)
    # A vector is only needed to choose between several cases, or to give a new case its centroid.
    _load_embeddings(conn, [r for key, pool in pools.items() for r in pool
                            if len(known.get(key, [])) > 1 or (key not in known and viable(pool, thresholds))])
    for r in rows:
        if r["id"] in done:
            continue
        key = (r["feature_id"], r["aspect_group"])
        cases = [(1.0, known[key][0][0])] if len(known[key]) == 1 else sorted(
            ((float(_unit(as_matrix([r["embedding"]])[0]) @ centroid), cid) for cid, centroid in known[key]),
            reverse=True)[:2]
        if len(cases) == 1:
            joins[(cases[0][1], "case of the same topic + aspect group")].append(r)
            done.add(r["id"])
        elif cases and cases[0][0] >= min_similarity:
            joins[(cases[0][1], "nearest case of the topic + aspect group")].append(r)
            done.add(r["id"])
        else:
            pool = [m for m in pools[key] if m["id"] not in done]
            if not viable(pool, thresholds):
                continue  # below the bar: the signals wait without a case
            case = create_case(conn, r["feature_id"], r["feature"], pool, aspect_group=r["aspect_group"],
                               run_id=run_id,
                               rationale="waiting signals of this topic + aspect group passed the bar" if not cases
                               else "no case above the similarity threshold; waiting signals passed the bar")
            known[key].append((case["id"], _unit(np.mean(as_matrix([m["embedding"] for m in pool]), axis=0))))
            done.update(m["id"] for m in pool)
            created += 1
    for (case_id, why), members in joins.items():
        assign(conn, case_id, members, run_id=run_id, rationale=why)
    attached = sum(len(m) for m in joins.values())
    return {"attached": attached, "created": created, "signals_without_a_case": len(rows) - len(done)}


def refresh_centroid(conn, case_id: str, *, run_id=None) -> None:
    rows = conn.execute("select embedding from signal where case_id = %s and embedding is not null",
                        (case_id,)).fetchall()
    if rows:
        centroid = _unit(np.mean(as_matrix([r["embedding"] for r in rows]), axis=0))
        audit.update(conn, "case_item", {"id": case_id}, {"embedding": centroid}, actor=ACTOR, run_id=run_id,
                     rationale="centroid after membership change")


def merge(conn, source_id: str, target_id: str, *, actor: str, rationale: str) -> None:
    """Move every signal of source into target. The source case stays (rejected,
    pointing to the target) so its ID and history remain resolvable."""
    members = conn.execute("select id, vehicle from signal where case_id = %s", (source_id,)).fetchall()
    audit.update_many(conn, "signal", [({"id": m["id"]}, {"case_id": target_id}) for m in members], actor=actor,
                      rationale=f"merge {source_id} -> {target_id}: {rationale}")
    audit.insert(conn, "case_lineage", {"from_case": source_id, "to_case": target_id, "op": "merge", "actor": actor,
                                        "rationale": rationale}, actor=actor)
    for cv in conn.execute("select vehicle from case_vehicle where case_id = %s", (source_id,)).fetchall():
        audit.update(conn, "case_vehicle", {"case_id": source_id, "vehicle": cv["vehicle"]},
                     {"state": "rejected", "state_reason": f"merged into {target_id}", "workflow": None,
                      "outcome": "merged", "outcome_note": rationale}, actor=actor,
                     rationale=rationale, action="state_change")
    assign(conn, target_id, [dict(m) for m in members], rationale=f"merged from {source_id}")
    refresh_centroid(conn, target_id)


def split(conn, case_id: str, signal_ids: list[str], *, actor: str, rationale: str) -> dict:
    members = conn.execute(
        "select s.id, s.feature_id, s.kind, s.severity, s.market, s.vehicle, s.customer_ref, s.evidence_role,"
        " s.quote, s.embedding, s.aspect_group, f.name as feature"
        " from signal s join feature f on f.id = s.feature_id"
        " where s.case_id = %s and s.id = any(%s::uuid[])", (case_id, signal_ids)).fetchall()
    if not members:
        raise ValueError("no signals of this case selected")
    aspect = conn.execute("select aspect_group from case_item where id = %s", (case_id,)).fetchone()["aspect_group"]
    new = create_case(conn, members[0]["feature_id"], members[0]["feature"], list(members), aspect_group=aspect,
                      rationale=f"split from {case_id}: {rationale}")
    audit.insert(conn, "case_lineage", {"from_case": case_id, "to_case": new["id"], "op": "split", "actor": actor,
                                        "rationale": rationale}, actor=actor)
    refresh_centroid(conn, case_id)
    return new
