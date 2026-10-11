"""Argus, the AI colleague of the PMs: the RAG agent on case and requirement pages.

Tools: search_signals, search_context, get_case, get_requirement,
score_breakdown, compare_markets, what_if_weights, propose_edit. Every factual
claim about customers or the market cites a signal as [signal:<id>]; what a
person told the system (brief, stance, answers, meeting notes, feedback,
comments) is cited as [context:<type>:<id>] and is never customer evidence.
Citation check: a cited ID must have been returned by a search in this
conversation turn, otherwise the citation is removed; an answer left without
any valid citation becomes "No evidence found", unless it was built on the
stored figures of the case (counts, scores, requirement fields): then it is kept
and marked as such. Edits are only proposals (diffs) that the PM accepts or rejects.

Without an OpenAI key the agent answers extractively from the hybrid search
(changes.md 7.3).
"""

from __future__ import annotations

import datetime as dt
import difflib
import json
import re
import uuid
from dataclasses import dataclass, field

from app import audit
from app.config import get_settings
from app.llm import prompts
from app.llm.client import llm_available
from app.llm.embeddings import get_embedder
from app.scoring import score as scoring

CITATION = re.compile(r"\[signal:([0-9a-f-]{36})\]")
CONTEXT_CITATION = re.compile(r"\[context:([a-z_]+):([^\]\s]+)\]")
NO_EVIDENCE = "No evidence found in the stored sources."
MAX_STEPS = 6
# Tools that read stored rows of the case itself: an answer built on them is grounded without a signal.
DATA_TOOLS = ("get_case", "get_requirement", "score_breakdown", "compare_markets", "what_if_weights")
FROM_FIGURES = "_From the stored case figures and scores; no customer quote is cited._"
# A greeting or "who are you" needs no search and no model.
GREETING = re.compile(r"^\s*(hi|hello|hey|good (morning|afternoon|evening)|who are you|what are you|"
                      r"what can you do|how can you help|help)\b[\s!?.,]*(argus)?[\s!?.]*$", re.I)
INTRO = ("I'm Argus, your AI colleague in Argon. I work on this page with you: I search the stored customer and "
         "market signals and cite every claim, compare markets with numbers, explain why a case ranks where it "
         "does, recall what you and your colleagues decided or asked, and propose page edits for you to accept "
         "or reject. I research and draft; you decide. Ask me, for example, what customers complain about most "
         "here, how the markets differ, or why this is ranked where it is.")


@dataclass
class Turn:
    object_type: str
    object_id: str
    retrieved: set[str] = field(default_factory=set)
    context: set[tuple[str, str]] = field(default_factory=set)   # (type, id) of PM-context chunks returned
    proposal: dict | None = None
    actor: str | None = None   # who asks (pm:<user id>): decides whose brief is the context
    grounded: set[str] = field(default_factory=set)   # stored-data tools that returned something


def search(conn, query: str, *, k: int = 12, vehicle: str | None = None, case_id: str | None = None,
           types: list[str] | None = None) -> list[dict]:
    qv = get_embedder().embed([query])[0]
    rows = conn.execute("select * from rag_search(%s, %s, %s, %s, %s, %s)",
                        (query, qv, k, vehicle, case_id, types)).fetchall()
    return [{**r, "score": float(r["score"])} for r in rows]


# ---- tools -----------------------------------------------------------------------

def tool_search_signals(conn, turn: Turn, query: str, case_only: bool = True, vehicle: str | None = None) -> list:
    case_id = turn.object_id if turn.object_type == "case" and case_only else None
    if turn.object_type == "requirement" and case_only:
        case_id = conn.execute("select case_id from requirement where id = %s", (turn.object_id,)).fetchone()["case_id"]
    hits = search(conn, query, vehicle=vehicle, case_id=case_id, types=["signal"])
    if not hits and case_id:
        hits = search(conn, query, vehicle=vehicle, types=["signal"])
    turn.retrieved.update(h["object_id"] for h in hits)
    return [{"signal_id": h["object_id"], "vehicle": h["vehicle"], "market": h["market"], "case_id": h["case_id"],
             "text": h["text"][:600]} for h in hits]


