from fastapi import APIRouter
from app import db

router = APIRouter()


@router.get("/map")
async def get_map_points():
    rows = await db.fetch(
        "SELECT latitude, longitude, zone, property_type FROM property_sales"
    )
    return rows
