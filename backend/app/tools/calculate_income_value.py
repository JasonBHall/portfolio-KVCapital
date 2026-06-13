"""
calculate_income_value tool — Direct Capitalization (Income Approach)

Derives property value from Net Operating Income using the formula:
    Value = NOI / Cap Rate

Methodology: CUSPAP (Appraisal Institute of Canada) — Direct Capitalization
Market benchmarks: Altus Group Canadian Cap Rate Report Q4 2024

Cap rate selection logic:
  1. Extract implied cap rates from comparable sales (most reliable — market-derived)
  2. Cross-reference against Altus Group market benchmarks from market_benchmarks table
  3. If comp-derived rates fall within benchmark range → use median of comp rates
  4. If outside benchmark range → pull toward nearest benchmark endpoint
  5. If no comp cap rates available → use benchmark midpoint with a flag

Sensitivity table: ±50bps and ±25bps around the selected cap rate.
"""

import statistics
import time
from typing import Optional

from app import db


async def _get_benchmark(asset_class: str, building_class: Optional[str], city: str) -> Optional[dict]:
    if building_class:
        row = await db.fetchrow(
            """SELECT * FROM market_benchmarks
               WHERE asset_class = %s AND building_class = %s AND city = %s AND is_active = TRUE
               LIMIT 1""",
            (asset_class, building_class, city),
        )
        if row:
            return dict(row)
    # Fall back to NULL building_class match (industrial, multifamily)
    row = await db.fetchrow(
        """SELECT * FROM market_benchmarks
           WHERE asset_class = %s AND building_class IS NULL AND city = %s AND is_active = TRUE
           LIMIT 1""",
        (asset_class, city),
    )
    return dict(row) if row else None


async def calculate_income_value(
    subject_noi: Optional[float],
    asset_class: str,
    city: str,
    comps: list[dict],
    building_class: Optional[str] = None,
) -> dict:
    t0 = time.time()

    if not subject_noi or subject_noi <= 0:
        return {
            "income_value": None,
            "income_approach_available": False,
            "flag": "Income approach not run — NOI not provided. Sales comparison approach only.",
            "elapsed_ms": int((time.time() - t0) * 1000),
        }

    benchmark = await _get_benchmark(asset_class, building_class, city)

    # Extract implied cap rates from comps that have them
    comp_cap_rates = [
        float(c["implied_cap_rate"])
        for c in comps
        if c.get("implied_cap_rate") and float(c["implied_cap_rate"]) > 0
    ]

    bm_low  = float(benchmark["cap_rate_low"])  if benchmark else 0.04
    bm_high = float(benchmark["cap_rate_high"]) if benchmark else 0.12
    bm_mid  = float(benchmark["cap_rate_mid"])  if benchmark else 0.07
    source  = benchmark["source_name"] if benchmark else "Market benchmark not found — using general estimate"

    # Select cap rate
    if comp_cap_rates:
        comp_median = statistics.median(comp_cap_rates)
        # Clamp to benchmark range — trust comps but don't let outliers dominate
        cap_rate = max(bm_low, min(bm_high, comp_median))
        if comp_median < bm_low:
            rationale = (
                f"Comp-implied median cap rate of {comp_median:.2%} is below the {source} "
                f"benchmark range of {bm_low:.2%}–{bm_high:.2%}. "
                f"Cap rate adjusted to benchmark floor of {bm_low:.2%}."
            )
        elif comp_median > bm_high:
            rationale = (
                f"Comp-implied median cap rate of {comp_median:.2%} exceeds the {source} "
                f"benchmark ceiling of {bm_high:.2%}. "
                f"Cap rate adjusted to benchmark ceiling of {bm_high:.2%}."
            )
        else:
            rationale = (
                f"Cap rate of {cap_rate:.2%} derived from {len(comp_cap_rates)} comparable "
                f"sale(s) (implied rates: {', '.join(f'{r:.2%}' for r in comp_cap_rates)}). "
                f"Benchmarked against {source} ({bm_low:.2%}–{bm_high:.2%}). "
                f"Per CUSPAP, cap rate is market-derived from comp evidence."
            )
    else:
        cap_rate = bm_mid
        rationale = (
            f"No comparable sales with known income data available. "
            f"Cap rate of {cap_rate:.2%} sourced from {source} "
            f"benchmark midpoint ({bm_low:.2%}–{bm_high:.2%}). "
            f"Per CUSPAP, market-derived evidence is preferred; "
            f"this estimate carries additional uncertainty."
        )

    income_value = int(subject_noi / cap_rate)

    # Sensitivity table — 5 rows: -50bps, -25bps, selected, +25bps, +50bps
    sensitivity_table = []
    for bps, label in [(-50, "-50 bps"), (-25, "-25 bps"), (0, "Selected"), (25, "+25 bps"), (50, "+50 bps")]:
        r = cap_rate + bps / 10000
        if r > 0:
            sensitivity_table.append({
                "cap_rate": round(r, 4),
                "value": int(subject_noi / r),
                "label": label,
            })

    return {
        "income_approach_available": True,
        "income_value": income_value,
        "cap_rate_applied": round(cap_rate, 4),
        "cap_rate_range_from_comps": [round(r, 4) for r in comp_cap_rates],
        "cap_rate_benchmark_low": bm_low,
        "cap_rate_benchmark_high": bm_high,
        "cap_rate_source": source,
        "cap_rate_rationale": rationale,
        "sensitivity_table": sensitivity_table,
        "noi_used": subject_noi,
        "elapsed_ms": int((time.time() - t0) * 1000),
    }
