"""RAG index (rag_chunk): case and requirement pages, signals (summary + quote),
source texts, decisions and audit events about cases and requirements, and the
PM context: series briefs, stances, open questions and answers, meeting notes,
feedback on requirements, comments.

The index is derived data rebuilt from audited tables, so a rebuild writes one
audit event with the counts instead of one per chunk (changes.md 7.1).
"""

from __future__ import annotations


from app import audit, db
from app.llm.embeddings import get_embedder

SOURCE_TEXT_LIMIT = 1500
# What people told the system (not customer evidence): searched by the agent's search_context tool.
CONTEXT_TYPES = ("series_brief", "case_stance", "open_question", "meeting_note", "requirement_feedback", "comment")
BRIEF_LABELS = {"thesis": "Thesis", "targetCustomer": "Target customer", "marketWeights": "Market weights",
                "changeAmbition": "Evolution or revolution", "protectList": "Protect list",
                "dontFightOn": "Don't fight on", "givens": "Already decided", "costEnvelope": "Cost envelope"}


def _plain(value) -> str:
    """A JSON value as a short readable phrase."""
    if isinstance(value, dict):
        return ", ".join(f"{k} {_plain(v)}" for k, v in value.items() if v not in (None, "", [], {}))
    if isinstance(value, list):
        return "; ".join(_plain(v) for v in value) or "none"
    if isinstance(value, float):
        return f"{value:.0%}" if 0 <= value <= 1 else str(value)
    return str(value)


def context_chunks(conn) -> list[dict]:
    """One chunk per brief, stance, question, meeting note, feedback entry and comment."""
    names = {str(u["id"]): u["name"] for u in conn.execute("select id, name from app_user").fetchall()}
    who = lambda uid: names.get(str(uid), "a PM")  # noqa: E731
    out = []
    for b in conn.execute("select * from series_brief").fetchall():
        kind = "shared brief" if b["kind"] == "shared" else f"regional brief ({b['region']}) of {who(b['owner_id'])}"
        lines = [f"Series brief of the {b['vehicle']}, {kind}, version {b['version']}."]
        for key, label in BRIEF_LABELS.items():
            if key in b["values"]:
                meta = (b["meta"] or {}).get(key) or {}
                lines.append(f"{label}: {_plain(b['values'][key])}"
                             + ("" if meta.get("confirmed") else " (not confirmed yet)")
                             + (f". Why it differs: {meta['reason']}" if meta.get("reason") else ""))
        out.append({"object_type": "series_brief", "object_id": b["id"], "vehicle": b["vehicle"], "market": None,
                    "case_id": None, "text": "\n".join(lines)})
    for s in conn.execute("select * from case_stance").fetchall():
        lines = [f"Stance of {who(s['author_id'])} on {s['case_id']}."]
        if s["ambition"]:
            lines.append(f"Ambition: {s['ambition']} (fix the complaint, match the best competitor, or beat it).")
        for key, value in (s["overrides"] or {}).items():
            lines.append(f"Differs from the brief on {BRIEF_LABELS.get(key, key)}: {_plain(value)}. "
                         f"Reason: {(s['override_reasons'] or {}).get(key, 'none given')}")
        lines += [f"Reading of the evidence ({t.get('effect')}): {t.get('text')}" for t in s["evidence_takes"] or []]
        lines += [f"Inside knowledge ({i.get('kind', 'other').replace('_', ' ')}): {i.get('text')}"
                  for i in s["inside"] or []]
        out.append({"object_type": "case_stance", "object_id": f"{s['case_id']}/{s['author_id']}", "vehicle": None,
                    "market": None, "case_id": s["case_id"], "text": "\n".join(lines)})
    for q in conn.execute(
            "select q.*, r.case_id as req_case from open_question q left join requirement r"
            " on q.object_type = 'requirement' and r.id = q.object_id").fetchall():
        text = (f"Open question {q['id']} to {q['addressee'].replace('_', ' ')} on {q['object_id']}, asked by "
                f"{who(q['asked_by'])} ({q['status']}): {q['question']}"
                + (f"\nWhy it matters: {q['why']}" if q["why"] else "")
                + (f"\nAnswer ({q['answer_source'] or 'manual'}): {q['answer']}" if q["answer"] else ""))
        out.append({"object_type": "open_question", "object_id": q["id"], "vehicle": q["vehicle"], "market": None,
                    "case_id": q["object_id"] if q["object_type"] == "case" else q["req_case"], "text": text})
    for n in conn.execute("select * from meeting_note").fetchall():
        out.append({"object_type": "meeting_note", "object_id": n["id"], "vehicle": n["vehicle"], "market": None,
                    "case_id": n["case_id"],
                    "text": f"Meeting note {n['id']} on {n['case_id']}: {n['title']}"
                            + (f" ({n['held_on']})" if n["held_on"] else "")
                            + (f". Attendees: {', '.join(n['attendees'])}" if n["attendees"] else "")
                            + f"\n{n['text'][:SOURCE_TEXT_LIMIT]}"})
    for f in conn.execute("select f.*, r.case_id, r.vehicle from requirement_feedback f join requirement r"
                          " on r.id = f.requirement_id").fetchall():
        out.append({"object_type": "requirement_feedback", "object_id": f["id"], "vehicle": f["vehicle"],
                    "market": None, "case_id": f["case_id"],
                    "text": f"Feedback {f['id']} from {f['source'].replace('_', ' ')} on {f['requirement_id']}: "
                            f"{f['text']}\nThe PM's response ({f['response'].replace('_', ' ')}): {f['pm_rationale']}"})
    for c in conn.execute(
            "select c.*, r.case_id as req_case from comment c left join requirement r"
            " on c.object_type = 'requirement' and r.id = c.object_id").fetchall():
        out.append({"object_type": "comment", "object_id": str(c["id"]), "vehicle": None, "market": None,
                    "case_id": c["object_id"] if c["object_type"] == "case" else c["req_case"],
                    "text": f"Comment by {who(c['author_id'])} on {c['object_id']}: {c['body']}"})
    return out


