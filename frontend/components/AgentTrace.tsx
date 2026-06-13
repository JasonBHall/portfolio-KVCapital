'use client'

import { useEffect, useRef } from 'react'
import { AgentTraceStep } from '@/lib/types'
import { CheckCircle, Loader2, Search, Calculator, BarChart3, FileText, ArrowRight, Zap, TrendingUp } from 'lucide-react'

const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  // Residential
  search_comps:                   { label: 'Search Comps',            icon: <Search size={13} />,     color: 'text-blue-400',    bg: 'bg-blue-950/40 light:bg-blue-50',     border: 'border-blue-800/60 light:border-blue-200' },
  expand_search:                  { label: 'Expand Search',            icon: <ArrowRight size={13} />, color: 'text-kv-green',    bg: 'bg-kv-blue/15 light:bg-kv-blue/10',   border: 'border-kv-blue/40 light:border-kv-blue/30' },
  calculate_adjustments:          { label: 'Calculate Adjustments',    icon: <Calculator size={13} />, color: 'text-violet-400',  bg: 'bg-violet-950/40 light:bg-violet-50', border: 'border-violet-800/60 light:border-violet-200' },
  get_market_context:             { label: 'Market Context',           icon: <BarChart3 size={13} />,  color: 'text-emerald-400', bg: 'bg-emerald-950/40 light:bg-emerald-50',border: 'border-emerald-800/60 light:border-emerald-200' },
  generate_report:                { label: 'Generate Report',          icon: <FileText size={13} />,   color: 'text-kv-green',    bg: 'bg-kv-blue/15 light:bg-kv-blue/10',   border: 'border-kv-blue/40 light:border-kv-blue/30' },
  // Commercial
  search_commercial_comps:        { label: 'Search Commercial Comps',  icon: <Search size={13} />,     color: 'text-blue-400',    bg: 'bg-blue-950/40 light:bg-blue-50',     border: 'border-blue-800/60 light:border-blue-200' },
  expand_commercial_search:       { label: 'Expand Search',            icon: <ArrowRight size={13} />, color: 'text-kv-green',    bg: 'bg-kv-blue/15 light:bg-kv-blue/10',   border: 'border-kv-blue/40 light:border-kv-blue/30' },
  calculate_commercial_adjustments:{ label: 'Calculate Adjustments',   icon: <Calculator size={13} />, color: 'text-violet-400',  bg: 'bg-violet-950/40 light:bg-violet-50', border: 'border-violet-800/60 light:border-violet-200' },
  calculate_income_value:         { label: 'Income Approach',          icon: <TrendingUp size={13} />, color: 'text-amber-400',   bg: 'bg-amber-950/40 light:bg-amber-50',   border: 'border-amber-800/60 light:border-amber-200' },
}

function stepDetail(step: AgentTraceStep): { primary: string; secondary?: string } {
  const out = step.output as Record<string, unknown>
  if (step.tool === 'search_comps') {
    const found = out.total_found as number
    const inp = step.input as Record<string, unknown>
    return { primary: `${found} comparable${found !== 1 ? 's' : ''} found`, secondary: `${inp.radius_km ?? 2}km radius · last ${inp.max_age_months ?? 12} months` }
  }
  if (step.tool === 'expand_search') {
    const found = out.total_found as number
    return { primary: `${found} comparable${found !== 1 ? 's' : ''} found after expansion`, secondary: out.expansion_applied as string }
  }
  if (step.tool === 'calculate_adjustments') {
    const comps = (out.adjusted_comps as unknown[])?.length ?? 0
    const outliers = (out.adjusted_comps as Array<{ is_outlier: boolean }>)?.filter(c => c.is_outlier).length ?? 0
    const rates = out.adjustment_rates as Record<string, number> | undefined
    return { primary: `${comps} comp${comps !== 1 ? 's' : ''} adjusted`, secondary: outliers > 0 ? `${outliers} outlier${outliers > 1 ? 's' : ''} flagged · $${rates?.sqft_per_foot ?? 85}/sqft rate` : `No outliers · $${rates?.sqft_per_foot ?? 85}/sqft rate` }
  }
  if (step.tool === 'get_market_context') {
    const condition = out.market_condition as string
    const trend = out.price_trend as string
    const dom = out.avg_days_on_market as number
    return { primary: `${condition ? condition.charAt(0).toUpperCase() + condition.slice(1) : ''} market · ${trend}`, secondary: dom ? `Avg ${dom} days on market` : undefined }
  }
  if (step.tool === 'search_commercial_comps') {
    const found = out.total_found as number
    const inp = step.input as Record<string, unknown>
    return { primary: `${found} comparable${found !== 1 ? 's' : ''} found`, secondary: `${inp.radius_km ?? 2}km radius · ${inp.asset_class}` }
  }
  if (step.tool === 'expand_commercial_search') {
    const found = out.total_found as number
    return { primary: `${found} comparable${found !== 1 ? 's' : ''} found after expansion`, secondary: out.expansion_applied as string }
  }
  if (step.tool === 'calculate_commercial_adjustments') {
    const comps = (out.adjusted_comps as unknown[])?.length ?? 0
    const outliers = (out.adjusted_comps as Array<{ is_outlier: boolean }>)?.filter(c => c.is_outlier).length ?? 0
    return { primary: `${comps} comp${comps !== 1 ? 's' : ''} adjusted`, secondary: outliers > 0 ? `${outliers} outlier${outliers > 1 ? 's' : ''} flagged` : 'No outliers' }
  }
  if (step.tool === 'calculate_income_value') {
    const iv = out.income_value as number | undefined
    const cr = out.cap_rate_applied as number | undefined
    const src = out.cap_rate_source as string | undefined
    return {
      primary: iv ? `Income value: $${iv.toLocaleString()}` : 'Income approach complete',
      secondary: cr ? `Cap rate ${(cr * 100).toFixed(2)}%${src ? ` · ${src}` : ''}` : undefined,
    }
  }
  return { primary: `${step.elapsed_ms}ms` }
}

