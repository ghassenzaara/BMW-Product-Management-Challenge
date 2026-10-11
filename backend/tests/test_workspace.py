"""The PM workspace (migration 0014): briefs, case work, proposals, requirement
versions and sign-off, plan. Offline: template texts, no LLM."""

import uuid

import pytest

from app import audit
from tests.test_api import ENGINEER, OTHER_PM, PM, api, h  # noqa: F401  (fixtures)
from tests.test_cases import world  # noqa: F401  (fixture)

HEAD = str(uuid.uuid4())
PM_CN = str(uuid.uuid4())


@pytest.fixture
def ws(api):
    conn = api["world"]["conn"]
    audit.update(conn, "app_user", {"id": uuid.UUID(PM)}, {"pm_role": "vehicle_pm", "region": "RoW"},
                 actor="seed:test")
    for uid, name, vehicles, pm_role, region in ((HEAD, "Katrin Head", [], "head", "global"),
                                                 (PM_CN, "Wei China", ["G60"], "vehicle_pm", "CN")):
        audit.insert(conn, "app_user", {"id": uuid.UUID(uid), "name": name, "role": "pm", "vehicles": vehicles,
                                        "pm_role": pm_role, "region": region}, actor="seed:test")
    conn.commit()
    return api


def test_case_card_texts_and_tags_are_filled(ws):
    c = ws["client"]
    board = c.get("/cases", params={"profile_id": ws["profile"]}, headers=h(PM)).json()
    row = next(r for r in board if r["id"] == ws["case_id"])
    assert row["short_title"] and row["summary"] and len(row["highlights"]) == 3
    assert row["case_type"] and row["change_depth"] and row["workflow"] == "new" and row["outcome"] is None
    assert set(row["factors"]) == set(row["contributions"]) and "reach" in row["factors"]


def test_workspace_brief_and_overlay(ws):
    c, conn = ws["client"], ws["world"]["conn"]
    me = c.get("/workspace", headers=h(PM)).json()
    assert me["config"]["name"] == "G60 / USA" and me["weight_profile_id"] == ws["profile"]
    assert me["needs_onboarding"] and me["brief"] is None
    from app.collab import briefs

    shared = briefs.ensure_shared(conn, "G60", uuid.UUID(PM))
    conn.commit()
    assert shared["values"]["marketWeights"] == {"EU": 0.0, "US": 0.52, "CN": 0.48, "RoW": 0.0}
    assert shared["meta"]["marketWeights"] == {**shared["meta"]["marketWeights"], "source": "data", "confirmed": False}
    values = {"thesis": "The sportiest business saloon", "targetCustomer": {"who": "both", "positioning": "premium"},
              "changeAmbition": {"level": "balanced", "innovationSlots": 3}, "protectList": ["Driving dynamics"],
              "dontFightOn": ["Lowest price"], "costEnvelope": {"sensitivity": "medium", "perCarBand": "mid"},
              "givens": {"platform": "CLAR", "sop": "2030", "frozen": [], "openReleases": ["next_gen"],
                         "cycle": "WLTP"}}
    saved = c.put("/briefs/BRIEF-G60", json={"values": values, "reasons": {}, "confirm": ["marketWeights"]},
                  headers=h(PM)).json()
    assert saved["brief"]["version"] == 2
    assert c.put("/briefs/BRIEF-G60", json={"values": {"thesis": "x"}}, headers=h(PM_CN)).status_code == 403
    me = c.get("/workspace", headers=h(PM)).json()
    assert not me["needs_onboarding"] and me["brief"]["confirmed"]
    # The China PM gets an overlay; a difference needs a reason and shows up as a conflict for the head.
    overlay = c.post("/briefs", json={"vehicle": "G60"}, headers=h(PM_CN)).json()
    assert overlay["kind"] == "overlay" and overlay["values"]["marketWeights"]["CN"] == 1
    url = f"/briefs/{overlay['id']}"
    different = {"costEnvelope": {"sensitivity": "high", "perCarBand": "low"}}
    assert c.put(url, json={"values": different}, headers=h(PM_CN)).status_code == 422
    assert c.put(url, json={"values": different, "reasons": {"costEnvelope": "price war in China"}},
                 headers=h(PM_CN)).status_code == 200
    conflicts = c.get("/brief-conflicts", headers=h(HEAD)).json()
    assert {x["field"] for x in conflicts} == {"marketWeights", "costEnvelope"}
    assert c.post(f"{url}/conflicts/costEnvelope", json={"resolution": "align", "rationale": "one envelope"},
                  headers=h(PM)).status_code == 403
    aligned = c.post(f"{url}/conflicts/costEnvelope", json={"resolution": "align", "rationale": "one envelope"},
                     headers=h(HEAD)).json()
    assert "costEnvelope" not in aligned["values"]
    assert any(n["type"] == "escalation" and n["user_id"] == PM_CN
               for n in c.get("/notifications", headers=h(PM_CN)).json())


