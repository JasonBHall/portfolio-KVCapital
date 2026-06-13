'use client'

import { useMemo, useState } from 'react'
import { CommercialCompResult, CommercialValuationReport } from '@/lib/types'

interface Props {
  report: CommercialValuationReport
  subjectSqft?: number
  subjectUnits?: number
}

// ── Layout constants ──────────────────────────────────────────────────────────
const M   = { top: 22, right: 52, bottom: 46, left: 62 }
const W   = 560
const H   = 260
const IW  = W - M.left - M.right
const IH  = H - M.top - M.bottom

function linScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

function niceTickVals(lo: number, hi: number, n: number): number[] {
  const step = (hi - lo) / (n - 1)
  return Array.from({ length: n }, (_, i) => lo + step * i)
}

// ── Dot colour logic ──────────────────────────────────────────────────────────
function dotFill(isOutlier: boolean, inBand: boolean | null) {
  if (isOutlier) return '#f87171'   // rose — flagged
  if (inBand === true)  return '#C4D82E'   // kv-green — in benchmark lane
  if (inBand === false) return '#f59e0b'   // amber — outside lane, not outlier
  return '#C4D82E'                         // fallback
}

// ── Tooltip state type ────────────────────────────────────────────────────────
interface Tip {
  x: number; y: number
  label: string
  val: string
  size: string
  isOutlier: boolean
  inBand: boolean | null
}

