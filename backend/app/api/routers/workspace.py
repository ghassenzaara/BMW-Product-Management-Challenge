"""The PM workspace: people, series briefs, case work (stance, questions, notes,
referrals, innovation pool, alerts, comments), AI proposals, requirement versions
and sign-off, the vehicle plan, what-if scores, search and the global audit list.

Rows are returned as stored (snake_case, backend vocabulary); JSON columns marked
"UI shape" in database-design.md are passed through unchanged.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import audit
from app.api.auth import User, current_user, require_pm
from app.api.deps import conn, request_id
from app.cases import queries
from app.collab import briefs, casework, people, plan, proposals
from app.rag import index
from app.requirements import generator, service
from app.scoring import rank, score

router = APIRouter(tags=["workspace"])
ObjectType = Literal["case", "requirement"]
Addressee = Literal["engineering", "finance", "design", "quality", "market_pm", "purchasing", "other"]
Region = Literal["global", "RoW", "CN"]
Release = Literal["next_gen", "current_car", "ota"]
CaseType = Literal["new_feature", "fix_improve", "performance_target", "quality_perception", "market_variant",
                   "brand_differentiator", "regression"]
ChangeDepth = Literal["trim_option", "part_module", "platform_powertrain", "software_ota"]


# ---- people and workspace -----------------------------------------------------------

@router.get("/users")
def users(c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return people.users(c)


@router.get("/workspace")
def my_workspace(c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """My config (vehicle x market) and weight profile, my brief and whether I still have to answer it."""
    ws = people.workspace(c, user)
    cfg = c.execute("select id, name, vehicle, market from config where id = %s", (ws["config_id"],)).fetchone()
    vehicle = cfg["vehicle"] if cfg else (user.vehicles[0] if user.vehicles else None)
    return {**ws, "config": cfg,
            "brief": briefs.resolve(c, vehicle, user.id) if vehicle and user.pm_role == "vehicle_pm" else None,
            "needs_onboarding": briefs.needs_onboarding(c, user)}


class WorkspaceIn(BaseModel):
    config_id: str | None = None
    weight_profile_id: str | None = None
    source_filter: dict[str, Any] | None = None
    watchlist: dict[str, list[str]] | None = None


@router.put("/workspace")
def save_workspace(body: WorkspaceIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    people.update_workspace(c, user, body.model_dump(), request_id=request_id())
    return my_workspace(c, user)


# ---- series briefs (PM context layer 1) -----------------------------------------------

@router.get("/briefs")
def list_briefs(vehicle: str | None = None, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return c.execute("select * from series_brief where %s::text is null or vehicle = %s order by vehicle, kind desc,"
                     " id", (vehicle, vehicle)).fetchall()


@router.get("/briefs/mine")
def my_brief(vehicle: str | None = None, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    vehicle = vehicle or (user.vehicles[0] if user.vehicles else None)
    if vehicle is None:
        return {"resolved": None, "shared": None, "overlay": None, "proposals": []}
    base, over = briefs.shared(c, vehicle), briefs.overlay(c, vehicle, user.id)
    ids = [b["id"] for b in (base, over) if b]
    return {"resolved": briefs.resolve(c, vehicle, user.id) if user.pm_role == "vehicle_pm" else None,
            "shared": base, "overlay": over, "proposals": proposals.listing(c, "brief", ids) if ids else []}


class OverlayIn(BaseModel):
    vehicle: str


@router.post("/briefs", status_code=201)
def create_overlay(body: OverlayIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """My regional overlay on the shared brief of my line (holds only what differs)."""
    row = briefs.create_overlay(c, body.vehicle, user, request_id=request_id())
    index.refresh_context(c)
    return row


class BriefIn(BaseModel):
    values: dict[str, Any] = {}
    reasons: dict[str, str] = {}
    confirm: list[str] | None = None
    clear: list[str] | None = None


@router.put("/briefs/{brief_id}")
def save_brief(brief_id: str, body: BriefIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Save brief answers. Returns the requirements drafted with the changed fields (for review)."""
    row, impact = briefs.save(c, brief_id, user, body.values, body.reasons, body.confirm, body.clear,
                              request_id=request_id())
    index.refresh_context(c)
    return {"brief": row, "impact": impact}


class BriefValuesIn(BaseModel):
    values: dict[str, Any]