def _scope(conn, turn: Turn) -> tuple[str | None, list[str]]:
    """The case of the page and the BMW lines it applies to."""
    if turn.object_type == "requirement":
        r = conn.execute("select case_id, vehicle from requirement where id = %s", (turn.object_id,)).fetchone()
        return (r["case_id"], [r["vehicle"]]) if r else (None, [])
    lines = [r["vehicle"] for r in conn.execute("select vehicle from case_vehicle where case_id = %s",
                                                (turn.object_id,)).fetchall()]
    # A case can span lines; the brief that counts is the one of the asking PM's line.
    user_id = (turn.actor or "").split(":", 1)[-1] if turn.actor and turn.actor.startswith(("pm:", "admin:")) else None
    try:
        user_id = user_id and str(uuid.UUID(user_id))
    except ValueError:
        user_id = None  # an actor that is not a stored user (scripts, tests)
    if user_id:
        own = conn.execute("select vehicles from app_user where id = %s", (user_id,)).fetchone()
        mine = [v for v in (own["vehicles"] if own else []) if v in lines]
        if not mine:
            ws = conn.execute("select c.vehicle from workspace w join config c on c.id = w.config_id"
                              " where w.user_id = %s", (user_id,)).fetchone()
            mine = [ws["vehicle"]] if ws and ws["vehicle"] in lines else []
        if mine:
            return turn.object_id, mine
    return turn.object_id, lines


def _own_brief(conn, turn: Turn, brief_id: str) -> bool:
    """The shared brief of the line, or the asking PM's own regional overlay (not a colleague's)."""
    b = conn.execute("select kind, owner_id from series_brief where id = %s", (brief_id,)).fetchone()
    return bool(b) and (b["kind"] == "shared" or (turn.actor or "").endswith(f":{b['owner_id']}"))


def tool_search_context(conn, turn: Turn, query: str) -> list:
    """What people told the system about this case and its lines: series brief, stance,
    open questions and answers, meeting notes, feedback, comments."""
    from app.rag.index import CONTEXT_TYPES

    case_id, vehicles = _scope(conn, turn)
    hits = search(conn, query, k=40, types=list(CONTEXT_TYPES))
    # Text search can miss a short note: the context of this very case is always offered.
    known = {h["id"] for h in hits}
    hits += [dict(r, score=0.0) for r in conn.execute(
        "select id, object_type, object_id, vehicle, market, case_id, text from rag_chunk"
        " where object_type = any(%s) and (case_id = %s or (object_type = 'series_brief' and vehicle = any(%s)))",
        (list(CONTEXT_TYPES), case_id, vehicles)).fetchall() if r["id"] not in known]
    mine = [h for h in hits if h["case_id"] == case_id
            or (h["object_type"] == "series_brief" and h["vehicle"] in vehicles
                and _own_brief(conn, turn, h["object_id"]))][:12]
    turn.context.update((h["object_type"], h["object_id"]) for h in mine)
    return [{"cite_as": f"[context:{h['object_type']}:{h['object_id']}]", "type": h["object_type"],
             "text": h["text"][:900]} for h in mine]


def tool_get_case(conn, turn: Turn, case_id: str) -> dict:
    c = conn.execute("select id, title, body_md, body_version, brand_fit, segment, figures from case_item where id = %s",
                     (case_id,)).fetchone()
    if not c:
        return {"error": f"{case_id} not found"}
    states = conn.execute("select vehicle, state, release_fit, market_conflict from case_vehicle where case_id = %s",
                          (case_id,)).fetchall()
    return {**{k: c[k] for k in ("id", "title", "body_md", "body_version", "brand_fit", "segment")},
            "per_vehicle": states,
            "figures": {v: {"distinct_customers": f.get("distinct_customers"), "markets": f.get("markets")}
                        for v, f in (c["figures"] or {}).get("by_vehicle", {}).items()}}


