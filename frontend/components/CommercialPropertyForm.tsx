'use client'

import { useState } from 'react'
import { CommercialSubjectProperty } from '@/lib/types'
import { Building2, Loader2 } from 'lucide-react'

const ASSET_CLASSES = ['industrial', 'office', 'multifamily'] as const
const BUILDING_CLASSES = ['A', 'B', 'C'] as const
const LEASE_TYPES = ['NNN', 'gross', 'modified_gross'] as const
const LEASE_TYPE_LABEL: Record<string, string> = {
  NNN: 'NNN',
  gross: 'Gross',
  modified_gross: 'Modified Gross',
}

const DEMO_PRESETS: Record<string, Partial<CommercialSubjectProperty>> = {
  'Industrial — High Confidence': {
    address: '142 Commerce Way', city: 'Edmonton', latitude: 53.583, longitude: -113.405,
    asset_class: 'industrial', year_built: 2010, gba_sqft: 24000,
    noi: 204000, occupancy_pct: 97, lease_type: 'NNN',
  },
  'Office Class B — Medium Confidence': {
    address: 'Suite 200, 340 Terwillegar Dr', city: 'Edmonton', latitude: 53.525, longitude: -113.608,
    asset_class: 'office', building_class: 'B', year_built: 2005, nra_sqft: 8500,
    noi: 85000, occupancy_pct: 84, lease_type: 'gross',
  },
  'Multifamily — High Confidence': {
    address: '1440 Whyte Ave', city: 'Edmonton', latitude: 53.545, longitude: -113.498,
    asset_class: 'multifamily', year_built: 1998, num_units: 12,
    noi: 148000, occupancy_pct: 96,
  },
  'Industrial — No Income Data': {
    address: '88 Meridian St', city: 'Edmonton', latitude: 53.612, longitude: -113.355,
    asset_class: 'industrial', year_built: 2003, gba_sqft: 18000,
    lease_type: 'NNN',
  },
}

const DEFAULT: CommercialSubjectProperty = {
  address: '', city: 'Edmonton', province: 'AB',
  latitude: 53.583, longitude: -113.405,
  asset_class: 'industrial', year_built: 2010,
  gba_sqft: 20000,
}

interface Props {
  onSubmit: (subject: CommercialSubjectProperty) => void
  isLoading: boolean
}