def refresh_context(conn) -> int:
    """Bring the PM-context chunks in line with their tables after a write: only new
    or changed texts are embedded again. Derived data: no audit event."""
    wanted = {(c["object_type"], c["object_id"]): c for c in context_chunks(conn)}
    stored = {(r["object_type"], r["object_id"]): r["text"] for r in conn.execute(
        "select object_type, object_id, text from rag_chunk where object_type = any(%s)",
        (list(CONTEXT_TYPES),)).fetchall()}
    gone = [k for k in stored if k not in wanted]
    changed = [c for k, c in wanted.items() if stored.get(k) != c["text"]]
    for object_type, object_id in gone + [(c["object_type"], c["object_id"]) for c in changed]:
        conn.execute("delete from rag_chunk where object_type = %s and object_id = %s", (object_type, object_id))
    if changed:
        vectors = get_embedder().embed([c["text"][:2000] for c in changed])
        with conn.cursor() as cur:
            cur.executemany(
                "insert into rag_chunk (object_type, object_id, vehicle, market, case_id, text, embedding)"
                " values (%s, %s, %s, %s, %s, %s, %s)",
                [(c["object_type"], c["object_id"], c["vehicle"], c["market"], c["case_id"], c["text"], v)
                 for c, v in zip(changed, vectors)])
    return len(changed) + len(gone)


def _chunks(conn) -> list[dict]:
    out = []
    for c in conn.execute("select id, title, body_md from case_item").fetchall():
        vehicles = [r["vehicle"] for r in conn.execute("select vehicle from case_vehicle where case_id = %s",
                                                       (c["id"],)).fetchall()]
        out.append({"object_type": "case", "object_id": c["id"], "vehicle": vehicles[0] if len(vehicles) == 1 else None,
                    "market": None, "case_id": c["id"], "text": f"{c['id']}: {c['title']}\n{c['body_md']}"})
    for r in conn.execute("select id, case_id, vehicle, market, title, body_md from requirement"
                          " where status <> 'deleted'").fetchall():
        out.append({"object_type": "requirement", "object_id": r["id"], "vehicle": r["vehicle"], "market": r["market"],
                    "case_id": r["case_id"], "text": f"{r['id']}: {r['title']}\n{r['body_md']}"})
    for s in conn.execute(
            "select s.id, s.vehicle, s.market, s.case_id, s.kind, s.summary, s.quote, r.source_id, r.url"
            " from signal s join source_record r using (record_id) where s.validation = 'valid'").fetchall():
        out.append({"object_type": "signal", "object_id": str(s["id"]), "vehicle": s["vehicle"], "market": s["market"],
                    "case_id": s["case_id"],
                    "text": f"[{s['kind']}] {s['summary']}\nQuote: {s['quote']}\nSource: {s['source_id']}"})
    # One chunk per record: a review page can hold signals of several cases and lines, and then
    # belongs to none of them alone.
    for r in conn.execute(
            "select r.record_id, r.title, r.text_original, array_agg(distinct s.vehicle) as vehicles,"
            " array_agg(distinct s.case_id) as cases"
            " from source_record r join signal s using (record_id)"
            " where r.deleted_at is null and r.source_id <> 'bmw_feedback' and s.validation = 'valid'"
            " group by r.record_id, r.title, r.text_original").fetchall():
        out.append({"object_type": "source_record", "object_id": r["record_id"],
                    "vehicle": r["vehicles"][0] if len(r["vehicles"]) == 1 else None,
                    "market": None, "case_id": r["cases"][0] if len(r["cases"]) == 1 else None,
                    "text": f"{r['title'] or r['record_id']}\n{(r['text_original'] or '')[:SOURCE_TEXT_LIMIT]}"})
    for d in conn.execute("select id, object_type, object_id, vehicle, actor, action, rationale from decision"
                          ).fetchall():
        case_id = d["object_id"] if d["object_type"] == "case" else None
        out.append({"object_type": "decision", "object_id": str(d["id"]), "vehicle": d["vehicle"], "market": None,
                    "case_id": case_id,
                    "text": f"Decision {d['action']} on {d['object_type']} {d['object_id']} by {d['actor']}: "
                            f"{d['rationale'] or ''}"})
    for a in conn.execute(
            "select seq, at, actor, action, object_type, object_id, rationale from audit_event"
            " where object_type in ('case', 'case_vehicle', 'requirement') and action <> 'create'"
            # What people did and why. Machine events (figures recomputed, tags proposed, signals
            # assigned) are noise for retrieval and were 5,000 chunks of the index.
            " and actor_type = 'human' and rationale is not null order by seq desc limit 5000").fetchall():
        case_id = a["object_id"].split("/")[0] if a["object_type"] in ("case", "case_vehicle") else None
        out.append({"object_type": "audit_event", "object_id": str(a["seq"]), "vehicle": None, "market": None,
                    "case_id": case_id,
                    "text": f"{a['at']:%Y-%m-%d} {a['actor']} {a['action']} {a['object_type']} {a['object_id']}: "
                            f"{a['rationale']}"})
    return out + context_chunks(conn)


