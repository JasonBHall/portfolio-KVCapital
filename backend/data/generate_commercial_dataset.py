"""
Synthetic Alberta commercial property sales dataset generator.

Produces ~200 records across three asset classes calibrated to
Altus Group Canadian Cap Rate Report Q4 2024 benchmarks.

Distribution:
  - Industrial:   80 records — NE Edmonton, NNN leases, 5.25–6.75% cap rates
  - Office:       70 records — West/South Edmonton suburban, Class A/B
  - Multifamily:  50 records — Central Edmonton, 6–24 units

Each record has internally consistent income data:
  GPI → EGI → NOI → sale_price (derived from cap rate)
  implied_cap_rate is recomputed from NOI / sale_price at generation time.

Usage:
    python generate_commercial_dataset.py
    python generate_commercial_dataset.py --seed 99 --target 200
    python generate_commercial_dataset.py --clear   # truncate and re-seed
"""

import argparse
import math
import os
import random
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras

BATCH_SIZE   = 50
EMBEDDING_DIM = 1536

# ---------------------------------------------------------------------------
# Edmonton commercial location anchors
# ---------------------------------------------------------------------------

# Industrial: Yellowhead corridor + NE industrial park
INDUSTRIAL_ANCHORS = [
    ("Edmonton", "AB", 53.583, -113.405),   # Yellowhead industrial
    ("Edmonton", "AB", 53.612, -113.355),   # NE industrial park
    ("Edmonton", "AB", 53.570, -113.440),   # 97th St corridor
]

# Office: West Edmonton suburban + South Edmonton common
OFFICE_ANCHORS = [
    ("Edmonton", "AB", 53.525, -113.608),   # West Edmonton suburban office
    ("Edmonton", "AB", 53.543, -113.524),   # South Edmonton common area
    ("Edmonton", "AB", 53.516, -113.565),   # Windermere business park
]

# Multifamily: Central and mature neighbourhoods
MULTIFAMILY_ANCHORS = [
    ("Edmonton", "AB", 53.545, -113.498),   # Central core
    ("Edmonton", "AB", 53.530, -113.512),   # Whyte Ave / South side
    ("Edmonton", "AB", 53.560, -113.480),   # North central
]