export default function CapRateScatterChart({ report, subjectSqft, subjectUnits }: Props) {
  const [tip, setTip] = useState<Tip | null>(null)

  const isMulti = report.asset_class === 'multifamily'
  const getSize = (c: CommercialCompResult) => isMulti ? (c.num_units ?? 0) : (c.gba_sqft ?? 0)
  const subjectSize = isMulti ? subjectUnits : subjectSqft

  // Decide mode: cap-rate scatter vs $/sqft fallback
  const hasRange     = report.cap_rate_range_low != null && report.cap_rate_range_high != null
  const capComps     = report.comps.filter(c => c.implied_cap_rate != null && getSize(c) > 0)
  const useCapMode   = report.cap_rate_applied != null && capComps.length >= 2

  const plotData = useMemo(() => {
    if (useCapMode) {
      return capComps.map(c => {
        const cap = c.implied_cap_rate!
        const inBand = hasRange
          ? cap >= report.cap_rate_range_low! && cap <= report.cap_rate_range_high!
          : null
        return { id: c.id, x: getSize(c), y: cap, isOutlier: c.is_outlier, inBand,
                 addr: c.address.split(',')[0], saleDate: c.sale_date, salePrice: c.sale_price }
      })
    }
    // $/sqft fallback
    return report.comps
      .filter(c => getSize(c) > 0)
      .map(c => {
        const ppsf = c.adjusted_price / getSize(c)
        const nonOutlierPPSF = report.comps
          .filter(x => !x.is_outlier && getSize(x) > 0)
          .map(x => x.adjusted_price / getSize(x))
          .sort((a, b) => a - b)
        const q1 = nonOutlierPPSF[Math.floor(nonOutlierPPSF.length * 0.25)] ?? 0
        const q3 = nonOutlierPPSF[Math.floor(nonOutlierPPSF.length * 0.75)] ?? 999999
        const inBand = !c.is_outlier ? (ppsf >= q1 && ppsf <= q3) : false
        return { id: c.id, x: getSize(c), y: ppsf, isOutlier: c.is_outlier, inBand,
                 addr: c.address.split(',')[0], saleDate: c.sale_date, salePrice: c.sale_price }
      })
  }, [report, useCapMode, hasRange])

  if (plotData.length < 2) return null

  // ── X domain — size ───────────────────────────────────────────────────────
  const xVals = plotData.map(d => d.x)
  if (subjectSize && subjectSize > 0) xVals.push(subjectSize)
  const xPad  = (Math.max(...xVals) - Math.min(...xVals)) * 0.15 || Math.max(...xVals) * 0.2
  const xMin  = Math.max(0, Math.min(...xVals) - xPad)
  const xMax  = Math.max(...xVals) + xPad

  // ── Y domain — cap rate or $/sqft ─────────────────────────────────────────
  const yVals     = plotData.map(d => d.y)
  let bandLo: number | null = null
  let bandHi: number | null = null
  let selY:   number | null = null

  let yMin: number, yMax: number
  let yFmt: (v: number) => string
  let yLabel: string
  let chartTitle: string
  let sourceNote: string

  if (useCapMode) {
    bandLo  = report.cap_rate_range_low ?? null
    bandHi  = report.cap_rate_range_high ?? null
    selY    = report.cap_rate_applied!
    const lo = Math.min(...yVals, bandLo ?? Infinity, selY - 0.015)
    const hi = Math.max(...yVals, bandHi ?? -Infinity, selY + 0.015)
    const pad = (hi - lo) * 0.15 || 0.005
    yMin    = lo - pad
    yMax    = hi + pad
    yFmt    = (v: number) => `${(v * 100).toFixed(2)}%`
    yLabel  = 'Implied Cap Rate'
    chartTitle = 'Cap Rate vs. Property Size — Comp Selection'
    sourceNote = 'Lane = Altus Group Q4 2024 benchmark range · Dashed line = selected rate · Dotted = ±25bps window'
  } else {
    const nonOutliers = plotData.filter(d => !d.isOutlier).map(d => d.y).sort((a, b) => a - b)
    if (nonOutliers.length >= 4) {
      bandLo = nonOutliers[Math.floor(nonOutliers.length * 0.25)]
      bandHi = nonOutliers[Math.floor(nonOutliers.length * 0.75)]
    }
    const pad = (Math.max(...yVals) - Math.min(...yVals)) * 0.15 || Math.max(...yVals) * 0.1
    yMin    = Math.max(0, Math.min(...yVals) - pad)
    yMax    = Math.max(...yVals) + pad
    yFmt    = (v: number) => `$${Math.round(v)}`
    yLabel  = isMulti ? 'Adj. $/unit' : 'Adj. $/sqft'
    chartTitle = `Adjusted ${isMulti ? '$/Unit' : '$/sqft'} vs. Property Size — Comp Selection`
    sourceNote = 'Lane = interquartile range of non-outlier comps · Red dots excluded from analysis'
  }

  const xSc = linScale([xMin, xMax], [0, IW])
  const ySc = linScale([yMax, yMin], [0, IH])   // inverted so higher = up

  const yTicks = niceTickVals(yMin, yMax, 5)
  const xTicks = niceTickVals(xMin, xMax, 4)
  const sizeUnit = isMulti ? 'units' : 'sqft'

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 transition-colors duration-300">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider">
          {chartTitle}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {useCapMode && bandLo != null && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'rgba(0,109,148,0.25)', border: '1px solid rgba(0,109,148,0.5)' }} />
              Benchmark lane
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-kv-green" />
            In lane
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            Outside lane
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
            Outlier
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <clipPath id="chart-clip">
              <rect x={0} y={0} width={IW} height={IH} />
            </clipPath>
          </defs>

          <g transform={`translate(${M.left},${M.top})`}>

            {/* Y grid lines */}
            {yTicks.map((v, i) => (
              <line key={i}
                x1={0} x2={IW} y1={ySc(v)} y2={ySc(v)}
                stroke="rgba(90,86,96,0.3)" strokeWidth={0.5}
              />
            ))}

            {/* Benchmark lane (band) */}
            {bandLo != null && bandHi != null && (
              <rect
                x={0} y={ySc(bandHi)} width={IW}
                height={Math.max(0, ySc(bandLo) - ySc(bandHi))}
                fill={useCapMode ? 'rgba(0,109,148,0.14)' : 'rgba(196,216,46,0.08)'}
                stroke={useCapMode ? 'rgba(0,109,148,0.4)' : 'rgba(196,216,46,0.3)'}
                strokeWidth={1}
              />
            )}

            {/* Selected cap rate line + ±25bps window */}
            {selY != null && (() => {
              const y0 = ySc(selY)
              const yPlus  = ySc(selY + 0.0025)
              const yMinus = ySc(selY - 0.0025)
              return (
                <>
                  <line x1={0} x2={IW} y1={yPlus}  y2={yPlus}
                    stroke="var(--chart-accent)" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.35} />
                  <line x1={0} x2={IW} y1={yMinus} y2={yMinus}
                    stroke="var(--chart-accent)" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.35} />
                  <line x1={0} x2={IW} y1={y0} y2={y0}
                    stroke="var(--chart-accent)" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.75} />
                  {/* Right-side label */}
                  <text x={IW + 5} y={y0 + 3.5} fontSize={8} fill="var(--chart-accent)" opacity={0.85}>
                    {yFmt(selY)}
                  </text>
                </>
              )
            })()}

            {/* Subject vertical line */}
            {subjectSize != null && subjectSize > 0 && (() => {
              const sx = xSc(subjectSize)
              if (sx < -5 || sx > IW + 5) return null
              return (
                <>
                  <line x1={sx} x2={sx} y1={0} y2={IH}
                    stroke="var(--chart-accent)" strokeWidth={1} strokeDasharray="4 2" opacity={0.45} />
                  {selY != null && (
                    <circle cx={sx} cy={ySc(selY)} r={6}
                      fill="var(--chart-accent)" stroke="var(--kv-card)" strokeWidth={1.5} />
                  )}
                  <text x={sx} y={IH + 30} fontSize={8} textAnchor="middle" fill="var(--chart-accent)" opacity={0.8}>
                    Subject
                  </text>
                </>
              )
            })()}

            {/* Comp dots — clipped */}
            <g clipPath="url(#chart-clip)">
              {plotData.map(d => {
                const cx = xSc(d.x)
                const cy = ySc(d.y)
                const fill = dotFill(d.isOutlier, d.inBand)
                return (
                  <circle key={d.id}
                    cx={cx} cy={cy} r={5.5}
                    fill={fill} stroke="#29262B" strokeWidth={1} opacity={0.9}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => {
                      const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect()
                      const svgW = rect.width
                      const scaleX = svgW / W
                      const px = (M.left + cx) * scaleX
                      const py = (M.top  + cy) * scaleX
                      setTip({
                        x: px, y: py,
                        label: d.addr,
                        val: yFmt(d.y),
                        size: `${d.x.toLocaleString()} ${sizeUnit}`,
                        isOutlier: d.isOutlier,
                        inBand: d.inBand,
                      })
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                )
              })}
            </g>

            {/* Axes */}
            <line x1={0} x2={0}  y1={0} y2={IH} stroke="rgba(90,86,96,0.5)" strokeWidth={0.75} />
            <line x1={0} x2={IW} y1={IH} y2={IH} stroke="rgba(90,86,96,0.5)" strokeWidth={0.75} />

            {/* Y-axis ticks + labels */}
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={-4} x2={0} y1={ySc(v)} y2={ySc(v)} stroke="rgba(90,86,96,0.6)" strokeWidth={0.75} />
                <text x={-8} y={ySc(v) + 3.5} fontSize={9} textAnchor="end"
                  fill="rgba(118,114,120,0.9)">
                  {yFmt(v)}
                </text>
              </g>
            ))}

            {/* X-axis ticks + labels */}
            {xTicks.map((v, i) => (
              <g key={i}>
                <line x1={xSc(v)} x2={xSc(v)} y1={IH} y2={IH + 4}
                  stroke="rgba(90,86,96,0.6)" strokeWidth={0.75} />
                <text x={xSc(v)} y={IH + 14} fontSize={9} textAnchor="middle"
                  fill="rgba(118,114,120,0.9)">
                  {v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : Math.round(v)}
                </text>
              </g>
            ))}

            {/* Axis labels */}
            <text x={IW / 2} y={IH + 38} fontSize={9} textAnchor="middle"
              fill="rgba(118,114,120,0.75)">
              {isMulti ? 'Number of Units' : 'Gross Building Area (sqft)'}
            </text>
            <text
              transform={`translate(-50,${IH / 2}) rotate(-90)`}
              fontSize={9} textAnchor="middle"
              fill="rgba(118,114,120,0.75)">
              {yLabel}
            </text>

          </g>
        </svg>

        {/* Hover tooltip */}
        {tip && (
          <div
            className="pointer-events-none absolute z-10 bg-kv-black light:bg-white border border-kv-border light:border-kv-grey rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{ left: tip.x + 10, top: tip.y - 36, minWidth: 160 }}
          >
            <div className="font-medium text-slate-200 light:text-kv-black truncate max-w-[200px]">{tip.label}</div>
            <div className="text-slate-400 light:text-slate-600 mt-0.5">
              {useCapMode ? 'Cap rate' : 'Adj. price/unit'}: <span className="font-semibold text-kv-green">{tip.val}</span>
            </div>
            <div className="text-slate-400 light:text-slate-600">Size: {tip.size}</div>
            {tip.isOutlier && <div className="text-rose-400 mt-0.5">Flagged — outlier</div>}
            {!tip.isOutlier && tip.inBand === false && (
              <div className="text-amber-400 mt-0.5">Outside benchmark lane</div>
            )}
          </div>
        )}
      </div>

      {/* Source attribution */}
      <div className="text-[10px] text-slate-600 light:text-slate-400 mt-2 leading-relaxed">
        {sourceNote}
      </div>
    </div>
  )
}