def test_case_workflow_referral_and_ownership(ws):
    c, case_id = ws["client"], ws["case_id"]
    url = f"/cases/{case_id}/vehicles/G60/transition"
    out = c.post(url, json={"action": "start"}, headers=h(PM)).json()
    assert out["state"] == "open" and out["workflow"] == "investigating"
    page = c.get(f"/cases/{case_id}", headers=h(PM)).json()
    assert next(v for v in page["vehicles"] if v["vehicle"] == "G60")["owner_id"] == PM  # first PM owns it
    # Another PM of the line cannot change an owned case, but anyone may escalate to the head.
    assert c.post(url, json={"action": "ready"}, headers=h(PM_CN)).status_code == 403
    assert c.post(url, json={"action": "refer", "escalate": True, "rationale": "China vs USA"},
                  headers=h(PM_CN)).status_code == 200
    assert c.post(url, json={"action": "refer", "rationale": "x"}, headers=h(PM)).status_code == 409  # no receiver
    referred = c.post(url, json={"action": "refer", "to_user": OTHER_PM, "rationale": "also a 7 Series topic"},
                      headers=h(PM)).json()
    assert referred["state"] == "open" and referred["outcome"] == "referred"
    refs = c.get("/referrals", headers=h(OTHER_PM)).json()
    assert len(refs) == 1 and refs[0]["kind"] == "referral" and refs[0]["status"] == "pending"
    accepted = c.post(f"/referrals/{refs[0]['id']}/decision", json={"decision": "accept", "rationale": "mine too"},
                      headers=h(OTHER_PM)).json()
    # The receiver works the same case for their own line: no copy.
    assert accepted["status"] == "accepted" and accepted["linked_case_id"] == case_id
    assert accepted["linked_vehicle"] == "G70"
    page = c.get(f"/cases/{case_id}", headers=h(PM)).json()
    g70 = next(v for v in page["vehicles"] if v["vehicle"] == "G70")
    assert g70["state"] == "open" and g70["owner_id"] == OTHER_PM
    escalations = [r for r in c.get("/referrals", headers=h(HEAD)).json() if r["kind"] == "escalation"]
    resolved = c.post(f"/referrals/{escalations[0]['id']}/decision",
                      json={"decision": "resolve", "rationale": "build a China variant", "resolution": "variant"},
                      headers=h(HEAD)).json()
    assert resolved["status"] == "resolved" and resolved["resolution"].startswith("variant")
    # Parked and innovation keep the case open; reopen clears the outcome.
    assert c.post(url, json={"action": "reopen", "rationale": "back to work"}, headers=h(PM)).json()["outcome"] is None
    pooled = c.post(url, json={"action": "innovation", "rationale": "too big for G60", "horizon": "gen_after"},
                    headers=h(PM)).json()
    assert pooled["outcome"] == "innovation_pool"
    pool = c.get("/innovation", headers=h(OTHER_PM)).json()
    assert pool[0]["case_id"] == case_id and pool[0]["horizon"] == "gen_after"
    assert len(c.post(f"/innovation/{case_id}/vote", headers=h(OTHER_PM)).json()["votes"]) == 2


