'use client'

import { useState, useEffect } from 'react'
import { AppConfig, CommercialAdjustmentRates, MarketBenchmark } from '@/lib/types'
import { fetchConfig, updateConfig, fetchCommercialConfig, updateCommercialConfig, fetchMarketBenchmarks } from '@/lib/api'
import { X, Save, Loader2, Check, AlertTriangle, Info } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'residential' | 'commercial'

// ── Residential metadata ──────────────────────────────────────────────────────

const EXPANSION_STEPS = [
  { strategy: 'radius',              label: 'Double search radius',    detail: '2 km → 4 km → 8 km (max 50 km)' },
  { strategy: 'age',                 label: 'Extend sale date window', detail: '12 mo → 18 mo → 24 mo (max 36 mo)' },
  { strategy: 'beds_plus_minus_one', label: 'Relax bedroom match',     detail: 'Include ±1 bedroom from subject' },
  { strategy: 'type_adjacent',       label: 'Broaden property type',   detail: 'e.g. include semi-detached for detached search' },
]

const RES_FIELD_META: Record<keyof AppConfig, { label: string; unit: string; source: string; samQuestion?: string }> = {
  sqft_per_foot: {
    label: 'Size adjustment',
    unit: '$/sqft',
    source: 'CREA MLS HPI, Edmonton CMA 2024',
    samQuestion: 'Ask Sam: what $/sqft differential does KV use internally for Edmonton vs suburban markets?',
  },
  per_bedroom: {
    label: 'Bedroom adjustment',
    unit: '$ per bedroom',
    source: 'AIC practitioner convention',
    samQuestion: 'Ask Sam: does KV apply bedroom adjustments, and at what value?',
  },
  per_bathroom: {
    label: 'Bathroom adjustment',
    unit: '$ per bathroom',
    source: 'AIC practitioner convention',
    samQuestion: 'Ask Sam: does KV apply bathroom adjustments, and at what value?',
  },
  per_year_age: {
    label: 'Age adjustment',
    unit: '$ per year',
    source: 'AIC practitioner rule of thumb — confirm with KV',
    samQuestion: 'Ask Sam: does KV adjust for age? What rate per year? Is there a cap?',
  },
  outlier_threshold_pct: {
    label: 'Outlier flag threshold',
    unit: '% of sale price',
    source: 'AIC / USPAP gross adjustment guideline',
    samQuestion: 'Ask Sam: at what total adjustment % does KV flag or discard a comp?',
  },
}

// ── Commercial metadata ───────────────────────────────────────────────────────

const COMM_FIELD_META: Record<keyof CommercialAdjustmentRates, { label: string; unit: string; source: string; step: number }> = {
  size_per_sqft: {
    label: 'Size adjustment',
    unit: '$/sqft difference',
    source: 'CUSPAP (AIC) income approach adjustment convention',
    step: 1,
  },
  age_per_year_pct: {
    label: 'Age adjustment',
    unit: '% per year effective age difference',
    source: 'AIC commercial practitioner convention — 0.5% per year',
    step: 0.001,
  },
  building_class_pct: {
    label: 'Building class step',
    unit: '% per class step (A/B/C)',
    source: 'AIC commercial practitioner convention — 5–10% per class step',
    step: 0.01,
  },
  outlier_threshold_pct: {
    label: 'Outlier flag threshold',
    unit: '% gross adjustment',
    source: 'AIC/CUSPAP — 25% gross adjustment threshold for commercial',
    step: 1,
  },
}

