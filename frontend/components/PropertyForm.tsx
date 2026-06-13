'use client'

import { useState } from 'react'
import { SubjectProperty } from '@/lib/types'
import { MapPin, Loader2 } from 'lucide-react'

const PROPERTY_TYPES = ['detached', 'semi-detached', 'townhouse', 'condo'] as const
const PROPERTY_TYPE_LABEL: Record<string, string> = {
  detached: 'Detached',
  'semi-detached': 'Semi-Detached',
  townhouse: 'Townhouse',
  condo: 'Condo',
}

const DEMO_PRESETS: Record<string, Partial<SubjectProperty>> = {
  'Urban — High Confidence': {
    address: '142 Glenora Dr', city: 'Edmonton', latitude: 53.5461, longitude: -113.4938,
    property_type: 'detached', bedrooms: 3, bathrooms: 2, sqft: 1450, year_built: 2005,
  },
  'Suburban — 1 Expansion': {
    address: '88 Heritage Valley Blvd', city: 'Leduc', latitude: 53.2594, longitude: -113.5497,
    property_type: 'detached', bedrooms: 3, bathrooms: 2, sqft: 1350, year_built: 2003,
  },
  'Rural — Low Confidence': {
    address: '22 Creekside Rd', city: 'Morinville', latitude: 53.7997, longitude: -113.6497,
    property_type: 'detached', bedrooms: 4, bathrooms: 2, sqft: 1600, year_built: 1998,
  },
  'Edge — No Comps': {
    address: '1 Isolated Rd', city: 'Radway', latitude: 54.0833, longitude: -113.4500,
    property_type: 'detached', bedrooms: 3, bathrooms: 2, sqft: 1400, year_built: 1998,
  },
}

const DEFAULT: SubjectProperty = {
  address: '', city: 'Edmonton', province: 'AB',
  latitude: 53.5461, longitude: -113.4938,
  property_type: 'detached', bedrooms: 3, bathrooms: 2, sqft: 1400, year_built: 2005,
}

interface Props {
  onSubmit: (subject: SubjectProperty) => void
  isLoading: boolean
}

export default function PropertyForm({ onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<SubjectProperty>(DEFAULT)

  function set<K extends keyof SubjectProperty>(key: K, val: SubjectProperty[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function applyPreset(name: string) {
    setForm(f => ({ ...f, ...DEMO_PRESETS[name], province: 'AB' }))
  }

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl p-5 space-y-4 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200 light:text-kv-black">Subject Property</h2>
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
        <div className="col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={v => set('address', v)} placeholder="123 Maple St" />
        </div>

        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={v => set('city', v)} placeholder="Edmonton" />
        </div>

        <div>
          <Label>Type</Label>
          <select
            className={selectCls}
            value={form.property_type}
            onChange={e => set('property_type', e.target.value as SubjectProperty['property_type'])}
          >
            {PROPERTY_TYPES.map(t => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
          </select>
        </div>

        <div>
          <Label>Bedrooms</Label>
          <Input type="number" value={String(form.bedrooms)} onChange={v => set('bedrooms', +v)} min="1" max="10" />
        </div>

        <div>
          <Label>Bathrooms</Label>
          <Input type="number" value={String(form.bathrooms)} onChange={v => set('bathrooms', +v)} min="1" max="10" step="0.5" />
        </div>

        <div>
          <Label>Sqft</Label>
          <Input type="number" value={String(form.sqft)} onChange={v => set('sqft', +v)} min="100" />
        </div>

        <div>
          <Label>Year Built</Label>
          <Input type="number" value={String(form.year_built)} onChange={v => set('year_built', +v)} min="1900" max="2030" />
        </div>

        <div>
          <Label>Latitude</Label>
          <Input type="number" value={String(form.latitude)} onChange={v => set('latitude', +v)} step="0.0001" />
        </div>

        <div>
          <Label>Longitude</Label>
          <Input type="number" value={String(form.longitude)} onChange={v => set('longitude', +v)} step="0.0001" />
        </div>
      </div>

      <button
        onClick={() => onSubmit(form)}
        disabled={isLoading || !form.address}
        className="w-full flex items-center justify-center gap-2 bg-kv-blue hover:bg-kv-blue-hover disabled:bg-kv-mid light:disabled:bg-slate-200 disabled:text-slate-500 light:disabled:text-slate-400 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
      >
        {isLoading
          ? <><Loader2 size={14} className="animate-spin" /> Running analysis…</>
          : <><MapPin size={14} /> Run Comp Analysis</>
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
  return (
    <input
      {...props}
      className={inputCls}
      onChange={e => onChange(e.target.value)}
    />
  )
}