def tool_get_requirement(conn, turn: Turn, requirement_id: str) -> dict:
    r = conn.execute("select id, case_id, vehicle, market, title, body_md, body_version, status, cost_size,"
                     " release_target, evidence_level from requirement where id = %s", (requirement_id,)).fetchone()
    return r or {"error": f"{requirement_id} not found"}


def tool_score_breakdown(conn, turn: Turn, case_id: str) -> list:
    return conn.execute(
        "select p.name as profile, c.vehicle, c.market, s.score, s.rationale from case_score_current s"
        " join weight_profile p on p.id = s.weight_profile_id join config c on c.id = p.config_id"
        " where s.case_id = %s order by s.score desc limit 12", (case_id,)).fetchall()


def tool_compare_markets(conn, turn: Turn, case_id: str, vehicle: str) -> dict:
    c = conn.execute("select figures from case_item where id = %s", (case_id,)).fetchone()
    return ((c or {}).get("figures") or {}).get("by_vehicle", {}).get(vehicle, {}).get("markets", {})


def tool_what_if_weights(conn, turn: Turn, case_id: str, weights: dict) -> list:
    case = conn.execute("select * from case_item where id = %s", (case_id,)).fetchone()
    out = []
    for cfg in conn.execute("select c.* from config c join case_vehicle cv on cv.vehicle = c.vehicle"
                            " where cv.case_id = %s", (case_id,)).fetchall():
        cases = conn.execute("select c.* from case_item c join case_vehicle cv on cv.case_id = c.id"
                             " where cv.vehicle = %s", (cfg["vehicle"],)).fetchall()
        refs = scoring.references(conn, cfg, cases)
        result = scoring.compute(case, {"name": "what-if", "case_weights": weights}, cfg, refs)
        out.append({"config": cfg["name"], "score": result["score"], "rationale": result["rationale"]})
    return out


def tool_propose_edit(conn, turn: Turn, new_body_md: str, reason: str) -> dict:
    table = "case_item" if turn.object_type == "case" else "requirement"
    current = conn.execute(f"select body_md, body_version from {table} where id = %s", (turn.object_id,)).fetchone()
    diff = "\n".join(difflib.unified_diff((current["body_md"] or "").splitlines(), new_body_md.splitlines(),
                                          "current", "proposed", lineterm=""))
    turn.proposal = {"base_version": current["body_version"], "body_md": new_body_md, "diff": diff, "reason": reason}
    return {"status": "proposed; the PM accepts or rejects it", "diff_lines": diff.count("\n") + 1}


TOOLS = {
    "search_signals": (tool_search_signals, {"query": "string", "case_only": "boolean", "vehicle": "string"},
                       "Hybrid search over signals (quotes from customers, reviews, competitor facts)."),
    "search_context": (tool_search_context, {"query": "string"},
                       "What people told the system about this case and its lines: series brief, the PM's stance, "
                       "open questions and their answers, meeting notes, engineering or finance feedback, comments. "
                       "PM context, not customer evidence."),
    "get_case": (tool_get_case, {"case_id": "string"}, "Case page, per-vehicle state and figures."),
    "get_requirement": (tool_get_requirement, {"requirement_id": "string"}, "Requirement page and fields."),
    "score_breakdown": (tool_score_breakdown, {"case_id": "string"}, "Current scores and rationales per profile."),
    "compare_markets": (tool_compare_markets, {"case_id": "string", "vehicle": "string"},
                        "Opinions and customers per market for one BMW line."),
    "what_if_weights": (tool_what_if_weights, {"case_id": "string", "weights": "object"},
                        "Score of the case under hypothetical factor weights."),
    "propose_edit": (tool_propose_edit, {"new_body_md": "string", "reason": "string"},
                     "Propose a new page body; the PM must accept it."),
}


