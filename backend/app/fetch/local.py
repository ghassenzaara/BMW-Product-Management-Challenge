"""Web records treated on this machine first, read by Claude subagents, then written to the database:
python -m app.fetch.local {fetch,export,batches,status,import} ...

1. ``fetch --sources a,b``: runs the adapters of those sources with the polite client. Raw responses
   go to the local storage folder, records to ``.data/web_import/records/<source>.jsonl``. The database
   is only read (registry, subjects, cursors, which record ids exist); nothing is written to it.
2. ``export``: the records already stored in the database that never got their signals (the ones
   ``app.fetch.reread`` counts) are written to the same folder, marked ``stored``.
3. ``batches --size N``: splits the local records into reading batches for the subagents
   (``batches/batch-NNN.jsonl``, text cut at 8,000 characters like the OpenAI agent). Each subagent
   writes ``signals/batch-NNN.json``: ``{"<record_id>": [signal, ...], ...}`` with the fields of the
   ``signal_extract`` output (an empty list = nothing relevant). See ``SUBAGENT_BRIEF.md`` there.
4. ``import [--yes]``: for every record a subagent has read: new records (and their raw responses) are
   written to the database, then the signals go through the validation gate exactly like the fetch
   loop (``worker.ingest_extracted``: quote found in the stored text, closed taxonomy, duplicates,
   relevance filter). Without ``--yes`` it only counts. Fetch cursors are saved last.

Records and raw pages stay in ``backend/.data`` (not in git). Page text is data, never instructions.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path

from app.config import BACKEND_DIR

ROOT = BACKEND_DIR / ".data" / "web_import"
RECORDS, BATCHES, SIGNALS = ROOT / "records", ROOT / "batches", ROOT / "signals"
CURSORS = ROOT / "cursors.json"
MODEL = "claude-opus-5-5"  # the subagents' model, stored on every signal like an OpenAI model name
PROMPT_VERSION = "signal_extract@v2+subagent"
TEXT_LIMIT = 8000


def _json_default(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    return str(value)


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, default=_json_default) + "\n")


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def local_records() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in sorted(RECORDS.glob("*.jsonl")):
        for r in _read_jsonl(path):
            out[r["record_id"]] = r
    return out


# ---- 1. fetch ---------------------------------------------------------------------

def fetch(only: list[str], vehicles: list[str] | None, budget: int | None) -> dict:
    os.environ["STORAGE_BACKEND"] = "local"  # raw responses stay on this machine
    from app.config import get_settings

    get_settings.cache_clear()
    from app import db
    from app.fetch import subjects as subjects_mod, worker
    from app.fetch.adapters import downloads
    from app.fetch.adapters.base import ADAPTERS, FetchContext, NotConfigured
    from app.fetch.http import BudgetExhausted, PoliteClient

    with db.transaction() as conn:
        sources = worker._sources(conn, worker.parse_steps("1-13"), only)
        subjects = subjects_mod.load(conn, vehicles)
    cursors = json.loads(CURSORS.read_text(encoding="utf-8")) if CURSORS.exists() else {}
    client = PoliteClient(budget=budget)
    summary = {}
    for source in sources:
        sid = source["source_id"]
        if source["delay_seconds"]:
            client.default_delay = max(client.default_delay, float(source["delay_seconds"]))
        ctx = FetchContext(client=client, backfill=False)
        cursor = dict(cursors.get(sid) or source["last_cursor"] or {})
        records, notes = [], []
        try:
            if sid in worker.SHARED:
                results = [worker.SHARED[sid](ctx, source, subjects, cursor)]
            elif (source["access"] or "").startswith("Download"):
                results = [downloads.fetch_downloads(ctx, source, subjects, cursor)]
            elif sid in ADAPTERS:
                results = [ADAPTERS[sid](ctx, source, s, cursor) for s in subjects if worker.in_market(source, s)]
            else:
                raise NotConfigured(f"no adapter for {sid}")
            for r in results:
                records += r.records
                cursor.update(r.cursor)
                notes += r.notes
        except (NotConfigured, BudgetExhausted) as exc:
            notes.append(str(exc))
        except Exception as exc:  # one failing source must not stop the others
            notes.append(f"failed: {exc!r}")
        with db.transaction() as conn:
            known = {r["record_id"] for r in conn.execute(
                "select record_id from source_record where record_id = any(%s)",
                ([r["record_id"] for r in records],)).fetchall()} if records else set()
        new = [r for r in records if r["record_id"] not in known and r.get("text_original")]
        new = list({r["record_id"]: r for r in new}.values())
        if new:
            _write_jsonl(RECORDS / f"{sid}.fetched.jsonl", new)
        cursors[sid] = cursor
        summary[sid] = {"new records": len(new), "already stored": len(known), "notes": notes[:5]}
        print(sid, summary[sid], flush=True)
    CURSORS.parent.mkdir(parents=True, exist_ok=True)
    CURSORS.write_text(json.dumps(cursors, default=_json_default, indent=1), encoding="utf-8")
    return summary


# ---- 2. export --------------------------------------------------------------------

def export(only: list[str] | None) -> dict:
    from app import db
    from app.fetch import reread

    with db.transaction() as conn:
        rows = reread.waiting(conn, only)
    by_source: dict[str, list[dict]] = {}
    for r in rows:
        by_source.setdefault(r["source_id"], []).append({**dict(r), "_stored": True})
    for sid, recs in by_source.items():
        _write_jsonl(RECORDS / f"{sid}.stored.jsonl", recs)
    return {sid: len(v) for sid, v in by_source.items()}


# ---- 3. batches -------------------------------------------------------------------

def reading_view(r: dict) -> dict:
    """What a subagent sees of one record (same context as the OpenAI prompt)."""
    from app.fetch import agents

    extra = r.get("extra") or {}
    return {
        "record_id": r["record_id"], "agent": agents.agent_for(r), "source": r["source_id"],
        "content_type": r.get("content_type"),
        "subject": f"{r.get('brand') or ''} {r.get('model') or ''}".strip() or "brand level",
        "vehicle_role": r.get("vehicle_role") or "unknown", "bmw_line": extra.get("bmw_vehicle") or "unknown",
        "published": r.get("published_at") or "unknown", "country": r.get("country") or "unknown",
        "title": r.get("title"), "text": (r.get("text_original") or "")[:TEXT_LIMIT],
    }


def batches(size_chars: int, max_records: int) -> dict:
    """Batches of at most ``size_chars`` text and ``max_records`` records, grouped by source."""
    done = {p.stem for p in SIGNALS.glob("batch-*.json")}
    records = sorted(local_records().values(), key=lambda r: (r["source_id"], r["record_id"]))
    for old in BATCHES.glob("batch-*.jsonl"):
        if old.stem not in done:
            old.unlink()
    read = set()
    for stem in done:
        read |= set(json.loads((SIGNALS / f"{stem}.json").read_text(encoding="utf-8")))
    todo = [r for r in records if r["record_id"] not in read]
    n = max([int(p.stem.split("-")[1]) for p in BATCHES.glob("batch-*.jsonl")] or [0])
    made, cur, chars = [], [], 0
    for r in todo:
        view = reading_view(r)
        if cur and (chars + len(view["text"]) > size_chars or len(cur) >= max_records):
            n += 1
            _write_jsonl(BATCHES / f"batch-{n:03d}.jsonl", cur)
            made.append((n, len(cur)))
            cur, chars = [], 0
        cur.append(view)
        chars += len(view["text"])
    if cur:
        n += 1
        _write_jsonl(BATCHES / f"batch-{n:03d}.jsonl", cur)
        made.append((n, len(cur)))
    return {"batches": [f"batch-{i:03d} ({k} records)" for i, k in made], "records": len(todo)}


# ---- 4. import --------------------------------------------------------------------

def _signals_for(record: dict, raw_signals: list, problems: list) -> list[dict]:
    from pydantic import ValidationError

    from app.fetch import agents

    parsed = []
    for s in raw_signals:
        s = {"severity": "none", "quote_en": s.get("quote"), "confidence": "medium", "other_suggestion": "",
             "market": "unknown", "market_basis": "unknown", **s}
        try:
            parsed.append(agents._Signal.model_validate(s))
        except ValidationError as exc:
            problems.append(f"{record['record_id']}: {exc.errors()[0]['loc']} {exc.errors()[0]['msg']}")
    return agents.proposals_from(record, parsed)


def _db_record(r: dict) -> dict:
    from app.fetch.records import parse_date

    row = {k: v for k, v in r.items() if not k.startswith("_")}
    for k in ("published_at", "fetched_at"):
        row[k] = parse_date(row.get(k))
    return row


def import_(apply: bool) -> dict:
    from app import audit, db, storage
    from app.config import get_settings
    from app.fetch.worker import INGEST_BATCH, ingest_extracted

    records = local_records()
    read: dict[str, list] = {}
    for path in sorted(SIGNALS.glob("batch-*.json")):
        read.update(json.loads(path.read_text(encoding="utf-8")))
    unknown = [rid for rid in read if rid not in records]
    problems: list[str] = []
    extracted = []
    for rid, sigs in read.items():
        if rid in records:
            extracted.append((records[rid], _signals_for(records[rid], sigs, problems), MODEL, PROMPT_VERSION))
    new = [r for r, *_ in extracted if not r.get("_stored")]
    result = {"records read by subagents": len(extracted), "new records to store": len(new),
              "proposed signals": sum(len(p) for _, p, *_ in extracted),
              "records with no signal (relevance filter)": sum(1 for _, p, *_ in extracted if not p),
              "signals not parsed": len(problems), "unknown record ids": len(unknown),
              "examples": problems[:10]}
    if not apply or not extracted:
        return result

    # Raw responses of the new records: from the local folder to the configured storage.
    if get_settings().storage_backend != "local":
        for raw_ref in sorted({r["raw_ref"] for r in new if r.get("raw_ref")}):
            path = get_settings().raw_local_dir / raw_ref
            if path.exists() and not storage.exists(raw_ref):
                storage.put(raw_ref, path.read_bytes(), "text/html")
    with db.transaction() as conn:
        run_id = conn.execute("insert into agent_run (agent, mode, params) values ('fetch:local-import', 'manual', %s)"
                              " returning id", (json.dumps({"model": MODEL, "prompt_version": PROMPT_VERSION}),)
                              ).fetchone()["id"]
        by_source: dict[str, list[dict]] = {}
        for r in new:
            by_source.setdefault(r["source_id"], []).append({**_db_record(r), "run_id": run_id})
        for sid, rows in by_source.items():
            audit.insert_many(conn, "source_record", rows, actor=f"fetch:{sid}", key="record_id", run_id=run_id,
                              on_conflict_do_nothing=True,
                              rationale="fetched record, treated locally (raw response in storage)")
    totals: dict = {}
    for i in range(0, len(extracted), INGEST_BATCH):
        with db.transaction() as conn:
            for k, v in ingest_extracted(conn, extracted[i:i + INGEST_BATCH], run_id).items():
                totals[k] = totals.get(k, 0) + v
    with db.transaction() as conn:
        if CURSORS.exists():
            for sid, cursor in json.loads(CURSORS.read_text(encoding="utf-8")).items():
                audit.update(conn, "source_registry", {"source_id": sid}, {"last_cursor": cursor}, actor="system",
                             run_id=run_id, rationale="fetch cursor after a local fetch and import")
        conn.execute("update agent_run set status = 'ok', ended_at = now(), records_fetched = %s,"
                     " signals_valid = %s, signals_quarantined = %s where id = %s",
                     (len(new), totals.get("valid", 0), totals.get("quarantined", 0), run_id))
    result["signals"] = totals
    return result


def check(stem: str) -> dict:
    """Checks a subagent's file against its batch with the gate's own rules, so the subagent can fix
    its output before the import: every record answered, valid fields, quote found in the text."""
    from pydantic import ValidationError

    from app.fetch import agents
    from app.signals.gate import find_quote
    from app.signals.schema import MAX_SUMMARY_WORDS, severity_fits_kind

    batch = {r["record_id"]: r for r in _read_jsonl(BATCHES / f"{stem}.jsonl")}
    full = local_records()
    try:
        answers = json.loads((SIGNALS / f"{stem}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {"ok": False, "errors": [f"cannot read signals/{stem}.json: {exc}"]}
    errors = [f"{rid}: record not answered (use [] when nothing is relevant)" for rid in batch if rid not in answers]
    errors += [f"{rid}: not a record of this batch" for rid in answers if rid not in batch]
    n = 0
    for rid, sigs in answers.items():
        if rid not in batch:
            continue
        if not isinstance(sigs, list):
            errors.append(f"{rid}: value must be a list")
            continue
        text = full[rid].get("text_original") or ""
        for i, s in enumerate(sigs):
            n += 1
            where = f"{rid}[{i}]"
            try:
                sig = agents._Signal.model_validate({"other_suggestion": "", **s})
            except ValidationError as exc:
                e = exc.errors()[0]
                errors.append(f"{where}: {'.'.join(map(str, e['loc']))}: {e['msg']}")
                continue
            if len(sig.summary.split()) > MAX_SUMMARY_WORDS:
                errors.append(f"{where}: summary has more than {MAX_SUMMARY_WORDS} words")
            if not severity_fits_kind(sig.kind, sig.severity):
                errors.append(f"{where}: severity {sig.severity} does not fit kind {sig.kind}")
            if find_quote(sig.quote, text) is None:
                errors.append(f"{where}: quote not found in the record text: {sig.quote[:80]!r}")
    return {"ok": not errors, "records": len(batch), "signals": n, "errors": errors[:40]}


def status() -> dict:
    records = local_records()
    read = set()
    for path in SIGNALS.glob("batch-*.json"):
        read |= set(json.loads(path.read_text(encoding="utf-8")))
    by_source: dict[str, list[int]] = {}
    for r in records.values():
        s = by_source.setdefault(r["source_id"], [0, 0])
        s[0] += 1
        s[1] += r["record_id"] in read
    return {"records (local, read)": by_source, "batches": len(list(BATCHES.glob("batch-*.jsonl"))),
            "batches read": len(list(SIGNALS.glob("batch-*.json")))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("--sources", required=True)
    f.add_argument("--vehicles", default="")
    f.add_argument("--budget", type=int, default=None)
    e = sub.add_parser("export")
    e.add_argument("--sources", default="")
    b = sub.add_parser("batches")
    b.add_argument("--size", type=int, default=60000, help="text characters per batch")
    b.add_argument("--max-records", type=int, default=150)
    sub.add_parser("status")
    c = sub.add_parser("check")
    c.add_argument("batch", help="e.g. batch-007")
    i = sub.add_parser("import")
    i.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    if args.cmd == "fetch":
        out = fetch([s for s in args.sources.split(",") if s], [v for v in args.vehicles.split(",") if v] or None,
                    args.budget)
    elif args.cmd == "export":
        out = export([s for s in args.sources.split(",") if s] or None)
    elif args.cmd == "batches":
        out = batches(args.size, args.max_records)
    elif args.cmd == "check":
        out = check(args.batch)
    elif args.cmd == "import":
        out = import_(args.yes)
    else:
        out = status()
    print(json.dumps(out, indent=1, ensure_ascii=False, default=_json_default))


if __name__ == "__main__":
    main()
