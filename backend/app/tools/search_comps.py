"""
search_comps tool

Queries property_sales using structured filters first, then re-ranks results
by vector cosine similarity on the description embedding.

Filter order (structured → vector):
  1. property_type match
  2. bedrooms within tolerance
  3. bounding box by radius_km
  4. sale_date within max_age_months
  5. re-rank top candidates by embedding similarity (if embeddings present)

Source for radius→degree conversion: 1 degree latitude ≈ 111km (spherical earth approx).
Haversine used for accurate distance on results after bounding box pre-filter.
"""

import math
import time
from typing import Optional

from app import db
from app.tools.embeddings import embed_text


# Haversine formula — accurate great-circle distance in km
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


async def search_comps(
    property_type: str,
    bedrooms: int,
    bathrooms: float,
    sqft: int,
    latitude: float,
    longitude: float,
    radius_km: float = 2.0,
    max_age_months: int = 12,
    beds_flexible: bool = False,
    type_adjacent: bool = False,
    limit: int = 10,
) -> dict:
    t0 = time.time()

    # Bounding box — fast pre-filter before haversine
    deg_lat = radius_km / 111.0
    deg_lng = radius_km / (111.0 * math.cos(math.radians(latitude)))
    lat_min, lat_max = latitude - deg_lat, latitude + deg_lat
    lng_min, lng_max = longitude - deg_lng, longitude + deg_lng

    # Property type adjacency mapping
    # e.g. if searching detached and data is thin, semi-detached is the closest alternative
    adjacent_types = {
        "detached":     ["semi-detached"],
        "semi-detached": ["detached", "townhouse"],
        "townhouse":    ["semi-detached", "condo"],
        "condo":        ["townhouse"],
    }
    type_filter = [property_type]
    if type_adjacent:
        type_filter += adjacent_types.get(property_type, [])

    bed_min = (bedrooms - 1) if beds_flexible else bedrooms
    bed_max = (bedrooms + 1) if beds_flexible else bedrooms

    rows = await db.fetch(
        """
        SELECT
            id, address, neighbourhood, city, sale_price, sale_date,
            property_type, bedrooms, bathrooms, sqft, year_built,
            latitude, longitude, description, embedding
        FROM property_sales
        WHERE property_type = ANY(%s::text[])
          AND bedrooms BETWEEN %s AND %s
          AND latitude  BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
          AND sale_date >= CURRENT_DATE - (%s * INTERVAL '1 month')
        ORDER BY sale_date DESC
        LIMIT 50
        """,
        (type_filter, bed_min, bed_max,
         lat_min, lat_max, lng_min, lng_max,
         max_age_months),
    )

    if not rows:
        return {"comps": [], "total_found": 0, "elapsed_ms": int((time.time() - t0) * 1000)}

    # Compute accurate haversine distance and filter to radius
    candidates = []
    for row in rows:
        dist = haversine_km(latitude, longitude, float(row["latitude"]), float(row["longitude"]))
        if dist <= radius_km:
            candidates.append({**dict(row), "distance_km": round(dist, 3)})

    # Vector re-ranking — generate a query embedding and sort by cosine similarity
    # Falls back to date-sorted order if embeddings are zero vectors (offline mode)
    query_description = f"{bedrooms}-bed {property_type} {sqft}sqft built around {_decade(sqft)}"
    try:
        query_embedding = await embed_text(query_description)
        for c in candidates:
            if c.get("embedding") and any(v != 0.0 for v in c["embedding"]):
                c["similarity_score"] = _cosine_similarity(query_embedding, c["embedding"])
            else:
                c["similarity_score"] = None
        candidates.sort(key=lambda x: x["similarity_score"] or 0, reverse=True)
    except Exception:
        for c in candidates:
            c["similarity_score"] = None

    results = candidates[:limit]

    # Strip raw embedding from output — not needed downstream
    for r in results:
        r.pop("embedding", None)

    return {
        "comps": results,
        "total_found": len(results),
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def _decade(sqft: int) -> str:
    # Rough proxy when year_built isn't in the query embedding
    return "2000s"


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x ** 2 for x in a))
    mag_b = math.sqrt(sum(x ** 2 for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)
