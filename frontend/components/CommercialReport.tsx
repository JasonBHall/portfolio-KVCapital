'use client'

import { useState, useEffect } from 'react'
import { CommercialValuationReport, AgentTraceStep } from '@/lib/types'
import CommercialCompTable from './CommercialCompTable'
import CapRateScatterChart from './CapRateScatterChart'
import TokenUsagePanel from './TokenUsagePanel'
import AgentTrace from './AgentTrace'
import {
  CheckCircle, AlertCircle, AlertTriangle, XCircle,
  FileText, Download, Calculator, ChevronDown, ChevronRight, Settings, TrendingUp,
} from 'lucide-react'

// ── FadePanel — identical stagger helper as ValuationReport ──────────────────

function FadePanel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div style={{
      opacity:    visible ? 1 : 0,
      transform:  visible ? 'translateY(0)' : 'translateY(14px)',
      transition: 'opacity 0.45s ease, transform 0.45s ease',
    }}>
      {children}
    </div>
  )
}

// ── Confidence config — same as ValuationReport ───────────────────────────────

const CONFIDENCE_CONFIG = {
  high:         { label: 'High Confidence',   icon: <CheckCircle size={15} />,   color: 'text-emerald-400 light:text-emerald-700', border: 'border-emerald-700/50 light:border-emerald-300', bg: 'bg-emerald-950/20 light:bg-emerald-50' },
  medium:       { label: 'Medium Confidence', icon: <AlertCircle size={15} />,   color: 'text-kv-green light:text-kv-blue',         border: 'border-kv-blue/40 light:border-kv-blue/30',     bg: 'bg-kv-blue/10 light:bg-kv-blue/10' },
  low:          { label: 'Low Confidence',    icon: <AlertTriangle size={15} />, color: 'text-rose-400 light:text-rose-700',         border: 'border-rose-700/50 light:border-rose-300',      bg: 'bg-rose-950/20 light:bg-rose-50' },
  insufficient: { label: 'Insufficient Data', icon: <XCircle size={15} />,       color: 'text-rose-500 light:text-rose-700',         border: 'border-rose-700/50 light:border-rose-300',      bg: 'bg-rose-950/20 light:bg-rose-50' },
}

