'use client'

import { useEffect, useRef } from 'react'
import { useIsDark } from '@/lib/useTheme'

// Minimal interfaces — satisfied by both residential and commercial types
interface MapSubject {
  latitude: number
  longitude: number
  address: string
}

interface MapComp {
  latitude: number
  longitude: number
  address: string
  sale_price: number
  adjusted_price: number
  is_outlier: boolean
}

interface Props {
  subject?: MapSubject
  comps?: MapComp[]
  allProperties?: Array<{ latitude: number; longitude: number; zone: string; property_type: string }>
  searchRadiusKm?: number
  sizeTrigger?: number
}

const ZONE_COLORS: Record<string, string> = {
  urban_dense:      '#3b82f6',
  suburban_sparse:  '#a78bfa',
  rural:            '#34d399',
  edge_case:        '#f87171',
}

const DARK_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

export default function MapView({ subject, comps, allProperties, searchRadiusKm, sizeTrigger }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const tileLayerRef  = useRef<L.TileLayer | null>(null)
  const isDark = useIsDark()
  // Ref so async Leaflet callbacks always read the current value, not a stale closure
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    import('leaflet').then(L => {
      if (mapRef.current) return
      const map = L.map(containerRef.current!, {
        center: [53.5461, -113.4938],
        zoom: 10,
        zoomControl: true,
      })
      // Use isDarkRef.current — resolved after effects have run, so it reflects the correct theme
      tileLayerRef.current = L.tileLayer(isDarkRef.current ? DARK_TILE : LIGHT_TILE, {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
      layerGroupRef.current = L.layerGroup().addTo(map)
    })
  }, [])

  // Swap tile layer when theme changes (handles toggles after initial load)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return
    import('leaflet').then(() => {
      tileLayerRef.current!.setUrl(isDark ? DARK_TILE : LIGHT_TILE)
    })
  }, [isDark])

  // Re-measure the container after mode switches resize it
  useEffect(() => {
    if (sizeTrigger === undefined || !mapRef.current) return
    // Small delay lets the DOM finish reflowing before Leaflet measures
    const t = setTimeout(() => mapRef.current!.invalidateSize(), 50)
    return () => clearTimeout(t)
  }, [sizeTrigger])

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return
    import('leaflet').then(L => {
      layerGroupRef.current!.clearLayers()

      allProperties?.forEach(p => {
        L.circleMarker([p.latitude, p.longitude], {
          radius: 3,
          color: ZONE_COLORS[p.zone] ?? '#94a3b8',
          fillColor: ZONE_COLORS[p.zone] ?? '#94a3b8',
          fillOpacity: 0.5,
          weight: 0,
        })
          .bindTooltip(`${p.property_type} · ${p.zone}`, { direction: 'top' })
          .addTo(layerGroupRef.current!)
      })

      if (subject && searchRadiusKm) {
        L.circle([subject.latitude, subject.longitude], {
          radius: searchRadiusKm * 1000,
          color: '#006D94',
          fillColor: '#006D94',
          fillOpacity: 0.06,
          weight: 1,
          dashArray: '4 4',
        }).addTo(layerGroupRef.current!)
      }

      comps?.forEach(comp => {
        const color = comp.is_outlier ? '#f87171' : '#C4D82E'
        L.circleMarker([comp.latitude, comp.longitude], {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(
            `<b>${comp.address}</b><br/>$${comp.sale_price.toLocaleString()} → adj $${comp.adjusted_price.toLocaleString()}${comp.is_outlier ? '<br/>⚠ Outlier' : ''}`,
            { direction: 'top' }
          )
          .addTo(layerGroupRef.current!)
      })

      if (subject) {
        const subjectIcon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;background:#006D94;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(0,109,148,0.8)"></div>`,
          iconAnchor: [7, 7],
        })
        L.marker([subject.latitude, subject.longitude], { icon: subjectIcon })
          .bindTooltip(`<b>Subject: ${subject.address}</b>`, { direction: 'top', permanent: false })
          .addTo(layerGroupRef.current!)
        mapRef.current!.setView([subject.latitude, subject.longitude], 11)
      }
    })
  }, [subject, comps, allProperties, searchRadiusKm])

  return (
    <div className="bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl overflow-hidden flex flex-col h-full transition-colors duration-300">
      <div className="flex items-center justify-between px-4 py-2 border-b border-kv-border light:border-kv-grey shrink-0">
        <span className="text-xs font-semibold text-slate-400 light:text-slate-600 uppercase tracking-wider">Property Map</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 light:text-slate-400">
          <Dot color="#3b82f6" label="Urban" />
          <Dot color="#a78bfa" label="Suburban" />
          <Dot color="#34d399" label="Rural" />
          <Dot color="#f87171" label="Edge" />
          <Dot color="#C4D82E" label="Comp" />
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-64 w-full" />
    </div>
  )
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div style={{ background: color }} className="w-2 h-2 rounded-full" />
      <span>{label}</span>
    </div>
  )
}
