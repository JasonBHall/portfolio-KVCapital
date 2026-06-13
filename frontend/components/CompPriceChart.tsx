'use client'

import { useState } from 'react'
import { useIsDark } from '@/lib/useTheme'

// Minimal shape required by the chart — satisfied by both residential and commercial reports
export interface ChartComp {
  id?: string
  address: string
  sale_price: number
  adjusted_price: number
  is_outlier: boolean
  adjustments: { total_pct: number }
}

export interface ChartReport {
  comps: ChartComp[]
  estimated_value_low: number
  estimated_value_high: number
  estimated_value_mid: number
}

interface Props {
  report: ChartReport
  hoveredId?: string | null
  onHover?: (id: string | null) => void
}

const ROW_H   = 44
const PAD_TOP = 26
const PAD_BOT = 40
const PAD_L   = 8
const PAD_R   = 160
const CHART_W = 720

function fmtK(n: number) { return `$${Math.round(n / 1000)}k` }
function fmt(n: number)  { return `$${n.toLocaleString()}` }

const TT_W = 190
const TT_H = 78
const TT_PAD = 8

export default function CompPriceChart({ report, hoveredId, onHover }: Props) {
  const [tooltip, setTooltip] = useState<{ comp: ChartComp; x: number; y: number } | null>(null)
  const isDark = useIsDark()

  // Semantic color palette — swaps with theme
  const c = {
    rawDot:      isDark ? '#64748b' : '#94a3b8',
    adjNormal:   isDark ? '#C4D82E' : '#006D94',
    adjOutlier:  isDark ? '#fb7185' : '#f43f5e',
    gridline:    isDark ? '#1e293b' : '#f1f5f9',
    axis:        isDark ? '#334155' : '#e2e8f0',
    tick:        isDark ? '#475569' : '#94a3b8',
    label:       isDark ? '#64748b' : '#6b7280',
    labelHover:  isDark ? '#e2e8f0' : '#111827',
    rowHover:    isDark ? 'rgba(196,216,46,0.08)' : 'rgba(0,109,148,0.06)',
    bandFill:    isDark ? '#C4D82E' : '#006D94',
    midLine:     isDark ? '#C4D82E' : '#006D94',
    midLabel:    isDark ? '#C4D82E' : '#006D94',
    ttBg:        isDark ? '#3c3840' : '#ffffff',
    ttBorder:    isDark ? '#5a5660' : '#E0DFE2',
    ttTitle:     isDark ? '#e2e8f0' : '#111827',
    ttMuted:     isDark ? '#94a3b8' : '#64748b',
    cardBg:      isDark ? '#3c3840' : '#ffffff',
    cardBorder:  isDark ? '#5a5660' : '#E0DFE2',
    headerText:  isDark ? '#94a3b8' : '#6b7280',
    legendText:  isDark ? '#64748b' : '#9ca3af',
  }

  const { comps, estimated_value_low, estimated_value_high, estimated_value_mid } = report
  if (!comps || comps.length === 0) return null

  const allPrices = [...comps.map(c => c.sale_price), ...comps.map(c => c.adjusted_price), estimated_value_low, estimated_value_high]
  const minP = Math.min(...allPrices) * 0.985
  const maxP = Math.max(...allPrices) * 1.015

  const plotW  = CHART_W - PAD_L - PAD_R
  const chartH = PAD_TOP + comps.length * ROW_H + PAD_BOT

  function xOf(price: number) { return PAD_L + ((price - minP) / (maxP - minP)) * plotW }
  function yOf(i: number)     { return PAD_TOP + i * ROW_H + ROW_H / 2 }

  const ticks = Array.from({ length: 5 }, (_, i) => minP + i * ((maxP - minP) / 4))
  const anyHovered = !!hoveredId

  return (
    <div
      className="rounded-xl p-5 space-y-3 transition-colors duration-300"
      style={{ backgroundColor: c.cardBg, border: `1px solid ${c.cardBorder}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.headerText }}>
        Price Distribution — Raw vs Adjusted
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_W} ${chartH}`}
          className="w-full"
          style={{ minWidth: 320 }}
          onMouseLeave={() => { setTooltip(null); onHover?.(null) }}
        >
          {/* Value range band */}
          <rect x={xOf(estimated_value_low)} y={PAD_TOP} width={xOf(estimated_value_high) - xOf(estimated_value_low)} height={comps.length * ROW_H} fill={c.bandFill} fillOpacity={0.08} />
          <line x1={xOf(estimated_value_low)}  y1={PAD_TOP} x2={xOf(estimated_value_low)}  y2={PAD_TOP + comps.length * ROW_H} stroke={c.midLine} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
          <text x={xOf(estimated_value_low)}  y={PAD_TOP - 5} textAnchor="middle" fill={c.midLabel} fillOpacity={0.6} fontSize={9} fontFamily="monospace">{fmtK(estimated_value_low)} min</text>

          <line x1={xOf(estimated_value_high)} y1={PAD_TOP} x2={xOf(estimated_value_high)} y2={PAD_TOP + comps.length * ROW_H} stroke={c.midLine} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
          <text x={xOf(estimated_value_high)} y={PAD_TOP - 5} textAnchor="middle" fill={c.midLabel} fillOpacity={0.6} fontSize={9} fontFamily="monospace">{fmtK(estimated_value_high)} max</text>

          <line x1={xOf(estimated_value_mid)}  y1={PAD_TOP} x2={xOf(estimated_value_mid)}  y2={PAD_TOP + comps.length * ROW_H} stroke={c.midLine} strokeOpacity={0.7} strokeWidth={1.5} />
          <text x={xOf(estimated_value_mid)}  y={PAD_TOP - 5} textAnchor="middle" fill={c.midLabel} fontSize={9} fontFamily="monospace">{fmtK(estimated_value_mid)} mid</text>

          {/* Axis */}
          <line x1={PAD_L} y1={PAD_TOP + comps.length * ROW_H} x2={PAD_L + plotW} y2={PAD_TOP + comps.length * ROW_H} stroke={c.axis} strokeWidth={1} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={xOf(t)} y1={PAD_TOP + comps.length * ROW_H} x2={xOf(t)} y2={PAD_TOP + comps.length * ROW_H + 4} stroke={c.tick} strokeWidth={1} />
              <text x={xOf(t)} y={PAD_TOP + comps.length * ROW_H + 14} textAnchor="middle" fill={c.tick} fontSize={9} fontFamily="monospace">{fmtK(t)}</text>
            </g>
          ))}

          {/* Gridlines */}
          {comps.map((_, i) => (
            <line key={i} x1={PAD_L} y1={PAD_TOP + i * ROW_H} x2={PAD_L + plotW} y2={PAD_TOP + i * ROW_H} stroke={c.gridline} strokeWidth={1} />
          ))}

          {/* Comp rows — no tooltip inside so later rows don't paint over it */}
          {comps.map((comp, i) => {
            const y         = yOf(i)
            const x1        = xOf(comp.sale_price)
            const x2        = xOf(comp.adjusted_price)
            const isOutlier = comp.is_outlier
            const adjColor  = isOutlier ? c.adjOutlier : c.adjNormal
            const moved     = Math.abs(comp.adjusted_price - comp.sale_price) > 500
            const isHovered = hoveredId === comp.id
            const dimmed    = anyHovered && !isHovered
            const opacity   = dimmed ? 0.2 : 1

            return (
              <g key={comp.id} style={{ opacity, transition: 'opacity 0.15s' }}
                onMouseEnter={() => { setTooltip({ comp, x: x2, y }); onHover?.(comp.id ?? null) }}
                onMouseLeave={() => { setTooltip(null); onHover?.(null) }}
              >
                <rect x={PAD_L} y={PAD_TOP + i * ROW_H} width={plotW} height={ROW_H} fill="transparent" style={{ cursor: 'pointer' }} />
                {isHovered && <rect x={PAD_L} y={PAD_TOP + i * ROW_H} width={plotW + PAD_R - 10} height={ROW_H} fill={c.rowHover} rx={3} />}
                {moved && <line x1={x1} y1={y} x2={x2} y2={y} stroke={adjColor} strokeOpacity={0.35} strokeWidth={1.5} />}
                <circle cx={x1} cy={y} r={isHovered ? 6 : 5} fill={c.rawDot} />
                <circle cx={x2} cy={y} r={isHovered ? 7 : 6} fill={adjColor} />
                {isHovered && <circle cx={x2} cy={y} r={11} fill="none" stroke={adjColor} strokeOpacity={0.35} strokeWidth={2} />}
                <text x={PAD_L + plotW + 10} y={y + 4} fill={isOutlier ? c.adjOutlier : (isHovered ? c.labelHover : c.label)} fontSize={9} fontFamily="sans-serif">
                  {comp.address.split(',')[0]}
                </text>
              </g>
            )
          })}

          {/* Tooltip rendered last — always paints on top of every dot */}
          {tooltip && (() => {
            const tc        = tooltip.comp
            const ti        = comps.findIndex(cp => cp.id === tc.id)
            const ty        = yOf(ti)
            const tx2       = xOf(tc.adjusted_price)
            const isOutlier = tc.is_outlier
            const adjColor  = isOutlier ? c.adjOutlier : c.adjNormal
            const totalAdj  = tc.adjusted_price - tc.sale_price
            const ttY = ty - TT_H - 12 < PAD_TOP ? ty + 12 : ty - TT_H - 12
            const ttX = Math.min(Math.max(tx2 - TT_W / 2, PAD_L), PAD_L + plotW - TT_W)
            return (
              <g key="active-tooltip" style={{ pointerEvents: 'none' }}>
                <rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={6} fill={c.ttBg} stroke={c.ttBorder} strokeWidth={1} />
                <text x={ttX + TT_PAD} y={ttY + TT_PAD + 10} fill={c.ttTitle} fontSize={10} fontWeight="600" fontFamily="sans-serif">{tc.address.split(',')[0]}</text>
                <text x={ttX + TT_PAD} y={ttY + TT_PAD + 26} fill={c.ttMuted} fontSize={9} fontFamily="monospace">{`Sale price:  ${fmt(tc.sale_price)}`}</text>
                <text x={ttX + TT_PAD} y={ttY + TT_PAD + 40} fill={adjColor}  fontSize={9} fontFamily="monospace">{`Adjusted:    ${fmt(tc.adjusted_price)}`}</text>
                <text x={ttX + TT_PAD} y={ttY + TT_PAD + 54} fill={c.ttMuted} fontSize={9} fontFamily="monospace">{`Adj total:   ${totalAdj >= 0 ? '+' : ''}${fmt(totalAdj)} (${tc.adjustments.total_pct}%)`}</text>
                {isOutlier && <text x={ttX + TT_PAD} y={ttY + TT_H - TT_PAD} fill={c.adjOutlier} fontSize={8} fontFamily="sans-serif">⚠ Large adjustment — weak comp</text>}
              </g>
            )
          })()}
        </svg>
      </div>

      <div className="flex flex-wrap gap-5 text-[10px] pt-1" style={{ color: c.legendText }}>
        <LegendItem color={c.rawDot}    label="Raw sale price" circle />
        <LegendItem color={c.adjNormal} label="Adjusted price" circle />
        <LegendItem color={c.adjOutlier} label="Outlier" circle />
        <LegendItem color={c.adjNormal} label="Subject value range" band />
      </div>
    </div>
  )
}

function LegendItem({ color, label, circle, band }: { color: string; label: string; circle?: boolean; band?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {circle && <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} /></svg>}
      {band && <svg width={16} height={10}><rect x={0} y={1} width={16} height={8} fill={color} fillOpacity={0.2} /><line x1={8} y1={0} x2={8} y2={10} stroke={color} strokeWidth={1.5} strokeOpacity={0.7} /></svg>}
      <span>{label}</span>
    </div>
  )
}