interface Props {
  steps: AgentTraceStep[]
  isRunning: boolean
}

export default function AgentTrace({ steps, isRunning }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [steps.length, isRunning])

  if (steps.length === 0 && !isRunning) return null

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey overflow-hidden transition-colors duration-300">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-kv-border/60 light:border-kv-grey/60">
        <Zap size={13} className="text-kv-green" />
        <span className="text-xs font-semibold text-slate-400 light:text-slate-600 uppercase tracking-wider flex-1">Agent Trace</span>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[10px] text-kv-green animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            Running
          </span>
        )}
        {!isRunning && steps.length > 0 && (
          <span className="text-[10px] text-slate-600 light:text-slate-400">
            {steps.length} step{steps.length !== 1 ? 's' : ''} · {steps.reduce((a, s) => a + s.elapsed_ms, 0)}ms
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-0">
        {steps.map((step, i) => {
          const meta = TOOL_META[step.tool] ?? { label: step.tool, icon: null, color: 'text-slate-400', bg: 'bg-kv-mid light:bg-slate-100', border: 'border-kv-border light:border-kv-grey' }
          const detail = stepDetail(step)
          const isLast = i === steps.length - 1
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center w-6 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}>
                  <span className={meta.color}>{meta.icon}</span>
                </div>
                {(!isLast || isRunning) && <div className="w-px flex-1 bg-slate-700 light:bg-slate-200 mt-1 mb-1 min-h-3" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 min-h-6">
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-slate-600 light:text-slate-400 tabular-nums ml-auto">{step.elapsed_ms}ms</span>
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                </div>
                <p className="text-xs text-slate-300 light:text-slate-700 mt-0.5">{detail.primary}</p>
                {detail.secondary && <p className="text-[11px] text-slate-500 light:text-slate-400 mt-0.5">{detail.secondary}</p>}
              </div>
            </div>
          )
        })}

        {isRunning && (
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-6 shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-kv-blue/20 light:bg-kv-blue/10 border border-kv-blue/50 light:border-kv-blue/30 animate-pulse">
                <Loader2 size={12} className="text-kv-green animate-spin" />
              </div>
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 min-h-6">
                <span className="text-xs font-semibold text-kv-green">{nextStepLabel(steps)}</span>
              </div>
              <p className="text-[11px] text-slate-500 light:text-slate-400 mt-0.5">Waiting for Claude…</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function nextStepLabel(steps: AgentTraceStep[]): string {
  if (steps.length === 0) return 'Searching comps…'
  const last = steps[steps.length - 1].tool
  // Residential
  if (last === 'search_comps') {
    const found = (steps[steps.length - 1].output as Record<string, unknown>).total_found as number
    return found < 3 ? 'Expanding search…' : 'Calculating adjustments…'
  }
  if (last === 'expand_search')         return 'Calculating adjustments…'
  if (last === 'calculate_adjustments') return 'Fetching market context…'
  if (last === 'get_market_context')    return 'Generating report…'
  // Commercial
  if (last === 'search_commercial_comps') {
    const found = (steps[steps.length - 1].output as Record<string, unknown>).total_found as number
    return found < 3 ? 'Expanding search…' : 'Calculating adjustments…'
  }
  if (last === 'expand_commercial_search')        return 'Calculating adjustments…'
  if (last === 'calculate_commercial_adjustments') return 'Running income approach…'
  if (last === 'calculate_income_value')           return 'Fetching market context…'
  return 'Working…'
}
