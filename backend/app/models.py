from typing import Optional
from pydantic import BaseModel, Field


class SubjectProperty(BaseModel):
    address: str
    city: str
    province: str = "AB"
    latitude: float
    longitude: float
    property_type: str = Field(pattern="^(detached|semi-detached|townhouse|condo)$")
    bedrooms: int = Field(ge=1, le=10)
    bathrooms: float = Field(ge=1.0, le=10.0)
    sqft: int = Field(gt=0)
    year_built: int = Field(ge=1900, le=2030)


class ValuationRequest(BaseModel):
    subject: SubjectProperty


class AdjustmentDetail(BaseModel):
    sqft: str
    bedrooms: str
    bathrooms: str
    age: str
    total_pct: float


class CompResult(BaseModel):
    id: str
    address: str
    neighbourhood: Optional[str]
    city: str
    sale_price: int
    sale_date: str
    property_type: str
    bedrooms: int
    bathrooms: float
    sqft: int
    year_built: int
    distance_km: float
    similarity_score: Optional[float]
    adjusted_price: int
    adjustments: AdjustmentDetail
    is_outlier: bool


class AgentTraceStep(BaseModel):
    tool: str
    input: dict
    output: dict
    elapsed_ms: int


class AdjustmentRates(BaseModel):
    sqft_per_foot: float
    per_bedroom: int
    per_bathroom: int
    per_year_age: int
    outlier_threshold_pct: float


class AdjustmentConfigUpdate(BaseModel):
    sqft_per_foot: float    = Field(gt=0, le=500)
    per_bedroom: int        = Field(gt=0, le=100_000)
    per_bathroom: int       = Field(gt=0, le=100_000)
    per_year_age: int       = Field(gt=0, le=50_000)
    outlier_threshold_pct: float = Field(gt=0, le=100)


class ValuationReport(BaseModel):
    id: str
    estimated_value_low: int
    estimated_value_high: int
    estimated_value_mid: int
    confidence: str
    narrative: str
    flags: list[str]
    comps: list[CompResult]
    agent_trace: list[AgentTraceStep]
    tool_call_count: int
    expansions_applied: int
    latency_ms: int
    report_date: str
    adjustment_rates: Optional[AdjustmentRates] = None


class SeedInfo(BaseModel):
    id: int
    name: str
    seed: int
    description: Optional[str]
    record_count: Optional[int]


class RegenerateRequest(BaseModel):
    seed: int = 42
    target: int = 900
    seed_name: Optional[str] = None
    seed_description: Optional[str] = None


# ---------------------------------------------------------------------------
# Commercial valuation models
# ---------------------------------------------------------------------------

class CommercialSubjectProperty(BaseModel):
    address: str
    city: str
    province: str = "AB"
    latitude: float
    longitude: float
    asset_class: str = Field(pattern="^(industrial|office|multifamily)$")
    building_class: Optional[str] = Field(default=None, pattern="^(A|B|C)$")
    year_built: int = Field(ge=1950, le=2030)
    gba_sqft: Optional[int] = Field(default=None, gt=0)    # industrial
    nra_sqft: Optional[int] = Field(default=None, gt=0)    # office
    num_units: Optional[int] = Field(default=None, gt=0)   # multifamily
    noi: Optional[float] = Field(default=None, gt=0)       # enables income approach
    occupancy_pct: Optional[float] = Field(default=None, ge=0, le=100)
    lease_type: Optional[str] = Field(default=None, pattern="^(NNN|gross|modified_gross)$")


class CommercialValuationRequest(BaseModel):
    subject: CommercialSubjectProperty


class CommercialAdjustmentDetail(BaseModel):
    size: str
    age: str
    building_class: str
    total_pct: float


class CommercialCompResult(BaseModel):
    id: str
    address: str
    city: str
    sale_price: int
    sale_date: str
    asset_class: str
    building_class: Optional[str]
    gba_sqft: Optional[int]
    nra_sqft: Optional[int]
    num_units: Optional[int]
    year_built: int
    distance_km: float
    noi: Optional[float]
    implied_cap_rate: Optional[float]
    occupancy_pct_at_sale: Optional[float]
    lease_type: Optional[str]
    adjusted_price: int
    adjustments: CommercialAdjustmentDetail
    is_outlier: bool
    adjustment_notes: str


class SensitivityRow(BaseModel):
    cap_rate: float
    value: int
    label: str


class CommercialValuationReport(BaseModel):
    id: str
    asset_class: str
    estimated_value_low: int
    estimated_value_high: int
    estimated_value_mid: int
    confidence: str
    narrative: str
    flags: list[str]
    comps: list[CommercialCompResult]
    income_approach_value: Optional[int] = None
    cap_rate_applied: Optional[float] = None
    cap_rate_range_low: Optional[float] = None
    cap_rate_range_high: Optional[float] = None
    cap_rate_source: Optional[str] = None
    sensitivity_table: Optional[list[SensitivityRow]] = None
    approach_weights: Optional[dict] = None
    approach_rationale: Optional[str] = None
    agent_trace: list[AgentTraceStep]
    tool_call_count: int
    expansions_applied: int
    latency_ms: int
    report_date: str
    adjustment_rates: Optional[dict] = None