def rebuild(conn, *, actor: str = "system") -> dict:
    chunks = _chunks(conn)
    embedder = get_embedder()
    vectors = embedder.embed([c["text"][:2000] for c in chunks]) if chunks else []
    conn.execute("delete from rag_chunk")
    for i in range(0, len(chunks), 500):
        batch = chunks[i : i + 500]
        with conn.cursor() as cur:
            cur.executemany(
                "insert into rag_chunk (object_type, object_id, vehicle, market, case_id, text, embedding)"
                " values (%s, %s, %s, %s, %s, %s, %s)",
                [(c["object_type"], c["object_id"], c["vehicle"], c["market"], c["case_id"], c["text"], v)
                 for c, v in zip(batch, vectors[i : i + 500])],
            )
    counts: dict[str, int] = {}
    for c in chunks:
        counts[c["object_type"]] = counts.get(c["object_type"], 0) + 1
    audit.write(conn, action="reindex", object_type="rag_chunk", object_id="all", actor=actor,
                after={"chunks": counts, "embedding_provider": embedder.name},
                rationale="RAG index rebuilt from audited tables")
    return counts


def refresh_page(conn, object_type: str, object_id: str) -> int:
    """Re-index one case or requirement page after a save or generation, so the
    sidebar sees it before the next full rebuild. Derived data: no audit event."""
    if object_type == "case":
        c = conn.execute("select id, title, body_md from case_item where id = %s", (object_id,)).fetchone()
        vehicles = [r["vehicle"] for r in conn.execute("select vehicle from case_vehicle where case_id = %s",
                                                       (object_id,)).fetchall()]
        chunk = c and {"vehicle": vehicles[0] if len(vehicles) == 1 else None, "market": None, "case_id": c["id"],
                       "text": f"{c['id']}: {c['title']}\n{c['body_md']}"}
    elif object_type == "requirement":
        r = conn.execute("select id, case_id, vehicle, market, title, body_md, status from requirement"
                         " where id = %s", (object_id,)).fetchone()
        chunk = r and r["status"] != "deleted" and {"vehicle": r["vehicle"], "market": r["market"],
                                                    "case_id": r["case_id"],
                                                    "text": f"{r['id']}: {r['title']}\n{r['body_md']}"}
    else:
        raise ValueError("only case and requirement pages are refreshed one by one")
    conn.execute("delete from rag_chunk where object_type = %s and object_id = %s", (object_type, object_id))
    if not chunk:
        return 0
    vector = get_embedder().embed([chunk["text"][:2000]])[0]
    conn.execute("insert into rag_chunk (object_type, object_id, vehicle, market, case_id, text, embedding)"
                 " values (%s, %s, %s, %s, %s, %s, %s)",
                 (object_type, object_id, chunk["vehicle"], chunk["market"], chunk["case_id"], chunk["text"], vector))
    return 1


if __name__ == "__main__":
    with db.transaction() as conn:
        print(rebuild(conn))
