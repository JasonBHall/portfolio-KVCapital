import sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import valuations, admin, properties
from app.routers import commercial_valuations


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # no pool to open/close — psycopg2 connections are per-request


app = FastAPI(
    title="KV Capital Comp Analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(valuations.router, prefix="/api/valuations", tags=["valuations"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(properties.router, prefix="/api/properties", tags=["properties"])
app.include_router(commercial_valuations.router, prefix="/api/commercial/valuations", tags=["commercial"])


@app.get("/health")
async def health():
    return {"status": "ok"}
