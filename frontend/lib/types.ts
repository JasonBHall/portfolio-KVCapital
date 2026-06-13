export interface SubjectProperty {
  address: string
  city: string
  province: string
  latitude: number
  longitude: number
  property_type: 'detached' | 'semi-detached' | 'townhouse' | 'condo'
  bedrooms: number
  bathrooms: number
  sqft: number
  year_built: number
}

export interface AdjustmentDetail {
  sqft: string
  bedrooms: string
  bathrooms: string
  age: string
  total_pct: number
}

export interface CompResult {
  id: string
  address: string
  neighbourhood?: string
  city: string
  sale_price: number
  sale_date: string
  property_type: string
  bedrooms: number
  bathrooms: number
  sqft: number
  year_built: number
  distance_km: number
  similarity_score?: number
  adjusted_price: number
  adjustments: AdjustmentDetail
  is_outlier: boolean
  latitude: number
  longitude: number
}

export interface AgentTraceStep {
  tool: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  elapsed_ms: number
}

export interface TokenUsage {
  model: string
  api_calls: number
  input_tokens: number
  output_tokens: number
  cache_write_tokens: number
  cache_read_tokens: number
  total_tokens: number
  cost_usd: number
  cost_display: string
  cache_savings_usd: number
  cache_savings_display: string
  cache_hit: boolean
}

export interface AdjustmentRates {
  sqft_per_foot: number
  per_bedroom: number
  per_bathroom: number
  per_year_age: number
  outlier_threshold_pct: number
}

export interface ValuationReport {
  id: string
  estimated_value_low: number
  estimated_value_high: number
  estimated_value_mid: number
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
  narrative: string
  flags: string[]
  comps: CompResult[]
  agent_trace: AgentTraceStep[]
  tool_call_count: number
  expansions_applied: number
  latency_ms: number
  report_date: string
  token_usage?: TokenUsage
  adjustment_rates?: AdjustmentRates
}

// Re-exported as AppConfig for the settings drawer
export type AppConfig = AdjustmentRates

export interface SeedInfo {
  id: number
  name: string
  seed: number
  description?: string
  record_count?: number
}

export type TraceEvent =
  | { type: 'trace_step'; step: AgentTraceStep }
  | { type: 'report'; report: ValuationReport }
  | { type: 'token_usage'; usage: TokenUsage }
  | { type: 'done' }

// ---------------------------------------------------------------------------
// Commercial types
// ---------------------------------------------------------------------------

export interface CommercialSubjectProperty {
  address: string
  city: string
  province: string
  latitude: number
  longitude: number
  asset_class: 'industrial' | 'office' | 'multifamily'
  building_class?: 'A' | 'B' | 'C'
  year_built: number
  gba_sqft?: number
  nra_sqft?: number
  num_units?: number
  noi?: number
  occupancy_pct?: number
  lease_type?: 'NNN' | 'gross' | 'modified_gross'
}

export interface CommercialAdjustmentDetail {
  size: string
  age: string
  building_class: string
  total_pct: number
}

export interface CommercialCompResult {
  id: string
  address: string
  city: string
  latitude: number
  longitude: number
  sale_price: number
  sale_date: string
  asset_class: string
  building_class?: string
  gba_sqft?: number
  nra_sqft?: number
  num_units?: number
  year_built: number
  distance_km: number
  noi?: number
  implied_cap_rate?: number
  occupancy_pct_at_sale?: number
  lease_type?: string
  adjusted_price: number
  adjustments: CommercialAdjustmentDetail
  is_outlier: boolean
  adjustment_notes: string
}

export interface SensitivityRow {
  cap_rate: number
  value: number
  label: string
}

export interface CommercialValuationReport {
  id: string
  asset_class: string
  estimated_value_low: number
  estimated_value_high: number
  estimated_value_mid: number
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
  narrative: string
  flags: string[]
  comps: CommercialCompResult[]
  income_approach_value?: number
  cap_rate_applied?: number
  cap_rate_range_low?: number
  cap_rate_range_high?: number
  cap_rate_source?: string
  sensitivity_table?: SensitivityRow[]
  approach_weights?: { income: number; sales_comparison: number }
  approach_rationale?: string
  agent_trace: AgentTraceStep[]
  tool_call_count: number
  expansions_applied: number
  latency_ms: number
  report_date: string
  adjustment_rates?: Record<string, number>
  token_usage?: TokenUsage
}

export interface CommercialAdjustmentRates {
  size_per_sqft: number
  age_per_year_pct: number
  building_class_pct: number
  outlier_threshold_pct: number
}

export interface MarketBenchmark {
  id: number
  asset_class: string
  building_class?: string
  city: string
  cap_rate_low: number
  cap_rate_high: number
  cap_rate_mid: number
  vacancy_rate_typical?: number
  avg_net_rent_low?: number
  avg_net_rent_high?: number
  expense_ratio_typical?: number
  source_name: string
  source_date: string
}

export type CommercialTraceEvent =
  | { type: 'trace_step'; step: AgentTraceStep }
  | { type: 'report'; report: CommercialValuationReport }
  | { type: 'token_usage'; usage: TokenUsage }
  | { type: 'done' }