def _tool_specs() -> list[dict]:
    specs = []
    for name, (_, params, desc) in TOOLS.items():
        props = {k: ({"type": t} if t != "object" else {"type": "object", "additionalProperties": {"type": "number"}})
                 for k, t in params.items()}
        specs.append({"type": "function", "name": name, "description": desc, "strict": False, "parameters": {
            "type": "object", "properties": props, "required": [k for k in params if k not in ("case_only", "vehicle")]}})
    return specs


def check_citations(conn, answer: str, retrieved: set[str],
                    context: set[tuple[str, str]] | None = None, grounded: bool = False) -> tuple[str, list[str]]:
    """Keep only citations of things a search returned in this turn: signals, and
    PM-context items. An answer left with neither is replaced by "No evidence found",
    unless it was built on the stored figures of the case (``grounded``): then it stays
    and says so."""
    cited = list(dict.fromkeys(CITATION.findall(answer)))
    existing = {str(r["id"]) for r in conn.execute("select id from signal where id = any(%s::uuid[])"
                                                   " and validation = 'valid'", (cited,)).fetchall()} if cited else set()
    valid = [c for c in cited if c in retrieved and c in existing]
    cleaned = CITATION.sub(lambda m: m.group(0) if m.group(1) in valid else "", answer)
    context = context or set()
    kept = [m for m in CONTEXT_CITATION.findall(cleaned) if m in context]
    cleaned = CONTEXT_CITATION.sub(lambda m: m.group(0) if (m.group(1), m.group(2)) in context else "", cleaned)
    if not valid and not kept:
        if grounded and cleaned.strip() and NO_EVIDENCE not in cleaned:
            return f"{cleaned.strip()}\n\n{FROM_FIGURES}", []
        return NO_EVIDENCE, []
    return cleaned.strip(), valid


def _extractive(conn, turn: Turn, question: str) -> str:
    hits = tool_search_signals(conn, turn, question)
    told = tool_search_context(conn, turn, question)
    if not hits and not told:
        return NO_EVIDENCE
    lines = []
    if hits:
        lines.append(f"Signals matching the question ({len(hits)} found, extractive answer without an LLM):")
        for h in hits[:8]:
            quote = h["text"].split("Quote: ", 1)[-1].split("\nSource:")[0][:200]
            lines.append(f"- {h['market'] or 'unknown market'}, {h['vehicle'] or 'brand'}: \"{quote}\" "
                         f"[signal:{h['signal_id']}]")
    if told:
        lines += ["", "What you and your colleagues told me about this case (PM context, not customer evidence):"]
        for c in told[:6]:
            lines.append(f"- {' '.join(c['text'].split())[:260]} {c['cite_as']}")
    return "\n".join(lines).strip()


def _llm_answer(conn, turn: Turn, question: str, history: list[dict]) -> tuple[str, str]:
    from openai import OpenAI

    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key, max_retries=3, timeout=180)
    prompt = prompts.load("rag_agent")
    system, _ = prompt.render(object_type=turn.object_type, object_id=turn.object_id, guard=prompts.INJECTION_GUARD)
    # Responses API: gpt-6-luna accepts function tools together with its default thinking only there.
    pending: list[dict] = history + [{"role": "user", "content": question}]
    previous = None
    for _ in range(MAX_STEPS):
        response = client.responses.create(model=settings.llm_model_for("rag_agent"), instructions=system,
                                           input=pending, tools=_tool_specs(), previous_response_id=previous)
        calls = [item for item in response.output if item.type == "function_call"]
        if not calls:
            return response.output_text or "", prompt.prompt_version
        previous, pending = response.id, []
        for call in calls:
            fn = TOOLS.get(call.name, (None,))[0]
            try:
                args = json.loads(call.arguments or "{}")
                result = fn(conn, turn, **args) if fn else {"error": "unknown tool"}
                if call.name in DATA_TOOLS and result and not (isinstance(result, dict) and "error" in result):
                    turn.grounded.add(call.name)
            except Exception as exc:  # tool errors go back to the model, not to the PM
                result = {"error": str(exc)[:300]}
            pending.append({"type": "function_call_output", "call_id": call.call_id,
                            "output": prompts.wrap_source(json.dumps(result, default=str)[:12000])})
    return "I could not finish within the step limit. " + NO_EVIDENCE, prompt.prompt_version


