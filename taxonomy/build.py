"""Validate the taxonomy CSVs against BMW's feedback data and build the generated files.

    python taxonomy/build.py

Inputs (hand-edited, the source of truth):
    taxonomy/car_areas.csv   the 11 car areas (level 1, UI chips)
    taxonomy/topics.csv      BMW VFC level 2 label -> topic_id -> car_area
    taxonomy/aspects.csv     BMW VFC level 3 label -> aspect_group
Outputs (generated, do not edit):
    taxonomy/taxonomy.json   what the classifier, backend and UI load
    taxonomy/classifier.schema.json  structured-output schema for the LLM (closed topic enum)
    taxonomy/prompt_topics.md        the topic list pasted into the classifier prompt
    taxonomy/eval/gold.csv   BMW-labelled verbatims with their canonical topics (dev/test split)
    taxonomy/eval/unlabeled.csv  verbatims BMW could not classify (no_class_found), to backfill

Fails with exit code 1 if any label in the data is unmapped or the CSVs are inconsistent.
"""
import csv
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FEEDBACK = ROOT.parent / "docs" / "02-bmw-data" / "processed" / "feedback_rows.csv"
VERSION = "2026-10-11.1"
ASPECT_GROUPS = {
    "function": "Does the feature exist and do its job (incl. missing equipment).",
    "usability": "How easy it is to operate; ergonomics; can't switch it off.",
    "reliability": "Defects, faults, things that stop working.",
    "performance": "Power, speed, responsiveness, strength of an effect.",
    "efficiency_range": "Consumption, efficiency, electric range, charging infrastructure.",
    "design": "Look and styling.",
    "comfort": "Physical comfort.",
    "space": "Size, room, storage, view.",
    "quality": "Materials, workmanship, damage, leaks, rattles, smells.",
    "sound": "Noise and sound.",
    "price": "Price-performance, standard vs. paid option.",
}


