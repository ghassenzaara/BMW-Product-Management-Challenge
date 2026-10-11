"""Source registry seed from docs/05-web-sources/fetching-sources.md.

Two steps, so the parsed result can be reviewed before it is loaded:
1. ``build()`` parses the markdown into ``backend/seed/registry.yaml``.
2. ``load(conn)`` loads the YAML into source_registry, vehicle, competitor,
   site_slug and search_term (audited, actor seed:registry).
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from app import audit
from app.config import BACKEND_DIR, SOURCES_FILE

REGISTRY_YAML = BACKEND_DIR / "seed" / "registry.yaml"
ACTOR = "seed:registry"

# Sources that are not on the web but come with the challenge (no fetch step).
INTERNAL_SOURCES = [
    {"source_id": "bmw_feedback", "name": "BMW customer feedback (provided Excel)", "categories": ["A", "B"],
     "country": "Global", "level": "model", "access": "Internal", "check_status": "provided"},
    {"source_id": "bmw_study", "name": "BMW customer study 2025 (provided Excel)", "categories": ["G"],
     "country": "Global", "level": "model", "access": "Internal", "check_status": "provided"},
    {"source_id": "bmw_sales", "name": "BMW sales volumes 2024-2030 (provided Excel)", "categories": ["F"],
     "country": "Global", "level": "market", "access": "Internal", "check_status": "provided"},
    {"source_id": "option_list", "name": "BMW option lists, German market, July 2026 (provided PDF)",
     "categories": ["E"], "country": "DE", "level": "model", "access": "Internal", "check_status": "provided"},
]

# BMW lines and predecessors (fetching-sources 2.1, 2.2; markets from the sales file).
# on_sale_since: precision as stated in the sources file (year or month).
VEHICLES = [
    {"code": "F70", "series": "1 Series", "segment": "entry", "generation": "4th generation",
     "on_sale_since": "2024-01-01", "on_sale_precision": "year", "predecessor_code": "F40", "is_current": True,
     "variants": ["116", "118", "120", "120d", "123 xDrive", "M135"], "slugs": ["1-series"],
     "wikipedia_page": "BMW 1 Series (F70)",
     "names": {"en": ["1 Series"], "de": ["1er"], "fr": ["Série 1"], "it": ["Serie 1"], "es": ["Serie 1"],
               "nl": ["1 Serie"]}},
    {"code": "G60", "series": "5 Series", "segment": "business", "generation": "8th generation",
     "on_sale_since": "2023-01-01", "on_sale_precision": "year", "predecessor_code": "G30", "is_current": True,
     "variants": ["520i", "530i", "540i", "550e", "530e", "i5 eDrive40", "i5 xDrive40", "i5 M60", "M5"],
     "slugs": ["5-series", "i5", "m5"], "wikipedia_page": "BMW 5 Series (G60)",
     "chassis_aliases": ["G61", "G68", "G90", "G99"],
     "names": {"en": ["5 Series", "i5"], "de": ["5er", "i5"], "fr": ["Série 5"], "it": ["Serie 5"],
               "es": ["Serie 5"], "nl": ["5 Serie"], "zh": ["宝马5系", "宝马i5"]}},
    {"code": "G70", "series": "7 Series", "segment": "luxury", "generation": "7th generation",
     "on_sale_since": "2022-07-01", "on_sale_precision": "month", "predecessor_code": "G11", "is_current": True,
     "variants": ["740i", "750e", "760i", "i7 eDrive50", "i7 xDrive60", "i7 M70"], "slugs": ["7-series", "i7"],
     "wikipedia_page": "BMW 7 Series (G70)",
     "names": {"en": ["7 Series", "i7"], "de": ["7er", "i7"], "fr": ["Série 7"], "it": ["Serie 7"],
               "es": ["Serie 7"], "nl": ["7 Serie"], "zh": ["宝马7系", "宝马i7"]}},
    {"code": "F40", "series": "1 Series", "segment": "entry", "generation": "3rd generation",
     "on_sale_since": "2019-01-01", "on_sale_precision": "year", "is_current": False},
    {"code": "G30", "series": "5 Series", "segment": "business", "generation": "7th generation",
     "on_sale_since": "2017-02-01", "on_sale_precision": "month", "is_current": False,
     "chassis_aliases": ["G31", "G38"]},
    {"code": "G11", "series": "7 Series", "segment": "luxury", "generation": "6th generation",
     "on_sale_since": "2015-01-01", "on_sale_precision": "year", "is_current": False, "chassis_aliases": ["G12"]},
]

# Collision rules (2.4): bare names that must be searched with the brand.
COLLIDING_BARE_TERMS = {"i5", "i7", "G70", "G80", "G90", "G60", "F70", "G30", "F40", "ES", "LS", "A3", "A6",
                        "A8", "Golf", "Leon", "Han", "001", "Dolphin", "Air", "Model S"}

_ROW = re.compile(r"^\|\s*`(?P<id>[a-z0-9-]+)`\s*\|(?P<rest>.*)\|\s*$")


def _cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _sections(text: str) -> dict[str, str]:
    """Split by '### x.y' headings."""
    parts = re.split(r"^### ", text, flags=re.M)
    return {p.split("\n", 1)[0].strip(): p for p in parts[1:]}


def parse_sources(text: str) -> list[dict]:
    sources = []
    body = text.split("## 3. Source list", 1)[1].split("### 3.9", 1)[0]
    for line in body.splitlines():
        m = _ROW.match(line)
        if not m:
            continue
        cells = _cells(line)
        if len(cells) != 9:
            continue
        sid, name, url, cats, country, level, access, check, step = cells
        sources.append({
            "source_id": sid.strip("`"),
            "name": name,
            "url_pattern": url,
            "categories": [c.strip() for c in cats.split(",") if c.strip()],
            "country": country,
            "level": level,
            "access": access,
            "check_status": check,
            "fetch_step": int(step),
            "enabled": int(step) <= 9,
        })
    return sources


def parse_competitors(text: str) -> list[dict]:
    """Section 2.3: three tables, one per BMW line."""
    body = text.split("### 2.3 Competitors", 1)[1].split("### 2.4", 1)[0]
    blocks = re.split(r"\*\*Rivals of the ", body)[1:]
    line_of = {"1 Series": "F70", "5 Series": "G60", "7 Series": "G70"}
    out = []
    for block in blocks:
        series = next(s for s in line_of if block.startswith(s))
        bmw = line_of[series]
        for line in block.splitlines():
            if not line.startswith("|") or line.startswith("|---") or "Competitor" in line:
                continue
            cells = _cells(line)
            name, gen = cells[0], cells[1]
            wiki = cells[-1].strip("`")
            de_fr = cells[2] if len(cells) >= 4 else ""
            zh = cells[3] if len(cells) == 5 else ""
            brand, model = _split_brand(re.sub(r"\s*\(.*?\)", "", name))
            names = {"en": name}
            if de_fr and de_fr != "not sold in Europe":
                de, _, fr = de_fr.partition(" / ")
                names["de"], names["fr"] = de.strip(), (fr or de).strip()
            if zh and zh.rstrip(" ✓") not in ("not sold in China", "n/a"):
                names["zh"] = zh.rstrip(" ✓").strip()
            notes = " ".join(cells).lower()
            out.append({
                "bmw_vehicle": bmw,
                "brand": brand,
                "model": model,
                "label": name,
                "generation": gen.rstrip(" ✓"),
                "names": names,
                "wikipedia_page": wiki,
                "not_sold_in": [m for m, key in (("China", "not sold in china"), ("Europe", "not sold in europe"))
                                if key in notes],
                "status": "ended" if "production ended" in notes else "active",
            })
    return out


BRANDS = ["Mercedes-Benz", "Mercedes", "Audi", "VW", "Volkswagen", "Cupra", "MG", "BYD", "Tesla", "Genesis",
          "Lexus", "NIO", "Nio", "Zeekr", "Xiaomi", "Porsche", "Lucid", "Maextro", "Hongqi"]


def _split_brand(name: str) -> tuple[str, str]:
    for b in BRANDS:
        if name.startswith(b + " "):
            brand = {"Mercedes": "Mercedes-Benz", "VW": "Volkswagen", "Nio": "NIO"}.get(b, b)
            return brand, name[len(b) + 1:].strip()
    if name == "MG4":
        return "MG", "MG4"
    return name.split(" ", 1)[0], name.split(" ", 1)[-1]


def parse_slugs(text: str) -> list[dict]:
    """Section 3.10: slug of each vehicle on each of the 10 sites."""
    body = text.split("### 3.10", 1)[1].split("## 4.", 1)[0]
    lines = [l for l in body.splitlines() if l.startswith("|")]
    header = [c.replace("`", "").strip() for c in _cells(lines[0])]
    sites = [h.split(" ")[0] for h in header[1:]]
    out = []
    for line in lines[2:]:
        cells = _cells(line)
        m = re.match(r"(?P<label>.+?) \(`(?P<slug>[^`]+)`\)", cells[0])
        if not m:
            continue
        standard = m["slug"]
        for site, cell in zip(sites, cells[1:]):
            ticks = re.findall(r"`([^`]+)`", cell)
            if ticks:
                for t in ticks:
                    out.append({"label": m["label"], "source_id": site, "slug": t, "note": cell})
            elif cell.startswith("✓"):
                bodies = [b.strip() for b in cell[1:].split(",") if b.strip()]
                if site == "whatcar" and bodies:
                    for b in bodies:
                        out.append({"label": m["label"], "source_id": site, "slug": f"{standard}/{b}", "note": ""})
                else:
                    note = cell[1:].strip()
                    slug = standard
                    if site in ("carwow", "autoexpress") and slug.startswith("mercedes-benz/"):
                        slug = slug.replace("mercedes-benz/", "mercedes/", 1)
                    out.append({"label": m["label"], "source_id": site, "slug": slug, "note": note})
    return out


def build(sources_file: Path = SOURCES_FILE, out: Path = REGISTRY_YAML) -> dict:
    text = sources_file.read_text(encoding="utf-8")
    data = {
        "parsed_from": "docs/05-web-sources/fetching-sources.md",
        "vehicles": VEHICLES,
        "sources": INTERNAL_SOURCES + parse_sources(text),
        "competitors": parse_competitors(text),
        "slugs": parse_slugs(text),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=140), encoding="utf-8")
    return data


def _vehicle_label(code: str, data: dict) -> str:
    v = next(v for v in data["vehicles"] if v["code"] == code)
    return f"BMW {v['series']}"


def search_terms(data: dict) -> list[dict]:
    terms = []
    for v in data["vehicles"]:
        if not v.get("is_current"):
            terms.append({"subject_type": "vehicle", "subject_id": v["code"], "term": f"BMW {v['code']}",
                          "language": "en", "collision_safe": True, "scope": "any"})
            continue
        for lang, names in v.get("names", {}).items():
            for n in names:
                term = n if lang == "zh" else f"BMW {n}"
                terms.append({"subject_type": "vehicle", "subject_id": v["code"], "term": term, "language": lang,
                              "collision_safe": True, "scope": "any"})
                if lang == "en":
                    terms.append({"subject_type": "vehicle", "subject_id": v["code"], "term": n, "language": lang,
                                  "collision_safe": n not in COLLIDING_BARE_TERMS, "scope": "single_brand_source"})
        terms.append({"subject_type": "vehicle", "subject_id": v["code"], "term": f"BMW {v['code']}",
                      "language": "en", "collision_safe": True, "scope": "any"})
    return terms


def load(conn, data: dict | None = None) -> dict[str, int]:
    data = data or yaml.safe_load(REGISTRY_YAML.read_text(encoding="utf-8"))
    counts = {}
    rationale = "registry seed parsed from fetching-sources.md"

    counts["source_registry"] = audit.insert_many(conn, "source_registry", (
        {k: s[k] for k in ("source_id", "name", "url_pattern", "categories", "country", "level", "access",
                           "check_status", "fetch_step", "enabled") if k in s}
        for s in data["sources"]
    ), actor=ACTOR, rationale=rationale, key="source_id", on_conflict_do_nothing=True)

    vehicles = sorted(data["vehicles"], key=lambda v: v.get("is_current", False))  # predecessors first
    for v in vehicles:
        audit.insert(conn, "vehicle", {
            "code": v["code"], "series": v["series"], "segment": v["segment"], "generation": v["generation"],
            "on_sale_since": v["on_sale_since"], "predecessor_code": v.get("predecessor_code"),
            "is_current": v.get("is_current", False), "variants": v.get("variants", []),
        }, actor=ACTOR, rationale=rationale, key="code", on_conflict_do_nothing=True)
    counts["vehicle"] = len(vehicles)

    competitor_ids: dict[str, str] = {}
    for c in data["competitors"]:
        row = audit.insert(conn, "competitor", {
            "bmw_vehicle": c["bmw_vehicle"], "brand": c["brand"], "model": c["model"],
            "generation": c["generation"], "names": c["names"], "wikipedia_page": c["wikipedia_page"],
            "status": c["status"], "origin": "registry", "confirmed": True,
        }, actor=ACTOR, rationale=rationale, on_conflict_do_nothing=True)
        if row:
            competitor_ids.setdefault(c["label"], str(row["id"]))
            # Slug table labels omit the China notes in brackets ("Audi A6 (A6L in China)").
            competitor_ids.setdefault(re.sub(r"\s*\(.*?\)", "", c["label"]).strip(), str(row["id"]))
    counts["competitor"] = len(data["competitors"])

    vehicle_by_label = {_vehicle_label(v["code"], data): v["code"] for v in data["vehicles"] if v.get("is_current")}
    vehicle_by_label.update({"BMW i5": "G60", "BMW M5": "G60", "BMW i7": "G70"})
    slug_rows = []
    for s in data["slugs"]:
        if s["label"] in vehicle_by_label:
            subject = ("vehicle", vehicle_by_label[s["label"]])
        elif s["label"] in competitor_ids:
            subject = ("competitor", competitor_ids[s["label"]])
        else:
            continue
        slug_rows.append({"subject_type": subject[0], "subject_id": subject[1], "source_id": s["source_id"],
                          "slug": s["slug"], "note": s["note"] or None})
    counts["site_slug"] = audit.insert_many(conn, "site_slug", slug_rows, actor=ACTOR, rationale=rationale,
                                            key=("subject_type", "subject_id", "source_id", "slug"),
                                            on_conflict_do_nothing=True)

    terms = search_terms(data)
    for c in data["competitors"]:
        cid = competitor_ids.get(c["label"])
        if not cid:
            continue
        base = c["model"] if c["model"].startswith(c["brand"]) else f"{c['brand']} {c['model']}"
        terms.append({"subject_type": "competitor", "subject_id": cid, "term": base,
                      "language": "en", "collision_safe": True, "scope": "any"})
        for lang in ("de", "fr", "zh"):
            if lang in c["names"]:
                term = c["names"][lang] if lang == "zh" else f"{c['brand']} {c['names'][lang]}"
                terms.append({"subject_type": "competitor", "subject_id": cid, "term": term, "language": lang,
                              "collision_safe": True, "scope": "any"})
    counts["search_term"] = audit.insert_many(conn, "search_term", terms, actor=ACTOR, rationale=rationale,
                                              on_conflict_do_nothing=True)
    return counts


EXTRA_SLUGS = REGISTRY_YAML.parent / "slugs_extra.yaml"


def load_extra_slugs(conn) -> int:
    """Slugs written as prose in fetching-sources 3.4 / 3.9 (seed/slugs_extra.yaml). Idempotent."""
    data = yaml.safe_load(EXTRA_SLUGS.read_text(encoding="utf-8"))
    rows = []
    for code, sites in data["vehicles"].items():
        for source_id, slugs in sites.items():
            rows += [{"subject_type": "vehicle", "subject_id": code, "source_id": source_id, "slug": str(sl)}
                     for sl in slugs]
    for c in data["competitors"]:
        found = conn.execute("select id from competitor where bmw_vehicle = %s and brand = %s and model = %s",
                             (c["bmw_vehicle"], c["brand"], c["model"])).fetchone()
        if not found:
            continue
        for source_id, slugs in c.items():
            if source_id in ("bmw_vehicle", "brand", "model"):
                continue
            rows += [{"subject_type": "competitor", "subject_id": str(found["id"]), "source_id": source_id,
                      "slug": str(sl)} for sl in slugs]
    known = {r["source_id"] for r in conn.execute("select source_id from source_registry").fetchall()}
    rows = [r for r in rows if r["source_id"] in known]
    return audit.insert_many(conn, "site_slug", rows, actor=ACTOR, key=("subject_type", "subject_id", "source_id", "slug"),
                             rationale="slugs from fetching-sources 3.4 / 3.9 (seed/slugs_extra.yaml)",
                             on_conflict_do_nothing=True)


DECISIONS = REGISTRY_YAML.parent / "source_decisions.yaml"


def apply_source_decisions(conn) -> int:
    """Fetch cadence per source and disabled sources (seed/source_decisions.yaml). Idempotent."""
    data = yaml.safe_load(DECISIONS.read_text(encoding="utf-8"))
    by_step = {int(k): int(v) for k, v in data["refresh_days_by_step"].items()}
    changed = 0
    for src in conn.execute("select source_id, fetch_step, enabled from source_registry").fetchall():
        sid = src["source_id"]
        changes = {"refresh_days": int(data.get("refresh_days", {}).get(sid) or by_step.get(src["fetch_step"] or 0, 1))}
        reason = (data.get("disabled") or {}).get(sid)
        if reason:
            changes.update(enabled=False, disabled_reason=reason.strip())
        before = conn.execute("select refresh_days, enabled, disabled_reason from source_registry"
                              " where source_id = %s", (sid,)).fetchone()
        if any(before[k] != v for k, v in changes.items()):
            audit.update(conn, "source_registry", {"source_id": sid}, changes, actor=ACTOR,
                         rationale=f"source decision (seed/source_decisions.yaml){': ' + reason.strip() if reason else ''}")
            changed += 1
    return changed


if __name__ == "__main__":
    d = build()
    print(f"{len(d['sources'])} sources, {len(d['competitors'])} competitors, {len(d['slugs'])} slugs -> {REGISTRY_YAML}")
