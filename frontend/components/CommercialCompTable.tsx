'use client'

import { Fragment, useState } from 'react'
import { CommercialCompResult } from '@/lib/types'
import { ChevronDown } from 'lucide-react'

interface Props {
  comps: CommercialCompResult[]
  hoveredId: string | null
  onHover: (id: string | null) => void
  capRateLow?: number
  capRateHigh?: number
}

function fmt(n: number) { return `$${n.toLocaleString()}` }

const LEASE_LABEL: Record<string, string> = {
  NNN: 'NNN',
  gross: 'Gross',
  modified_gross: 'Modified Gross',
}
function fmtRate(n?: number) { return n != null ? `${(n * 100).toFixed(2)}%` : '—' }
function fmtPct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

export default function CommercialCompTable({ comps, hoveredId, onHover, capRateLow, capRateHigh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-kv-border light:border-kv-grey transition-colors duration-300">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-kv-mid light:bg-kv-beige text-slate-400 light:text-slate-500 uppercase tracking-wider text-[10px]">
            <th className="text-left px-3 py-2">Address</th>
            <th className="text-right px-3 py-2">Sale Price</th>
            <th className="text-right px-3 py-2">Adj Price</th>
            <th className="text-right px-3 py-2">Cap Rate</th>
            <th className="text-right px-3 py-2">Lease</th>
            <th className="text-right px-3 py-2">Occ %</th>
            <th className="text-right px-3 py-2">Dist</th>
            <th className="px-2 py-2 w-6"></th>
          </tr>
        </thead>
        <tbody>
          {comps.map((comp, i) => {
            const isHovered  = hoveredId === comp.id
            const isExpanded = expandedId === comp.id
            const isOutlier  = comp.is_outlier
            const totalAdj   = comp.adjusted_price - comp.sale_price
            const rowBg = isHovered
              ? 'bg-kv-green/10 light:bg-kv-blue/10'
              : i % 2 === 0
                ? 'bg-kv-card light:bg-white'
                : 'bg-kv-mid/40 light:bg-slate-50'

            return (
              <Fragment key={comp.id}>
                <tr
                  className={`${rowBg} border-t border-kv-border light:border-kv-grey cursor-pointer hover:bg-kv-green/10 light:hover:bg-kv-blue/10 transition-colors`}
                  onMouseEnter={() => onHover(comp.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => toggle(comp.id)}
                >
                  <td className="px-3 py-2">
                    <div className={`font-medium ${isOutlier ? 'text-red-400 light:text-red-500' : 'text-slate-200 light:text-kv-black'}`}>
                      {comp.address.split(',')[0]}
                      {isOutlier && <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded">outlier</span>}
                    </div>
                    <div className="text-slate-500 light:text-slate-400">
                      {comp.asset_class}{comp.building_class ? ` · Class ${comp.building_class}` : ''} · {comp.sale_date?.slice(0, 7)}
                      {comp.implied_cap_rate != null && capRateLow != null && capRateHigh != null
                        && (comp.implied_cap_rate < capRateLow || comp.implied_cap_rate > capRateHigh) && (
                        <span className="text-amber-400"> — Outside benchmark</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300 light:text-slate-700 font-mono">{fmt(comp.sale_price)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${isOutlier ? 'text-red-400' : 'text-kv-green light:text-kv-blue'}`}>
                    {fmt(comp.adjusted_price)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 light:text-slate-600">{fmtRate(comp.implied_cap_rate)}</td>
                  <td className="px-3 py-2 text-right text-slate-400 light:text-slate-600">{comp.lease_type ? (LEASE_LABEL[comp.lease_type] ?? comp.lease_type) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-400 light:text-slate-600">
                    {comp.occupancy_pct_at_sale != null ? `${comp.occupancy_pct_at_sale}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 font-mono">{comp.distance_km.toFixed(1)} km</td>
                  <td className="px-2 py-2 text-center text-slate-500">
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </td>
                </tr>

                {/* Expanded adjustment math */}
                {isExpanded && (
                  <tr className="bg-kv-dark/60 light:bg-slate-50">
                    <td colSpan={8} className="px-5 py-3">
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-slate-400 light:text-slate-500 uppercase tracking-wider">
                          Adjustment Breakdown
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <AdjLine label="Size"          value={comp.adjustments.size} />
                          <AdjLine label="Age"           value={comp.adjustments.age} />
                          <AdjLine label="Building Class" value={comp.adjustments.building_class} />
                          <AdjLine
                            label="Net Adjustment"
                            value={`${fmtPct(comp.adjustments.total_pct)} → ${fmt(comp.adjusted_price)}`}
                            highlight
                          />
                        </div>
                        {comp.adjustment_notes && (
                          <p className="text-[10px] text-slate-500 light:text-slate-400 mt-1 italic">{comp.adjustment_notes}</p>
                        )}
                        {comp.noi != null && (
                          <div className="mt-2 pt-2 border-t border-kv-border light:border-kv-grey text-[10px] text-slate-400 light:text-slate-500">
                            <span className="font-mono">NOI: {fmt(comp.noi)}</span>
                            {comp.implied_cap_rate != null && (
                              <span className="ml-3 font-mono">Implied cap rate: {fmtRate(comp.implied_cap_rate)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AdjLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[9px] text-slate-600 light:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`font-mono ${highlight ? 'text-kv-green light:text-kv-blue font-semibold' : 'text-slate-300 light:text-slate-700'}`}>{value}</div>
    </div>
  )
}
