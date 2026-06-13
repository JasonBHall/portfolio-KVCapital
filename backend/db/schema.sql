-- KV Capital Comp Analysis — Postgres Schema
-- Local dev: uses FLOAT[] for embeddings (no pgvector required)
-- Production (Railway): swap embedding column to vector(1536) and add IVFFlat index
-- Run once against a fresh database before seeding.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pgvector: install on Railway via CREATE EXTENSION vector;
-- Not available in local EDB install without manual compilation.
-- Embeddings stored as FLOAT[] locally; cosine similarity computed in Python.
-- See design/decisions.md for full rationale.


-- ---------------------------------------------------------------------------
-- property_sales
-- Core table. One row per historical sale used as a comp source.
-- ---------------------------------------------------------------------------

CREATE TABLE property_sales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Location
    address         TEXT        NOT NULL,
    neighbourhood   TEXT,
    city            TEXT        NOT NULL,
    province        CHAR(2)     NOT NULL DEFAULT 'AB',
    latitude        NUMERIC(9,6) NOT NULL,
    longitude       NUMERIC(9,6) NOT NULL,

    -- Classification (used for structured comp filtering)
    zone            TEXT        NOT NULL CHECK (zone IN (
                        'urban_dense', 'suburban_sparse', 'rural', 'edge_case'
                    )),
    property_type   TEXT        NOT NULL CHECK (property_type IN (
                        'detached', 'semi-detached', 'townhouse', 'condo'
                    )),

    -- Physical attributes
    bedrooms        SMALLINT    NOT NULL CHECK (bedrooms BETWEEN 1 AND 10),
    bathrooms       NUMERIC(3,1) NOT NULL CHECK (bathrooms BETWEEN 1 AND 10),
    sqft            SMALLINT    CHECK (sqft > 0),
    lot_sqft        INTEGER     CHECK (lot_sqft > 0),
    year_built      SMALLINT    CHECK (year_built BETWEEN 1900 AND 2030),

    -- Sale data
    sale_price      INTEGER     NOT NULL CHECK (sale_price > 0),
    sale_date       DATE        NOT NULL,
    days_on_market  SMALLINT    CHECK (days_on_market >= 0),

    -- Natural language description + embedding
    -- Local: FLOAT[] — cosine similarity in Python
    -- Production: ALTER COLUMN embedding TYPE vector(1536) after installing pgvector
    description     TEXT,
    embedding       FLOAT[],

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_sales_property_type  ON property_sales (property_type);
CREATE INDEX idx_sales_bedrooms       ON property_sales (bedrooms);
CREATE INDEX idx_sales_sale_date      ON property_sales (sale_date DESC);
CREATE INDEX idx_sales_city           ON property_sales (city);
CREATE INDEX idx_sales_location       ON property_sales (latitude, longitude);
-- Production: CREATE INDEX idx_sales_embedding ON property_sales
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);


-- ---------------------------------------------------------------------------
-- dataset_seeds
-- ---------------------------------------------------------------------------

