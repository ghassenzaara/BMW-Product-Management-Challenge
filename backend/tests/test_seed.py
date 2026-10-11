"""Phase 2: seed from the provided data. Counts are checked against
docs/02-bmw-data/README.md."""

import pytest

from app.seed import classify, option_lists, readers, registry
from app.config import RAW_DATA_DIR, SOURCES_FILE
from app.seed.option_load import FILES, item_feature, tech_data

README_COUNTS = {
    # vehicle: rows, unique ids, Likes, Difficult to Use, Defect, Wants
    "F70": (4076, 2128, 1630, 595, 491, 273),
    "G60": (5005, 4000, 1951, 1306, 435, 582),
    "G70": (4690, 4000, 1890, 1119, 481, 518),
}


@pytest.mark.parametrize("vehicle", ["F70", "G60", "G70"])
def test_feedback_reader_matches_readme(vehicle):
    rows = readers.read_feedback(vehicle)
    total, ids, likes, dtu, defect, wants = README_COUNTS[vehicle]
    assert len(rows) == total
    assert len({r.verbatim_id for r in rows}) == ids
    types = [r.feedback_type for r in rows]
    assert (types.count("Likes"), types.count("Difficult to Use"), types.count("Defect"), types.count("Wants")) == (
        likes, dtu, defect, wants)


def test_survey_question_prefix_is_stripped_and_answer_is_substring():
    text = 'If there was one comment, what would you want to say to them?\n: "Really love this car!"'
    question, answer = readers.split_question(text)
    assert question.endswith("to them?") and answer == "Really love this car!" and answer in text
    assert readers.split_question("plain text") == (None, "plain text")


def test_sales_reader_flags_suspect_values():
    sales = {(s.vehicle, s.market, s.year): s for s in readers.read_sales()}
    assert sales[("G60", "USA", 2030)].units == 80000
    assert sales[("F70", "China", 2024)].units is None and sales[("F70", "China", 2024)].suspect
    assert sales[("F70", "Rest of World", 2030)].suspect and not sales[("G70", "Rest of World", 2030)].suspect


def test_study_reader_normalizes_both_sheets():
    study = readers.read_study()
    cn_eu = [s for s in study if s.sheet == "CN_EU_2025"]
    us = [s for s in study if s.sheet == "US_2025"]
    assert len(cn_eu) == 37 * 5
    assert len(us) == 2 * len({s.attribute for s in us}) and len(us) > 150
    overall = next(s for s in cn_eu if s.attribute == "Overall product satisfaction" and s.model_label.endswith("G68"))
    assert overall.vehicle == "G60" and overall.market == "China" and abs(overall.normalized - 0.877) < 0.001
    assert all(0 <= s.normalized <= 1 for s in study)
    assert all(s.dissatisfied_share is not None for s in us)


def test_registry_parse_matches_sources_file():
    text = SOURCES_FILE.read_text(encoding="utf-8")
    sources = registry.parse_sources(text)
    assert len(sources) == 130
    assert len({s["source_id"] for s in sources}) == 130
    assert sum(1 for s in sources if s["enabled"]) == 82  # fetch steps 1 to 9
    competitors = registry.parse_competitors(text)
    assert len(competitors) == 27
    assert {c["bmw_vehicle"] for c in competitors} == {"F70", "G60", "G70"}
    lucid = next(c for c in competitors if c["model"] == "Air")
    assert lucid["not_sold_in"] == ["China"]


def test_option_list_grid_g60():
    items, texts, variants = option_lists.extract(RAW_DATA_DIR / FILES["G60"])
    assert len(variants) == 10 and variants[0] == "i5 eDrive40"
    comfort = next(i for i in items if i.name == "COMFORT PAKET")
    assert comfort.sa_code == "7VB" and comfort.base_price == 2750
    assert comfort.availability["i5 M60 xDrive"] == "optional" and comfort.prices["i5 M60 xDrive"] == 1150
    vent = next(i for i in items if i.name == "Aktive Sitzbelüftung vorn")
    assert vent.package == "COMFORT PAKET" and set(vent.availability.values()) == {"optional"}
    steptronic = next(i for i in items if i.name == "Steptronic Getriebe mit Schaltwippen")
    assert "i5 eDrive40" not in steptronic.availability  # electric models have no gearbox
    assert item_feature("Aktive Sitzbelüftung vorn") == "seating_ventilate_heat"


def test_tech_data_g60_range():
    items, texts, variants = option_lists.extract(RAW_DATA_DIR / FILES["G60"])
    rows = tech_data("G60", texts, variants)
    r = next(r for r in rows if r["variant"] == "i5 eDrive40" and r["metric"] == "electric range WLTP")
    assert r["value"] == 513 and r["value_text"] == "513 – 627"


