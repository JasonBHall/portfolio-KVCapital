'use client'

import { Fragment, useState } from 'react'
import { CompResult, AdjustmentRates } from '@/lib/types'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

function fmt(n: number) {
  return `$${n.toLocaleString()}`
}

function parseDollars(s: string): number {
  if (!s || s === '$0') return 0
  const sign = s.startsWith('-') ? -1 : 1
  return sign * parseInt(s.replace(/[^0-9]/g, ''), 10)
}

function adjDelta(adjStr: string, rate: number): string {
  const dollars = parseDollars(adjStr)
  if (dollars === 0 || rate === 0) return '0'
  const delta = Math.round(dollars / rate)
  return (delta > 0 ? '+' : '') + delta
}

// Returns Tailwind classes for both dark and light themes
function adjCls(s: string): string {
  if (!s || s === '$0') return 'text-slate-500 light:text-slate-400'
  return s.startsWith('+')
    ? 'text-emerald-400 light:text-emerald-700'
    : 'text-rose-400 light:text-rose-600'
}

interface Props {
  comps: CompResult[]
  rates?: AdjustmentRates
  hoveredId?: string | null
  onHover?: (id: string | null) => void
}

export default function CompTable({ comps, rates, hoveredId, onHover }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (comps.length === 0) return null

  const anyHovered = !!hoveredId

  return (
    <div className="overflow-x-auto rounded-xl border border-kv-border light:border-kv-grey transition-colors duration-300">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-kv-border light:border-kv-grey bg-kv-mid/60 light:bg-kv-beige text-slate-400 light:text-slate-600 uppercase tracking-wider text-[10px]">
            <th className="px-4 py-3 w-6" />
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Sale Date</th>
            <th className="px-4 py-3">Sale Price</th>
            <th className="px-4 py-3">Adjusted</th>
            <th className="px-4 py-3">Δ Size</th>
            <th className="px-4 py-3">Δ Beds</th>
            <th className="px-4 py-3">Δ Age</th>
            <th className="px-4 py-3">Adj %</th>
            <th className="px-4 py-3">Dist</th>
          </tr>
        </thead>
        <tbody>
          {comps.map((comp, i) => {
            const isOpen    = openId === comp.id
            const isHovered = hoveredId === comp.id
            const dimmed    = anyHovered && !isHovered
            const totalAdj  = comp.adjusted_price - comp.sale_price
            const isOdd = i % 2 === 1

            // One bg per theme at a time — avoids CSS cascade conflicts.
            // Dark: odd rows get a slight lift; light: clearer alternating stripe.
            const darkBg = comp.is_outlier
              ? 'bg-rose-950/20'
              : isOpen   ? 'bg-kv-mid/60'
              : isHovered? 'bg-kv-mid/50'
              : isOdd    ? 'bg-kv-mid/30'
              : ''

            const darkHover = !comp.is_outlier && !isOpen && !isHovered
              ? 'hover:bg-kv-mid/50'
              : ''

            const lightBg = comp.is_outlier
              ? 'light:bg-rose-50'
              : isOpen   ? 'light:bg-slate-200/60'
              : isHovered? 'light:bg-slate-200/40'
              : isOdd    ? 'light:bg-slate-100'
              : ''

            const lightHover = !comp.is_outlier && !isOpen && !isHovered
              ? isOdd ? 'light:hover:bg-kv-grey/60' : 'light:hover:bg-slate-100'
              : ''

            return (
              <Fragment key={comp.id}>
                {/* Main row */}
                <tr
                  onClick={() => setOpenId(isOpen ? null : comp.id)}
                  onMouseEnter={() => onHover?.(comp.id)}
                  onMouseLeave={() => onHover?.(null)}
                  style={{ transition: 'opacity 0.15s' }}
                  className={[
                    'border-b border-kv-border/60 light:border-kv-grey cursor-pointer select-none transition-colors',
                    darkBg, darkHover,
                    lightBg, lightHover,
                    dimmed ? 'opacity-30' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-3">
                    {isOpen
                      ? <ChevronDown  size={12} className="text-slate-400 light:text-slate-600" />
                      : <ChevronRight size={12} className="text-slate-500 light:text-slate-500" />
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {comp.is_outlier && <AlertTriangle size={12} className="text-rose-400 shrink-0" />}
                      <div>
                        <div className="text-slate-200 light:text-kv-black font-medium">{comp.address}</div>
                        <div className="text-slate-500 light:text-slate-500">{comp.neighbourhood ?? comp.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 light:text-slate-700 tabular-nums">{comp.sale_date}</td>
                  <td className="px-4 py-3 text-slate-200 light:text-kv-black font-medium tabular-nums">{fmt(comp.sale_price)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-kv-green light:text-kv-blue">{fmt(comp.adjusted_price)}</td>
                  <td className="px-4 py-3"><span className={adjCls(comp.adjustments.sqft)}>{comp.adjustments.sqft}</span></td>
                  <td className="px-4 py-3"><span className={adjCls(comp.adjustments.bedrooms)}>{comp.adjustments.bedrooms}</span></td>
                  <td className="px-4 py-3"><span className={adjCls(comp.adjustments.age)}>{comp.adjustments.age}</span></td>
                  <td className="px-4 py-3">
                    <span className={`font-medium tabular-nums ${comp.is_outlier ? 'text-rose-400' : 'text-slate-400 light:text-slate-600'}`}>
                      {comp.adjustments.total_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 light:text-slate-600 tabular-nums">{comp.distance_km} km</td>
                </tr>

                {/* Expanded calculation row */}
                {isOpen && (
                  <tr className={[
                    'border-b border-kv-border/60 light:border-kv-grey',
                    comp.is_outlier
                      ? 'bg-rose-950/10 light:bg-white'
                      : 'bg-kv-mid/10 light:bg-white',
                  ].join(' ')}>
                    <td />
                    <td colSpan={9} className="px-6 py-4">
                      <div className="flex flex-wrap gap-8">

                        {/* Line-item math */}
                        <table className="font-mono text-[11px]">
                          <tbody>
                            <CalcRow label="Sale price" value={fmt(comp.sale_price)} cls="text-slate-300 light:text-kv-black" />
                            {rates ? (
                              <>
                                <CalcRow label={`+ Size  (${adjDelta(comp.adjustments.sqft, rates.sqft_per_foot)} sqft × ${fmt(rates.sqft_per_foot)})`} value={comp.adjustments.sqft} cls={adjCls(comp.adjustments.sqft)} />
                                <CalcRow label={`+ Beds  (${adjDelta(comp.adjustments.bedrooms, rates.per_bedroom)} bed × ${fmt(rates.per_bedroom)})`}     value={comp.adjustments.bedrooms}   cls={adjCls(comp.adjustments.bedrooms)} />
                                <CalcRow label={`+ Baths (${adjDelta(comp.adjustments.bathrooms, rates.per_bathroom)} bath × ${fmt(rates.per_bathroom)})`}  value={comp.adjustments.bathrooms}  cls={adjCls(comp.adjustments.bathrooms)} />
                                <CalcRow label={`+ Age   (${adjDelta(comp.adjustments.age, rates.per_year_age)} yr × ${fmt(rates.per_year_age)})`}          value={comp.adjustments.age}        cls={adjCls(comp.adjustments.age)} />
                              </>
                            ) : (
                              <>
                                <CalcRow label="+ Size"  value={comp.adjustments.sqft}      cls={adjCls(comp.adjustments.sqft)} />
                                <CalcRow label="+ Beds"  value={comp.adjustments.bedrooms}   cls={adjCls(comp.adjustments.bedrooms)} />
                                <CalcRow label="+ Baths" value={comp.adjustments.bathrooms}  cls={adjCls(comp.adjustments.bathrooms)} />
                                <CalcRow label="+ Age"   value={comp.adjustments.age}        cls={adjCls(comp.adjustments.age)} />
                              </>
                            )}
                            <tr><td colSpan={2} className="py-0.5"><div className="border-t border-kv-border light:border-kv-grey" /></td></tr>
                            <CalcRow
                              label="Total adjustment"
                              value={`${totalAdj >= 0 ? '+' : ''}${fmt(totalAdj)} (${comp.adjustments.total_pct}%)`}
                              cls={comp.is_outlier ? 'text-rose-400 font-semibold' : 'text-slate-300 light:text-kv-black font-semibold'}
                            />
                            <CalcRow
                              label="Adjusted price"
                              value={fmt(comp.adjusted_price)}
                              cls={`font-bold ${comp.is_outlier ? 'text-rose-400' : 'text-kv-green light:text-kv-blue'}`}
                            />
                          </tbody>
                        </table>

                        {/* Property details */}
                        <div className="text-[11px] space-y-1">
                          <div className="text-slate-500 light:text-slate-600 uppercase tracking-wider text-[9px] mb-2">Comp details</div>
                          <Detail label="Type"       value={{ detached: 'Detached', 'semi-detached': 'Semi-Detached', townhouse: 'Townhouse', condo: 'Condo' }[comp.property_type] ?? comp.property_type} />
                          <Detail label="Size"       value={`${comp.sqft.toLocaleString()} sqft`} />
                          <Detail label="Beds"       value={String(comp.bedrooms)} />
                          <Detail label="Baths"      value={String(comp.bathrooms)} />
                          <Detail label="Year built" value={String(comp.year_built)} />
                          <Detail label="Distance"   value={`${comp.distance_km} km`} />
                          {comp.similarity_score != null && (
                            <Detail label="Similarity" value={`${Math.round(comp.similarity_score * 100)}%`} />
                          )}
                        </div>
                      </div>

                      {comp.is_outlier && (
                        <p className="mt-3 text-[10px] text-rose-400 light:text-rose-600 flex items-center gap-1.5">
                          <AlertTriangle size={10} />
                          Total adjustment exceeds {rates?.outlier_threshold_pct ?? 15}% of sale price — treated as a weak comparable
                        </p>
                      )}
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

function CalcRow({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <tr>
      <td className="py-0.5 pr-6 text-slate-500 light:text-slate-600">{label}</td>
      <td className={`py-0.5 text-right tabular-nums ${cls}`}>{value}</td>
    </tr>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 light:text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-slate-300 light:text-slate-700">{value}</span>
    </div>
  )
}
