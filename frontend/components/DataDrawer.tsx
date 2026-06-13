'use client'

import { useState, useEffect } from 'react'
import { fetchSeeds, regenerateData, saveSeed } from '@/lib/api'
import { SeedInfo } from '@/lib/types'
import { X, RefreshCw, Save, Loader2, Check } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  mode?: 'residential' | 'commercial'
}

export default function DataDrawer({ open, onClose, mode = 'residential' }: Props) {
  const [seeds, setSeeds]           = useState<SeedInfo[]>([])
  const [seed, setSeed]             = useState(42)
  const [target, setTarget]         = useState(900)
  const [seedName, setSeedName]     = useState('')
  const [isRegen, setIsRegen]       = useState(false)
  const [isSaving, setIsSaving]     = useState(false)
  const [regenResult, setRegenResult] = useState<{ record_count: number } | null>(null)

  useEffect(() => {
    if (open) fetchSeeds().then(setSeeds).catch(() => {})
  }, [open])

  async function handleRegenerate() {
    setIsRegen(true)
    setRegenResult(null)
    const result = await regenerateData(seed, target, seedName || undefined)
    setRegenResult(result)
    setIsRegen(false)
    if (seedName) fetchSeeds().then(setSeeds)
  }

  async function handleSaveSeed() {
    if (!seedName) return
    setIsSaving(true)
    await saveSeed(seedName, seed)
    await fetchSeeds().then(setSeeds)
    setSeedName('')
    setIsSaving(false)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" style={{ zIndex: 900 }} onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-kv-card light:bg-white border-l border-kv-border light:border-kv-grey flex flex-col" style={{ zIndex: 1000 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-kv-border light:border-kv-grey">
          <h2 className="font-semibold text-slate-200 light:text-kv-black">
            {mode === 'commercial' ? 'Manage Commercial Data' : 'Manage Residential Data'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Saved seeds */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 light:text-slate-700 uppercase tracking-wider mb-3">Saved Seeds</h3>
            {seeds.length === 0
              ? <p className="text-xs text-slate-500">No saved seeds yet.</p>
              : (
                <div className="space-y-2">
                  {seeds.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey rounded-lg px-3 py-2.5 cursor-pointer hover:border-kv-blue transition-colors"
                      onClick={() => setSeed(s.seed)}
                    >
                      <div>
                        <div className="text-sm text-slate-200 light:text-kv-black font-medium">{s.name}</div>
                        {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-kv-green font-mono">seed {s.seed}</div>
                        {s.record_count && <div className="text-xs text-slate-500">{s.record_count} records</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </section>

          {/* Generator controls */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Generate Dataset</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 light:text-slate-600 block mb-1">Seed</label>
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(+e.target.value)}
                  className="w-full bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey text-slate-200 light:text-kv-black text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-kv-blue"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 light:text-slate-600 block mb-1">Target records</label>
                <input
                  type="number"
                  value={target}
                  onChange={e => setTarget(+e.target.value)}
                  className="w-full bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey text-slate-200 light:text-kv-black text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-kv-blue"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 light:text-slate-600 block mb-1">Save as (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seedName}
                  onChange={e => setSeedName(e.target.value)}
                  placeholder="e.g. Demo: Rural"
                  className="flex-1 bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey text-slate-200 light:text-kv-black text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-kv-blue"
                />
                <button
                  onClick={handleSaveSeed}
                  disabled={!seedName || isSaving}
                  className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg transition-colors"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={isRegen}
              className="w-full flex items-center justify-center gap-2 bg-kv-blue hover:bg-kv-blue-hover disabled:bg-kv-mid disabled:text-slate-500 text-slate-950 font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              {isRegen
                ? <><Loader2 size={14} className="animate-spin" /> Regenerating…</>
                : <><RefreshCw size={14} /> Regenerate Data</>
              }
            </button>

            {regenResult && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-800 rounded-lg px-3 py-2">
                <Check size={14} />
                {regenResult.record_count} records generated with seed {seed}
              </div>
            )}
          </section>

          {/* Zone legend */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 light:text-slate-700 uppercase tracking-wider mb-3">Zone Guide</h3>
            <div className="space-y-2 text-xs">
              <ZoneRow color="#3b82f6" name="Urban Dense" desc="50–80 comps/area · high confidence path" />
              <ZoneRow color="#a78bfa" name="Suburban Sparse" desc="15–25 comps/area · 1 expansion path" />
              <ZoneRow color="#34d399" name="Rural" desc="3–8 comps/area · 2 expansion path" />
              <ZoneRow color="#f87171" name="Edge Cases" desc="Outliers, zero-comp, high variance" />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function ZoneRow({ color, name, desc }: { color: string; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <div style={{ background: color }} className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" />
      <div>
        <span className="text-slate-300 light:text-slate-700 font-medium">{name}</span>
        <span className="text-slate-500"> — {desc}</span>
      </div>
    </div>
  )
}
