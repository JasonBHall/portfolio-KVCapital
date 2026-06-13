"""
calculate_adjustments tool

Applies dollar adjustments to each comp's sale price to account for
differences from the subject property.

Adjustment rates are loaded from the adjustment_config table so they can
be changed without a code deploy. Defaults sourced from CREA MLS HPI and
AIC practitioner convention — see design/decisions.md.
"""

import time
from functools import lru_cache

from app import db


async def get_adjustment_config() -> dict:
    row = await db.fetchrow("SELECT * FROM adjustment_config WHERE id = 1")
    return row


async def calculate_adjustments(subject: dict, comps: list[dict]) -> dict:
    t0 = time.time()
    cfg = await get_adjustment_config()

    sqft_rate      = float(cfg["sqft_per_foot"])      # $/sqft
    bed_rate       = int(cfg["per_bedroom"])           # $ per bedroom delta
    bath_rate      = int(cfg["per_bathroom"])          # $ per bathroom delta
    age_rate       = int(cfg["per_year_age"])          # $ per year delta
    outlier_pct    = float(cfg["outlier_threshold_pct"]) / 100.0

    adjusted = []
    for comp in comps:
        sqft_diff  = (subject["sqft"]       - (comp["sqft"]       or subject["sqft"])) * sqft_rate
        bed_diff   = (subject["bedrooms"]   -  comp["bedrooms"])                        * bed_rate
        bath_diff  = (subject["bathrooms"]  -  comp["bathrooms"])                       * bath_rate
        age_diff   = (subject["year_built"] - (comp["year_built"]  or subject["year_built"])) * age_rate

        total_adj     = sqft_diff + bed_diff + bath_diff + age_diff
        adjusted_price = int(comp["sale_price"] + total_adj)
        adj_pct       = abs(total_adj) / comp["sale_price"]
        is_outlier    = adj_pct > outlier_pct

        adjusted.append({
            **comp,
            "adjustments": {
                "sqft":      _fmt(sqft_diff),
                "bedrooms":  _fmt(bed_diff),
                "bathrooms": _fmt(bath_diff),
                "age":       _fmt(age_diff),
                "total_pct": round(adj_pct * 100, 1),
            },
            "adjusted_price": adjusted_price,
            "is_outlier": is_outlier,
            "adjustment_notes": _notes(
                sqft_diff, bed_diff, bath_diff, age_diff,
                subject, comp, is_outlier, outlier_pct
            ),
        })

    return {
        "adjusted_comps": adjusted,
        "adjustment_rates": {
            "sqft_per_foot": sqft_rate,
            "per_bedroom":   bed_rate,
            "per_bathroom":  bath_rate,
            "per_year_age":  age_rate,
            "outlier_threshold_pct": cfg["outlier_threshold_pct"],
        },
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def _fmt(value: float) -> str:
    if value == 0:
        return "$0"
    sign = "+" if value > 0 else "-"
    return f"{sign}${abs(int(value)):,}"


def _notes(sqft_d, bed_d, bath_d, age_d, subject, comp, is_outlier, threshold) -> str:
    parts = []
    if sqft_d != 0:
        diff = subject["sqft"] - (comp["sqft"] or subject["sqft"])
        parts.append(f"Subject is {abs(diff)} sqft {'larger' if diff > 0 else 'smaller'} ({_fmt(sqft_d)})")
    if bed_d != 0:
        diff = subject["bedrooms"] - comp["bedrooms"]
        parts.append(f"Subject has {abs(diff)} {'more' if diff > 0 else 'fewer'} bed(s) ({_fmt(bed_d)})")
    if bath_d != 0:
        diff = subject["bathrooms"] - comp["bathrooms"]
        parts.append(f"Subject has {abs(diff):.1f} {'more' if diff > 0 else 'fewer'} bath(s) ({_fmt(bath_d)})")
    if age_d != 0:
        diff = subject["year_built"] - (comp["year_built"] or subject["year_built"])
        parts.append(f"Subject is {abs(diff)} yr(s) {'newer' if diff > 0 else 'older'} ({_fmt(age_d)})")
    if is_outlier:
        parts.append(f"⚠ Total adjustment exceeds {int(threshold * 100)}% of sale price — treated as weak comp")
    return "; ".join(parts) if parts else "No significant adjustments"