def ask(conn, object_type: str, object_id: str, question: str, *, actor: str, request_id: str | None = None) -> dict:
    turn = Turn(object_type, object_id, actor=actor)
    history = [{"role": "user" if m["role"] == "pm" else "assistant", "content": m["content"]}
               for m in conn.execute("select role, content from chat_message where object_type = %s and object_id = %s"
                                     " order by created_at desc limit 8", (object_type, object_id)).fetchall()][::-1]
    audit.insert(conn, "chat_message", {"object_type": object_type, "object_id": object_id, "role": "pm",
                                        "author": actor, "content": question}, actor=actor, request_id=request_id)
    model = None
    if GREETING.match(question):
        answer, cited, prompt_version = INTRO, [], "argus_intro@v1"
    else:
        if llm_available():
            raw, prompt_version = _llm_answer(conn, turn, question, history)
            model = get_settings().llm_model_for("rag_agent")
        else:
            raw, prompt_version = _extractive(conn, turn, question), "rag_extractive@v2"
        answer, cited = check_citations(conn, raw, turn.retrieved, turn.context, grounded=bool(turn.grounded))
    row = audit.insert(conn, "chat_message", {
        "object_type": object_type, "object_id": object_id, "role": "agent", "author": "agent:rag",
        "content": answer, "cited_signals": [uuid.UUID(c) for c in cited],
        "retrieved_signals": [uuid.UUID(r) for r in sorted(turn.retrieved)],
        "proposed_diff": turn.proposal, "diff_status": "proposed" if turn.proposal else "none",
        "model": model, "prompt_version": prompt_version,
    }, actor="agent:rag", request_id=request_id, rationale="Argus answer (citations checked)")
    if turn.proposal:
        from app.collab import proposals

        row["proposal_id"] = proposals.from_chat_edit(conn, row, request_id=request_id)["id"]
    return row


def decide_edit(conn, message_id: str, accept: bool, *, actor: str, request_id: str | None = None) -> dict:
    """PM accepts (applies with the stale-save check) or rejects a proposed edit."""
    from app.cases.pages import save_case_page
    from app.requirements.service import save_page

    msg = audit.fetch_for_update(conn, "chat_message", {"id": message_id})
    if msg["diff_status"] != "proposed":
        raise ValueError("no open edit proposal on this message")
    if accept:
        p = msg["proposed_diff"]
        if msg["object_type"] == "case":
            save_case_page(conn, msg["object_id"], p["body_md"], p["base_version"], actor=actor, request_id=request_id)
        else:
            save_page(conn, msg["object_id"], p["body_md"], p["base_version"], actor=actor, request_id=request_id)
    out = audit.update(conn, "chat_message", {"id": message_id},
                       {"diff_status": "accepted" if accept else "rejected"}, actor=actor,
                       rationale="PM decision on the proposed edit", request_id=request_id)
    linked = conn.execute("select id from proposal where chat_message_id = %s and status = 'pending'",
                          (message_id,)).fetchone()
    if linked:
        audit.update(conn, "proposal", {"id": linked["id"]}, {
            "status": "accepted" if accept else "rejected", "decided_by": uuid.UUID(actor.split(":", 1)[1]),
            "decided_at": dt.datetime.now(dt.timezone.utc)}, actor=actor, action="accept" if accept else "reject",
            rationale="PM decision on the proposed edit", request_id=request_id)
    return out