def test_stance_questions_notes_comments_proposals(ws):
    c, case_id = ws["client"], ws["case_id"]
    bad = c.put(f"/cases/{case_id}/stance", json={"overrides": {"costEnvelope": {"sensitivity": "low"}}},
                headers=h(PM))
    assert bad.status_code == 422  # an override needs a reason
    stance = c.put(f"/cases/{case_id}/stance", json={
        "ambition": "beat", "evidence_takes": [{"id": "t1", "text": "discount fleet drivers", "effect": "discount"}],
        "inside": [{"id": "i1", "kind": "supplier_tech", "text": "new fan supplier"}]}, headers=h(PM)).json()
    assert stance["ambition"] == "beat"
    q = c.post(f"/cases/{case_id}/questions", json={"addressee": "engineering", "question": "Can the fan be stronger?",
                                                     "why": "target"}, headers=h(PM)).json()
    assert q["id"].startswith("Q-") and q["status"] == "open"
    note = c.post(f"/cases/{case_id}/meeting-notes", json={"title": "Seat round", "attendees": ["Ben"],
                                                           "text": "Engineering: a stronger fan is feasible."},
                  headers=h(PM)).json()
    p = c.post("/proposals", json={"object_type": "case", "object_id": case_id, "source": "meeting_note",
                                   "kind": "question_answer", "summary": "Answer: feasible", "question_id": q["id"],
                                   "changes": [{"field": "answer", "before": None, "after": "feasible"}],
                                   "meeting_note_id": note["id"], "agent": "note_extractor"}, headers=h(PM)).json()
    assert p["created_by"] == "agent:note_extractor" and p["status"] == "pending"
    answered = c.patch(f"/questions/{q['id']}", json={"answer": "feasible", "answer_source": "meeting_note"},
                       headers=h(ENGINEER)).json()
    assert answered["status"] == "answered" and answered["answer_source"] == "meeting_note"
    done = c.post(f"/proposals/{p['id']}/decision", json={"accept": True}, headers=h(PM)).json()
    assert done["status"] == "accepted" and done["decided_by"] == PM
    assert c.post(f"/proposals/{p['id']}/decision", json={"accept": True}, headers=h(PM)).status_code == 422
    comment = c.post("/comments", json={"object_type": "case", "object_id": case_id,
                                        "body": "@Eng can you check the fan?"}, headers=h(PM)).json()
    assert comment["mentions"] == [ENGINEER]
    inbox = c.get("/notifications", headers=h(ENGINEER)).json()
    assert any(n["type"] == "mention" for n in inbox)
    page = c.get(f"/cases/{case_id}", headers=h(PM)).json()
    assert page["stances"] and page["questions"] and page["meeting_notes"] and page["proposals"]
    # The sidebar agent knows what people told the system, cited as PM context, never as a signal.
    told = c.post(f"/chat/case/{case_id}", json={"question": "What did engineering answer about the fan?"},
                  headers=h(PM)).json()
    assert f"[context:open_question:{q['id']}]" in told["content"] and "feasible" in told["content"]
    assert f"[context:meeting_note:{note['id']}]" in told["content"] and "PM context" in told["content"]
    assert set(told["cited_signals"]) <= set(told["retrieved_signals"])
    segments = c.get(f"/cases/{case_id}/segments", params={"vehicle": "G60"}, headers=h(PM)).json()
    assert {s["market"] for s in segments} == {"USA", "China"}
    trail = c.get("/audit", headers=h(PM)).json()
    assert {"open_question", "meeting_note", "proposal", "case_stance", "comment"} <= {e["object_type"] for e in trail}
    assert all(e["action"] != "view" for e in trail)