@router.post("/briefs/{brief_id}/impact")
def brief_impact(brief_id: str, body: BriefValuesIn, c=Depends(conn), user: User = Depends(current_user)) -> list:
    """Which requirements a change of these fields would touch; nothing is stored."""
    brief = briefs.get(c, brief_id)
    return briefs.affected_requirements(c, brief, briefs.changed_fields(brief, body.values))


class BriefFieldIn(BaseModel):
    value: Any
    source: Literal["doc", "pm"] = "pm"
    reason: str | None = None


@router.post("/briefs/{brief_id}/fields/{field}")
def set_brief_field(brief_id: str, field: str, body: BriefFieldIn, c=Depends(conn),
                    user: User = Depends(current_user)) -> dict:
    """One accepted proposal (strategy doc, learning) sets one brief field."""
    row = briefs.apply_field(c, brief_id, field, body.value, user, source=body.source, reason=body.reason,
                             request_id=request_id())
    index.refresh_context(c)
    return row


@router.get("/brief-conflicts")
def brief_conflicts(c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return briefs.all_conflicts(c)


class ConflictIn(BaseModel):
    resolution: Literal["regional_variant", "align"]
    rationale: str = Field(min_length=1)


@router.post("/briefs/{brief_id}/conflicts/{field}")
def resolve_brief_conflict(brief_id: str, field: str, body: ConflictIn, c=Depends(conn),
                           user: User = Depends(current_user)) -> dict:
    row = briefs.resolve_conflict(c, brief_id, field, body.resolution, body.rationale, user,
                                  request_id=request_id())
    index.refresh_context(c)
    return row


# ---- case work ------------------------------------------------------------------------

class CaseIn(BaseModel):
    vehicle: str
    title: str = Field(min_length=3)
    summary: str = ""
    signal_ids: list[str] = []
    scope: Region = "global"
    rationale: str = Field(min_length=1)
    # A case started by hand has no signals yet: the PM picks its topic and aspect group.
    topic_id: str | None = None
    aspect_group: str | None = None
    case_type: CaseType | None = None
    change_depth: ChangeDepth | None = None


@router.post("/cases", status_code=201, tags=["cases"])
def create_case(body: CaseIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Start a case from signals that belong to no case yet (one topic and one aspect group),
    or by hand with a topic and an aspect group of the fixed taxonomy (evidence is added after)."""
    from app.api.routers.cases import _refresh

    if body.signal_ids:
        case = casework.create_case(c, user, body.vehicle, body.signal_ids, body.title, body.summary,
                                    body.rationale, scope=body.scope, request_id=request_id())
    elif body.topic_id and body.aspect_group:
        case = casework.create_empty_case(c, user, body.vehicle, body.topic_id, body.aspect_group, body.title,
                                          body.summary, body.rationale, scope=body.scope,
                                          case_type=body.case_type, change_depth=body.change_depth,
                                          request_id=request_id())
    else:
        raise HTTPException(422, "a case needs signals, or a topic and an aspect group when started by hand")
    _refresh(c, case["id"])
    index.refresh_page(c, "case", case["id"])
    return {"id": case["id"], "vehicle": body.vehicle}


class CaseDetails(BaseModel):
    title: str | None = None
    short_title: str | None = None
    summary: str | None = None
    case_type: CaseType | None = None
    change_depth: ChangeDepth | None = None
    rationale: str | None = None


@router.patch("/cases/{case_id}/vehicles/{vehicle}/details", tags=["cases"])
def case_details(case_id: str, vehicle: str, body: CaseDetails, c=Depends(conn),
                 user: User = Depends(current_user)) -> dict:
    """Names and classification of a case (title, short title, summary, type, change depth).
    The topic and the car area are fixed by the taxonomy and are not edited here."""
    row = casework.update_details(c, case_id, vehicle, user, body.model_dump(exclude={"rationale"}),
                                  body.rationale, request_id=request_id())
    index.refresh_page(c, "case", case_id)
    return row


class EvidenceItem(BaseModel):
    type: Literal["csv_row", "link", "note"]
    text: str = Field(min_length=3)
    title: str | None = None
    url: str | None = None
    source: str | None = None   # file name of an uploaded row
    kind: Literal["complaint", "wish", "like", "competitor_fact", "trend", "innovation"]
    market: Literal["USA", "China", "Europe", "Rest of World", "unknown"] = "unknown"


class EvidenceIn(BaseModel):
    items: list[EvidenceItem] = Field(min_length=1, max_length=500)
    rationale: str = Field(min_length=1)


@router.post("/cases/{case_id}/vehicles/{vehicle}/evidence", status_code=201, tags=["cases"])
def add_evidence(case_id: str, vehicle: str, body: EvidenceIn, c=Depends(conn),
                 user: User = Depends(current_user)) -> dict:
    """Evidence a PM adds by hand: each item becomes a stored source record and a signal
    that passed the validation gate. Only file rows count as customers."""
    from app.api.routers.cases import _refresh

    out = casework.add_evidence(c, case_id, vehicle, user, [i.model_dump() for i in body.items], body.rationale,
                                request_id=request_id())
    _refresh(c, case_id)
    index.refresh_page(c, "case", case_id)
    return out


@router.get("/cases/{case_id}/integrity", tags=["cases"])
def case_integrity(case_id: str, vehicle: str | None = None, c=Depends(conn),
                   user: User = Depends(current_user)) -> dict:
    """Recheck now: every quote of the case is found in its stored source record, every record is intact."""
    return casework.evidence_integrity(c, case_id, vehicle)


class RecordLookup(BaseModel):
    record_ids: list[str] = Field(max_length=100)


@router.post("/source-records/lookup", tags=["signals"])
def source_records(body: RecordLookup, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    """The stored source records behind signals (text, url, hash taken at capture)."""
    return c.execute(
        "select r.record_id, r.source_id, coalesce(sr.name, r.source_id) as source_name, r.url, r.title,"
        " r.text_original, r.content_hash, r.fetched_at from source_record r left join source_registry sr"
        " on sr.source_id = r.source_id where r.record_id = any(%s) and r.deleted_at is null"
        " and r.text_original is not null", (body.record_ids,)).fetchall()


class AccessIn(BaseModel):
    action: Literal["export", "view"]
    object_type: Literal["case", "requirement", "vehicle_plan"]
    object_id: str = Field(min_length=1)
    detail: str | None = None


@router.post("/access-log", status_code=201, tags=["collaboration"])
def log_access(body: AccessIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Views and exports made in the PM workspace (markdown, hand-over file, deck, replay) are logged too."""
    seq = audit.write(c, action=body.action, object_type=body.object_type, object_id=body.object_id,
                      actor=user.actor, rationale=body.detail, request_id=request_id())
    return {"seq": seq}


class WorkIn(BaseModel):
    owner_id: str | None = None
    co_owner_ids: list[str] | None = None
    watcher_ids: list[str] | None = None
    scope: Region | None = None
    rationale: str | None = None


@router.patch("/cases/{case_id}/vehicles/{vehicle}/work", tags=["cases"])
def assign(case_id: str, vehicle: str, body: WorkIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Owner, co-owners, watchers and scope of the case for one line."""
    return casework.assign(c, case_id, vehicle, user, body.model_dump(exclude={"rationale"}),
                           rationale=body.rationale, request_id=request_id())


class StanceIn(BaseModel):
    overrides: dict[str, Any] = {}
    override_reasons: dict[str, str] = {}
    evidence_takes: list[dict] = []
    inside: list[dict] = []
    ambition: Literal["fix", "match", "beat"] | None = None
    pending_shape: list[dict] | None = None


@router.put("/cases/{case_id}/stance", tags=["cases"])
def save_stance(case_id: str, body: StanceIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """My stance on this case (PM context layer 2)."""
    row = casework.save_stance(c, case_id, user, body.model_dump(exclude_none=True), request_id=request_id())
    index.refresh_context(c)
    return row


@router.get("/cases/{case_id}/segments", tags=["cases"])
def case_segments(case_id: str, vehicle: str | None = None, c=Depends(conn),
                  user: User = Depends(current_user)) -> list[dict]:
    """Customer segments (market, market x powertrain) counted from BMW customer signals only."""
    return casework.segments(c, case_id, vehicle)


class QuestionIn(BaseModel):
    addressee: Addressee
    contact: str | None = None
    question: str = Field(min_length=3)
    why: str = ""
    due_date: str | None = None
    fields_affected: list[str] = []
    vehicle: str | None = None


@router.post("/{object_type}s/{object_id}/questions", status_code=201)
def create_question(object_type: ObjectType, object_id: str, body: QuestionIn, c=Depends(conn),
                    user: User = Depends(current_user)) -> dict:
    row = casework.create_question(c, object_type, object_id, user, body.model_dump(), vehicle=body.vehicle,
                                   request_id=request_id())
    index.refresh_context(c)
    return row


@router.get("/questions")
def list_questions(all: bool = False, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return casework.questions(c, user, all)


class QuestionPatch(BaseModel):
    addressee: Addressee | None = None
    contact: str | None = None
    question: str | None = None
    why: str | None = None
    status: Literal["open", "answered", "dropped"] | None = None
    answer: str | None = None
    due_date: str | None = None
    answer_source: Literal["meeting_note", "chat", "manual"] = "manual"


@router.patch("/questions/{question_id}")
def patch_question(question_id: str, body: QuestionPatch, c=Depends(conn),
                   user: User = Depends(current_user)) -> dict:
    row = casework.update_question(c, question_id, user, body.model_dump(exclude={"answer_source"}),
                                   source=body.answer_source, request_id=request_id())
    index.refresh_context(c)
    return row


class NoteIn(BaseModel):
    title: str
    held_on: str | None = None
    attendees: list[str] = []
    text: str = Field(min_length=10)
    vehicle: str | None = None


@router.post("/cases/{case_id}/meeting-notes", status_code=201, tags=["cases"])
def add_meeting_note(case_id: str, body: NoteIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    row = casework.add_meeting_note(c, case_id, user, body.model_dump(), vehicle=body.vehicle,
                                    request_id=request_id())
    index.refresh_context(c)
    return row


@router.get("/comments")
def comments(object_type: ObjectType, object_id: str, c=Depends(conn),
             user: User = Depends(current_user)) -> list[dict]:
    return c.execute("select * from comment where object_type = %s and object_id = %s order by created_at",
                     (object_type, object_id)).fetchall()


class CommentIn(BaseModel):
    object_type: ObjectType
    object_id: str
    body: str = Field(min_length=1)


@router.post("/comments", status_code=201)
def add_comment(body: CommentIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    row = casework.add_comment(c, body.object_type, body.object_id, user, body.body, request_id=request_id())
    index.refresh_context(c)
    return row


# ---- referrals, innovation pool, alerts ---------------------------------------------------

@router.get("/referrals")
def list_referrals(c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return casework.referrals(c, user)


class ReferralDecision(BaseModel):
    decision: Literal["accept", "decline", "escalate", "resolve"]
    rationale: str = Field(min_length=1)
    resolution: Literal["one_market", "variant", "keep_both", "take_over", "return"] | None = None


@router.post("/referrals/{referral_id}/decision")
def decide_referral(referral_id: str, body: ReferralDecision, c=Depends(conn),
                    user: User = Depends(current_user)) -> dict:
    row = casework.decide_referral(c, referral_id, user, body.decision, body.rationale, body.resolution,
                                   request_id=request_id())
    if body.decision == "accept":
        score.score_case(c, row["case_id"], row["linked_vehicle"])  # the case may be new to the receiver's line
    return row


@router.get("/innovation")
def innovation(c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return c.execute(
        "select i.*, c.title, c.short_title, c.summary, f.topic_id, f.name as topic, f.car_area"
        " from innovation_item i join case_item c on c.id = i.case_id join feature f on f.id = c.feature_id"
        " order by cardinality(i.votes) desc, i.created_at").fetchall()


@router.post("/innovation/{case_id}/vote")
def vote(case_id: str, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    return casework.vote(c, case_id, user, request_id=request_id())


class PullIn(BaseModel):
    vehicle: str
    rationale: str = Field(min_length=1)


@router.post("/innovation/{case_id}/pull")
def pull(case_id: str, body: PullIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Pull an innovation into my line: the same case now applies to it, open and mine."""
    row = casework.pull(c, case_id, body.vehicle, user, body.rationale, request_id=request_id())
    score.score_case(c, case_id, body.vehicle)
    return row


@router.get("/alerts")
def list_alerts(all: bool = False, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return casework.alerts(c, user, all)


class AlertIn(BaseModel):
    status: Literal["dismissed", "rework"]
    rationale: str = Field(min_length=1)


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, body: AlertIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    return casework.resolve_alert(c, alert_id, user, body.status, body.rationale, request_id=request_id())


# ---- proposals ------------------------------------------------------------------------

class ProposalIn(BaseModel):
    object_type: Literal["case", "requirement", "brief"]
    object_id: str
    source: Literal["chat", "meeting_note", "monitor", "strategy_doc", "feedback", "brief_change", "learning"]
    kind: Literal["field", "body", "question_answer", "new_question", "new_requirement", "brief_field",
                  "new_version"]
    summary: str
    changes: list[dict] = []
    question_id: str | None = None
    citations: list[str] = []
    meeting_note_id: str | None = None
    agent: str = Field(pattern=r"^[a-z_]+$", description="the proposing agent, e.g. note_extractor")


@router.post("/proposals", status_code=201)
def create_proposal(body: ProposalIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Record an AI proposal for a person to decide. The proposing agent is the actor."""
    return proposals.create(c, body.model_dump(exclude={"agent"}), agent=body.agent, requested_by=user.actor,
                            request_id=request_id())


@router.get("/proposals")
def list_proposals(object_type: str | None = None, object_id: str | None = None, status: str | None = None,
                   c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    return proposals.listing(c, object_type, [object_id] if object_id else None, status)


class ProposalDecision(BaseModel):
    accept: bool
    note: str | None = None


@router.post("/proposals/{proposal_id}/decision")
def decide_proposal(proposal_id: str, body: ProposalDecision, c=Depends(conn),
                    user: User = Depends(current_user)) -> dict:
    """Record the decision. A page edit of the assistant is applied here; every other
    kind is applied by the caller through the object's own endpoint first."""
    if user.role not in ("pm", "engineer", "admin"):
        raise HTTPException(403, "only PMs and engineers decide proposals")
    row = proposals.decide(c, proposal_id, user, body.accept, body.note, request_id=request_id())
    if body.accept and row["chat_message_id"]:
        index.refresh_page(c, row["object_type"], row["object_id"])
    return row


# ---- requirements: structured content, versions, sign-off ---------------------------------

class RequirementPatch(BaseModel):
    title: str | None = None
    short_title: str | None = None
    description: str | None = None
    description_parts: list[str] | None = None
    market_scope: Region | None = None
    release_target: Release | None = None
    change_depth: Literal["trim_option", "part_module", "platform_powertrain", "software_ota"] | None = None
    metrics: list[dict] | None = None
    acceptance_criteria: list[str] | None = None
    assumptions: list[str] | None = None
    evidence_level: Literal["bmw_data", "web", "assumption"] | None = None
    cost_size: Literal["S", "M", "L"] | None = None
    cost_band: str | None = None
    cost_source: Literal["option_price", "ai_estimate", "pm", "engineering", "finance"] | None = None
    cost_note: str | None = None
    provenance: list[dict] | None = None
    shape_answers: list[dict] | None = None
    # The PM's edited argument sheet (markdown); an empty text goes back to the generated one.
    argument_md: str | None = None
    rationale: str = Field(min_length=1)
    expected_version: int | None = None
    cause: Literal["edit", "feedback", "brief_change"] = "edit"
    feedback_id: str | None = None


@router.patch("/requirements/{rid}", tags=["requirements"])
def patch_requirement(rid: str, body: RequirementPatch, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Edit the SMART fields: a new version with a reason (409 when someone saved first)."""
    fields = body.model_dump(exclude={"rationale", "expected_version", "cause", "feedback_id", "argument_md"},
                             exclude_none=True)
    if body.argument_md is not None:
        # Not part of a version: the argument sheet is the PM's presentation of the same content.
        current = c.execute("select * from requirement where id = %s", (rid,)).fetchone()
        if current is None:
            raise HTTPException(404, f"{rid} not found")
        if not service.can_edit(user, current):
            raise HTTPException(403, f"only the owner changes {rid}")
        row = audit.update(c, "requirement", {"id": rid}, {"argument_md": body.argument_md.strip() or None},
                           actor=user.actor, rationale=body.rationale, request_id=request_id())
        if not fields:
            return row
    if body.cause == "edit":
        row = service.patch(c, rid, user, fields, body.rationale, expected_version=body.expected_version,
                            request_id=request_id())
    else:
        current = c.execute("select * from requirement where id = %s", (rid,)).fetchone()
        if current is None:
            raise HTTPException(404, f"{rid} not found")
        if not service.can_edit(user, current):
            raise HTTPException(403, f"only the owner changes {rid}")
        row = service.apply_version(c, rid, fields, cause=body.cause, actor=user.actor, rationale=body.rationale,
                                    expected_version=body.expected_version, feedback_id=body.feedback_id,
                                    request_id=request_id())
        if body.feedback_id:
            audit.update(c, "requirement_feedback", {"id": body.feedback_id},
                         {"resulting_version": row["body_version"]}, actor=user.actor,
                         rationale="version created from this feedback", request_id=request_id())
    index.refresh_page(c, "requirement", rid)
    return row


class RequirementAction(BaseModel):
    action: Literal["discuss", "approve", "send_back", "sign_off", "plan", "export", "reject", "restore"]
    rationale: str = Field(min_length=1)
    open_issues: dict[str, int] | None = None


@router.post("/requirements/{rid}/transition", tags=["requirements"])
def requirement_transition(rid: str, body: RequirementAction, c=Depends(conn),
                           user: User = Depends(current_user)) -> dict:
    """PM: discuss, approve, plan, reject, restore. Head of product line: send back, sign off."""
    return service.transition(c, rid, user, body.action, body.rationale, open_issues=body.open_issues,
                              request_id=request_id())


class FeedbackIn(BaseModel):
    source: Addressee
    text: str = Field(min_length=3)
    response: Literal["accept", "push_back", "compromise"]
    rationale: str = Field(min_length=1)
    signal_ids: list[str] = []


@router.post("/requirements/{rid}/feedback", status_code=201, tags=["requirements"])
def add_feedback(rid: str, body: FeedbackIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Engineering or finance feedback and the PM's response (PM context layer 4)."""
    row = service.add_feedback(c, rid, user, body.model_dump(), request_id=request_id())
    index.refresh_context(c)
    return row


class FeedbackLink(BaseModel):
    proposal_id: str


@router.patch("/requirements/feedback/{feedback_id}", tags=["requirements"])
def link_feedback(feedback_id: str, body: FeedbackLink, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    return audit.update(c, "requirement_feedback", {"id": feedback_id}, {"proposal_id": body.proposal_id},
                        actor=user.actor, rationale="new-version proposal for this feedback", request_id=request_id())


class CheckIn(BaseModel):
    engine: Literal["rules", "rules+llm"] = "rules"
    issues: list[dict] = []
    trigger: str = "Run by the PM"


@router.post("/requirements/{rid}/check", status_code=201, tags=["requirements"])
def save_check(rid: str, body: CheckIn, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """Store the result of a quality-check run (warns, never blocks)."""
    return service.save_check(c, rid, body.engine, body.issues, f"{body.trigger} ({user.actor})",
                              request_id=request_id())


class DraftIn(BaseModel):
    answers: list[dict] = []
    market_scope: Region | None = None
    release_target: Release | None = None
    variant_of: str | None = None


@router.post("/cases/{case_id}/vehicles/{vehicle}/requirements/draft", status_code=201, tags=["requirements"])
def draft_requirements(case_id: str, vehicle: str, body: DraftIn, c=Depends(conn),
                       user: User = Depends(current_user)) -> list[dict]:
    """Draft the requirement of a confirmed case with my brief, my stance and my shape answers."""
    require_pm(user, vehicle)
    created = generator.generate(c, case_id, vehicle, request_id=request_id(), user=user, answers=body.answers,
                                 market_scope=body.market_scope, release_target=body.release_target,
                                 variant_of=body.variant_of)
    for r in created:
        index.refresh_page(c, "requirement", r["id"])
    return created


# ---- vehicle plan ---------------------------------------------------------------------

@router.get("/plans/{vehicle}", tags=["plan"])
def get_plan(vehicle: str, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """The successor plan: features (topics) with today's equipment, the PM's decision and linked requirements."""
    return plan.plan(c, vehicle)


class PlanPatch(BaseModel):
    action: Literal["keep", "new", "improve", "remove"] | None = None
    release: Release | None = None
    is_protected: bool | None = None
    note: str | None = None
    rationale: str = Field(min_length=1)


@router.patch("/plans/{vehicle}/features/{topic_id}", tags=["plan"])
def patch_plan_feature(vehicle: str, topic_id: str, body: PlanPatch, c=Depends(conn),
                       user: User = Depends(current_user)) -> dict:
    plan.patch_feature(c, vehicle, topic_id, user, body.model_dump(exclude={"rationale"}), body.rationale,
                       request_id=request_id())
    return plan.plan(c, vehicle)


# ---- what-if scores, search, global audit list, chat messages of scripted flows ------------------

class Preview(BaseModel):
    profile_id: str
    weights: dict[str, float]


@router.post("/scores/preview", tags=["scoring"])
def preview_scores(body: Preview, c=Depends(conn), user: User = Depends(current_user)) -> dict:
    """What-if ranking for unsaved weights, from the stored factor values of the profile
    (score = brand multiplier x sum(weight x factor) / sum(weight)). Nothing is stored."""
    profile = c.execute("select * from weight_profile where id = %s", (body.profile_id,)).fetchone()
    if profile is None:
        raise HTTPException(404, "weight profile not found")
    unknown = set(body.weights) - set(score.FACTORS)
    if unknown:
        raise HTTPException(422, f"unknown factors {sorted(unknown)}")
    weights = score.normalize_weights({**profile["case_weights"], **body.weights})
    cases = []
    for r in rank.case_board(c, body.profile_id):
        factors = r["factors"] or {}
        contributions = {f: round(float(factors.get(f, {}).get("normalized") or 0) * w, 4)
                         for f, w in weights.items()}
        cases.append({"case_id": r["id"], "manual_rank": r["manual_rank"], "contributions": contributions,
                      "score": round(sum(contributions.values()) * float(r["brand_multiplier"] or 0.8), 4)})
    manual = sorted((x for x in cases if x["manual_rank"] is not None), key=lambda x: x["manual_rank"])
    auto = sorted((x for x in cases if x["manual_rank"] is None), key=lambda x: -x["score"])
    for i, x in enumerate(manual + auto, start=1):
        x["rank"] = i
    by_case = {x["case_id"]: x["score"] for x in cases}
    reqs = [{"requirement_id": r["id"],
             "score": rank.requirement_rank(by_case.get(r["case_id"]), r["cost_size"], profile["cost_multipliers"]) or 0}
            for r in service.board(c, body.profile_id, statuses=service.LIVE)]
    for i, r in enumerate(sorted(reqs, key=lambda r: -r["score"]), start=1):
        r["rank"] = i
    return {"profile_id": body.profile_id, "weights": weights, "cases": manual + auto, "requirements": reqs}


@router.get("/search")
def search(q: str, vehicle: str | None = None, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    """Cases, requirements, people and signals by id or text."""
    q = q.strip()
    if not q:
        return []
    like = f"%{q}%"
    out = [{"type": "case", "id": r["id"], "title": r["title"], "subtitle": f"{r['id']} · {r['topic']}"}
           for r in c.execute(
               "select c.id, c.title, f.name as topic from case_item c join feature f on f.id = c.feature_id"
               " where (c.id ilike %s or c.title ilike %s or f.name ilike %s) and (%s::text is null or exists"
               " (select 1 from case_vehicle cv where cv.case_id = c.id and cv.vehicle = %s and cv.state <> 'observed'))"
               " order by c.id limit 10", (like, like, like, vehicle, vehicle)).fetchall()]
    out += [{"type": "requirement", "id": r["id"], "title": r["title"], "subtitle": f"{r['id']} · {r['status']}"}
            for r in c.execute("select id, title, status from requirement where status <> 'deleted' and"
                               " (id ilike %s or title ilike %s) order by id limit 8", (like, like)).fetchall()]
    out += [{"type": "user", "id": str(r["id"]), "title": r["name"], "subtitle": r["title"] or r["role"]}
            for r in c.execute("select id, name, title, role from app_user where name ilike %s or title ilike %s"
                               " order by name limit 5", (like, like)).fetchall()]
    if len(q) > 3:
        try:
            ids = [uuid.UUID(q)]
        except ValueError:
            ids = []
        out += [{"type": "signal", "id": str(r["id"]), "title": r["summary"], "subtitle": r["record_id"],
                 "case_id": r["case_id"]}
                for r in c.execute("select id, summary, record_id, case_id from signal where validation = 'valid' and"
                                   " (id = any(%s::uuid[]) or summary ilike %s) limit 8", (ids, like)).fetchall()]
    return out[:25]


# What a person reads in the trail: decisions and changes, not page views or bulk machine writes.
AUDIT_OBJECTS = ("case", "case_vehicle", "requirement", "requirement_version", "requirement_feedback", "proposal",
                 "referral", "open_question", "meeting_note", "series_brief", "case_stance", "alert", "comment",
                 "planned_feature", "vehicle_plan", "weight_profile", "brand_profile", "workspace",
                 "innovation_item", "config")


@router.get("/audit")
def audit_list(object_id: str | None = None, actor_type: Literal["human", "ai", "system"] | None = None,
               limit: int = 200, c=Depends(conn), user: User = Depends(current_user)) -> list[dict]:
    """The append-only log, newest first: of one object (and its per-line and
    per-version rows), or of every decision and change in the workspace."""
    return c.execute(
        "select seq, at, actor, actor_type, action, object_type, object_id, before, after, rationale, run_id,"
        " request_id from audit_event where action <> 'view'"
        " and (%(o)s::text is null or object_id = %(o)s or object_id like %(o)s || '/%%')"
        " and (%(o)s::text is not null or (object_type = any(%(types)s) and run_id is null))"
        " and (%(a)s::text is null or actor_type = %(a)s) order by seq desc limit %(n)s",
        {"o": object_id, "a": actor_type, "types": list(AUDIT_OBJECTS), "n": min(limit, 1000)}).fetchall()


class MessageIn(BaseModel):
    role: Literal["pm", "agent"]
    content: str = Field(min_length=1)
    agent: str | None = Field(default=None, pattern=r"^[a-z_]+$")
    cited_signals: list[str] = []
    segment: str | None = None


@router.post("/chat/{object_type}/{object_id}/messages", status_code=201, tags=["collaboration"])
def append_message(object_type: ObjectType, object_id: str, body: MessageIn, c=Depends(conn),
                   user: User = Depends(current_user)) -> dict:
    """Store a message of a scripted assistant flow (shape questions, stance follow-ups,
    "ask the segment"). Cited signals must be valid signals of the object's case."""
    table = "case_item" if object_type == "case" else "requirement"
    row = c.execute(f"select {'id' if object_type == 'case' else 'case_id'} as case_id from {table} where id = %s",
                    (object_id,)).fetchone()
    if row is None:
        raise HTTPException(404, f"{object_id} not found")
    cited = [uuid.UUID(s) for s in body.cited_signals]
    known = {r["id"] for r in c.execute("select id from signal where id = any(%s) and case_id = %s and"
                                        " validation = 'valid'", (cited, row["case_id"])).fetchall()}
    if set(cited) - known:
        raise HTTPException(422, "cited signals must be valid signals of the case")
    is_agent = body.role == "agent"
    actor = f"agent:{body.agent or 'assistant'}" if is_agent else user.actor
    return audit.insert(c, "chat_message", {
        "object_type": object_type, "object_id": object_id, "role": body.role, "author": actor,
        "content": body.content, "cited_signals": cited, "retrieved_signals": cited, "segment": body.segment,
        "prompt_version": "scripted@ui" if is_agent else None}, actor=actor, request_id=request_id(),
        rationale=f"scripted flow, asked by {user.actor}" if is_agent else None)


@router.post("/notifications/read-all", tags=["collaboration"])
def read_all(c=Depends(conn), user: User = Depends(current_user)) -> dict:
    me = uuid.UUID(user.id)
    rows = c.execute("select id, read_by from notification where not (%s = any(read_by)) and (user_id = %s or"
                     " (user_id is null and (cardinality(%s::text[]) = 0 or vehicle is null or"
                     " vehicle = any(%s::text[]))))", (me, me, list(user.vehicles), list(user.vehicles))).fetchall()
    for r in rows:
        audit.update(c, "notification", {"id": r["id"]}, {"read_by": [*r["read_by"], me]}, actor=user.actor,
                     rationale="notification read", request_id=request_id())
    return {"updated": len(rows)}
