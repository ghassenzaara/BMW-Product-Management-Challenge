"""The four fetch agents turn stored records into proposed signals.

- competitor agent: categories J, E (launches, competitor equipment)
- customer / public feedback agent: A, B, C, D, H (complaints, reviews,
  community, expert and video, apps)
- trends agent: F, G, I (market, studies, future trends)
- innovation scout: I and J from shows and other industries (ces, iaa, auto-china)

Agents only PROPOSE signals; the validation gate decides. Page text is data,
never instructions (prompt-injection guard). With an OpenAI key the LLM extracts
(prompt ``signal_extract``) and picks topic and aspect group from the closed
lists of the taxonomy (enums in the output schema); the car area is derived from
the topic in code. Without a key the feedback agent uses a sentence heuristic on
owner and expert texts (marked ``kind_source = heuristic``, no topic; the LLM
classifier fills topic and aspect group later) and the other agents extract
nothing.
"""

from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from app import taxonomy
from app.llm import prompts
from app.llm.client import LLMUnavailable, get_llm, llm_available
from app.seed.classify import heuristic

AGENTS = {
    "agent:competitor": {"J", "E"},
    "agent:feedback": {"A", "B", "C", "D", "H"},
    "agent:trends": {"F", "G", "I"},
    "agent:innovation": {"I", "J"},
}
INNOVATION_SOURCES = {"ces", "iaa", "auto-china"}
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def agent_for(record: dict) -> str:
    if record["source_id"] in INNOVATION_SOURCES:
        return "agent:innovation"
    cat = record.get("category") or "C"
    if cat in ("J", "E"):
        return "agent:competitor"
    if cat in ("F", "G", "I"):
        return "agent:trends"
    return "agent:feedback"


class _Signal(BaseModel):
    kind: Literal["complaint", "wish", "like", "competitor_fact", "trend", "innovation"]
    severity: Literal["defect", "difficult_to_use", "wish", "none"]
    summary: str = Field(description="English, at most 20 words, one statement about one topic")
    quote: str = Field(description="exact excerpt copied from the source text, in its original language")
    quote_en: str = Field(description="English translation of the quote, or the quote itself if English")
    topic_id: taxonomy.TopicId
    aspect_group: taxonomy.AspectGroup
    confidence: taxonomy.Confidence
    other_suggestion: str = Field(description="short proposed name when topic_id is other, else empty")
    market: Literal["USA", "China", "Europe", "Rest of World", "unknown"]
    market_basis: Literal["stated", "inferred", "unknown"]


class _Extraction(BaseModel):
    signals: list[_Signal]


def evidence_role(record: dict) -> str:
    if record.get("vehicle_role") == "competitor":
        return "competitor"
    if record.get("content_type") == "owner":
        return "bmw_customer"
    return "market"


def _base(record: dict) -> dict:
    extra = record.get("extra") or {}
    role = evidence_role(record)
    base = {
        "record_id": record["record_id"],
        "vehicle": extra.get("bmw_vehicle"),
        "chassis_code": record.get("chassis_code"),
        "vehicle_role": record.get("vehicle_role") or "unknown",
        "evidence_role": role,
        "powertrain": record.get("powertrain") or "unknown",
        "customer_ref": record.get("author_hash") or record["record_id"],
        "reach": _reach(record.get("engagement") or {}),
        "reach_unit": _reach_unit(record.get("engagement") or {}),
    }
    if role == "competitor":
        base["competitor_id"] = extra.get("subject_id")
    return base


def _reach(engagement: dict) -> int | None:
    for k in ("views", "upvotes", "likes", "replies"):
        if isinstance(engagement.get(k), (int, float)):
            return int(engagement[k])
    return None


def _reach_unit(engagement: dict) -> str:
    for k in ("views", "upvotes", "likes", "replies"):
        if isinstance(engagement.get(k), (int, float)):
            return k
    return "none"