export default function CommercialPropertyForm({ onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<CommercialSubjectProperty>(DEFAULT)
  const [showIncome, setShowIncome] = useState(true)

  function set<K extends keyof CommercialSubjectProperty>(key: K, val: CommercialSubjectProperty[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setAssetClass(cls: CommercialSubjectProperty['asset_class']) {
    // Clear size fields that don't apply to the new class
    setForm(f => ({
      ...f,
      asset_class: cls,
      gba_sqft:    cls === 'industrial' ? (f.gba_sqft ?? 20000) : undefined,
      nra_sqft:    cls === 'office'     ? (f.nra_sqft ?? 8000)  : undefined,
      num_units:   cls === 'multifamily'? (f.num_units ?? 12)   : undefined,
      building_class: cls === 'office'  ? (f.building_class ?? 'B') : undefined,
      lease_type: cls === 'multifamily' ? 'gross' : f.lease_type,
      latitude:   cls === 'industrial'  ? 53.583  : cls === 'office' ? 53.525 : 53.545,
      longitude:  cls === 'industrial'  ? -113.405 : cls === 'office' ? -113.608 : -113.498,
    }))
  }

  function applyPreset(name: string) {
    const preset = DEMO_PRESETS[name]
    if (!preset) return
    setForm({ ...DEFAULT, ...preset, province: 'AB' })
    setShowIncome(!!(preset.noi || preset.occupancy_pct))
  }

  function handleSubmit() {
    // Strip undefined optional fields before sending
    const payload: CommercialSubjectProperty = { ...form }
    if (!payload.noi) delete payload.noi
    if (!payload.occupancy_pct) delete payload.occupancy_pct
    if (!payload.gba_sqft) delete payload.gba_sqft
    if (!payload.nra_sqft) delete payload.nra_sqft
    if (!payload.num_units) delete payload.num_units
    if (!payload.building_class) delete payload.building_class
    if (!payload.lease_type) delete payload.lease_type
    onSubmit(payload)
  }

  const isIndustrial  = form.asset_class === 'industrial'
  const isOffice      = form.asset_class === 'office'
  const isMultifamily = form.asset_class === 'multifamily'

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 space-y-4 transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200 light:text-kv-black">Commercial Property</h2>
        <select
          className="text-xs bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey text-slate-300 light:text-slate-700 rounded-lg px-2 py-1.5 cursor-pointer transition-colors"
          defaultValue=""
          onChange={e => e.target.value && applyPreset(e.target.value)}
        >
          <option value="" disabled>Load demo preset…</option>
          {Object.keys(DEMO_PRESETS).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">

        {/* Address */}
        <div className="col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={v => set('address', v)} placeholder="123 Commerce Way" />
        </div>

        {/* City */}
        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={v => set('city', v)} placeholder="Edmonton" />
        </div>

        {/* Asset Class */}
        <div>
          <Label>Asset Class</Label>
          <select
            className={selectCls}
            value={form.asset_class}
            onChange={e => setAssetClass(e.target.value as CommercialSubjectProperty['asset_class'])}
          >
            {ASSET_CLASSES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Year Built */}
        <div>
          <Label>Year Built</Label>
          <Input type="number" value={String(form.year_built)} onChange={v => set('year_built', +v)} min="1950" max="2030" />
        </div>

        {/* Building Class (office only) */}
        {isOffice && (
          <div>
            <Label>Building Class</Label>
            <select
              className={selectCls}
              value={form.building_class ?? 'B'}
              onChange={e => set('building_class', e.target.value as 'A' | 'B' | 'C')}
            >
              {BUILDING_CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
        )}

        {/* Size field — varies by asset class */}
        {isIndustrial && (
          <div>
            <Label>GBA (sqft)</Label>
            <Input type="number" value={String(form.gba_sqft ?? '')} onChange={v => set('gba_sqft', +v || undefined)} placeholder="20000" min="1000" />
          </div>
        )}
        {isOffice && (
          <div>
            <Label>NRA (sqft)</Label>
            <Input type="number" value={String(form.nra_sqft ?? '')} onChange={v => set('nra_sqft', +v || undefined)} placeholder="8000" min="500" />
          </div>
        )}
        {isMultifamily && (
          <div>
            <Label>Number of Units</Label>
            <Input type="number" value={String(form.num_units ?? '')} onChange={v => set('num_units', +v || undefined)} placeholder="12" min="5" />
          </div>
        )}

        {/* Lat / Lng */}
        <div>
          <Label>Latitude</Label>
          <Input type="number" value={String(form.latitude)} onChange={v => set('latitude', +v)} step="0.0001" />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" value={String(form.longitude)} onChange={v => set('longitude', +v)} step="0.0001" />
        </div>
      </div>

      {/* Income section toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowIncome(s => !s)}
          className="flex items-center gap-1.5 text-[10px] text-slate-500 light:text-slate-600 hover:text-kv-green light:hover:text-kv-blue uppercase tracking-wider transition-colors"
        >
          <span className={`transition-transform duration-150 ${showIncome ? 'rotate-90' : ''}`}>▶</span>
          Income Data
          <span className="text-slate-600 light:text-slate-400 normal-case tracking-normal ml-1">(optional — enables income approach)</span>
        </button>

        {showIncome && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="col-span-2">
              <Label>Annual NOI ($)</Label>
              <Input
                type="number"
                value={String(form.noi ?? '')}
                onChange={v => set('noi', +v || undefined)}
                placeholder="e.g. 204000"
                min="0"
              />
            </div>
            <div>
              <Label>Occupancy (%)</Label>
              <Input
                type="number"
                value={String(form.occupancy_pct ?? '')}
                onChange={v => set('occupancy_pct', +v || undefined)}
                placeholder="e.g. 95"
                min="0" max="100"
              />
            </div>
            {!isMultifamily && (
              <div>
                <Label>Lease Type</Label>
                <select
                  className={selectCls}
                  value={form.lease_type ?? ''}
                  onChange={e => set('lease_type', e.target.value as CommercialSubjectProperty['lease_type'] || undefined)}
                >
                  <option value="">Select…</option>
                  {LEASE_TYPES.map(t => <option key={t} value={t}>{LEASE_TYPE_LABEL[t]}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source citation */}
      <p className="text-[10px] text-slate-600 light:text-slate-500">
        Methodology: CUSPAP (AIC) · Market benchmarks: Altus Group Canadian Cap Rate Report Q4 2024
      </p>

      <button
        onClick={handleSubmit}
        disabled={isLoading || !form.address}
        className="w-full flex items-center justify-center gap-2 bg-kv-blue hover:bg-kv-blue-hover disabled:bg-kv-mid light:disabled:bg-slate-200 disabled:text-slate-500 light:disabled:text-slate-400 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
      >
        {isLoading
          ? <><Loader2 size={14} className="animate-spin" /> Running analysis…</>
          : <><Building2 size={14} /> Run Commercial Valuation</>
        }
      </button>
    </div>
  )
}

const inputCls = 'w-full bg-kv-mid light:bg-kv-beige border border-kv-border light:border-kv-grey text-slate-200 light:text-kv-black text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-kv-blue transition-colors'
const selectCls = `${inputCls} cursor-pointer`

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-slate-400 light:text-slate-500 mb-1">{children}</label>
}

function Input({ onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { onChange: (v: string) => void }) {
  return <input {...props} className={inputCls} onChange={e => onChange(e.target.value)} />
}
