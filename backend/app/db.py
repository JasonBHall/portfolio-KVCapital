"""
Database access layer.

Uses psycopg2 (sync) wrapped in asyncio.to_thread for non-blocking operation.
psycopg3 async has compatibility issues with Windows ProactorEventLoop.
psycopg2 is reliable cross-platform and already installed.
"""

import os
from dotenv import load_dotenv
load_dotenv(override=True)

import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor


def get_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _coerce(row: dict) -> dict:
    """Convert Postgres types (Decimal, date) to native Python for JSON safety."""
    from decimal import Decimal
    from datetime import date, datetime
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, (date, datetime)):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def _fetch(query: str, params=None) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return [_coerce(dict(r)) for r in cur.fetchall()]
    finally:
        conn.close()


def _execute(query: str, params=None) -> None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
    finally:
        conn.close()


def _fetchrow(query: str, params=None) -> dict | None:
    rows = _fetch(query, params)
    return rows[0] if rows else None


import asyncio
from functools import partial


async def fetch(query: str, params=None) -> list[dict]:
    return await asyncio.to_thread(_fetch, query, params)


async def fetchrow(query: str, params=None) -> dict | None:
    return await asyncio.to_thread(_fetchrow, query, params)


async def execute(query: str, params=None) -> None:
    return await asyncio.to_thread(_execute, query, params)
