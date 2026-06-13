"""
Commercial valuation agent runner.

Orchestrates the Claude tool-use loop for commercial property valuation:
  search_commercial_comps
    → (expand_commercial_search if thin)
    → calculate_commercial_adjustments
    → calculate_income_value (if NOI provided)
    → get_market_context
    → final JSON report

Uses claude-opus-4-8 — commercial cap rate reasoning requires stronger
chain-of-thought than residential arithmetic. See design/decisions.md.
"""

import json
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import AsyncIterator, Optional

import anthropic

from app.agent.costs import TokenUsage
from app.agent.commercial_prompts import COMMERCIAL_SYSTEM_PROMPT, build_commercial_user_message
from app.agent.commercial_tool_schemas import COMMERCIAL_TOOL_SCHEMAS
from app.models import CommercialSubjectProperty
from app.tools.search_commercial_comps import search_commercial_comps
from app.tools.calculate_commercial_adjustments import calculate_commercial_adjustments
from app.tools.calculate_income_value import calculate_income_value
from app.tools.get_market_context import get_market_context

CACHED_COMMERCIAL_SYSTEM = [
    {
        "type": "text",
        "text": COMMERCIAL_SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }
]

MAX_TOOL_CALLS = 10


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

def _get_client():
    global _client
    if _client is None:
        import os
        from dotenv import load_dotenv
        load_dotenv(override=True)
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _client = anthropic.AsyncAnthropic(api_key=key)
    return _client


async def run_commercial_agent(
    subject: CommercialSubjectProperty,
    stream: bool = False,
):
    if stream:
        return _run_streaming(subject)
    return await _run_blocking(subject)


async def _run_blocking(subject: CommercialSubjectProperty) -> dict:
    report = None
    async for event in _agent_loop(subject):
        if event["type"] == "report":
            report = event["report"]
    return report


async def _run_streaming(subject: CommercialSubjectProperty) -> AsyncIterator[str]:
    async for event in _agent_loop(subject):
        yield _dumps(event)


async def _agent_loop(subject: CommercialSubjectProperty):
    t_start = time.time()
    trace = []
    messages = [{"role": "user", "content": build_commercial_user_message(subject)}]
    tool_call_count = 0
    expansions_applied = 0
    token_usage = TokenUsage()

    current_comps = []
    current_search_params = {
        "radius_km": 3.0,
        "max_age_months": 18,
        "class_adjacent": False,
    }
    income_value_result: Optional[dict] = None
    market_context: Optional[dict] = None
    adjustment_rates: Optional[dict] = None

    while tool_call_count < MAX_TOOL_CALLS:
        response = await _get_client().messages.create(
            model="claude-opus-4-8",
            max_tokens=4096,
            system=CACHED_COMMERCIAL_SYSTEM,
            tools=COMMERCIAL_TOOL_SCHEMAS,
            messages=messages,
        )
        token_usage.add(response.usage)
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if hasattr(b, "text")), "")
            report = _parse_commercial_report(
                text, subject, trace, tool_call_count, expansions_applied, t_start,
                income_value_result=income_value_result,
                adjustment_rates=adjustment_rates,
                comps=current_comps,
                token_usage=token_usage,
            )
            yield {"type": "report", "report": report}
            yield {"type": "token_usage", "usage": token_usage.to_display()}
            yield {"type": "done"}
            return

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_call_count += 1
            t_tool = time.time()
            inp = block.input
            result = None

            if block.name == "search_commercial_comps":
                current_search_params.update({
                    k: inp[k]
                    for k in ("radius_km", "max_age_months", "class_adjacent")
                    if k in inp
                })
                result = await search_commercial_comps(
                    asset_class=subject.asset_class,
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    building_class=subject.building_class if not current_search_params.get("class_adjacent") else None,
                    subject_size=_subject_size(subject),
                    **current_search_params,
                )
                current_comps = result["comps"]

            elif block.name == "expand_commercial_search":
                strategy = inp.get("strategy", "radius")
                expansions_applied += 1
                _apply_expansion(strategy, current_search_params)
                result = await search_commercial_comps(
                    asset_class=subject.asset_class,
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    building_class=subject.building_class if not current_search_params.get("class_adjacent") else None,
                    subject_size=_subject_size(subject),
                    **current_search_params,
                )
                current_comps = result["comps"]
                result["expansion_applied"] = (
                    f"{strategy} → radius={current_search_params['radius_km']}km, "
                    f"age={current_search_params['max_age_months']}mo"
                )
                result["confidence_penalty"] = "low" if expansions_applied >= 2 else "medium"

            elif block.name == "calculate_commercial_adjustments":
                result = await calculate_commercial_adjustments(
                    subject=subject.model_dump(),
                    comps=current_comps,
                )
                current_comps = result["adjusted_comps"]
                adjustment_rates = result.get("adjustment_rates")

            elif block.name == "calculate_income_value":
                result = await calculate_income_value(
                    subject_noi=subject.noi,
                    asset_class=subject.asset_class,
                    city=subject.city,
                    comps=current_comps,
                    building_class=subject.building_class,
                )
                if result.get("income_approach_available"):
                    income_value_result = result

            elif block.name == "get_market_context":
                result = await get_market_context(
                    latitude=subject.latitude,
                    longitude=subject.longitude,
                    radius_km=inp.get("radius_km", current_search_params["radius_km"]),
                    property_type=subject.asset_class,
                    months=inp.get("months", 12),
                )
                market_context = result

            else:
                result = {"error": f"Unknown tool: {block.name}"}

            elapsed_ms = int((time.time() - t_tool) * 1000)
            step = {"tool": block.name, "input": inp, "output": result, "elapsed_ms": elapsed_ms}
            trace.append(step)
            yield {"type": "trace_step", "step": step}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": _dumps(result),
            })

        messages.append({"role": "user", "content": tool_results})

    # Max tool calls reached
    report = _parse_commercial_report(
        "Maximum tool calls reached.",
        subject, trace, tool_call_count, expansions_applied, t_start,
        force_low_confidence=True,
        income_value_result=income_value_result,
        adjustment_rates=adjustment_rates,
        comps=current_comps,
    )
    yield {"type": "report", "report": report}
    yield {"type": "done"}