def read(name):
    with open(ROOT / name, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def fail(errors):
    for e in errors:
        print("ERROR:", e, file=sys.stderr)
    sys.exit(1)


def main():
    areas = read("car_areas.csv")
    topics = read("topics.csv")
    aspects = read("aspects.csv")
    area_ids = {a["car_area"] for a in areas}
    by_id = {t["topic_id"]: t for t in topics}
    errors = []

    # --- consistency of the CSVs ---
    if len(by_id) != len(topics):
        errors.append("duplicate topic_id in topics.csv")
    for t in topics:
        if t["status"] not in {"active", "alias", "meta", "fallback"}:
            errors.append(f"{t['topic_id']}: unknown status {t['status']}")
        if t["status"] in {"active", "alias"} and t["car_area"] not in area_ids:
            errors.append(f"{t['topic_id']}: unknown car_area '{t['car_area']}'")
        if t["status"] == "alias" and by_id.get(t["alias_of"], {}).get("status") != "active":
            errors.append(f"{t['topic_id']}: alias_of must point to an active topic")
        if t["status"] == "alias" and by_id[t["alias_of"]]["car_area"] != t["car_area"]:
            errors.append(f"{t['topic_id']}: alias and its target must share a car_area")
    for a in aspects:
        if a["aspect_group"] not in ASPECT_GROUPS:
            errors.append(f"aspect '{a['vfc_level3']}': unknown group {a['aspect_group']}")

    vfc_to_topic = {t["vfc_level2"]: t for t in topics if t["vfc_level2"]}
    level3_to_group = {a["vfc_level3"]: a["aspect_group"] for a in aspects}

    def canonical(topic_id):
        t = by_id[topic_id]
        return t["alias_of"] if t["status"] == "alias" else topic_id

    # --- coverage of BMW's labels ---
    with open(FEEDBACK, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    counts = defaultdict(lambda: defaultdict(set))
    verbatims = {}
    for r in rows:
        t = vfc_to_topic.get(r["topic"])
        if t is None:
            errors.append(f"VFC level 2 label not mapped: {r['topic']!r}")
            continue
        if r["aspect"] and r["aspect"] not in level3_to_group:
            errors.append(f"VFC level 3 label not mapped: {r['aspect']!r}")
        v = verbatims.setdefault(r["id"], {"id": r["id"], "model": r["model"], "country": r["country"],
                                           "engine": r["engine"], "text": r["text"], "topics": set(), "meta": False})
        if t["status"] == "meta":
            v["meta"] = True
            continue
        cid = canonical(t["topic_id"])
        v["topics"].add(cid)
        counts[cid][r["model"]].add(r["id"])
    if errors:
        fail(sorted(set(errors)))

    # --- taxonomy.json ---
    active = [t for t in topics if t["status"] == "active"]
    out_topics = []
    for t in active:
        aliases = [x["vfc_level2"] for x in topics if x["alias_of"] == t["topic_id"]]
        per_model = {m: len(ids) for m, ids in sorted(counts[t["topic_id"]].items())}
        out_topics.append({
            "id": t["topic_id"],
            "label": t["vfc_level2"],
            "car_area": t["car_area"],
            "hint": t["hint"] or None,
            "vfc_level2": [t["vfc_level2"], *aliases],
            "n_verbatims": len(set().union(*counts[t["topic_id"]].values())) if counts[t["topic_id"]] else 0,
            "n_by_model": per_model,
        })
    out_topics.sort(key=lambda t: (t["car_area"], -t["n_verbatims"], t["label"].lower()))
    taxonomy = {
        "version": VERSION,
        "source": "BMW VFC level 2/3 labels from docs/02-bmw-data/processed/feedback_rows.csv",
        "car_areas": [{"id": a["car_area"], "label": a["label"], "description": a["description"]} for a in areas],
        "topics": out_topics,
        "fallback_topic": "other",
        "aspect_groups": [{"id": k, "description": v} for k, v in ASPECT_GROUPS.items()],
        "vfc_level2_to_topic": {t["vfc_level2"]: (canonical(t["topic_id"]) if t["status"] in {"active", "alias"} else None)
                                for t in topics if t["vfc_level2"]},
        "vfc_level3_to_aspect_group": level3_to_group,
    }
    (ROOT / "taxonomy.json").write_text(json.dumps(taxonomy, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # --- classifier artifacts: output schema (closed enums) and the topic list for the prompt ---
    topic_enum = [t["id"] for t in out_topics] + ["other"]
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": f"FindingClassification (taxonomy {VERSION})",
        "type": "object",
        "additionalProperties": False,
        "required": ["findings"],
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["topic_id", "aspect_group", "quote", "summary", "confidence", "other_suggestion"],
                    "properties": {
                        "topic_id": {"type": "string", "enum": topic_enum},
                        "aspect_group": {"type": "string", "enum": list(ASPECT_GROUPS)},
                        "quote": {"type": "string", "description": "Exact excerpt of the input text this finding is about."},
                        "summary": {"type": "string", "description": "Max 20 words, English."},
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                        "other_suggestion": {
                            "type": ["string", "null"],
                            "description": "Only when topic_id is 'other': a short proposed topic name for human review. Otherwise null.",
                        },
                    },
                },
            }
        },
    }
    (ROOT / "classifier.schema.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")

    lines = [f"# Topic list, taxonomy {VERSION}. Use only these topic_id values, or 'other'.", ""]
    for a in areas:
        lines.append(f"## {a['car_area']}: {a['label']}")
        for t in out_topics:
            if t["car_area"] == a["car_area"]:
                lines.append(f"- {t['id']}: {t['label']}" + (f" ({t['hint']})" if t["hint"] else ""))
        lines.append("")
    lines.append("## aspect_group")
    lines += [f"- {k}: {v}" for k, v in ASPECT_GROUPS.items()]
    (ROOT / "prompt_topics.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # --- eval sets ---
    area_of = {t["topic_id"]: t["car_area"] for t in active}
    gold, unlabeled = [], []
    for v in sorted(verbatims.values(), key=lambda v: v["id"]):
        base = {k: v[k] for k in ("id", "model", "country", "engine")}
        if v["topics"]:
            split = "dev" if int(hashlib.sha1(v["id"].encode()).hexdigest(), 16) % 10 == 0 else "test"
            gold.append({**base, "split": split, "gold_topics": ";".join(sorted(v["topics"])),
                         "gold_areas": ";".join(sorted({area_of[t] for t in v["topics"]})), "text": v["text"]})
        elif v["meta"]:
            unlabeled.append({**base, "text": v["text"]})
    (ROOT / "eval").mkdir(exist_ok=True)
    for name, data in (("gold.csv", gold), ("unlabeled.csv", unlabeled)):
        with open(ROOT / "eval" / name, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(data[0].keys()))
            w.writeheader()
            w.writerows(data)

    n_dev = sum(g["split"] == "dev" for g in gold)
    print(f"taxonomy {VERSION}: {len(areas)} car areas, {len(active)} topics "
          f"({len(topics) - len(active)} alias/meta/fallback), {len(ASPECT_GROUPS)} aspect groups")
    print(f"BMW labels covered: {len(vfc_to_topic)} level 2, {len(level3_to_group)} level 3")
    print(f"eval/gold.csv: {len(gold)} verbatims ({n_dev} dev, {len(gold) - n_dev} test); "
          f"eval/unlabeled.csv: {len(unlabeled)}")
    for a in areas:
        n = sum(1 for t in active if t["car_area"] == a["car_area"])
        print(f"  {a['car_area']:<22} {n:>3} topics")


if __name__ == "__main__":
    main()
