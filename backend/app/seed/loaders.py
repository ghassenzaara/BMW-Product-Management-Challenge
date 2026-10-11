"""Seed loaders for the provided BMW data: sales, customer study, feedback.

Every row is written through the audited write path with actor ``seed:<step>``.
The raw files are copied unchanged to raw storage (``provided/<file>``) so every
``raw_ref`` resolves; the originals in docs/ are never touched.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict

from app import audit, storage, taxonomy
from app.config import RAW_DATA_DIR
from app.seed import readers
from app.seed.classify import classify_rows
from app.seed.catalog import mapping, topic_ids
from app.signals import service

SCHEMA_VERSION = "signal@2"

POWERTRAIN = {"ICE": "ICE", "PHEV": "PHEV", "BEVE": "BEV", "BEV": "BEV"}
EUROPE = {"GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "AT", "BE", "CH", "DK", "FI", "IE", "PT", "PL", "CZ",
          "SK", "HU", "RO", "BG", "GR", "HR", "SI", "LU", "EE", "LV", "LT", "IS", "MT", "CY", "RS", "BA", "ME",
          "MK", "AL", "UA", "MD", "LI", "MC", "SM", "AD", "TR"}

# Feedback Type -> (kind, severity).
FEEDBACK_TYPES = {
    "Likes": ("like", "none"),
    "Difficult to Use": ("complaint", "difficult_to_use"),
    "Defect": ("complaint", "defect"),
    "Wants": ("wish", "wish"),
}
KIND_LABEL = {"like": "Likes", "complaint": "Complaint", "wish": "Wish"}

# Style of the anonymized BMW sources (data README).
SOURCE_STYLE = {"Source A": ("B", "owner review"), "Source B": ("A", "dealer or call-center note"),
                "Source C": ("B", "survey answer"), "Source D": ("B", "open survey answer")}


def country_to_market(country: str | None) -> str:
    if not country:
        return "unknown"
    c = country.upper()
    if c == "US":
        return "USA"
    if c == "CN":
        return "China"
    if c in EUROPE:
        return "Europe"
    return "Rest of World"


def store_raw_file(name: str) -> str:
    """Copy one provided file to raw storage; returns raw_ref."""
    ref = f"provided/{name}"
    if not storage.exists(ref):
        storage.put(ref, (RAW_DATA_DIR / name).read_bytes())
    return ref


def load_sales(conn, run_id) -> int:
    raw_ref = store_raw_file(readers.SALES_FILE)
    rows = []
    for s in readers.read_sales():
        period = f"{s.year} forecast" if s.year > 2025 else str(s.year)
        rows.append({
            "record_id": f"bmw_sales-{s.vehicle}-{s.market.replace(' ', '')}-{s.year}",
            "source_id": "bmw_sales", "category": "F", "url": readers.SALES_FILE, "raw_ref": raw_ref,
            "brand": "BMW", "chassis_code": s.vehicle, "market": s.market, "period": period,
            "metric": "sales units", "value": s.units, "value_text": None if s.units is not None else str(s.raw),
            "unit": "units", "source_location": s.cell, "suspect": s.suspect, "run_id": run_id,
        })
    n = audit.insert_many(conn, "data_record", rows, actor="seed:sales", key="record_id", run_id=run_id,
                          rationale="BMW sales volumes (provided Excel)")
    # markets_sold = markets with 2030 forecast > 0.
    sold = defaultdict(list)
    for r in rows:
        if r["period"] == "2030 forecast" and (r["value"] or 0) > 0:
            sold[r["chassis_code"]].append(r["market"])
    for vehicle, markets in sold.items():
        audit.update(conn, "vehicle", {"code": vehicle}, {"markets_sold": sorted(markets)},
                     actor="seed:sales", rationale="markets with 2030 sales forecast > 0", run_id=run_id)
    return n


def load_study(conn, run_id) -> int:
    store_raw_file(readers.STUDY_FILE)
    features = mapping(conn, "study_attribute")
    rows = [{
        "vehicle": s.vehicle, "market": s.market, "sheet": s.sheet, "attribute": s.attribute, "method": s.method,
        "raw": s.raw, "normalized": s.normalized, "dissatisfied_share": s.dissatisfied_share,
        "feature_id": features.get(s.attribute.strip()), "source_location": s.source_location,
    } for s in readers.read_study()]
    return audit.insert_many(conn, "study_score", rows, actor="seed:study", run_id=run_id,
                             rationale="BMW customer study 2025 (provided Excel)")


def _summary(kind: str, severity: str, l2: str | None, l3: str | None) -> str:
    """Label-based summary for classified rows (no LLM): kind + BMW topic labels."""
    label = {"difficult_to_use": "Difficult to use", "defect": "Defect"}.get(severity, KIND_LABEL[kind])
    topic = l2 or "general"
    text = f"{label}: {topic}" + (f" ({l3})" if l3 and l3 not in ("None",) else "")
    words = text.split()
    return " ".join(words[:20])


def prefetch_feedback_classification(vehicles=("F70", "G60", "G70")) -> int:
    """Classify every feedback row that needs the LLM before the seed transaction
    opens. The answers go to the disk cache, so ``load_feedback`` only reads them:
    the database connection never waits, idle, for minutes of LLM calls (that idle
    wait is what dropped the connection and rolled the whole step back)."""
    rows = []
    for vehicle in vehicles:
        rows += [r for r in readers.read_feedback(vehicle)
                 if r.feedback_type not in FEEDBACK_TYPES or not taxonomy.topic_for_label(r.topic_l2)]
    # classify_rows keys its result by excel row, which repeats across files; only the cache matters here.
    classify_rows(rows)
    return len(rows)


def load_feedback(conn, run_id, vehicles=("F70", "G60", "G70")) -> dict[str, int]:
    features = topic_ids(conn)
    version = taxonomy.version()
    counts = {"records": 0, "signals": 0, "quarantined": 0, "taxonomy_review": 0}
    for vehicle in vehicles:
        raw_ref = store_raw_file(readers.FEEDBACK_FILES[vehicle])
        rows = readers.read_feedback(vehicle)
        by_id: dict[str, list] = defaultdict(list)
        for r in rows:
            by_id[r.verbatim_id].append(r)

        records = []
        for vid, group in by_id.items():
            first = group[0]
            question, answer = readers.split_question(first.text)
            category, style = SOURCE_STYLE.get(first.source, ("B", "unknown"))
            records.append({
                "record_id": f"bmw_feedback-{vid}", "source_id": "bmw_feedback", "category": category,
                "content_type": "bmw_internal", "level": "model",
                "url": f"{readers.FEEDBACK_FILES[vehicle]}#rows={','.join(str(g.excel_row) for g in group)}",
                "raw_ref": raw_ref, "author_hash": hashlib.sha256(vid.encode()).hexdigest()[:16],
                "brand": "BMW", "model": _series(vehicle), "chassis_code": first.chassis,
                "vehicle_role": "current", "powertrain": POWERTRAIN.get(first.engine or "", "unknown"),
                "country": first.country, "market": country_to_market(first.country), "language": "en",
                "text_original": first.text,
                "extra": {"bmw_source": first.source, "source_style": style, "verbatim_id": vid,
                          "survey_question": question, "excel_rows": [g.excel_row for g in group]},
                "content_hash": hashlib.sha256(f"bmw_feedback|{vid}|{first.text}".encode()).hexdigest(),
                "run_id": run_id,
            })
        counts["records"] += audit.insert_many(conn, "source_record", records, actor="seed:feedback",
                                                key="record_id", run_id=run_id,
                                                rationale="BMW customer feedback verbatim (provided Excel)")

        # Rows without a BMW Feedback Type or without a usable VFC topic are classified from the text.
        unclassified = [r for r in rows if r.feedback_type not in FEEDBACK_TYPES
                        or not taxonomy.topic_for_label(r.topic_l2)]
        verdicts = classify_rows(unclassified)
        signals = []
        for r in rows:
            _, answer = readers.split_question(r.text)
            topic, aspect = taxonomy.topic_for_label(r.topic_l2), taxonomy.aspect_for_label(r.topic_l3)
            l2 = r.topic_l2 if topic else None
            classified_by, confidence = ("bmw_label", "high") if topic else (None, None)
            extra = {"vfc_level2": r.topic_l2, "vfc_level3": r.topic_l3, "feedback_type": r.feedback_type,
                     "excel_row": r.excel_row, "bmw_source": r.source}
            v = verdicts.get(r.excel_row)
            model = pv = None
            if topic is None and v and v.topic_id:
                # Meta label (no_class_found, general enquiry): topic and aspect group from the text.
                topic, aspect, classified_by, confidence = v.topic_id, v.aspect_group or aspect, "llm", v.confidence
                model, pv = v.model, v.prompt_version
                if v.other_suggestion:
                    extra["other_suggestion"] = v.other_suggestion
            if r.feedback_type in FEEDBACK_TYPES:
                kind, severity = FEEDBACK_TYPES[r.feedback_type]
                extra["kind_source"] = "bmw_label"
                summary, validation, reason = _summary(kind, severity, l2, r.topic_l3), "valid", None
            else:
                kind, severity, extra["kind_source"] = v.kind, v.severity, v.source
                model, pv = v.model, v.prompt_version
                summary = v.summary or (_summary(kind, severity, l2, r.topic_l3) if kind else None)
                validation = "valid" if kind else "quarantined"
                reason = None if kind else "unclassified: no BMW feedback type and no classifier verdict"
            area = taxonomy.car_area_of(topic)
            signals.append({
                "record_id": f"bmw_feedback-{r.verbatim_id}", "run_id": run_id, "schema_version": SCHEMA_VERSION,
                "prompt_version": pv, "model": model, "customer_ref": r.verbatim_id,
                "market": country_to_market(r.country), "market_basis": "stated" if r.country else "unknown",
                "vehicle": vehicle, "chassis_code": r.chassis, "vehicle_role": "current",
                "evidence_role": "bmw_customer", "powertrain": POWERTRAIN.get(r.engine or "", "unknown"),
                "kind": kind, "severity": severity, "car_area": [area] if area else [], "feature_hint": l2,
                "feature_id": features.get(topic) if topic else None, "aspect_group": aspect,
                "classified_by": classified_by, "classification_confidence": confidence,
                "taxonomy_version": version if topic else None,
                "summary": summary, "quote": answer, "quote_start": r.text.find(answer),
                "reach": None, "reach_unit": "none", "scope_tag": _scope(aspect),
                "extra": extra, "validation": validation, "reject_reason": reason,
            })
        stored = audit.insert_many(conn, "signal", signals, actor="seed:feedback", run_id=run_id,
                                   rationale="one signal per classified topic row of the BMW feedback Excel")
        counts["signals"] += stored
        counts["quarantined"] += sum(1 for s in signals if s["validation"] == "quarantined")
    counts["taxonomy_review"] = service.queue_taxonomy_review(conn, actor="seed:feedback", run_id=run_id)
    return counts


def _series(vehicle: str) -> str:
    return {"F70": "1 Series", "G60": "5 Series", "G70": "7 Series"}.get(vehicle, vehicle)


def _scope(aspect_group: str | None) -> str:
    # Aspect group price is pricing, which is out of scope (CLAUDE.md); the signal stays visible.
    return "out_of_scope" if aspect_group == "price" else "in_scope"
