"""
Synthetic Alberta residential property sales dataset generator.

Produces ~800-1000 records across four zones designed to trigger different
agent tool paths. Can be run standalone (CLI) or called from the API
via the /admin/regenerate-data endpoint.

Usage:
    python generate_dataset.py                  # default seed, ~900 records
    python generate_dataset.py --seed 99        # reproducible run
    python generate_dataset.py --output sales.json
"""

import argparse
import json
import math
import random
import uuid
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Optional


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

@dataclass
class PropertyRecord:
    id: str
    address: str
    neighbourhood: str
    city: str
    province: str = "AB"
    latitude: float = 0.0
    longitude: float = 0.0
    zone: str = "urban_dense"
    property_type: str = "detached"
    bedrooms: int = 3
    bathrooms: float = 2.0
    sqft: int = 1400
    lot_sqft: Optional[int] = None
    year_built: int = 2005
    sale_price: int = 460000
    sale_date: str = "2025-01-01"
    days_on_market: int = 14
    description: str = ""
    embedding: None = None


# ---------------------------------------------------------------------------
# Zone definitions
# Source: CMHC Housing Market Information Portal (Edmonton CMA, 2024-2025)
#         CREA MLS HPI by property type
# ---------------------------------------------------------------------------

ZONES = {
    "urban_dense": {
        "weight": 0.50,
        "cities": [
            ("Edmonton", "AB", 53.5461, -113.4938),
            ("St. Albert", "AB", 53.6332, -113.6268),
            ("Sherwood Park", "AB", 53.5344, -113.3186),
        ],
        "neighbourhoods": [
            "Glenora", "Garneau", "Oliver", "Windermere", "Terwillegar",
            "Riverbend", "Summerside", "Rutherford", "Glastonbury", "Griesbach",
        ],
        "max_age_months": 12,
        "records_per_subarea": (50, 80),
        "price_variance": 0.08,
        "missing_attr_rate": 0.02,
        "jitter_km": 2.5,   # tight cluster — ensures 4+ comps within default 2km search
    },
    "suburban_sparse": {
        "weight": 0.30,
        "cities": [
            ("Leduc", "AB", 53.2594, -113.5497),
            ("Spruce Grove", "AB", 53.5453, -113.9008),
            ("Fort Saskatchewan", "AB", 53.7128, -113.2136),
        ],
        "neighbourhoods": [
            "Downtown", "Southfork", "Heritage Valley", "Breckenridge",
            "Westpark", "Lakeland Ridge", "Woodhaven",
        ],
        "max_age_months": 14,
        "records_per_subarea": (15, 25),
        "price_variance": 0.12,
        "missing_attr_rate": 0.08,
        "jitter_km": 6.0,
    },
    "rural": {
        "weight": 0.15,
        "cities": [
            ("Stony Plain", "AB", 53.5264, -114.0000),
            ("Morinville", "AB", 53.7997, -113.6497),
            ("Bon Accord", "AB", 53.8333, -113.4167),
        ],
        "neighbourhoods": [
            "Downtown", "Rural Route", "Countryside Estates", "Creekside",
        ],
        "max_age_months": 20,
        "records_per_subarea": (3, 8),
        "price_variance": 0.18,
        "missing_attr_rate": 0.15,
        "jitter_km": 10.0,
    },
    "edge_case": {
        "weight": 0.05,
        "cities": [
            ("Gibbons", "AB", 53.8333, -113.3333),
            ("Legal", "AB", 53.9500, -113.6167),
        ],
        "neighbourhoods": ["Main Street", "Rural"],
        "max_age_months": 24,
        "records_per_subarea": (1, 3),
        "price_variance": 0.30,
        "missing_attr_rate": 0.25,
        "jitter_km": 15.0,
    },
}

# Base prices by property type — Edmonton CMA median, CMHC 2024-2025
BASE_PRICES = {
    "detached":     460_000,
    "semi-detached": 380_000,
    "townhouse":    310_000,
    "condo":        220_000,
}

# Sqft ranges by type
SQFT_RANGES = {
    "detached":     (1_200, 2_400),
    "semi-detached": (1_000, 1_600),
    "townhouse":    (900,   1_500),
    "condo":        (600,   1_200),
}

# Lot sqft ranges (condos/townhouses often have no lot)
LOT_RANGES = {
    "detached":     (3_500, 7_000),
    "semi-detached": (2_500, 4_000),
    "townhouse":    None,
    "condo":        None,
}

PROPERTY_TYPE_WEIGHTS = [0.45, 0.20, 0.20, 0.15]  # detached, semi, town, condo
PROPERTY_TYPES = ["detached", "semi-detached", "townhouse", "condo"]

BEDROOM_RANGES = {
    "detached":     (2, 5),
    "semi-detached": (2, 4),
    "townhouse":    (2, 4),
    "condo":        (1, 3),
}

BATHROOM_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]