ZONE_WEIGHTS = {
    "urban_dense":     0.60,
    "suburban_sparse": 0.30,
    "edge_case":       0.10,
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_connection():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return psycopg2.connect(url)


def get_embeddings(texts: list[str]) -> list[list[float]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(model="text-embedding-3-small", input=texts)
        return [item.embedding for item in response.data]
    print("  [warn] No OPENAI_API_KEY — using zero-vector stubs for embeddings")
    return [[0.0] * EMBEDDING_DIM for _ in texts]


def jitter(lat: float, lng: float, km: float, rng: random.Random) -> tuple:
    dlat = (rng.uniform(-km, km)) / 111.0
    dlng = (rng.uniform(-km, km)) / (111.0 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lng + dlng, 6)


def random_date(max_age_months: int, rng: random.Random) -> str:
    today = date.today()
    days_back = rng.randint(30, int(max_age_months * 30.5))
    d = today - timedelta(days=days_back)
    return d.isoformat()


def pick_zone(rng: random.Random) -> str:
    r = rng.random()
    cumulative = 0.0
    for zone, weight in ZONE_WEIGHTS.items():
        cumulative += weight
        if r < cumulative:
            return zone
    return "urban_dense"


def round_to_nearest(value: float, nearest: int) -> int:
    return int(round(value / nearest) * nearest)


# ---------------------------------------------------------------------------
# Industrial generator
# ---------------------------------------------------------------------------

def _industrial_address(i: int) -> str:
    street_names = [
        "Commerce Way", "Industrial Rd", "Yellowhead Trail",
        "Manning Dr", "97 St NW", "Meridian St",
        "Gateway Blvd", "Parsons Rd", "Roper Rd",
    ]
    return f"{100 + i * 7} {street_names[i % len(street_names)]}"


def _industrial_description(gba: int, clear_h: float, docks: int, noi: float, cap: float, lease: str) -> str:
    size_cat = "small-bay" if gba < 20_000 else ("mid-bay" if gba < 50_000 else "large-format")
    return (
        f"{gba:,} sqft {size_cat} industrial/warehouse, Edmonton AB, "
        f"{clear_h:.0f}ft clear height, {docks} dock door(s), {lease} lease, "
        f"NOI ${noi:,.0f}/yr, implied cap rate {cap:.2%}"
    )


def generate_industrial(n: int, rng: random.Random) -> list[dict]:
    records = []
    for i in range(n):
        anchor = rng.choice(INDUSTRIAL_ANCHORS)
        city, prov, alat, alng = anchor
        jitter_km = 3.0 if pick_zone(rng) == "urban_dense" else 7.0
        lat, lng = jitter(alat, alng, jitter_km, rng)
        zone = pick_zone(rng)

        gba = rng.randint(8_000, 75_000)
        # Clear height correlated with size
        if gba < 15_000:
            clear_h = round(rng.uniform(18, 24), 1)
        elif gba < 40_000:
            clear_h = round(rng.uniform(22, 28), 1)
        else:
            clear_h = round(rng.uniform(26, 32), 1)

        docks = max(1, int(gba / 12_000) + rng.randint(0, 2))
        year_built = rng.randint(1985, 2023)

        # Income — NNN (tenant pays expenses)
        # Net rent: larger buildings get slightly lower $/sqft
        if gba < 20_000:
            net_rent = rng.uniform(12.0, 16.5)
        elif gba < 50_000:
            net_rent = rng.uniform(10.5, 15.0)
        else:
            net_rent = rng.uniform(9.5, 13.5)

        vacancy = rng.uniform(0.00, 0.08)   # NNN typically low vacancy
        gpi = gba * net_rent
        egi = gpi * (1 - vacancy)
        expense_ratio = rng.uniform(0.06, 0.10)
        opex = egi * expense_ratio
        noi = egi - opex

        # Cap rate — Altus Q4 2024: Edmonton industrial 5.25–6.75%
        cap_rate = rng.uniform(0.0525, 0.0675)
        if zone == "edge_case":
            cap_rate = rng.choice([rng.uniform(0.07, 0.09), rng.uniform(0.04, 0.052)])

        sale_price = round_to_nearest(noi / cap_rate, 25_000)
        implied_cap = noi / sale_price if sale_price > 0 else cap_rate

        desc = _industrial_description(gba, clear_h, docks, noi, implied_cap, "NNN")

        records.append({
            "id": str(uuid.uuid4()),
            "address": _industrial_address(i),
            "neighbourhood": None,
            "city": city,
            "province": prov,
            "latitude": lat,
            "longitude": lng,
            "zone": zone,
            "asset_class": "industrial",
            "building_class": None,
            "year_built": year_built,
            "year_renovated": None,
            "num_floors": 1,
            "site_area_sqft": int(gba * rng.uniform(2.5, 5.0)),
            "gba_sqft": gba,
            "nra_sqft": None,
            "num_units": None,
            "clear_height_ft": clear_h,
            "num_dock_doors": docks,
            "gross_potential_income": round(gpi, 2),
            "vacancy_rate_pct": round(vacancy * 100, 2),
            "effective_gross_income": round(egi, 2),
            "operating_expenses": round(opex, 2),
            "noi": round(noi, 2),
            "implied_cap_rate": round(implied_cap, 4),
            "occupancy_pct_at_sale": round((1 - vacancy) * 100, 1),
            "lease_type": "NNN",
            "walt_years": round(rng.uniform(1.5, 8.0), 1),
            "sale_price": sale_price,
            "sale_date": random_date(20, rng),
            "days_on_market": rng.randint(14, 120),
            "description": desc,
        })
    return records


# ---------------------------------------------------------------------------
# Office generator
# ---------------------------------------------------------------------------

def _office_address(i: int) -> str:
    streets = [
        "Jasper Ave NW", "99 St NW", "111 Ave NW", "Stony Plain Rd",
        "Terwillegar Dr", "Ellerslie Rd", "Anthony Henday Dr",
        "Gateway Blvd", "Calgary Trail NW",
    ]
    suite = f"Suite {100 + i * 3}, "
    return f"{suite}{200 + i * 4} {streets[i % len(streets)]}"


def _office_description(nra: int, cls: str, floors: int, noi: float, cap: float, lease: str, vacancy: float) -> str:
    return (
        f"{nra:,} sqft NRA Class {cls} suburban office, Edmonton AB, "
        f"{floors} floor(s), {lease} lease, {(1-vacancy)*100:.0f}% occupied, "
        f"NOI ${noi:,.0f}/yr, implied cap rate {cap:.2%}"
    )


def generate_office(n: int, rng: random.Random) -> list[dict]:
    records = []
    for i in range(n):
        anchor = rng.choice(OFFICE_ANCHORS)
        city, prov, alat, alng = anchor
        lat, lng = jitter(alat, alng, 4.0, rng)
        zone = pick_zone(rng)

        # 70% Class B, 30% Class A
        bld_class = "A" if rng.random() < 0.30 else "B"
        nra = rng.randint(3_000, 28_000)
        floors = max(1, int(nra / 6_000) + rng.randint(0, 2))
        year_built = rng.randint(1990, 2020)

        # Rent and vacancy by class
        if bld_class == "A":
            net_rent  = rng.uniform(18.0, 24.0)
            vacancy   = rng.uniform(0.05, 0.16)
            cap_rate  = rng.uniform(0.0675, 0.0850)
            exp_ratio = rng.uniform(0.38, 0.42)
            lease     = rng.choice(["gross", "modified_gross"])
        else:
            net_rent  = rng.uniform(13.5, 19.0)
            vacancy   = rng.uniform(0.10, 0.24)   # higher vacancy for Class B
            cap_rate  = rng.uniform(0.0750, 0.0950)
            exp_ratio = rng.uniform(0.40, 0.44)
            lease     = rng.choice(["gross", "gross", "modified_gross"])  # gross more common

        if zone == "edge_case":
            vacancy  = rng.uniform(0.25, 0.40)   # high vacancy edge case
            cap_rate = rng.uniform(0.09, 0.11)

        gpi  = nra * net_rent
        egi  = gpi * (1 - vacancy)
        opex = egi * exp_ratio
        noi  = egi - opex

        sale_price  = round_to_nearest(noi / cap_rate, 25_000)
        if sale_price <= 0:
            sale_price = 500_000
        implied_cap = noi / sale_price

        desc = _office_description(nra, bld_class, floors, noi, implied_cap, lease, vacancy)

        records.append({
            "id": str(uuid.uuid4()),
            "address": _office_address(i),
            "neighbourhood": None,
            "city": city,
            "province": prov,
            "latitude": lat,
            "longitude": lng,
            "zone": zone,
            "asset_class": "office",
            "building_class": bld_class,
            "year_built": year_built,
            "year_renovated": year_built + rng.randint(0, 15) if rng.random() < 0.3 else None,
            "num_floors": floors,
            "site_area_sqft": int(nra * rng.uniform(3.0, 8.0)),
            "gba_sqft": None,
            "nra_sqft": nra,
            "num_units": None,
            "clear_height_ft": None,
            "num_dock_doors": None,
            "gross_potential_income": round(gpi, 2),
            "vacancy_rate_pct": round(vacancy * 100, 2),
            "effective_gross_income": round(egi, 2),
            "operating_expenses": round(opex, 2),
            "noi": round(noi, 2),
            "implied_cap_rate": round(implied_cap, 4),
            "occupancy_pct_at_sale": round((1 - vacancy) * 100, 1),
            "lease_type": lease,
            "walt_years": round(rng.uniform(1.0, 6.0), 1),
            "sale_price": sale_price,
            "sale_date": random_date(22, rng),
            "days_on_market": rng.randint(30, 180),
            "description": desc,
        })
    return records


# ---------------------------------------------------------------------------
# Multifamily generator
# ---------------------------------------------------------------------------

def _mf_address(i: int) -> str:
    streets = [
        "Whyte Ave", "82 Ave NW", "109 St NW", "112 Ave NW",
        "Jasper Ave NW", "95 St NW", "118 Ave NW", "Stony Plain Rd",
    ]
    return f"{120 + i * 6} {streets[i % len(streets)]}"


def _mf_description(units: int, avg_rent: float, noi: float, cap: float, vacancy: float) -> str:
    return (
        f"{units}-unit multifamily residential, Edmonton AB, "
        f"avg rent ${avg_rent:,.0f}/unit/mo, {(1-vacancy)*100:.0f}% occupied, "
        f"NOI ${noi:,.0f}/yr, implied cap rate {cap:.2%} "
        f"(CMHC RMR Fall 2024 / Altus Group Q4 2024)"
    )


def generate_multifamily(n: int, rng: random.Random) -> list[dict]:
    records = []
    for i in range(n):
        anchor = rng.choice(MULTIFAMILY_ANCHORS)
        city, prov, alat, alng = anchor
        lat, lng = jitter(alat, alng, 3.5, rng)
        zone = pick_zone(rng)

        num_units = rng.randint(6, 24)
        year_built = rng.randint(1970, 2020)

        # Unit mix — weighted toward 2BR
        avg_rent = rng.uniform(1_380, 1_780)  # CMHC RMR Edmonton Fall 2024
        vacancy = rng.uniform(0.02, 0.06)     # Edmonton MF: tight market

        if zone == "edge_case":
            vacancy  = rng.uniform(0.10, 0.18)
            avg_rent = rng.uniform(1_100, 1_350)

        gpi  = num_units * avg_rent * 12
        egi  = gpi * (1 - vacancy)
        exp_ratio = rng.uniform(0.32, 0.38)
        opex = egi * exp_ratio
        noi  = egi - opex

        # Cap rate — Altus Q4 2024: Edmonton MF 4.50–5.50%
        cap_rate = rng.uniform(0.0450, 0.0550)
        if zone == "edge_case":
            cap_rate = rng.uniform(0.055, 0.075)

        sale_price  = round_to_nearest(noi / cap_rate, 25_000)
        if sale_price <= 0:
            sale_price = 750_000
        implied_cap = noi / sale_price

        desc = _mf_description(num_units, avg_rent, noi, implied_cap, vacancy)

        records.append({
            "id": str(uuid.uuid4()),
            "address": _mf_address(i),
            "neighbourhood": None,
            "city": city,
            "province": prov,
            "latitude": lat,
            "longitude": lng,
            "zone": zone,
            "asset_class": "multifamily",
            "building_class": None,
            "year_built": year_built,
            "year_renovated": None,
            "num_floors": max(2, int(num_units / 4)),
            "site_area_sqft": int(num_units * rng.uniform(600, 1_200)),
            "gba_sqft": int(num_units * rng.uniform(700, 950)),
            "nra_sqft": None,
            "num_units": num_units,
            "clear_height_ft": None,
            "num_dock_doors": None,
            "gross_potential_income": round(gpi, 2),
            "vacancy_rate_pct": round(vacancy * 100, 2),
            "effective_gross_income": round(egi, 2),
            "operating_expenses": round(opex, 2),
            "noi": round(noi, 2),
            "implied_cap_rate": round(implied_cap, 4),
            "occupancy_pct_at_sale": round((1 - vacancy) * 100, 1),
            "lease_type": "gross",
            "walt_years": round(rng.uniform(0.3, 1.5), 1),
            "sale_price": sale_price,
            "sale_date": random_date(24, rng),
            "days_on_market": rng.randint(14, 90),
            "description": desc,
        })
    return records


# ---------------------------------------------------------------------------
# Generate + seed
# ---------------------------------------------------------------------------

def generate(seed: int = 42, target: int = 200) -> list[dict]:
    rng = random.Random(seed)

    n_industrial  = int(target * 0.40)
    n_office      = int(target * 0.35)
    n_multifamily = target - n_industrial - n_office

    records = []
    records += generate_industrial(n_industrial, rng)
    records += generate_office(n_office, rng)
    records += generate_multifamily(n_multifamily, rng)

    rng.shuffle(records)
    return records


def insert_batch(conn, batch: list[dict], embeddings: list[list[float]]) -> None:
    rows = []
    for rec, emb in zip(batch, embeddings):
        rows.append((
            rec["id"],
            rec["address"],
            rec.get("neighbourhood"),
            rec["city"],
            rec["province"],
            rec["latitude"],
            rec["longitude"],
            rec["zone"],
            rec["asset_class"],
            rec.get("building_class"),
            rec.get("year_built"),
            rec.get("year_renovated"),
            rec.get("num_floors"),
            rec.get("site_area_sqft"),
            rec.get("gba_sqft"),
            rec.get("nra_sqft"),
            rec.get("num_units"),
            rec.get("clear_height_ft"),
            rec.get("num_dock_doors"),
            rec.get("gross_potential_income"),
            rec.get("vacancy_rate_pct"),
            rec.get("effective_gross_income"),
            rec.get("operating_expenses"),
            rec.get("noi"),
            rec.get("implied_cap_rate"),
            rec.get("occupancy_pct_at_sale"),
            rec.get("lease_type"),
            rec.get("walt_years"),
            rec["sale_price"],
            rec["sale_date"],
            rec.get("days_on_market"),
            rec.get("description"),
            emb,
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO commercial_properties (
                id, address, neighbourhood, city, province,
                latitude, longitude, zone, asset_class, building_class,
                year_built, year_renovated, num_floors, site_area_sqft,
                gba_sqft, nra_sqft, num_units,
                clear_height_ft, num_dock_doors,
                gross_potential_income, vacancy_rate_pct, effective_gross_income,
                operating_expenses, noi, implied_cap_rate,
                occupancy_pct_at_sale, lease_type, walt_years,
                sale_price, sale_date, days_on_market, description, embedding
            ) VALUES %s
            ON CONFLICT (id) DO NOTHING
            """,
            rows,
            template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        )
    conn.commit()


def seed_commercial(seed: int = 42, target: int = 200, clear: bool = False) -> int:
    records = generate(seed=seed, target=target)
    conn = get_connection()

    try:
        if clear:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE commercial_properties RESTART IDENTITY CASCADE;")
            conn.commit()
            print("Cleared commercial_properties")

        total = len(records)
        print(f"Seeding {total} commercial records (industrial={int(total*0.4)}, office={int(total*0.35)}, multifamily={total-int(total*0.4)-int(total*0.35)})")

        inserted = 0
        for i in range(0, total, BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            descriptions = [r.get("description") or r["address"] for r in batch]

            print(f"  Embedding batch {i // BATCH_SIZE + 1}/{-(-total // BATCH_SIZE)} ({len(batch)} records)...", end=" ")
            t0 = time.time()
            embeddings = get_embeddings(descriptions)
            print(f"{time.time() - t0:.1f}s")

            insert_batch(conn, batch, embeddings)
            inserted += len(batch)

        print(f"Done. {inserted} commercial records inserted.")
        return inserted

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Generate and seed synthetic Alberta commercial property dataset")
    parser.add_argument("--seed",   type=int,  default=42,  help="Random seed")
    parser.add_argument("--target", type=int,  default=200, help="Approximate record count")
    parser.add_argument("--clear",  action="store_true",    help="Truncate table before seeding")
    args = parser.parse_args()

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env", override=True)

    count = seed_commercial(seed=args.seed, target=args.target, clear=args.clear)
    print(f"\nAsset class breakdown:")
    records = generate(seed=args.seed, target=args.target)
    for cls in ("industrial", "office", "multifamily"):
        n = sum(1 for r in records if r["asset_class"] == cls)
        print(f"  {cls}: {n}")


if __name__ == "__main__":
    main()