def heuristic_extract(record: dict, max_signals: int = 5) -> list[dict]:
    if record.get("content_type") not in ("owner", "expert") or agent_for(record) != "agent:feedback":
        return []
    if (record.get("language") or "en") != "en":
        return []
    out = []
    for sentence in _SENTENCE.split(record["text_original"] or ""):
        sentence = sentence.strip()
        if not 20 <= len(sentence) <= 400:
            continue
        v = heuristic(sentence)
        if not v.kind or not v.about_car:
            continue
        out.append({**_base(record), "kind": v.kind, "severity": v.severity, "summary": " ".join(sentence.split()[:20]),
                    "quote": sentence, "extra": {"kind_source": "heuristic"}})
        if len(out) >= max_signals:
            break
    return out


def llm_signals(record: dict) -> tuple[list[_Signal], str, str]:
    """What the OpenAI agent extracts from one record, before it becomes proposals for the gate."""
    agent = agent_for(record)
    extra = record.get("extra") or {}
    subject = f"{record.get('brand') or ''} {record.get('model') or ''}".strip() or "brand level"
    result = get_llm().structured(
        prompts.load("signal_extract"), _Extraction, guard=prompts.INJECTION_GUARD, agent=agent,
        subject=subject, vehicle_role=record.get("vehicle_role") or "unknown",
        bmw_line=extra.get("bmw_vehicle") or "unknown", topics=taxonomy.prompt_topics(),
        aspect_groups=taxonomy.prompt_aspects(), source=record["source_id"],
        content_type=record.get("content_type") or "",
        published=str(record.get("published_at") or "unknown"), country=record.get("country") or "unknown",
        text=prompts.wrap_source(json.dumps({"title": record.get("title"), "text": (record["text_original"] or "")[:8000]},
                                            ensure_ascii=False)),
    )
    return result.data.signals, result.model, result.prompt_version


def llm_extract(record: dict) -> tuple[list[dict], str, str]:
    signals, model, prompt_version = llm_signals(record)
    return proposals_from(record, signals), model, prompt_version


def proposals_from(record: dict, signals: list[_Signal]) -> list[dict]:
    """Proposed signals for the gate from what a reader extracted (the OpenAI agent, or the
    subagent files of ``app.fetch.local``): the record's own fields plus the extraction."""
    agent = agent_for(record)
    out = []
    for s in signals:
        if agent != "agent:competitor" and s.kind == "competitor_fact" and evidence_role(record) != "competitor":
            continue
        extra_out = {"kind_source": "llm", "agent": agent}
        if s.topic_id == taxonomy.OTHER and s.other_suggestion.strip():
            extra_out["other_suggestion"] = s.other_suggestion.strip()
        out.append({**_base(record), "kind": s.kind, "severity": s.severity, "summary": s.summary, "quote": s.quote,
                    "quote_en": s.quote_en if s.quote_en != s.quote else None, "topic_id": s.topic_id,
                    "aspect_group": s.aspect_group, "classification_confidence": s.confidence,
                    "classified_by": "llm", "market": s.market, "market_basis": s.market_basis,
                    "extra": extra_out})
    return out


def extract(record: dict) -> tuple[list[dict], str | None, str]:
    """(proposals, model, prompt_version) for one record."""
    if llm_available():
        try:
            return llm_extract(record)
        except LLMUnavailable:
            pass
    return heuristic_extract(record), None, "heuristic@v1"


def extract_many(records: list[dict]) -> list[tuple[dict, list[dict], str | None, str]]:
    """(record, proposals, model, prompt_version) per record, in the order given. With an LLM the
    records are read in parallel (``LLM_WORKERS``); never call this inside a database transaction."""
    from concurrent.futures import ThreadPoolExecutor

    from app.llm import cache

    if not llm_available() or len(records) < 2:
        return [(r, *extract(r)) for r in records]
    with ThreadPoolExecutor(max_workers=cache.WORKERS) as pool:
        return [(r, *out) for r, out in zip(records, pool.map(extract, records))]