FEATURES = [
    "finished basement", "unfinished basement", "double attached garage",
    "single attached garage", "detached garage", "no garage",
    "updated kitchen", "updated bathrooms", "new roof (2023)", "new roof (2022)",
    "hardwood floors", "new flooring (2024)", "central A/C", "no A/C",
    "large backyard", "corner lot", "backs onto green space", "backs onto ravine",
    "new windows (2023)", "original windows",
]

STREET_TYPES = ["St", "Ave", "Blvd", "Dr", "Cres", "Way", "Pl", "Rd", "Ct", "Ln"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def jitter(lat: float, lng: float, radius_km: float, rng: random.Random):
    """Add random lat/lng offset within radius_km."""
    r = radius_km / 111.0  # degrees per km (approximate)
    dlat = rng.uniform(-r, r)
    dlng = rng.uniform(-r, r) / max(math.cos(math.radians(lat)), 0.01)
    return round(lat + dlat, 6), round(lng + dlng, 6)


def random_date(max_age_months: int, rng: random.Random) -> str:
    today = date(2026, 5, 31)
    days_back = rng.randint(30, int(max_age_months * 30.44))
    return (today - timedelta(days=days_back)).isoformat()


def random_address(neighbourhood: str, rng: random.Random) -> str:
    number = rng.randint(100, 9999)
    street_name = rng.choice([
        "Maple", "Oak", "Cedar", "Pine", "Elm", "Birch", "Aspen",
        "River", "Lake", "Park", "Hill", "Valley", "Meadow", "Forest",
        "Heritage", "Pioneer", "Frontier", "Prairie", "Summit",
    ])
    street_type = rng.choice(STREET_TYPES)
    return f"{number} {street_name} {street_type}"


def price_adjustment(base: int, sqft: int, beds: int, baths: float,
                     year_built: int, variance: float, rng: random.Random) -> int:
    """
    Apply per-attribute price adjustments to the base price.
    Rates sourced from CREA MLS HPI $/sqft differentials and
    AIC practitioner convention (bedroom/bathroom/age adjustments).
    """
    sqft_mid = (SQFT_RANGES["detached"][0] + SQFT_RANGES["detached"][1]) / 2
    price = base
    price += (sqft - sqft_mid) * 85           # $85/sqft — CREA HPI Edmonton 2024
    price += (beds - 3) * 8_000               # $8,000/bedroom — AIC convention
    price += (baths - 2.0) * 6_000            # $6,000/bathroom — AIC convention
    price += (year_built - 2005) * 1_250      # $1,250/year — AIC practitioner rule
    price *= (1 + rng.uniform(-variance, variance))
    return max(80_000, round(price / 1_000) * 1_000)


def build_description(ptype: str, beds: int, baths: float, neighbourhood: str,
                      year_built: int, rng: random.Random) -> str:
    feature_count = rng.randint(2, 4)
    features = rng.sample(FEATURES, feature_count)
    bath_str = f"{int(baths)}-bath" if baths == int(baths) else f"{baths}-bath"
    return (
        f"{beds}-bed {bath_str} {ptype} in {neighbourhood}, "
        f"built {year_built}, {', '.join(features)}"
    )


# ---------------------------------------------------------------------------
# Edge case injectors
# ---------------------------------------------------------------------------

def inject_edge_cases(records: list[PropertyRecord], rng: random.Random) -> list[PropertyRecord]:
    """
    Add deliberate edge case records that force specific agent behaviors.
    Each edge case is documented with the agent path it triggers.
    """
    base_lat, base_lng = 53.9500, -113.6167  # Legal, AB — very sparse area

    # Edge case 1: Zero comps scenario
    # Agent path: search_comps → 0 results → expand_search x2 → "insufficient data"
    records.append(PropertyRecord(
        id=str(uuid.uuid4()),
        address="1 Isolated Rd",
        neighbourhood="No Comp Zone",
        city="Radway",
        province="AB",
        latitude=54.0833,
        longitude=-113.4500,
        zone="edge_case",
        property_type="detached",
        bedrooms=3,
        bathrooms=2.0,
        sqft=1400,
        lot_sqft=5000,
        year_built=1998,
        sale_price=280_000,
        sale_date="2024-08-15",
        days_on_market=62,
        description="3-bed 2-bath detached in Radway, original condition, large lot, wood stove",
    ))

    # Edge case 2: Outlier comp — large adjustment required (>15% of sale price)
    # Agent path: calculate_adjustments → flags outlier → notes it in report
    # This property is unusually large for its area, forcing a big sqft adjustment
    records.append(PropertyRecord(
        id=str(uuid.uuid4()),
        address="42 Outlier Cres",
        neighbourhood="Countryside Estates",
        city="Stony Plain",
        province="AB",
        latitude=53.5264,
        longitude=-114.0100,
        zone="edge_case",
        property_type="detached",
        bedrooms=5,
        bathrooms=3.5,
        sqft=3_200,          # Very large — will force >15% adjustment vs typical comps
        lot_sqft=12_000,
        year_built=2018,
        sale_price=780_000,
        days_on_market=45,
        sale_date="2025-03-10",
        description="5-bed 3.5-bath detached in Stony Plain, oversized lot, triple garage, theatre room, high-end finishes throughout",
    ))

    # Edge case 3: High variance comps — conflicting adjusted prices
    # Agent path: generate_report → flags low comparability confidence
    # Three nearby sales with wildly different prices due to condition
    variance_base = {"lat": 53.7128, "lng": -113.2136}  # Fort Saskatchewan
    for i, (price, condition) in enumerate([
        (290_000, "needs full renovation, original 1970s finishes, new furnace (2024)"),
        (520_000, "fully renovated 2023, new kitchen, bathrooms, flooring, roof"),
        (390_000, "updated kitchen and bathrooms, original windows, functional condition"),
    ]):
        lat, lng = jitter(variance_base["lat"], variance_base["lng"], 0.5, rng)
        records.append(PropertyRecord(
            id=str(uuid.uuid4()),
            address=f"{100 + i * 12} Variance St",
            neighbourhood="Downtown",
            city="Fort Saskatchewan",
            province="AB",
            latitude=lat,
            longitude=lng,
            zone="edge_case",
            property_type="detached",
            bedrooms=3,
            bathrooms=2.0,
            sqft=1_350,
            lot_sqft=4_500,
            year_built=1972,
            sale_price=price,
            sale_date="2025-04-15",
            days_on_market=rng.randint(8, 55),
            description=f"3-bed 2-bath detached in Fort Saskatchewan, built 1972, {condition}",
        ))

    return records


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

def generate(seed: int = 42, target: int = 900) -> list[dict]:
    rng = random.Random(seed)
    records: list[PropertyRecord] = []

    for zone_name, zone in ZONES.items():
        zone_target = int(target * zone["weight"])
        cities = zone["cities"]
        min_per, max_per = zone["records_per_subarea"]
        neighbourhoods = zone["neighbourhoods"]

        # Each city × neighbourhood pairing is a sub-area; each emits min_per–max_per records
        # We keep adding sub-areas until we hit zone_target
        generated = 0
        city_cycle = 0
        while generated < zone_target:
            city_name, province, base_lat, base_lng = cities[city_cycle % len(cities)]
            neighbourhood = neighbourhoods[rng.randint(0, len(neighbourhoods) - 1)]
            count = rng.randint(min_per, max_per)
            count = min(count, zone_target - generated)  # don't overshoot
            city_cycle += 1

            for _ in range(count):
                ptype = rng.choices(PROPERTY_TYPES, weights=PROPERTY_TYPE_WEIGHTS)[0]
                beds_min, beds_max = BEDROOM_RANGES[ptype]
                beds = rng.randint(beds_min, beds_max)
                baths = rng.choice(BATHROOM_OPTIONS[:BATHROOM_OPTIONS.index(
                    min(BATHROOM_OPTIONS, key=lambda x: abs(x - (beds * 0.7)))
                ) + 2])
                sqft_min, sqft_max = SQFT_RANGES[ptype]
                sqft = rng.randint(sqft_min, sqft_max)
                year_built = rng.randint(1975, 2024)
                lat, lng = jitter(base_lat, base_lng, zone["jitter_km"], rng)
                sale_price = price_adjustment(
                    BASE_PRICES[ptype], sqft, beds, baths, year_built,
                    zone["price_variance"], rng
                )

                lot_range = LOT_RANGES[ptype]
                lot_sqft = rng.randint(*lot_range) if lot_range else None

                # Simulate missing attributes
                if rng.random() < zone["missing_attr_rate"]:
                    sqft = rng.choice([sqft, None])

                records.append(PropertyRecord(
                    id=str(uuid.uuid4()),
                    address=random_address(neighbourhood, rng),
                    neighbourhood=neighbourhood,
                    city=city_name,
                    province=province,
                    latitude=lat,
                    longitude=lng,
                    zone=zone_name,
                    property_type=ptype,
                    bedrooms=beds,
                    bathrooms=baths,
                    sqft=sqft or rng.randint(sqft_min, sqft_max),
                    lot_sqft=lot_sqft,
                    year_built=year_built,
                    sale_price=sale_price,
                    sale_date=random_date(zone["max_age_months"], rng),
                    days_on_market=rng.randint(3, 90),
                    description=build_description(ptype, beds, baths, neighbourhood, year_built, rng),
                ))
                generated += 1

    records = inject_edge_cases(records, rng)
    rng.shuffle(records)

    return [asdict(r) for r in records]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic Alberta property sales dataset")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument("--target", type=int, default=3000, help="Approximate record count (default: 3000)")
    parser.add_argument("--output", type=str, default="sales_data.json", help="Output file path")
    args = parser.parse_args()

    print(f"Generating dataset: seed={args.seed}, target={args.target}")
    records = generate(seed=args.seed, target=args.target)
    print(f"Generated {len(records)} records")

    zone_counts = {}
    for r in records:
        zone_counts[r["zone"]] = zone_counts.get(r["zone"], 0) + 1
    for zone, count in sorted(zone_counts.items()):
        print(f"  {zone}: {count}")

    with open(args.output, "w") as f:
        json.dump(records, f, indent=2)

    print(f"Written to {args.output}")


if __name__ == "__main__":
    main()
