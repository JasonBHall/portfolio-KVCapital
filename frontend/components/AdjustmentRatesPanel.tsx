'use client'

import { useState } from 'react'
import { AdjustmentRates } from '@/lib/types'
import { Calculator, ChevronDown, ChevronRight, Settings } from 'lucide-react'

interface Props {
  rates: AdjustmentRates
  onOpenSettings?: () => void
}

function fmt(n: number) { return `$${n.toLocaleString()}` }
function fmtK(n: number) { return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : fmt(n) }

export default function AdjustmentRatesPanel({ rates, onOpenSettings }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl overflow-hidden transition-colors duration-300">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-kv-mid/40 light:hover:bg-kv-beige transition-colors"
      >
        <Calculator size={13} className="text-kv-green shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <span className="text-[11px] font-mono text-slate-400 light:text-slate-500 leading-relaxed truncate block">
            <span className="text-kv-green">adj_price</span>
            {' = sale_price'}
            <span className="text-slate-600 light:text-slate-400"> + </span>
            <span className="text-emerald-400">(Δsqft × {fmtK(rates.sqft_per_foot)}/sqft)</span>
            <span className="text-slate-600 light:text-slate-400"> + </span>
            <span className="text-emerald-400">(Δbeds × {fmtK(rates.per_bedroom)})</span>
            <span className="text-slate-600 light:text-slate-400"> + </span>
            <span className="text-emerald-400">(Δbaths × {fmtK(rates.per_bathroom)})</span>
            <span className="text-slate-600 light:text-slate-400"> + </span>
            <span className="text-emerald-400">(Δage × {fmtK(rates.per_year_age)}/yr)</span>
            <span className="text-slate-600 light:text-slate-400"> · outlier </span>
            <span className="text-rose-400">&gt;{rates.outlier_threshold_pct}%</span>
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
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 light:text-slate-600 uppercase tracking-wider text-[10px]">
                <th className="text-left pb-2">Attribute</th>
                <th className="text-right pb-2">Rate</th>
                <th className="text-right pb-2 pl-4 hidden sm:table-cell">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 light:divide-slate-100">
              <RateRow label="Per sqft"     value={`${fmt(rates.sqft_per_foot)}/sqft`}          source="CREA MLS HPI, Edmonton CMA 2024" />
              <RateRow label="Per bedroom"  value={fmt(rates.per_bedroom)}                       source="AIC practitioner convention" />
              <RateRow label="Per bathroom" value={fmt(rates.per_bathroom)}                      source="AIC practitioner convention" />
              <RateRow label="Per year age" value={`${fmt(rates.per_year_age)}/yr`}             source="AIC practitioner rule of thumb" />
              <RateRow label="Outlier flag" value={`>${rates.outlier_threshold_pct}% total adj`} source="AIC / USPAP gross adjustment guideline" warn />
            </tbody>
          </table>
          <p className="text-[10px] text-slate-600 light:text-slate-400">
            Δ = subject minus comp. Positive Δ means subject is larger/newer/has more — comp price adjusted up.{' '}
            {onOpenSettings && (
              <button onClick={onOpenSettings} className="text-kv-green/70 hover:text-kv-green underline underline-offset-2">
                Edit in Settings →
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function RateRow({ label, value, source, warn }: { label: string; value: string; source: string; warn?: boolean }) {
  return (
    <tr>
      <td className="py-2 text-slate-400 light:text-slate-600">{label}</td>
      <td className={`py-2 text-right font-semibold tabular-nums ${warn ? 'text-rose-400' : 'text-slate-200 light:text-kv-black'}`}>{value}</td>
      <td className="py-2 text-right pl-4 text-slate-500 light:text-slate-400 hidden sm:table-cell">{source}</td>
    </tr>
  )
}
