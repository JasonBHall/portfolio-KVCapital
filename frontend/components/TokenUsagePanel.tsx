'use client'

import { TokenUsage } from '@/lib/types'
import { Zap, TrendingDown, Clock } from 'lucide-react'

interface Props {
  usage: TokenUsage
  latencyMs?: number
}

export default function TokenUsagePanel({ usage, latencyMs }: Props) {
  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-4 transition-colors duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">

        <div className="flex items-center gap-2">
          <Zap size={14} className="text-kv-green" />
          <span className="text-xs font-semibold text-slate-400 light:text-slate-600 uppercase tracking-wider">Claude Usage</span>
          {usage.cache_hit && (
            <span className="text-xs bg-emerald-900/50 light:bg-emerald-50 text-emerald-400 border border-emerald-700 light:border-emerald-300 px-2 py-0.5 rounded-full">
              Cache hit ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-6 text-xs flex-wrap">
          <Stat label="Cost"          value={usage.cost_display} highlight />
          <Stat label="API calls"     value={String(usage.api_calls)} />
          <Stat label="Input tokens"  value={usage.input_tokens.toLocaleString()} />
          <Stat label="Output tokens" value={usage.output_tokens.toLocaleString()} />
          {usage.cache_read_tokens > 0 && (
            <Stat label="Cache reads" value={usage.cache_read_tokens.toLocaleString()} dim />
          )}
          {latencyMs !== undefined && (
            <div className="flex items-center gap-1 text-slate-400 light:text-slate-500">
              <Clock size={11} />
              <Stat label="Total time" value={`${(latencyMs / 1000).toFixed(1)}s`} />
            </div>
          )}
          {usage.cache_savings_usd > 0 && (
            <div className="flex items-center gap-1 text-emerald-400">
              <TrendingDown size={12} />
              <span className="font-medium">Saved {usage.cache_savings_display} via prompt caching</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 light:text-slate-400 mt-2">
        Model: {usage.model} · Pricing: $3/M input, $15/M output, $0.30/M cache read (Anthropic, Jun 2026)
      </p>
    </div>
  )
}

function Stat({ label, value, highlight, dim }: { label: string; value: string; highlight?: boolean; dim?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`font-semibold ${highlight ? 'text-kv-green text-sm' : dim ? 'text-slate-500 light:text-slate-400' : 'text-slate-200 light:text-kv-black'}`}>
        {value}
      </span>
      <span className="text-slate-500 light:text-slate-400">{label}</span>
    </div>
  )
}
