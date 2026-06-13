"""
calculate_commercial_adjustments tool

Applies adjustments to commercial comp sale prices to account for differences
from the subject property.

Methodology: CUSPAP (Appraisal Institute of Canada) — income approach adjustment
convention for commercial properties.

Adjustment line items:
  - Size ($/sqft × delta in NRA/GBA)
  - Age (% of sale price per year of effective age difference)
  - Building class (% of sale price per class step — office only)

Outlier threshold: 25% of sale price (AIC/CUSPAP commercial guideline).
"""

import time
from typing import Optional

from app import db


_CLASS_RANK = {"A": 0, "B": 1, "C": 2}


async def _get_config() -> dict:
    row = await db.fetchrow("SELECT * FROM commercial_adjustment_config WHERE id = 1")
    return row


def _effective_size(prop: dict) -> int:
    return prop.get("gba_sqft") or prop.get("nra_sqft") or ((prop.get("num_units") or 0) * 800) or 1


def _fmt(value: float) -> str:
    if abs(value) < 1:
        return "$0"
    sign = "+" if value > 0 else "-"
    return f"{sign}${abs(int(value)):,}"


async def calculate_commercial_adjustments(subject: dict, comps: list[dict]) -> dict:
    t0 = time.time()
    cfg = await _get_config()

    size_rate      = float(cfg["size_per_sqft"])
    age_rate       = float(cfg["age_per_year_pct"])
    class_rate     = float(cfg["building_class_pct"])
    outlier_pct    = float(cfg["outlier_threshold_pct"]) / 100.0

    subject_size  = _effective_size(subject)
    subject_class = subject.get("building_class")
    subject_year  = subject.get("year_built") or 2000

    adjusted = []
    for comp in comps:
        comp_size  = _effective_size(comp)
        comp_year  = comp.get("year_built") or subject_year
        comp_class = comp.get("building_class")
        sale_price = int(comp.get("sale_price", 0))

        # Size adjustment
        size_adj = (subject_size - comp_size) * size_rate

        # Age adjustment — % of sale price per year
        age_diff = subject_year - comp_year
        age_adj  = age_diff * age_rate * sale_price

        # Building class adjustment (office only)
        class_adj = 0.0
        if subject_class and comp_class and subject.get("asset_class") == "office":
            class_steps = _CLASS_RANK.get(subject_class, 1) - _CLASS_RANK.get(comp_class, 1)
            # Negative steps = subject is better class = positive value adjustment
            class_adj = -class_steps * class_rate * sale_price

        total_adj     = size_adj + age_adj + class_adj
        adjusted_price = int(sale_price + total_adj)
        adj_pct       = abs(total_adj) / sale_price if sale_price else 0
        is_outlier    = adj_pct > outlier_pct

        notes = _notes(size_adj, age_adj, class_adj, subject, comp, is_outlier, outlier_pct)

        adjusted.append({
            **comp,
            "adjustments": {
                "size":           _fmt(size_adj),
                "age":            _fmt(age_adj),
                "building_class": _fmt(class_adj),
                "total_pct":      round(adj_pct * 100, 1),
            },
            "adjusted_price": adjusted_price,
            "is_outlier": is_outlier,
            "adjustment_notes": notes,
        })

    return {
        "adjusted_comps": adjusted,
        "adjustment_rates": {
            "size_per_sqft":        float(cfg["size_per_sqft"]),
            "age_per_year_pct":     float(cfg["age_per_year_pct"]),
            "building_class_pct":   float(cfg["building_class_pct"]),
            "outlier_threshold_pct": float(cfg["outlier_threshold_pct"]),
        },
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def _notes(size_d, age_d, class_d, subject, comp, is_outlier, threshold) -> str:
    parts = []
    subj_size = _effective_size(subject)
    comp_size = _effective_size(comp)
    if abs(size_d) >= 1:
        diff = subj_size - comp_size
        parts.append(
            f"Subject is {abs(diff):,} sqft {'larger' if diff > 0 else 'smaller'} ({_fmt(size_d)})"
        )
    if abs(age_d) >= 1:
        diff = (subject.get("year_built") or 2000) - (comp.get("year_built") or 2000)
        parts.append(
            f"Subject is {abs(diff)} yr(s) {'newer' if diff > 0 else 'older'} ({_fmt(age_d)})"
        )
    if abs(class_d) >= 1:
        parts.append(f"Building class adjustment ({_fmt(class_d)})")
    if is_outlier:
        parts.append(
            f"[!] Total adjustment exceeds {int(threshold * 100)}% — weak comparable (CUSPAP guideline)"
        )
    return "; ".join(parts) if parts else "No significant adjustments required"
