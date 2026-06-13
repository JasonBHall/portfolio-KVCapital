"""
Valuation agent runner.

Orchestrates the Claude tool-use loop:
  1. Send subject property + system prompt to Claude
  2. Claude returns tool_use blocks
  3. We execute the tool, return tool_result
  4. Repeat until Claude produces a final structured report
  5. Persist report to DB and return to caller

Supports two modes:
  - stream=False  → awaits full report, returns ValuationReport
  - stream=True   → async generator yielding JSON-encoded SSE events

Max tool calls: 8 (prevents runaway loops on bad data)
"""

import json
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import AsyncIterator

import anthropic

from app.agent.costs import TokenUsage
from app.agent.prompts import SYSTEM_PROMPT, build_user_message
from app.agent.tool_schemas import TOOL_SCHEMAS
from app.models import SubjectProperty
from app.tools.search_comps import search_comps
from app.tools.calculate_adjustments import calculate_adjustments
from app.tools.get_market_context import get_market_context

# System prompt with cache_control — Anthropic caches this block for 5 minutes.
# Cost: cache write = 1.25x input rate, cache read = 0.1x input rate.
# Break-even: profitable after first reuse within the TTL window.
# Source: Anthropic prompt caching docs.
CACHED_SYSTEM = [
    {
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }
]

MAX_TOOL_CALLS = 8


class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (date, datetime)):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def _dumps(obj) -> str:
    return json.dumps(obj, cls=_Encoder)

_client = None

def get_client():
    global _client
    if _client is None:
        import os
        from dotenv import load_dotenv
        load_dotenv(override=True)
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set — add it to backend/.env")
        _client = anthropic.AsyncAnthropic(api_key=key)
    return _client


async def run_valuation_agent(
    subject: SubjectProperty,
    stream: bool = False,
):
    if stream:
        return _run_streaming(subject)
    return await _run_blocking(subject)


async def _run_blocking(subject: SubjectProperty) -> dict:
    report = None
    trace = []
    async for event in _agent_loop(subject):
        if event["type"] == "trace_step":
            trace.append(event["step"])
        elif event["type"] == "report":
            report = event["report"]
    return report


async def _run_streaming(subject: SubjectProperty) -> AsyncIterator[str]:
    async for event in _agent_loop(subject):
        yield _dumps(event)


async def _agent_loop(subject: SubjectProperty):
    t_start = time.time()
    trace = []
    messages = [{"role": "user", "content": build_user_message(subject)}]
    tool_call_count = 0
    expansions_applied = 0
    token_usage = TokenUsage()

    # State carried across tool calls
    current_comps = []
    current_search_params = {
        "radius_km": 2.0,
        "max_age_months": 12,
        "beds_flexible": False,
        "type_adjacent": False,
    }
    market_context = None
    adjustment_rates = None

    while tool_call_count < MAX_TOOL_CALLS:
        response = await get_client().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=CACHED_SYSTEM,
            tools=TOOL_SCHEMAS,
            messages=messages,
        )
        token_usage.add(response.usage)

        # Append assistant response to message history
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            # Claude is done — extract the final report from its text response
            text = next((b.text for b in response.content if hasattr(b, "text")), "")
            report = _parse_report(
                text, subject, trace, tool_call_count,
                expansions_applied, t_start, token_usage=token_usage,
                adjustment_rates=adjustment_rates,
                comps=current_comps,
            )
            await _persist_report(report, subject)
            yield {"type": "report", "report": report}
            yield {"type": "token_usage", "usage": token_usage.to_display()}
            yield {"type": "done"}
            return

        # Process all tool_use blocks in this response
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_call_count += 1
            t_tool = time.time()
            tool_input = block.input
            tool_result = None

            # ----------------------------------------------------------------
            # Tool dispatch
            # ----------------------------------------------------------------
            if block.name == "search_comps":
                current_search_params.update({
                    k: tool_input[k]
                    for k in ("radius_km", "max_age_months", "beds_flexible", "type_adjacent")
                    if k in tool_input
                })
                tool_result = await search_comps(
                    property_type=subject.property_type,
                    bedrooms=subject.bedrooms,
                    bathrooms=subject.bathrooms,
                    sqft=subject.sqft,
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    **current_search_params,
                )
                current_comps = tool_result["comps"]

            elif block.name == "expand_search":
                strategy = tool_input.get("strategy", "radius")
                expansions_applied += 1
                _apply_expansion(strategy, current_search_params)
                tool_result = await search_comps(
                    property_type=subject.property_type,
                    bedrooms=subject.bedrooms,
                    bathrooms=subject.bathrooms,
                    sqft=subject.sqft,
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    **current_search_params,
                )
                current_comps = tool_result["comps"]
                tool_result["expansion_applied"] = f"{strategy} → radius={current_search_params['radius_km']}km, age={current_search_params['max_age_months']}mo"
                tool_result["confidence_penalty"] = "low" if expansions_applied >= 2 else "medium"

            elif block.name == "calculate_adjustments":
                tool_result = await calculate_adjustments(
                    subject=subject.model_dump(),
                    comps=current_comps,
                )
                current_comps = tool_result["adjusted_comps"]
                adjustment_rates = tool_result.get("adjustment_rates")

            elif block.name == "get_market_context":
                tool_result = await get_market_context(
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    radius_km=tool_input.get("radius_km", current_search_params["radius_km"]),
                    property_type=subject.property_type,
                    months=tool_input.get("months", 6),
                )
                market_context = tool_result

            else:
                tool_result = {"error": f"Unknown tool: {block.name}"}

            elapsed_ms = int((time.time() - t_tool) * 1000)
            step = {
                "tool": block.name,
                "input": tool_input,
                "output": tool_result,
                "elapsed_ms": elapsed_ms,
            }
            trace.append(step)
            yield {"type": "trace_step", "step": step}

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": _dumps(tool_result),
            })

        messages.append({"role": "user", "content": tool_results})

    # Safety exit — max tool calls reached
    report = _parse_report(
        "Maximum tool calls reached — producing best-effort report.",
        subject, trace, tool_call_count, expansions_applied, t_start,
        force_low_confidence=True,
        adjustment_rates=adjustment_rates,
        comps=current_comps,
    )
    await _persist_report(report, subject)
    yield {"type": "report", "report": report}
    yield {"type": "done"}