def test_requirement_draft_versions_and_sign_off(ws):
    c, case_id = ws["client"], ws["case_id"]
    url = f"/cases/{case_id}/vehicles/G60/transition"
    confirmed = c.post(url, json={"action": "confirm", "rationale": "PM round", "generate": False},
                       headers=h(PM)).json()
    assert confirmed["state"] == "confirmed" and confirmed["outcome"] == "confirmed" and not confirmed["requirements"]
    drafted = c.post(f"/cases/{case_id}/vehicles/G60/requirements/draft", json={
        "answers": [{"key": "scope", "value": "global", "by_default": False}], "market_scope": "global"},
        headers=h(PM)).json()
    assert len(drafted) == 1
    req = drafted[0]
    rid = req["id"]
    assert rid == f"REQ-G60-{case_id.split('-')[1]}" and req["owner_id"] == PM and req["market_scope"] == "global"
    assert req["description_parts"] and req["metrics"][0]["id"] == "m1" and req["short_title"]
    paths = {p["path"] for p in req["provenance"]}
    assert {"title", "description#0", "metrics.m1.target", "marketScope", "releaseTarget", "cost"} <= paths
    assert next(p for p in req["provenance"] if p["path"] == "marketScope")["ref"] == "shape.scope"
    # A regional variant of the China PM next to the global requirement.
    variant = c.post(f"/cases/{case_id}/vehicles/G60/requirements/draft", json={
        "market_scope": "CN", "variant_of": rid}, headers=h(PM_CN)).json()[0]
    assert variant["id"] == f"REQ-G60-CN-{case_id.split('-')[1]}" and variant["variant_of"] == rid
    # Editing makes a version; only the owner edits; a stale save is refused.
    assert c.patch(f"/requirements/{rid}", json={"title": "x", "rationale": "y"}, headers=h(PM_CN)).status_code == 403
    edited = c.patch(f"/requirements/{rid}", json={
        "description": "Front seats cool the driver within two minutes. It works in every market.",
        "cost_size": "L", "rationale": "sharper target", "expected_version": 1}, headers=h(PM)).json()
    assert edited["body_version"] == 2 and len(edited["description_parts"]) == 2 and edited["cost_source"] == "pm"
    assert "within two minutes" in edited["body_md"]
    assert c.patch(f"/requirements/{rid}", json={"title": "late", "rationale": "y", "expected_version": 1},
                   headers=h(PM)).status_code == 409
    fb = c.post(f"/requirements/{rid}/feedback", json={"source": "engineering", "text": "Two minutes is too tight",
                                                        "response": "compromise", "rationale": "three minutes"},
                headers=h(PM)).json()
    v3 = c.patch(f"/requirements/{rid}", json={"description": "Front seats cool the driver within three minutes.",
                                               "rationale": "after engineering feedback", "cause": "feedback",
                                               "feedback_id": fb["id"]}, headers=h(PM)).json()
    assert v3["body_version"] == 3
    # The PM's argument sheet is stored without making a version; an empty text clears it.
    sheet = c.patch(f"/requirements/{rid}", json={"argument_md": "## Why\n\nOwners sweat.", "rationale": "my wording"},
                    headers=h(PM)).json()
    assert sheet["argument_md"].startswith("## Why") and sheet["body_version"] == 3
    assert c.patch(f"/requirements/{rid}", json={"argument_md": "x", "rationale": "y"},
                   headers=h(PM_CN)).status_code == 403
    assert c.patch(f"/requirements/{rid}", json={"argument_md": "", "rationale": "back to the generated one"},
                   headers=h(PM)).json()["argument_md"] is None
    c.post(f"/requirements/{rid}/check", json={"issues": [{"id": "i1", "kind": "vague_word", "severity": "amber",
                                                           "field": "title", "message": "improve"}]}, headers=h(PM))
    page = c.get(f"/requirements/{rid}", headers=h(PM)).json()
    assert [v["version"] for v in page["versions"]] == [3, 2, 1] and page["versions"][0]["cause"] == "feedback"
    assert page["feedback"][0]["resulting_version"] == 3 and page["check"]["version"] == 3
    assert [v["id"] for v in page["variants"]] == [variant["id"]]
    # PM approves, only the head signs off; then plan and export.
    t = f"/requirements/{rid}/transition"
    assert c.post(t, json={"action": "sign_off", "rationale": "ok"}, headers=h(HEAD)).status_code == 409
    assert c.post(t, json={"action": "approve", "rationale": "top 10", "open_issues": {"red": 0, "amber": 1}},
                  headers=h(PM)).json()["status"] == "approved"
    assert any(n["type"] == "sign_off_request" for n in c.get("/notifications", headers=h(HEAD)).json())
    assert c.post(t, json={"action": "sign_off", "rationale": "ok"}, headers=h(PM)).status_code == 403
    back = c.post(t, json={"action": "send_back", "rationale": "target too soft"}, headers=h(HEAD)).json()
    assert back["status"] == "in_discussion" and back["sent_back_reason"] == "target too soft"
    c.post(t, json={"action": "approve", "rationale": "sharpened"}, headers=h(PM))
    assert c.post(t, json={"action": "sign_off", "rationale": "ok"}, headers=h(HEAD)).json()["status"] == "signed_off"
    assert c.post(t, json={"action": "plan", "rationale": "next gen"}, headers=h(PM)).json()["status"] == "planned"
    plan = c.get("/plans/G60", headers=h(PM)).json()
    feature = next(f for f in plan["features"] if rid in f["requirement_ids"])
    assert feature["action"] == "new" and feature["today"] == "absent" and feature["decided"]
    patched = c.patch(f"/plans/G60/features/{feature['id']}", json={"is_protected": True, "rationale": "core"},
                      headers=h(PM)).json()
    assert next(f for f in patched["features"] if f["id"] == feature["id"])["protected"]
    assert c.post(t, json={"action": "export", "rationale": "to codebeamer"}, headers=h(PM)).json()["status"] == \
        "exported"
    preview = c.post("/scores/preview", json={"profile_id": ws["profile"], "weights": {"severity": 5}},
                     headers=h(PM)).json()
    assert preview["cases"][0]["rank"] == 1 and any(r["requirement_id"] == rid for r in preview["requirements"])
    found = c.get("/cases", params={"profile_id": ws["profile"], "q": "seat", "state": ["open", "confirmed"]},
                  headers=h(PM))
    assert found.status_code == 200 and rid in next(r for r in found.json() if r["id"] == case_id)["requirement_ids"]
    hits = c.get("/search", params={"q": rid}, headers=h(PM)).json()
    assert hits and hits[0]["type"] == "requirement"


