import json
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.models import SeedInfo, RegenerateRequest, AdjustmentRates, AdjustmentConfigUpdate


class CommercialAdjustmentRates(BaseModel):
    size_per_sqft: float
    age_per_year_pct: float
    building_class_pct: float
    outlier_threshold_pct: float


class MarketBenchmark(BaseModel):
    id: int
    asset_class: str
    building_class: Optional[str]
    city: str
    cap_rate_low: float
    cap_rate_high: float
    cap_rate_mid: float
    vacancy_rate_typical: Optional[float]
    avg_net_rent_low: Optional[float]
    avg_net_rent_high: Optional[float]
    expense_ratio_typical: Optional[float]
    source_name: str
    source_date: str

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent / "data"


@router.get("/config", response_model=AdjustmentRates)
async def get_config():
    """Return the current adjustment rate configuration."""
    row = await db.fetchrow("SELECT * FROM adjustment_config WHERE id = 1")
    return row


@router.patch("/config", response_model=AdjustmentRates)
async def update_config(body: AdjustmentConfigUpdate):
    """Update adjustment rates. Changes take effect on the next valuation request."""
    row = await db.fetchrow(
        """
        UPDATE adjustment_config SET
            sqft_per_foot         = %s,
            per_bedroom           = %s,
            per_bathroom          = %s,
            per_year_age          = %s,
            outlier_threshold_pct = %s,
            updated_at            = NOW()
        WHERE id = 1
        RETURNING *
        """,
        (body.sqft_per_foot, body.per_bedroom, body.per_bathroom,
         body.per_year_age, body.outlier_threshold_pct),
    )
    return row


@router.get("/seeds", response_model=list[SeedInfo])
async def list_seeds():
    rows = await db.fetch(
        "SELECT id, name, seed, description, record_count FROM dataset_seeds ORDER BY id"
    )
    return rows


@router.post("/seeds", response_model=SeedInfo)
async def save_seed(body: RegenerateRequest):
    if not body.seed_name:
        raise HTTPException(status_code=400, detail="seed_name is required when saving a seed")
    row = await db.fetchrow(
        """
        INSERT INTO dataset_seeds (name, seed, description)
        VALUES (%s, %s, %s)
        ON CONFLICT (name) DO UPDATE SET seed = EXCLUDED.seed, description = EXCLUDED.description
        RETURNING id, name, seed, description, record_count
        """,
        (body.seed_name, body.seed, body.seed_description),
    )
    return row


@router.post("/regenerate")
async def regenerate_data(body: RegenerateRequest):
    sys.path.insert(0, str(DATA_DIR))
    from generate_dataset import generate

    records = generate(seed=body.seed, target=body.target)
    output_path = DATA_DIR / "sales_data.json"
    with open(output_path, "w") as f:
        json.dump(records, f)

    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "db"))
    from seed import seed as run_seed, get_connection, ensure_extensions

    conn = get_connection()
    try:
        ensure_extensions(conn)
        run_seed(output_path, conn, clear=True)
    finally:
        conn.close()

    if body.seed_name:
        await db.execute(
            """
            INSERT INTO dataset_seeds (name, seed, description, record_count)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (name) DO UPDATE
            SET seed = EXCLUDED.seed, description = EXCLUDED.description,
                record_count = EXCLUDED.record_count
            """,
            (body.seed_name, body.seed, body.seed_description, len(records)),
        )

    return {"status": "ok", "seed": body.seed, "record_count": len(records)}


# ---------------------------------------------------------------------------
# Commercial config
# ---------------------------------------------------------------------------

@router.get("/commercial/config", response_model=CommercialAdjustmentRates)
async def get_commercial_config():
    row = await db.fetchrow("SELECT * FROM commercial_adjustment_config WHERE id = 1")
    return row


@router.patch("/commercial/config", response_model=CommercialAdjustmentRates)
async def update_commercial_config(body: CommercialAdjustmentRates):
    row = await db.fetchrow(
        """
        UPDATE commercial_adjustment_config SET
            size_per_sqft         = %s,
            age_per_year_pct      = %s,
            building_class_pct    = %s,
            outlier_threshold_pct = %s,
            updated_at            = NOW()
        WHERE id = 1
        RETURNING size_per_sqft, age_per_year_pct, building_class_pct, outlier_threshold_pct
        """,
        (body.size_per_sqft, body.age_per_year_pct,
         body.building_class_pct, body.outlier_threshold_pct),
    )
    return row


@router.get("/commercial/benchmarks", response_model=list[MarketBenchmark])
async def get_market_benchmarks():
    rows = await db.fetch(
        """
        SELECT id, asset_class, building_class, city,
               cap_rate_low, cap_rate_high, cap_rate_mid,
               vacancy_rate_typical, avg_net_rent_low, avg_net_rent_high,
               expense_ratio_typical, source_name, source_date::text
        FROM market_benchmarks
        WHERE is_active = TRUE
        ORDER BY asset_class, city, building_class
        """
    )
    return rows