def _apply_expansion(strategy: str, params: dict) -> None:
    if strategy == "radius":
        params["radius_km"] = min(params["radius_km"] * 2, 50.0)
    elif strategy == "age":
        params["max_age_months"] = min(params["max_age_months"] + 6, 36)
    elif strategy == "beds_plus_minus_one":
        params["beds_flexible"] = True
    elif strategy == "type_adjacent":
        params["type_adjacent"] = True


def _parse_report(
    claude_text: str,
    subject: SubjectProperty,
    trace: list,
    tool_call_count: int,
    expansions_applied: int,
    t_start: float,
    force_low_confidence: bool = False,
    token_usage: TokenUsage = None,
    adjustment_rates: dict = None,
    comps: list = None,
) -> dict:
    """
    Extract the structured report from Claude's final text response.
    Claude is instructed to return JSON — we parse it and fall back
    gracefully if the format is unexpected.
    """
    try:
        # Claude returns JSON wrapped in a markdown code block
        raw = claude_text
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        parsed = json.loads(raw)
    except Exception:
        parsed = {
            "estimated_value_low": 0,
            "estimated_value_high": 0,
            "estimated_value_mid": 0,
            "confidence": "low",
            "narrative": claude_text,
            "flags": ["Report parsing error — raw narrative returned"],
            "comps": [],
        }

    if force_low_confidence:
        parsed["confidence"] = "low"
        parsed.setdefault("flags", []).append("Maximum tool call limit reached")

    return {
        "id": str(uuid.uuid4()),
        "estimated_value_low":  parsed.get("estimated_value_low", 0),
        "estimated_value_high": parsed.get("estimated_value_high", 0),
        "estimated_value_mid":  parsed.get("estimated_value_mid", 0),
        "confidence":           parsed.get("confidence", "low"),
        "narrative":            parsed.get("narrative", ""),
        "flags":                parsed.get("flags", []),
        "comps":                comps or [],
        "agent_trace":          trace,
        "tool_call_count":      tool_call_count,
        "expansions_applied":   expansions_applied,
        "latency_ms":           int((time.time() - t_start) * 1000),
        "report_date":          time.strftime("%Y-%m-%d"),
        "token_usage":          token_usage.to_display() if token_usage else None,
        "adjustment_rates":     adjustment_rates,
    }


async def _persist_report(report: dict, subject: SubjectProperty) -> None:
    from app import db
    await db.execute(
        """
        INSERT INTO valuation_reports (
            id, subject_address, subject_property_type,
            subject_bedrooms, subject_bathrooms, subject_sqft, subject_year_built,
            subject_latitude, subject_longitude,
            estimated_value_low, estimated_value_high, estimated_value_mid,
            confidence, narrative, flags, agent_trace,
            tool_call_count, expansions_applied, latency_ms
        ) VALUES (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        """,
        (report["id"],
         subject.address, subject.property_type,
         subject.bedrooms, subject.bathrooms, subject.sqft, subject.year_built,
         subject.latitude, subject.longitude,
         report["estimated_value_low"], report["estimated_value_high"], report["estimated_value_mid"],
         report["confidence"], report["narrative"],
         _dumps(report["flags"]), _dumps(report["agent_trace"]),
         report["tool_call_count"], report["expansions_applied"], report["latency_ms"]),
    )
