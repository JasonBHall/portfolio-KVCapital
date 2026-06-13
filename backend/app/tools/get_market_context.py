"""
get_market_context tool

Pulls area-level market statistics from property_sales to support
the report narrative. Always called once before generate_report.
"""

import math
import time

from app import db


async def get_market_context(
    latitude: float,
    longitude: float,
    radius_km: float,
    property_type: str,
    months: int = 6,
) -> dict:
    t0 = time.time()

    deg_lat = radius_km / 111.0
    deg_lng = radius_km / (111.0 * math.cos(math.radians(latitude)))

    row = await db.fetchrow(
        """
        SELECT
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)::int  AS median_sale_price,
            ROUND(AVG(days_on_market))::int                                AS avg_days_on_market,
            COUNT(*)::int                                                  AS sale_volume,
            ROUND(AVG(sale_price)::numeric, 0)::int                        AS avg_price_current
        FROM property_sales
        WHERE property_type = %s
          AND latitude  BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
          AND sale_date >= CURRENT_DATE - (%s * INTERVAL '1 month')
        """,
        (property_type,
         latitude - deg_lat, latitude + deg_lat,
         longitude - deg_lng, longitude + deg_lng,
         months),
    )

    prior = await db.fetchrow(
        """
        SELECT ROUND(AVG(sale_price)::numeric, 0)::int AS avg_price_prior
        FROM property_sales
        WHERE property_type = %s
          AND latitude  BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
          AND sale_date >= CURRENT_DATE - (%s * INTERVAL '1 month')
          AND sale_date <  CURRENT_DATE - (%s * INTERVAL '1 month')
        """,
        (property_type,
         latitude - deg_lat, latitude + deg_lat,
         longitude - deg_lng, longitude + deg_lng,
         months * 2, months),
    )

    current_avg = row["avg_price_current"] or 0
    prior_avg   = prior["avg_price_prior"] or current_avg
    trend_pct   = ((current_avg - prior_avg) / prior_avg * 100) if prior_avg else 0.0

    if trend_pct > 1:
        trend_str = f"up {trend_pct:.1f}% vs prior {months} months"
    elif trend_pct < -1:
        trend_str = f"down {abs(trend_pct):.1f}% vs prior {months} months"
    else:
        trend_str = "stable vs prior period"

    # Months of inventory — rough heuristic: volume / typical monthly run rate
    # A seller's market is generally < 4 months supply; buyer's > 6 months
    # Source: CREA market condition definitions
    monthly_rate = (row["sale_volume"] or 0) / months if months else 1
    months_inventory = round(1 / monthly_rate, 1) if monthly_rate > 0 else None

    if months_inventory is None:
        market_condition = "unknown"
    elif months_inventory < 4:
        market_condition = "seller"
    elif months_inventory > 6:
        market_condition = "buyer"
    else:
        market_condition = "balanced"

    return {
        "median_sale_price":    row["median_sale_price"],
        "avg_days_on_market":   row["avg_days_on_market"],
        "sale_volume":          row["sale_volume"],
        "price_trend":          trend_str,
        "months_of_inventory":  months_inventory,
        "market_condition":     market_condition,
        "elapsed_ms":           int((time.time() - t0) * 1000),
    }