def test_loose_signals_start_a_case_within_one_topic(ws):
    c, conn = ws["client"], ws["world"]["conn"]
    from app.signals import embed, service
    from tests.test_cases import TOPICS, VENT

    proposals = []
    for i, (topic, text) in enumerate(((VENT, "Seat ventilation is loud at full speed"),
                                       (VENT, "The seat ventilation fan is noisy"),
                                       ("Navigation system", "The navigation voice is too loud"))):
        rid = f"reddit-loose-{i}"
        audit.insert(conn, "source_record", {"record_id": rid, "source_id": "reddit", "text_original": text,
                                             "content_hash": rid, "author_hash": rid, "market": "USA"},
                     actor="agent:feedback", key="record_id")
        proposals.append({"record_id": rid, "kind": "complaint", "severity": "difficult_to_use", "summary": text,
                          "quote": text, "topic_id": TOPICS[topic], "aspect_group": "comfort", "vehicle": "G60",
                          "market": "USA", "customer_ref": rid})
    assert service.ingest(conn, proposals, actor="agent:feedback")["valid"] == 3
    embed.backfill(conn)
    conn.commit()
    loose = c.get("/signals", params={"vehicle": "G60", "unassigned": True}, headers=h(PM)).json()
    assert loose["total"] == 3 and loose["items"][0]["source_name"] == "reddit"
    ids = {s["summary"]: s["id"] for s in loose["items"]}
    body = {"vehicle": "G60", "title": "Seat ventilation too loud", "rationale": "seen on the radar"}
    crossed = c.post("/cases", json={**body, "signal_ids": list(ids.values())}, headers=h(PM))
    assert crossed.status_code == 422 and "never crosses a topic" in crossed.json()["detail"]
    same = [v for k, v in ids.items() if "ventilation" in k]
    created = c.post("/cases", json={**body, "signal_ids": same}, headers=h(PM))
    assert created.status_code == 201
    page = c.get(f"/cases/{created.json()['id']}", headers=h(PM)).json()
    assert page["title"] == "Seat ventilation too loud" and page["vehicles"][0]["owner_id"] == PM
    assert page["vehicles"][0]["state"] == "open" and page["figures"]["signals"] == 2
    flow = c.get("/signals/flow", params={"vehicle": "G60"}, headers=h(PM)).json()
    assert sum(f["signals"] for f in flow) == c.get("/signals", params={"vehicle": "G60"}, headers=h(PM)).json()["total"]