function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%` }

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsDrawer({ open, onClose }: Props) {
  const [tab, setTab]               = useState<Tab>('residential')

  // Residential
  const [resConfig, setResConfig]   = useState<AppConfig | null>(null)
  const [resDraft, setResDraft]     = useState<AppConfig | null>(null)

  // Commercial
  const [commConfig, setCommConfig] = useState<CommercialAdjustmentRates | null>(null)
  const [commDraft, setCommDraft]   = useState<CommercialAdjustmentRates | null>(null)
  const [benchmarks, setBenchmarks] = useState<MarketBenchmark[] | null>(null)

  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showSamTips, setShowSamTips] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!resConfig) {
      setLoading(true)
      fetchConfig()
        .then(cfg => { setResConfig(cfg); setResDraft(cfg) })
        .catch(() => setError('Could not load residential config'))
        .finally(() => setLoading(false))
    }
  }, [open])

  useEffect(() => {
    if (!open || tab !== 'commercial') return
    if (!commConfig) {
      setLoading(true)
      Promise.all([fetchCommercialConfig(), fetchMarketBenchmarks()])
        .then(([cfg, bm]) => { setCommConfig(cfg); setCommDraft(cfg); setBenchmarks(bm) })
        .catch(() => setError('Could not load commercial config'))
        .finally(() => setLoading(false))
    }
  }, [open, tab])

  if (!open) return null

  const isResDirty  = resDraft  && resConfig  && JSON.stringify(resDraft)  !== JSON.stringify(resConfig)
  const isCommDirty = commDraft && commConfig  && JSON.stringify(commDraft) !== JSON.stringify(commConfig)
  const isDirty     = tab === 'residential' ? isResDirty : isCommDirty

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      if (tab === 'residential' && resDraft) {
        const updated = await updateConfig(resDraft)
        setResConfig(updated); setResDraft(updated)
      } else if (tab === 'commercial' && commDraft) {
        const updated = await updateCommercialConfig(commDraft)
        setCommConfig(updated); setCommDraft(updated)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed — check backend connection')
    } finally {
      setSaving(false)
    }
  }

  function handleResChange(field: keyof AppConfig, raw: string) {
    if (!resDraft) return
    const n = parseFloat(raw)
    if (!isNaN(n)) setResDraft({ ...resDraft, [field]: n })
  }

  function handleCommChange(field: keyof CommercialAdjustmentRates, raw: string) {
    if (!commDraft) return
    const n = parseFloat(raw)
    if (!isNaN(n)) setCommDraft({ ...commDraft, [field]: n })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60" style={{ zIndex: 900 }} onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-kv-card light:bg-white border-l border-kv-border light:border-kv-grey flex flex-col" style={{ zIndex: 1000 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-kv-border light:border-kv-grey shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 light:text-kv-black">Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Adjustment rates · Expansion logic</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 light:hover:text-slate-900 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-kv-border light:border-kv-grey shrink-0">
          {(['residential', 'commercial'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-kv-green light:text-kv-blue border-b-2 border-kv-green light:border-kv-blue -mb-px'
                  : 'text-slate-500 hover:text-slate-300 light:hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <div className="bg-rose-950/40 border border-rose-700 rounded-lg px-4 py-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* ── RESIDENTIAL TAB ── */}
          {tab === 'residential' && resDraft && (
            <>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-300 light:text-kv-black uppercase tracking-wider">Adjustment Rates</h3>
                  <button onClick={() => setShowSamTips(t => !t)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-kv-green transition-colors">
                    <Info size={11} /> {showSamTips ? 'Hide' : 'Show'} Sam call tips
                  </button>
                </div>
                <div className="space-y-4">
                  {(Object.keys(RES_FIELD_META) as (keyof AppConfig)[]).map(field => {
                    const meta = RES_FIELD_META[field]
                    return (
                      <div key={field} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-300 light:text-slate-700 font-medium">{meta.label}</label>
                          <span className="text-[10px] text-slate-600">{meta.unit}</span>
                        </div>
                        <input
                          type="number" value={resDraft[field]}
                          step={field === 'outlier_threshold_pct' ? 0.5 : field === 'sqft_per_foot' ? 5 : 500}
                          min={0}
                          onChange={e => handleResChange(field, e.target.value)}
                          className="w-full bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey rounded-lg px-3 py-2 text-sm text-slate-100 light:text-kv-black focus:outline-none focus:border-kv-blue tabular-nums"
                        />
                        <p className="text-[10px] text-slate-600">Source: {meta.source}</p>
                        {showSamTips && meta.samQuestion && (
                          <p className="text-[10px] text-kv-green/80 bg-kv-blue/10 border border-kv-blue/30 rounded px-2 py-1.5">💬 {meta.samQuestion}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-slate-300 light:text-kv-black uppercase tracking-wider mb-1">Expansion Logic</h3>
                <p className="text-[10px] text-slate-500 mb-3">When initial comp search returns &lt; 3 results, the agent applies these strategies in order. Max 2 expansions before issuing a low-confidence report.</p>
                <div className="space-y-2">
                  {EXPANSION_STEPS.map((step, i) => (
                    <div key={step.strategy} className="bg-kv-mid/50 light:bg-kv-beige border border-kv-border light:border-kv-grey rounded-lg px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-mono text-slate-600 mt-0.5 w-4 shrink-0">{i + 1}</span>
                        <div>
                          <div className="text-xs font-medium text-slate-300 light:text-slate-700">{step.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{step.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-slate-300 light:text-kv-black uppercase tracking-wider mb-1">Planned Adjustments</h3>
                <p className="text-[10px] text-slate-500 mb-3">These attributes are stored in the database but not yet applied as adjustments. Confirm with Sam which ones KV uses.</p>
                <div className="space-y-2">
                  {[
                    { field: 'garage', label: 'Garage', note: 'Not in dataset — common AIC line item. Double attached adds ~$20–35k in Edmonton.', samTip: 'Ask Sam: does KV adjust for garage presence/type (single vs double, attached vs detached)? What dollar value per stall?' },
                    { field: 'basement', label: 'Basement (finished vs unfinished)', note: 'Not in dataset — high impact in Alberta. Finished basement adds ~$30–60k.', samTip: 'Ask Sam: does KV apply a finished basement adjustment? Rate per sqft or flat dollar?' },
                    { field: 'time_adjustment', label: 'Time / market condition adjustment', note: 'AIC requires this when comps are >3 months old. Currently handled narratively only.', samTip: 'Ask Sam: does KV apply a per-month appreciation rate to older comps? What rate — currently market is trending ~+5.2% over 6 months.' },
                    { field: 'lot_sqft', label: 'Lot size', note: 'Stored in DB — adjustment rate TBD.', samTip: 'Ask Sam: does KV adjust for lot size differences, and at what $/sqft?' },
                    { field: 'days_on_market', label: 'Days on market', note: 'Stored in DB — may signal distressed or motivated sale.', samTip: 'Ask Sam: does a high DOM prompt a price adjustment or just a flag?' },
                    { field: 'condition', label: 'Property condition', note: 'Not in dataset — biggest gap vs commercial AVM tools. Drives $100k+ variance on identical structures.', samTip: 'Ask Sam: does KV score condition (renovated / original / needs work)? This is the single biggest unresolved variable in the comp model.' },
                  ].map(item => (
                    <div key={item.field} className="text-[11px] py-2 border-b border-kv-border/60 last:border-0">
                      <div className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-slate-400 font-medium">{item.label}</span>
                          <span className="text-slate-600 ml-2">{item.note}</span>
                          {showSamTips && <p className="text-[10px] text-kv-green/80 bg-kv-blue/10 border border-kv-blue/30 rounded px-2 py-1.5 mt-1.5">💬 {item.samTip}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── COMMERCIAL TAB ── */}
          {tab === 'commercial' && commDraft && (
            <>
              <section>
                <h3 className="text-xs font-semibold text-slate-300 light:text-kv-black uppercase tracking-wider mb-3">
                  Commercial Adjustment Rates
                </h3>
                <p className="text-[10px] text-slate-500 mb-4">
                  Per CUSPAP (AIC), commercial adjustments use percentage-based factors rather than flat dollar values.
                </p>
                <div className="space-y-4">
                  {(Object.keys(COMM_FIELD_META) as (keyof CommercialAdjustmentRates)[]).map(field => {
                    const meta = COMM_FIELD_META[field]
                    const isRate = field === 'age_per_year_pct' || field === 'building_class_pct'
                    return (
                      <div key={field} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-300 light:text-slate-700 font-medium">{meta.label}</label>
                          <span className="text-[10px] text-slate-400 font-mono">{isRate ? fmtPct(commDraft[field]) : commDraft[field]}</span>
                        </div>
                        <input
                          type="number" value={commDraft[field]}
                          step={meta.step} min={0}
                          onChange={e => handleCommChange(field, e.target.value)}
                          className="w-full bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey rounded-lg px-3 py-2 text-sm text-slate-100 light:text-kv-black focus:outline-none focus:border-kv-blue tabular-nums font-mono"
                        />
                        <p className="text-[10px] text-slate-600">{meta.unit} · Source: {meta.source}</p>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Market benchmarks read-only table */}
              {benchmarks && benchmarks.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-300 light:text-kv-black uppercase tracking-wider mb-1">
                    Market Benchmarks
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Cap rate ranges by asset class and city. Source: Altus Group Canadian Cap Rate Report Q4 2024.
                    Updated quarterly via database — read-only here.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-kv-border light:border-kv-grey">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-kv-mid light:bg-kv-beige text-slate-500 uppercase tracking-wider text-[9px]">
                          <th className="text-left px-3 py-2">Asset / Class</th>
                          <th className="text-left px-3 py-2">City</th>
                          <th className="text-right px-3 py-2">Low</th>
                          <th className="text-right px-3 py-2">Mid</th>
                          <th className="text-right px-3 py-2">High</th>
                          <th className="text-right px-3 py-2">Vac%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks.map((bm, i) => (
                          <tr key={bm.id} className={`border-t border-kv-border light:border-kv-grey ${i % 2 === 0 ? 'bg-kv-card light:bg-white' : 'bg-kv-mid/30 light:bg-slate-50'}`}>
                            <td className="px-3 py-2 text-slate-300 light:text-slate-700 font-medium capitalize">
                              {bm.asset_class}{bm.building_class ? ` · ${bm.building_class}` : ''}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{bm.city}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">{fmtPct(bm.cap_rate_low)}</td>
                            <td className="px-3 py-2 text-right font-mono text-kv-green light:text-kv-blue font-semibold">{fmtPct(bm.cap_rate_mid)}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">{fmtPct(bm.cap_rate_high)}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500">{bm.vacancy_rate_typical ?? '—'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-1.5 px-1">
                    Source: {benchmarks[0]?.source_name} · {benchmarks[0]?.source_date}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-kv-border light:border-kv-grey shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (tab === 'residential' && resConfig) setResDraft({ ...resConfig })
              if (tab === 'commercial' && commConfig) setCommDraft({ ...commConfig })
            }}
            disabled={!isDirty || saving}
            className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
          >
            Reset changes
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 bg-kv-blue hover:bg-kv-blue-hover disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
              : saved ? <><Check size={13} /> Saved</>
              : <><Save size={13} /> Save changes</>}
          </button>
        </div>
      </div>
    </>
  )
}
