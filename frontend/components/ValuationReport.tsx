'use client'

import { ValuationReport as Report, AgentTraceStep, SubjectProperty } from '@/lib/types'
import CompTable from './CompTable'
import TokenUsagePanel from './TokenUsagePanel'
import AdjustmentRatesPanel from './AdjustmentRatesPanel'
import CompPriceChart from './CompPriceChart'
import AgentTrace from './AgentTrace'
import { useState, useEffect } from 'react'
import {
  CheckCircle, AlertCircle, AlertTriangle, XCircle,
  FileText, Download,
} from 'lucide-react'

function FadePanel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
    >
      {children}
    </div>
  )
}

const CONFIDENCE_CONFIG = {
  high:         { label: 'High Confidence',   icon: <CheckCircle size={15} />,   color: 'text-emerald-400 light:text-emerald-700', border: 'border-emerald-700/50 light:border-emerald-300', bg: 'bg-emerald-950/20 light:bg-emerald-50' },
  medium:       { label: 'Medium Confidence', icon: <AlertCircle size={15} />,   color: 'text-kv-green light:text-kv-blue',     border: 'border-kv-blue/40 light:border-kv-blue/30',    bg: 'bg-kv-blue/10 light:bg-kv-blue/10' },
  low:          { label: 'Low Confidence',    icon: <AlertTriangle size={15} />, color: 'text-rose-400 light:text-rose-700',       border: 'border-rose-700/50 light:border-rose-300',      bg: 'bg-rose-950/20 light:bg-rose-50' },
  insufficient: { label: 'Insufficient Data', icon: <XCircle size={15} />,       color: 'text-rose-500 light:text-rose-700',       border: 'border-rose-700/50 light:border-rose-300',      bg: 'bg-rose-950/20 light:bg-rose-50' },
}

function fmt(n: number) {
  return `$${n.toLocaleString()}`
}

interface Props {
  report: Report
  subject?: SubjectProperty
  traceSteps: AgentTraceStep[]
  isRunning: boolean
  onOpenSettings?: () => void
  onOpenTrace?: () => void
}

export default function ValuationReport({ report, subject, traceSteps, isRunning, onOpenSettings, onOpenTrace }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const conf = CONFIDENCE_CONFIG[report.confidence] ?? CONFIDENCE_CONFIG.low

  async function handleDownload() {
    setDownloading(true)
    try {
      const { downloadValuationPdf } = await import('./ValuationReportPdf')
      await downloadValuationPdf(report, subject)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Download button row ── */}
      <FadePanel delay={0}>
      <div className="flex justify-end">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border transition-colors bg-kv-blue hover:bg-kv-blue-hover disabled:opacity-50 text-white border-kv-blue font-medium"
        >
          <Download size={13} />
          {downloading ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </div>
      </FadePanel>

      {/* ── Row: Estimated Value + Details ── */}
      <FadePanel delay={0}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Estimated value */}
        <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 flex flex-col justify-between gap-3 transition-colors duration-300">
          <div>
            <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2">Estimated Value</div>
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

        {/* Orange details card — flags only */}
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

      {/* ── Row: Price Distribution Chart ── */}
      {report.comps.length > 0 && (
        <FadePanel delay={160}>
        <CompPriceChart
          report={report}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
        </FadePanel>
      )}

      {/* ── Row: Comparable Sales ── */}
      {report.comps.length > 0 && (
        <FadePanel delay={240}>
        <div>
          <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2 px-1">
            Comparable Sales ({report.comps.length})
          </div>
          <CompTable
            comps={report.comps}
            rates={report.adjustment_rates}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        </div>
        </FadePanel>
      )}

      {/* ── Row: Adjustment Methodology ── */}
      {report.adjustment_rates && (
        <FadePanel delay={320}>
        <div className="text-slate-400 light:text-slate-600 text-xs uppercase tracking-wider mb-2 px-1">
          Equations &amp; Methodology
        </div>
        <AdjustmentRatesPanel
          rates={report.adjustment_rates}
          onOpenSettings={onOpenSettings}
        />
        </FadePanel>
      )}

      {/* ── Row: Agent Trace + Claude Usage ── */}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 light:text-slate-600 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-slate-200 light:text-kv-black font-semibold mt-0.5">{value}</div>
    </div>
  )
}