function fmt(n: number) { return `$${n.toLocaleString()}` }
function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%` }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  report: CommercialValuationReport
  traceSteps: AgentTraceStep[]
  isRunning: boolean
  onOpenSettings?: () => void
  subjectSqft?: number
  subjectUnits?: number
  subject?: import('@/lib/types').CommercialSubjectProperty
}

// ── Commercial Equations & Methodology panel ─────────────────────────────────

function CommercialMethodologyPanel({
  report,
  onOpenSettings,
}: {
  report: CommercialValuationReport
  onOpenSettings?: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasIncome = report.income_approach_value != null && report.cap_rate_applied != null

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl overflow-hidden transition-colors duration-300">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-kv-mid/40 light:hover:bg-kv-beige transition-colors"
      >
        <Calculator size={13} className="text-kv-green shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <span className="text-[11px] font-mono text-slate-400 light:text-slate-500 leading-relaxed truncate block">
            {hasIncome ? (
              <>
                <span className="text-kv-green">income_value</span>
                {' = '}
                <span className="text-emerald-400">NOI ÷ cap_rate</span>
                <span className="text-slate-600 light:text-slate-400"> · reconciled with </span>
                <span className="text-emerald-400">sales_comparison</span>
              </>
            ) : (
              <>
                <span className="text-kv-green">adj_price</span>
                {' = sale_price'}
                <span className="text-slate-600 light:text-slate-400"> × </span>
                <span className="text-emerald-400">(1 + size_adj + age_adj + class_adj)</span>
                <span className="text-slate-600 light:text-slate-400"> · outlier </span>
                <span className="text-rose-400">&gt;{report.adjustment_rates?.outlier_threshold_pct ?? 25}%</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSettings && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onOpenSettings() }}
              className="flex items-center gap-1 text-[10px] text-slate-500 light:text-slate-400 hover:text-kv-green border border-kv-border light:border-kv-grey hover:border-kv-blue px-2 py-1 rounded transition-colors"
            >
              <Settings size={10} />
              Edit
            </span>
          )}
          {open
            ? <ChevronDown size={13} className="text-slate-500 light:text-slate-400" />
            : <ChevronRight size={13} className="text-slate-500 light:text-slate-400" />
          }
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-kv-border/60 light:border-kv-grey/60 space-y-4">

          {/* Income approach detail */}
          {hasIncome && (
            <div className="space-y-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Income Approach — Direct Capitalization</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 light:text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="text-left pb-2">Variable</th>
                    <th className="text-right pb-2">Value</th>
                    <th className="text-right pb-2 pl-4 hidden sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 light:divide-slate-100">
                  <MethodRow label="Cap rate applied"  value={fmtPct(report.cap_rate_applied!)}  source={report.cap_rate_source ?? 'Altus Group Q4 2024'} />
                  <MethodRow label="Cap rate range"    value={`${fmtPct(report.cap_rate_range_low!)} – ${fmtPct(report.cap_rate_range_high!)}`} source="Altus Group Canadian Cap Rate Report Q4 2024" />
                  <MethodRow label="Income value"      value={fmt(report.income_approach_value!)} source="NOI ÷ cap_rate" highlight />
                </tbody>
              </table>

              {/* Sensitivity table */}
              {report.sensitivity_table && report.sensitivity_table.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cap Rate Sensitivity</div>
                  <table className="w-full text-xs rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-kv-mid light:bg-kv-beige text-slate-400 light:text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-1.5">Scenario</th>
                        <th className="text-right px-3 py-1.5">Cap Rate</th>
                        <th className="text-right px-3 py-1.5">Indicated Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sensitivity_table.map((row, i) => {
                        const isSelected = row.label === 'Selected'
                        return (
                          <tr key={i} className={`border-t border-kv-border light:border-kv-grey ${isSelected ? 'bg-kv-green/10 light:bg-kv-blue/10 font-semibold' : i % 2 === 0 ? 'bg-kv-card light:bg-white' : 'bg-kv-mid/30 light:bg-slate-50'}`}>
                            <td className={`px-3 py-1.5 ${isSelected ? 'text-kv-green light:text-kv-blue' : 'text-slate-400'}`}>{row.label}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-300 light:text-slate-700">{fmtPct(row.cap_rate)}</td>
                            <td className={`px-3 py-1.5 text-right font-mono ${isSelected ? 'text-kv-green light:text-kv-blue' : 'text-slate-300 light:text-slate-700'}`}>{fmt(row.value)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Reconciliation */}
              {report.approach_weights && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Reconciliation</div>
                  <p className="text-[11px] font-mono text-slate-400 light:text-slate-600">
                    <span className="text-kv-green">final_value</span>
                    {' = '}
                    <span className="text-emerald-400">{Math.round(report.approach_weights.income * 100)}% × income_value</span>
                    {' + '}
                    <span className="text-emerald-400">{Math.round(report.approach_weights.sales_comparison * 100)}% × sales_comp_mid</span>
                    {' = '}
                    <span className="text-kv-green font-semibold">{fmt(report.estimated_value_mid)}</span>
                  </p>
                  {report.approach_rationale && (
                    <p className="text-[10px] text-slate-500 light:text-slate-400 mt-1">{report.approach_rationale}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sales comparison adjustment rates */}
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Sales Comparison Adjustment Rates</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 light:text-slate-600 uppercase tracking-wider text-[10px]">
                  <th className="text-left pb-2">Attribute</th>
                  <th className="text-right pb-2">Rate</th>
                  <th className="text-right pb-2 pl-4 hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 light:divide-slate-100">
                <MethodRow label="Size"          value={`$${report.adjustment_rates?.size_per_sqft ?? 8}/sqft difference`}       source="CUSPAP (AIC)" />
                <MethodRow label="Age"           value={`${((report.adjustment_rates?.age_per_year_pct ?? 0.005) * 100).toFixed(1)}%/yr`} source="AIC commercial convention" />
                <MethodRow label="Building class" value={`${((report.adjustment_rates?.building_class_pct ?? 0.07) * 100).toFixed(0)}% per step`} source="AIC commercial convention" />
                <MethodRow label="Outlier flag"  value={`>${report.adjustment_rates?.outlier_threshold_pct ?? 25}% total adj`}  source="AIC/CUSPAP gross adjustment guideline" warn />
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-600 light:text-slate-400">
            Methodology: CUSPAP (AIC) · Market benchmarks: Altus Group Canadian Cap Rate Report Q4 2024
            {onOpenSettings && (
              <> · <button onClick={onOpenSettings} className="text-kv-green/70 hover:text-kv-green underline underline-offset-2">Edit rates in Settings →</button></>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function MethodRow({ label, value, source, highlight, warn }: { label: string; value: string; source: string; highlight?: boolean; warn?: boolean }) {
  return (
    <tr>
      <td className="py-2 text-slate-400 light:text-slate-600">{label}</td>
      <td className={`py-2 text-right font-semibold tabular-nums ${warn ? 'text-rose-400' : highlight ? 'text-kv-green light:text-kv-blue' : 'text-slate-200 light:text-kv-black'}`}>{value}</td>
      <td className="py-2 text-right pl-4 text-slate-500 light:text-slate-400 hidden sm:table-cell">{source}</td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommercialReport({ report, traceSteps, isRunning, onOpenSettings, subjectSqft, subjectUnits, subject }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const conf = CONFIDENCE_CONFIG[report.confidence] ?? CONFIDENCE_CONFIG.low
  const hasIncome = report.income_approach_value != null

  const assetLabel = report.asset_class.charAt(0).toUpperCase() + report.asset_class.slice(1)

  return (
    <div className="space-y-4">

      {/* ── Download PDF button — right aligned ── */}
      <FadePanel delay={0}>
        <div className="flex justify-end">
          <button
            onClick={async () => {
              const { downloadCommercialPdf } = await import('./CommercialReportPdf')
              await downloadCommercialPdf(report, subject)
            }}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border transition-colors bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 light:text-amber-600 border-amber-500/30 light:border-amber-400/50 font-medium cursor-pointer"
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>
      </FadePanel>

      {/* ── Row: Estimated Value + Flags ── */}
      <FadePanel delay={0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Estimated value */}
          <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 flex flex-col justify-between gap-3 transition-colors duration-300">
            <div>
              <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2">
                {assetLabel} — Estimated Value
              </div>
              {report.confidence === 'insufficient' ? (
                <div className="text-rose-400 text-2xl font-bold">Insufficient Data</div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-slate-100 light:text-kv-black tabular-nums">
                    {fmt(report.estimated_value_low)} – {fmt(report.estimated_value_high)}
                  </div>
                  <div className="text-slate-400 light:text-slate-500 text-sm mt-1">
                    Midpoint: <span className="text-kv-green font-semibold tabular-nums">{fmt(report.estimated_value_mid)}</span>
                  </div>
                  {hasIncome && report.cap_rate_applied != null && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 light:text-amber-600">
                      <TrendingUp size={12} />
                      <span>Income approach: {fmt(report.income_approach_value!)} at {fmtPct(report.cap_rate_applied)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-kv-border/60 light:border-kv-grey">
              <div className={`flex items-center gap-2 ${conf.color}`}>
                {conf.icon}
                <span className="text-sm font-semibold">{conf.label}</span>
              </div>
              <span className="text-xs text-slate-500 light:text-slate-600">{report.report_date}</span>
            </div>
          </div>

          {/* Flags card */}
          <div className={`rounded-xl p-5 border ${conf.border} ${conf.bg}`}>
            {report.flags.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] text-slate-500 light:text-slate-600 uppercase tracking-wider mb-3">Flags</div>
                {report.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-kv-green/90 light:text-kv-blue">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 light:text-emerald-700 h-full">
                <CheckCircle size={14} />
                <span className="text-sm font-medium">No flags — clean comp set</span>
              </div>
            )}
          </div>
        </div>
      </FadePanel>

      {/* ── Row: Valuation Summary ── */}
      {report.narrative && (
        <FadePanel delay={80}>
          <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 transition-colors duration-300">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} className="text-kv-green" />
              <span className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider">Valuation Summary</span>
            </div>
            <p className="text-slate-200 light:text-kv-black text-sm leading-relaxed">{report.narrative}</p>
          </div>
        </FadePanel>
      )}

      {/* ── Row: Cap Rate / $/sqft Scatter ──────────────────────────────────
           Normalized chart: X = property size, Y = implied cap rate (or $/sqft
           fallback). The benchmark lane (Altus Q4 2024) is drawn as a band.
           Green dots fall within the lane; amber = outside; red = outlier.
           The selected cap rate and ±25bps window are overlaid as dashed lines.
           This replaces the absolute-price dumbbell, which is misleading for
           commercial comps because size variation creates wide price spreads. */}
      <FadePanel delay={160}>
        <CapRateScatterChart
          report={report}
          subjectSqft={subjectSqft}
          subjectUnits={subjectUnits}
        />
      </FadePanel>

      {/* ── Row: Comparable Sales ── */}
      {report.comps.length > 0 && (
        <FadePanel delay={240}>
          <div>
            <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2 px-1">
              Comparable Sales ({report.comps.length})
            </div>
            <CommercialCompTable
              comps={report.comps}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              capRateLow={report.cap_rate_range_low}
              capRateHigh={report.cap_rate_range_high}
            />
          </div>
        </FadePanel>
      )}

      {/* ── Row: Equations & Methodology ── */}
      <FadePanel delay={320}>
        <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2 px-1">
          Equations &amp; Methodology
        </div>
        <CommercialMethodologyPanel report={report} onOpenSettings={onOpenSettings} />
      </FadePanel>

      {/* ── Row: Agent Trace + Token Usage ── */}
      <FadePanel delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            {traceSteps.length > 0 && (
              <AgentTrace steps={traceSteps} isRunning={isRunning} />
            )}
          </div>
          <div>
            {report.token_usage && (
              <TokenUsagePanel usage={report.token_usage} latencyMs={report.latency_ms} />
            )}
          </div>
        </div>
      </FadePanel>

    </div>
  )
}
