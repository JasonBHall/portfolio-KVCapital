"""
Database seed script.

Loads the synthetic dataset into Postgres, generates embeddings for each
property description, and stores them in the pgvector column.

Usage:
    python seed.py                          # uses sales_data.json, seed 42
    python seed.py --input sales_data.json
    python seed.py --regenerate --seed 99   # regenerate dataset then seed
    python seed.py --clear                  # wipe property_sales and re-seed

Environment variables required:
    DATABASE_URL   postgres://user:pass@host:5432/dbname
    ANTHROPIC_API_KEY or OPENAI_API_KEY    (for embeddings)

Embedding model: text-embedding-3-small (OpenAI) — 1536 dimensions
Fallback:        If ANTHROPIC_API_KEY only, uses a local sentence-transformers
                 model at 384 dims (requires schema change to vector(384)).
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras
from psycopg2.extensions import connection as PGConnection

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BATCH_SIZE = 50          # records per embedding API call
EMBEDDING_DIM = 1536     # must match schema vector(1536)
DATA_DIR = Path(__file__).parent.parent / "data"


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a batch of texts.
    Uses OpenAI text-embedding-3-small (1536 dims) if OPENAI_API_KEY is set.
    Falls back to a stub (zeros) in test/offline mode when neither key is set.
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]

    # Offline stub — zero vectors. Structured search still works; vector
    # similarity will return arbitrary order. Fine for schema validation.
    print("  [warn] No OPENAI_API_KEY — using zero-vector stubs for embeddings")
    return [[0.0] * EMBEDDING_DIM for _ in texts]


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_connection() -> PGConnection:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return psycopg2.connect(url)


def ensure_extensions(conn: PGConnection) -> None:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
        # pgvector: only available on Railway/production — skip locally
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        except Exception:
            conn.rollback()
    conn.commit()


def clear_sales(conn: PGConnection) -> None:
    with conn.cursor() as cur:
        cur.execute("TRUNCATE property_sales RESTART IDENTITY CASCADE;")
    conn.commit()
    print("Cleared property_sales")


def record_count(conn: PGConnection) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM property_sales;")
        return cur.fetchone()[0]


def insert_batch(conn: PGConnection, batch: list[dict], embeddings: list[list[float]]) -> None:
    rows = []
    for record, embedding in zip(batch, embeddings):
        rows.append((
            record["id"],
            record["address"],
            record.get("neighbourhood"),
            record["city"],
            record["province"],
            record["latitude"],
            record["longitude"],
            record["zone"],
            record["property_type"],
            record["bedrooms"],
            record["bathrooms"],
            record.get("sqft"),
            record.get("lot_sqft"),
            record.get("year_built"),
            record["sale_price"],
            record["sale_date"],
            record.get("days_on_market"),
            record.get("description"),
            embedding,
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO property_sales (
                id, address, neighbourhood, city, province,
                latitude, longitude, zone, property_type,
                bedrooms, bathrooms, sqft, lot_sqft, year_built,
                sale_price, sale_date, days_on_market, description, embedding
            ) VALUES %s
            ON CONFLICT (id) DO NOTHING
            """,
            rows,
            template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def seed(
    input_path: Path,
    conn: PGConnection,
    clear: bool = False,
) -> None:
    if clear:
        clear_sales(conn)

    with open(input_path) as f:
        records = json.load(f)

    total = len(records)
    print(f"Seeding {total} records from {input_path.name}")

    inserted = 0
    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        descriptions = [r.get("description") or r["address"] for r in batch]

        print(f"  Embedding batch {i // BATCH_SIZE + 1}/{-(-total // BATCH_SIZE)} ({len(batch)} records)...", end=" ")
        t0 = time.time()
        embeddings = get_embeddings(descriptions)
        elapsed = time.time() - t0
        print(f"{elapsed:.1f}s")

        insert_batch(conn, batch, embeddings)
        inserted += len(batch)

    print(f"Done. {inserted} records inserted.")
    print(f"Total in DB: {record_count(conn)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed property sales into Postgres")
    parser.add_argument("--input", type=Path, default=DATA_DIR / "sales_data.json")
    parser.add_argument("--clear", action="store_true", help="Truncate table before seeding")
    parser.add_argument("--regenerate", action="store_true", help="Re-run dataset generator before seeding")
    parser.add_argument("--seed", type=int, default=42, help="Generator seed (used with --regenerate)")
    parser.add_argument("--target", type=int, default=900, help="Generator target record count")
    args = parser.parse_args()

    if args.regenerate:
        print(f"Regenerating dataset (seed={args.seed}, target={args.target})...")
        sys.path.insert(0, str(DATA_DIR))
        from generate_dataset import generate
        records = generate(seed=args.seed, target=args.target)
        args.input.parent.mkdir(parents=True, exist_ok=True)
        with open(args.input, "w") as f:
            json.dump(records, f, indent=2)
        print(f"Generated {len(records)} records → {args.input}")

    if not args.input.exists():
        print(f"Error: {args.input} not found. Run with --regenerate or provide a valid --input path.")
        sys.exit(1)

    conn = get_connection()
    try:
        ensure_extensions(conn)
        seed(args.input, conn, clear=args.clear)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