def test_case_by_hand_pm_evidence_details_and_integrity(ws):
    c = ws["client"]
    from tests.test_cases import TOPICS

    body = {"vehicle": "G60", "title": "Rear passengers cannot charge their phones", "summary": "No USB-C in the rear",
            "rationale": "dealer feedback"}
    # By hand the fixed taxonomy still holds: one topic and one aspect group, never "other".
    assert c.post("/cases", json=body, headers=h(PM)).status_code == 422
    assert c.post("/cases", json={**body, "topic_id": "other", "aspect_group": "comfort"},
                  headers=h(PM)).status_code == 422
    made = c.post("/cases", json={**body, "topic_id": TOPICS["Navigation system"], "aspect_group": "comfort",
                                  "case_type": "new_feature"}, headers=h(PM))
    assert made.status_code == 201
    cid = made.json()["id"]
    page = c.get(f"/cases/{cid}", headers=h(PM)).json()
    assert page["car_area"] == "infotainment_hmi" and page["aspect_group"] == "comfort"  # car area from the topic
    assert page["case_type"] == "new_feature" and page["case_type_source"] == "pm"
    line = page["vehicles"][0]
    assert line["state"] == "open" and line["workflow"] == "new" and line["owner_id"] == PM
    assert any(r["id"] == cid for r in c.get("/cases", params={"profile_id": ws["profile"]}, headers=h(PM)).json())

    # Evidence added by hand: a stored record and a gated signal each; only the file row is a customer.
    url = f"/cases/{cid}/vehicles/G60/evidence"
    items = [{"type": "note", "text": "Dealers say rear passengers ask for charging.", "kind": "complaint",
              "market": "USA"},
             {"type": "link", "text": "The E-Class has two USB-C ports in the rear.", "url": "https://example.com/e",
              "kind": "competitor_fact", "market": "Europe"},
             {"type": "csv_row", "text": "My kids cannot charge their tablets in the back.", "source": "clinic.csv",
              "kind": "complaint", "market": "USA"}]
    assert c.post(url, json={"items": items, "rationale": "x"}, headers=h(PM_CN)).status_code == 403
    out = c.post(url, json={"items": items, "rationale": "dealer feedback and a clinic file"}, headers=h(PM)).json()
    assert len(out["added"]) == 3 and out["quarantined"] == []
    signals = c.get("/signals", params={"case_id": cid}, headers=h(PM)).json()
    assert signals["total"] == 3 and {s["source_id"] for s in signals["items"]} == {"pm_note", "pm_link", "pm_upload"}
    assert all(s["classified_by"] == "pm" and s["car_area"] == ["infotainment_hmi"] for s in signals["items"])
    page = c.get(f"/cases/{cid}", headers=h(PM)).json()
    assert page["figures"]["by_vehicle"]["G60"]["distinct_customers"] == 1
    integrity = c.get(f"/cases/{cid}/integrity", params={"vehicle": "G60"}, headers=h(PM)).json()
    assert integrity["signals"] == 3 and integrity["quotes_found"] == 3
    assert integrity["quote_failure_count"] == 0 and integrity["record_failure_count"] == 0
    records = c.post("/source-records/lookup", json={"record_ids": [s["record_id"] for s in signals["items"]]},
                     headers=h(PM)).json()
    assert len(records) == 3 and all(r["content_hash"] and r["text_original"] for r in records)

    # Names and classification are edited with a reason; the topic and the car area are not.
    details = f"/cases/{cid}/vehicles/G60/details"
    edited = c.patch(details, json={"short_title": "Rear charging", "change_depth": "part_module",
                                    "rationale": "clearer name"}, headers=h(PM)).json()
    assert edited["short_title"] == "Rear charging" and edited["change_depth_source"] == "pm"
    assert c.patch(details, json={"summary": "x"}, headers=h(PM_CN)).status_code == 403

    # Exports made in the workspace are logged and show in the audit list.
    assert c.post("/access-log", json={"action": "export", "object_type": "vehicle_plan", "object_id": "G60",
                                       "detail": "2 requirements exported"}, headers=h(PM)).status_code == 201
    log = c.get("/audit", headers=h(PM)).json()
    assert any(e["object_type"] == "vehicle_plan" and e["action"] == "export" for e in log)