CREATE TABLE dataset_seeds (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    seed        INTEGER     NOT NULL,
    record_count INTEGER,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO dataset_seeds (name, seed, description) VALUES
    ('Default',          42,  'Standard balanced dataset — all zones represented'),
    ('Demo: Urban',     100,  'Higher urban density — good for showing fast high-confidence reports'),
    ('Demo: Rural',     201,  'Emphasises rural zone — triggers expand_search paths'),
    ('Demo: Edge Cases', 42,  'Seed 42 always injects all edge cases regardless of zone distribution');


-- ---------------------------------------------------------------------------
-- valuation_reports
-- ---------------------------------------------------------------------------

CREATE TABLE valuation_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    subject_address         TEXT,
    subject_property_type   TEXT,
    subject_bedrooms        SMALLINT,
    subject_bathrooms       NUMERIC(3,1),
    subject_sqft            SMALLINT,
    subject_year_built      SMALLINT,
    subject_latitude        NUMERIC(9,6),
    subject_longitude       NUMERIC(9,6),

    estimated_value_low     INTEGER,
    estimated_value_high    INTEGER,
    estimated_value_mid     INTEGER,
    confidence              TEXT CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
    narrative               TEXT,
    flags                   JSONB,
    comp_ids                UUID[],
    agent_trace             JSONB,

    tool_call_count         SMALLINT,
    expansions_applied      SMALLINT DEFAULT 0,
    latency_ms              INTEGER,
    report_date             DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_created    ON valuation_reports (created_at DESC);
CREATE INDEX idx_reports_confidence ON valuation_reports (confidence);


-- ---------------------------------------------------------------------------
-- adjustment_config — single-row config table
-- ---------------------------------------------------------------------------

CREATE TABLE adjustment_config (
    id                      SERIAL PRIMARY KEY CHECK (id = 1),
    sqft_per_foot           NUMERIC(8,2)  NOT NULL DEFAULT 85.00,
    per_bedroom             INTEGER       NOT NULL DEFAULT 8000,
    per_bathroom            INTEGER       NOT NULL DEFAULT 6000,
    per_year_age            INTEGER       NOT NULL DEFAULT 1250,
    outlier_threshold_pct   NUMERIC(5,2)  NOT NULL DEFAULT 15.00,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO adjustment_config DEFAULT VALUES;

COMMENT ON COLUMN adjustment_config.sqft_per_foot IS
    'Source: CREA MLS HPI $/sqft differential, Edmonton CMA 2024';
COMMENT ON COLUMN adjustment_config.per_bedroom IS
    'Source: AIC practitioner convention';
COMMENT ON COLUMN adjustment_config.per_bathroom IS
    'Source: AIC practitioner convention';
COMMENT ON COLUMN adjustment_config.per_year_age IS
    'Source: AIC practitioner rule of thumb — confirm with KV Capital internally';
COMMENT ON COLUMN adjustment_config.outlier_threshold_pct IS
    'Source: AIC/USPAP gross adjustment guideline — configurable to match KV internal standard';


-- ---------------------------------------------------------------------------
-- commercial_properties
-- Income-producing commercial property sales for comp-based and income-approach
-- valuation. Covers industrial, office, and multifamily asset classes.
-- ---------------------------------------------------------------------------

CREATE TABLE commercial_properties (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Location
    address         TEXT        NOT NULL,
    neighbourhood   TEXT,
    city            TEXT        NOT NULL,
    province        CHAR(2)     NOT NULL DEFAULT 'AB',
    latitude        NUMERIC(9,6) NOT NULL,
    longitude       NUMERIC(9,6) NOT NULL,

    -- Classification
    zone            TEXT        NOT NULL CHECK (zone IN (
                        'urban_dense', 'suburban_sparse', 'rural', 'edge_case'
                    )),
    asset_class     TEXT        NOT NULL CHECK (asset_class IN (
                        'industrial', 'office', 'multifamily'
                    )),
    building_class  TEXT        CHECK (building_class IN ('A', 'B', 'C')),

    -- Physical
    year_built      SMALLINT    CHECK (year_built BETWEEN 1950 AND 2030),
    year_renovated  SMALLINT    CHECK (year_renovated BETWEEN 1950 AND 2030),
    num_floors      SMALLINT,
    site_area_sqft  INTEGER,

    -- Size — asset-class specific
    gba_sqft        INTEGER,        -- gross building area (industrial)
    nra_sqft        INTEGER,        -- net rentable area (office)
    num_units       SMALLINT,       -- multifamily unit count

    -- Industrial-specific
    clear_height_ft NUMERIC(4,1),
    num_dock_doors  SMALLINT,

    -- Income statement
    gross_potential_income  NUMERIC(12,2),
    vacancy_rate_pct        NUMERIC(5,2),
    effective_gross_income  NUMERIC(12,2),
    operating_expenses      NUMERIC(12,2),
    noi                     NUMERIC(12,2),
    implied_cap_rate        NUMERIC(6,4),   -- NOI / sale_price, computed at ingest

    -- Tenancy
    occupancy_pct_at_sale   NUMERIC(5,2),
    lease_type              TEXT CHECK (lease_type IN ('NNN', 'gross', 'modified_gross')),
    walt_years              NUMERIC(4,1),

    -- Sale
    sale_price      INTEGER     NOT NULL CHECK (sale_price > 0),
    sale_date       DATE        NOT NULL,
    days_on_market  SMALLINT,

    -- Description + embedding (same pattern as property_sales)
    description     TEXT,
    embedding       FLOAT[],

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_asset_class  ON commercial_properties (asset_class);
CREATE INDEX idx_comm_sale_date    ON commercial_properties (sale_date DESC);
CREATE INDEX idx_comm_city         ON commercial_properties (city);
CREATE INDEX idx_comm_location     ON commercial_properties (latitude, longitude);


-- ---------------------------------------------------------------------------
-- market_benchmarks
-- Cap rate and rent benchmarks by asset class, building class, and city.
-- Source: Altus Group Canadian Cap Rate Report Q4 2024.
-- Updated quarterly via Settings → Manage Commercial Data.
-- ---------------------------------------------------------------------------

CREATE TABLE market_benchmarks (
    id              SERIAL PRIMARY KEY,
    asset_class     TEXT        NOT NULL CHECK (asset_class IN ('industrial', 'office', 'multifamily')),
    building_class  TEXT        CHECK (building_class IN ('A', 'B', 'C')),
    city            TEXT        NOT NULL,
    cap_rate_low    NUMERIC(6,4) NOT NULL,
    cap_rate_high   NUMERIC(6,4) NOT NULL,
    cap_rate_mid    NUMERIC(6,4) NOT NULL,
    vacancy_rate_typical    NUMERIC(5,2),
    avg_net_rent_low        NUMERIC(8,2),   -- $/sqft/yr (industrial/office) or $/unit/mo (MF)
    avg_net_rent_high       NUMERIC(8,2),
    expense_ratio_typical   NUMERIC(5,2),   -- OpEx as % of EGI
    source_name     TEXT        NOT NULL,
    source_date     DATE        NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO market_benchmarks
    (asset_class, building_class, city,
     cap_rate_low, cap_rate_high, cap_rate_mid,
     vacancy_rate_typical, avg_net_rent_low, avg_net_rent_high, expense_ratio_typical,
     source_name, source_date)
VALUES
    ('industrial', NULL, 'Edmonton',
     0.0525, 0.0675, 0.0600, 4.0, 10.00, 18.00, 8.0,
     'Altus Group Canadian Cap Rate Report Q4 2024', '2024-12-31'),
    ('industrial', NULL, 'Calgary',
     0.0500, 0.0650, 0.0575, 3.0, 12.00, 20.00, 8.0,
     'Altus Group Canadian Cap Rate Report Q4 2024', '2024-12-31'),
    ('office', 'A', 'Edmonton',
     0.0675, 0.0850, 0.0763, 14.0, 18.00, 26.00, 40.0,
     'Altus Group Canadian Cap Rate Report Q4 2024', '2024-12-31'),
    ('office', 'B', 'Edmonton',
     0.0750, 0.0950, 0.0850, 19.0, 14.00, 20.00, 42.0,
     'Altus Group Canadian Cap Rate Report Q4 2024', '2024-12-31'),
    ('office', 'B', 'Calgary',
     0.0700, 0.0900, 0.0800, 17.0, 16.00, 22.00, 40.0,
     'Altus Group Canadian Cap Rate Report Q4 2024', '2024-12-31'),
    ('multifamily', NULL, 'Edmonton',
     0.0450, 0.0550, 0.0500, 3.0, 1400.00, 1800.00, 35.0,
     'Altus Group Canadian Cap Rate Report Q4 2024 / CMHC Rental Market Report Fall 2024', '2024-12-31'),
    ('multifamily', NULL, 'Calgary',
     0.0425, 0.0525, 0.0475, 2.5, 1500.00, 1950.00, 34.0,
     'Altus Group Canadian Cap Rate Report Q4 2024 / CMHC Rental Market Report Fall 2024', '2024-12-31');


-- ---------------------------------------------------------------------------
-- commercial_adjustment_config — single-row config for commercial rates
-- ---------------------------------------------------------------------------

CREATE TABLE commercial_adjustment_config (
    id                      SERIAL PRIMARY KEY CHECK (id = 1),
    size_per_sqft           NUMERIC(8,2)  NOT NULL DEFAULT 8.00,
    age_per_year_pct        NUMERIC(5,3)  NOT NULL DEFAULT 0.005,
    building_class_pct      NUMERIC(5,3)  NOT NULL DEFAULT 0.070,
    outlier_threshold_pct   NUMERIC(5,2)  NOT NULL DEFAULT 25.00,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO commercial_adjustment_config DEFAULT VALUES;

COMMENT ON COLUMN commercial_adjustment_config.size_per_sqft IS
    'Source: CUSPAP (AIC) income approach adjustment convention';
COMMENT ON COLUMN commercial_adjustment_config.age_per_year_pct IS
    'Source: AIC commercial practitioner convention — 0.5% per year effective age difference';
COMMENT ON COLUMN commercial_adjustment_config.building_class_pct IS
    'Source: AIC commercial practitioner convention — 5-10% per class step (A/B/C)';
COMMENT ON COLUMN commercial_adjustment_config.outlier_threshold_pct IS
    'Source: AIC/CUSPAP — 25% gross adjustment threshold for commercial (higher than residential 15%)';