def test_heuristic_classifier():
    assert classify.heuristic("the screen keeps freezing").kind == "complaint"
    assert classify.heuristic("the screen keeps freezing").severity == "defect"
    assert classify.heuristic("I wish it had a heated steering wheel").kind == "wish"
    assert classify.heuristic("love the seats").kind == "like"
    assert classify.heuristic("it is a car").kind is None


# ---- seeded database -------------------------------------------------------------


def test_seed_counts(sconn):
    q = lambda sql, *p: sconn.execute(sql, p).fetchone()["n"]  # noqa: E731
    assert q("select count(*) n from source_record where source_id = 'bmw_feedback'") == 2128 + 4000 + 4000
    assert q("select count(*) n from signal where record_id like 'bmw_feedback-%%'") == 4076 + 5005 + 4690
    for vehicle, (_, ids, likes, dtu, defect, wants) in README_COUNTS.items():
        assert q("select count(distinct customer_ref) n from signal where vehicle = %s", vehicle) == ids
        got = sconn.execute(
            "select extra->>'feedback_type' t, count(*) n from signal where vehicle = %s group by 1", (vehicle,)
        ).fetchall()
        got = {r["t"]: r["n"] for r in got}
        assert (got["Likes"], got["Difficult to Use"], got["Defect"], got["Wants"]) == (likes, dtu, defect, wants)
    assert q("select count(*) n from source_registry") == 134
    assert q("select count(*) n from competitor") == 27
    assert q("select count(*) n from site_slug") == 231 + 71  # 3.10 table + seed/slugs_extra.yaml (3.4, 3.9)
    assert q("select count(*) n from config") == 10
    assert q("select count(*) n from weight_profile where is_default") == 10
    assert q("select count(*) n from vehicle_feature") > 3000
    assert q("select count(*) n from data_record where source_id = 'bmw_sales'") == 36


def test_taxonomy_seed(sconn):
    """Car areas, topics and aspect groups come from taxonomy/; BMW rows are mapped by lookup."""
    q = lambda sql, *p: sconn.execute(sql, p).fetchone()["n"]  # noqa: E731
    assert q("select count(*) n from car_area") == 11
    assert q("select count(*) n from aspect_group") == 11
    assert q("select count(*) n from feature") == 219 + 1  # topics + the fallback "other"
    assert q("select count(*) n from feature where topic_id is null") == 0
    # 11,214 rows carry a usable VFC label; no_class_found and general enquiry (2,557) wait for the LLM.
    assert q("select count(*) n from signal where classified_by = 'bmw_label'") == 11214
    assert q("select count(*) n from signal where feature_id is null") == 2557
    assert q("select count(*) n from signal where feature_id is not null and aspect_group is null") == 0
    # The stored car area is always the car area of the topic.
    assert q("select count(*) n from signal s join feature f on f.id = s.feature_id"
             " where s.car_area <> array[f.car_area]") == 0
    assert q("select count(*) n from signal where aspect_group = 'price' and scope_tag = 'in_scope'") == 0
    assert q("select count(*) n from signal where aspect_group = 'price'") == 116
    assert q("select count(*) n from study_score where feature_id is not null") > 0
    assert q("select count(*) n from vehicle_feature where feature_id is not null") > 0


def test_every_seed_quote_is_in_its_record(sconn):
    bad = sconn.execute(
        "select count(*) n from signal s join source_record r using (record_id)"
        " where s.quote is not null and strpos(r.text_original, s.quote) = 0"
    ).fetchone()["n"]
    assert bad == 0


def test_every_seeded_row_is_audited(sconn):
    for table, object_type, key in [("signal", "signal", "id::text"), ("source_record", "source_record", "record_id"),
                                    ("vehicle_feature", "vehicle_feature", "id::text"),
                                    ("study_score", "study_score", "id::text")]:
        missing = sconn.execute(
            f"select count(*) n from {table} t where not exists (select 1 from audit_event a"
            f" where a.object_type = %s and a.object_id = t.{key} and a.action = 'create')",
            (object_type,),
        ).fetchone()["n"]
        assert missing == 0, table


def test_markets_and_configs(sconn):
    rows = sconn.execute("select code, markets_sold::text[] m from vehicle where is_current order by code").fetchall()
    assert {r["code"]: sorted(r["m"]) for r in rows} == {
        "F70": ["Europe", "Rest of World"],
        "G60": ["China", "Europe", "Rest of World", "USA"],
        "G70": ["China", "Europe", "Rest of World", "USA"],
    }
    lucid = sconn.execute("select markets::text[] m from competitor where model = 'Air'").fetchone()["m"]
    assert "China" not in lucid
    g60_usa = sconn.execute("select competitor_ids from config where vehicle = 'G60' and market = 'USA'").fetchone()
    assert len(g60_usa["competitor_ids"]) == 11
