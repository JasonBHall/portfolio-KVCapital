"""
search_commercial_comps tool

Queries commercial_properties using structured filters then re-ranks by
vector cosine similarity on the description embedding.

Differs from residential search_comps:
- Filters on asset_class instead of property_type
- No bedrooms filter — uses size tolerance (±50% of subject size)
- Optional building_class filter with adjacency (A↔B, B↔C)
- Returns income fields: noi, implied_cap_rate, occupancy_pct_at_sale, lease_type
"""

import math
import time
from typing import Optional

from app import db
from app.tools.embeddings import embed_text


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x ** 2 for x in a))
    mag_b = math.sqrt(sum(x ** 2 for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _effective_size(row: dict) -> int:
    """Return a comparable size figure regardless of asset class."""
    return row.get("gba_sqft") or row.get("nra_sqft") or ((row.get("num_units") or 0) * 800) or 1


_CLASS_RANK = {"A": 0, "B": 1, "C": 2}
_ADJACENT_CLASSES = {"A": ["A", "B"], "B": ["A", "B", "C"], "C": ["B", "C"]}


async def search_commercial_comps(
    asset_class: str,
    latitude: float,
    longitude: float,
    radius_km: float = 3.0,
    max_age_months: int = 18,
    building_class: Optional[str] = None,
    class_adjacent: bool = False,
    subject_size: Optional[int] = None,
    limit: int = 10,
) -> dict:
    t0 = time.time()

    deg_lat = radius_km / 111.0
    deg_lng = radius_km / (111.0 * math.cos(math.radians(latitude)))
    lat_min, lat_max = latitude - deg_lat, latitude + deg_lat
    lng_min, lng_max = longitude - deg_lng, longitude + deg_lng

    class_filter = None
    if building_class:
        class_filter = _ADJACENT_CLASSES[building_class] if class_adjacent else [building_class]

    if class_filter:
        rows = await db.fetch(
            """
            SELECT id, address, city, sale_price, sale_date, asset_class, building_class,
                   gba_sqft, nra_sqft, num_units, year_built, latitude, longitude,
                   noi, implied_cap_rate, occupancy_pct_at_sale, lease_type, walt_years,
                   clear_height_ft, num_dock_doors, description, embedding
            FROM commercial_properties
            WHERE asset_class = %s
              AND building_class = ANY(%s::text[])
              AND latitude  BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
              AND sale_date >= CURRENT_DATE - (%s * INTERVAL '1 month')
            ORDER BY sale_date DESC
            LIMIT 50
            """,
            (asset_class, class_filter, lat_min, lat_max, lng_min, lng_max, max_age_months),
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, address, city, sale_price, sale_date, asset_class, building_class,
                   gba_sqft, nra_sqft, num_units, year_built, latitude, longitude,
                   noi, implied_cap_rate, occupancy_pct_at_sale, lease_type, walt_years,
                   clear_height_ft, num_dock_doors, description, embedding
            FROM commercial_properties
            WHERE asset_class = %s
              AND latitude  BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
              AND sale_date >= CURRENT_DATE - (%s * INTERVAL '1 month')
            ORDER BY sale_date DESC
            LIMIT 50
            """,
            (asset_class, lat_min, lat_max, lng_min, lng_max, max_age_months),
        )

    if not rows:
        return {"comps": [], "total_found": 0, "elapsed_ms": int((time.time() - t0) * 1000)}

    candidates = []
    for row in rows:
        dist = haversine_km(latitude, longitude, float(row["latitude"]), float(row["longitude"]))
        if dist <= radius_km:
            r = {**dict(row), "distance_km": round(dist, 3)}
            # Size filter — exclude if > 3× or < 1/3 of subject size (very different buildings)
            if subject_size:
                comp_size = _effective_size(r)
                if comp_size < subject_size / 3 or comp_size > subject_size * 3:
                    continue
            candidates.append(r)

    # Vector re-ranking
    query_text = f"{asset_class} {building_class or ''} commercial property Edmonton Alberta"
    try:
        query_embedding = await embed_text(query_text)
        for c in candidates:
            emb = c.get("embedding")
            if emb and any(v != 0.0 for v in emb):
                c["similarity_score"] = _cosine_similarity(query_embedding, emb)
            else:
                c["similarity_score"] = None
        candidates.sort(key=lambda x: x["similarity_score"] or 0, reverse=True)
    except Exception:
        for c in candidates:
            c["similarity_score"] = None

    results = candidates[:limit]
    for r in results:
        r.pop("embedding", None)
        # Normalise Decimal types
        for field in ("noi", "implied_cap_rate", "occupancy_pct_at_sale", "walt_years",
                      "clear_height_ft", "latitude", "longitude"):
            if r.get(field) is not None:
                r[field] = float(r[field])
        if r.get("sale_price"):
            r["sale_price"] = int(r["sale_price"])
        if r.get("sale_date"):
            r["sale_date"] = r["sale_date"].isoformat() if hasattr(r["sale_date"], "isoformat") else str(r["sale_date"])

    return {
        "comps": results,
        "total_found": len(results),
        "elapsed_ms": int((time.time() - t0) * 1000),
    }