def _subject_size(subject: CommercialSubjectProperty) -> Optional[int]:
    return subject.gba_sqft or subject.nra_sqft or ((subject.num_units or 0) * 800) or None


def _apply_expansion(strategy: str, params: dict) -> None:
    if strategy == "radius":
        params["radius_km"] = min(params["radius_km"] * 2, 75.0)
    elif strategy == "age":
        params["max_age_months"] = min(params["max_age_months"] + 6, 36)
    elif strategy == "class_adjacent":
        params["class_adjacent"] = True


def _parse_commercial_report(
    claude_text: str,
    subject: CommercialSubjectProperty,
    trace: list,
    tool_call_count: int,
    expansions_applied: int,
    t_start: float,
    force_low_confidence: bool = False,
    income_value_result: Optional[dict] = None,
    adjustment_rates: Optional[dict] = None,
    comps: Optional[list] = None,
    token_usage: Optional[TokenUsage] = None,
) -> dict:
    try:
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
            "approach_weights": {"income": 0.0, "sales_comparison": 1.0},
            "approach_rationale": "",
        }

    if force_low_confidence:
        parsed["confidence"] = "low"
        parsed.setdefault("flags", []).append("Maximum tool call limit reached")

    return {
        "id": str(uuid.uuid4()),
        "asset_class": subject.asset_class,
        "estimated_value_low":  parsed.get("estimated_value_low", 0),
        "estimated_value_high": parsed.get("estimated_value_high", 0),
        "estimated_value_mid":  parsed.get("estimated_value_mid", 0),
        "confidence":           parsed.get("confidence", "low"),
        "narrative":            parsed.get("narrative", ""),
        "flags":                parsed.get("flags", []),
        "comps":                comps or [],
        # Income approach — injected from runner state, not Claude's JSON
        "income_approach_value": income_value_result.get("income_value") if income_value_result else None,
        "cap_rate_applied":      income_value_result.get("cap_rate_applied") if income_value_result else None,
        "cap_rate_range_low":    income_value_result.get("cap_rate_benchmark_low") if income_value_result else None,
        "cap_rate_range_high":   income_value_result.get("cap_rate_benchmark_high") if income_value_result else None,
        "cap_rate_source":       income_value_result.get("cap_rate_source") if income_value_result else None,
        "sensitivity_table":     income_value_result.get("sensitivity_table") if income_value_result else None,
        "approach_weights":      parsed.get("approach_weights"),
        "approach_rationale":    parsed.get("approach_rationale", ""),
        "agent_trace":           trace,
        "tool_call_count":       tool_call_count,
        "expansions_applied":    expansions_applied,
        "latency_ms":            int((time.time() - t_start) * 1000),
        "report_date":           time.strftime("%Y-%m-%d"),
        "adjustment_rates":      adjustment_rates,
        "token_usage":           token_usage.to_display() if token_usage else None,
    }
