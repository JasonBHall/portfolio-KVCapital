'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import PropertyForm from '@/components/PropertyForm'
import AgentTrace from '@/components/AgentTrace'
import ValuationReport from '@/components/ValuationReport'
import DataDrawer from '@/components/DataDrawer'
import SettingsDrawer from '@/components/SettingsDrawer'
import CommercialPropertyForm from '@/components/CommercialPropertyForm'
import CommercialReport from '@/components/CommercialReport'
import { streamValuation, streamCommercialValuation, fetchMapPoints } from '@/lib/api'
import { SubjectProperty, AgentTraceStep, ValuationReport as ReportType, CommercialSubjectProperty, CommercialValuationReport } from '@/lib/types'
import { Database, Settings, X, Sun, Moon, ChevronDown } from 'lucide-react'
import { useTheme } from '@/lib/useTheme'

export type AppMode = 'residential' | 'commercial'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export default function Home() {
  const { theme, toggle: toggleTheme }        = useTheme()
  const [mode, setMode]                       = useState<AppMode>('residential')
  const [isLoading, setIsLoading]             = useState(false)
  const [traceSteps, setTraceSteps]           = useState<AgentTraceStep[]>([])
  const [report, setReport]                   = useState<ReportType | null>(null)
  const [commercialReport, setCommercialReport] = useState<CommercialValuationReport | null>(null)
  const [subject, setSubject]                 = useState<SubjectProperty | undefined>()
  const [commercialSubject, setCommercialSubject] = useState<CommercialSubjectProperty | undefined>()
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [drawerMode, setDrawerMode]           = useState<AppMode>('residential')
  const [settingsOpen, setSettingsOpen]       = useState(false)
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false)
  const [traceModalOpen, setTraceModalOpen]   = useState(false)
  const [reportRevealed, setReportRevealed]   = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [mapPoints, setMapPoints]             = useState<Array<{ latitude: number; longitude: number; zone: string; property_type: string }>>([])
  const [modeSwitchCount, setModeSwitchCount] = useState(0)
  const settingsDropdownRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMapPoints().then(setMapPoints).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setSettingsDropdownOpen(false)
      }
    }
    if (settingsDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsDropdownOpen])

  function switchMode() {
    setMode(m => m === 'residential' ? 'commercial' : 'residential')
    setModeSwitchCount(c => c + 1)
    setReport(null)
    setCommercialReport(null)
    setTraceSteps([])
    setError(null)
    setReportRevealed(false)
    setSubject(undefined)
    setCommercialSubject(undefined)
  }

  function openDataDrawer(m: AppMode) {
    setDrawerMode(m)
    setDrawerOpen(true)
    setSettingsDropdownOpen(false)
  }

  const searchRadius = traceSteps.length > 0
    ? ((traceSteps.findLast(s => s.tool === 'search_comps' || s.tool === 'expand_search')
        ?.input) as Record<string, number> | undefined)?.radius_km ?? 2
    : 2

  const handleSubmit = useCallback(async (subjectProp: SubjectProperty) => {
    setIsLoading(true)
    setTraceSteps([])
    setReport(null)
    setError(null)
    setReportRevealed(false)
    setSubject(subjectProp)
    setTraceModalOpen(true)

    try {
      for await (const event of streamValuation(subjectProp)) {
        if (event.type === 'trace_step') {
          setTraceSteps(prev => [...prev, event.step])
        } else if (event.type === 'report') {
          setReport(event.report)
        } else if (event.type === 'done') {
          setIsLoading(false)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }, [])

  const handleCommercialSubmit = useCallback(async (subjectProp: CommercialSubjectProperty) => {
    setIsLoading(true)
    setTraceSteps([])
    setCommercialReport(null)
    setCommercialSubject(subjectProp)
    setError(null)
    setReportRevealed(false)
    setTraceModalOpen(true)

    try {
      for await (const event of streamCommercialValuation(subjectProp)) {
        if (event.type === 'trace_step') {
          setTraceSteps(prev => [...prev, event.step])
        } else if (event.type === 'report') {
          setCommercialReport(event.report)
        } else if (event.type === 'done') {
          setIsLoading(false)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-kv-black light:bg-kv-beige text-slate-100 light:text-kv-black transition-colors duration-300">

      {/* ── Agent Trace Modal ── */}
      {traceModalOpen && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6" style={{ zIndex: 1100 }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-kv-black/60 light:bg-slate-200/70 backdrop-blur-md" />

          {/* Modal panel */}
          <div className="relative z-10 w-full sm:max-w-2xl max-h-[80vh] sm:rounded-xl rounded-t-xl bg-kv-card light:bg-white border border-kv-border light:border-kv-grey shadow-2xl flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-kv-border/60 light:border-kv-grey shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100 light:text-kv-black">Agent Trace</span>
                {isLoading && (
                  <span className="text-[10px] text-kv-blue light:text-kv-blue bg-kv-blue/10 light:bg-kv-blue/10 border border-kv-blue/40 light:border-kv-blue/30 px-2 py-0.5 rounded-full animate-pulse">
                    Running
                  </span>
                )}
                {!isLoading && (
                  <span className="text-[10px] text-emerald-400 light:text-emerald-700 bg-emerald-950/50 light:bg-emerald-50 border border-emerald-800 light:border-emerald-300 px-2 py-0.5 rounded-full">
                    Complete
                  </span>
                )}
              </div>
              <button
                onClick={() => { setTraceModalOpen(false); setReportRevealed(true) }}
                className="text-slate-500 hover:text-slate-200 light:text-slate-400 light:hover:text-slate-900 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable trace content */}
            <div className="flex-1 overflow-y-auto">
              <AgentTrace steps={traceSteps} isRunning={isLoading} />
            </div>

            {/* Dismiss button */}
            <div className="px-5 py-4 border-t border-kv-border/60 light:border-kv-grey shrink-0 flex justify-center">
              <button
                onClick={() => { setTraceModalOpen(false); setReportRevealed(true) }}
                className="px-8 py-2.5 rounded-lg text-sm font-medium transition-colors bg-kv-mid hover:bg-kv-mid light:bg-slate-100 light:hover:bg-kv-grey text-slate-200 light:text-slate-800 border border-slate-600 light:border-slate-300 hover:border-slate-500 light:hover:border-kv-grey"
              >
                {isLoading ? 'Dismiss — continue in background' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="border-b border-kv-border/60 light:border-kv-grey bg-kv-black light:bg-white px-6 py-4 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-4">
          {/* Logo — invert in dark mode so grey text becomes white */}
          <img
            src="/logo.png"
            alt="KV Capital"
            className="h-8 w-auto dark:invert light:invert-0"
            style={{ filter: 'var(--logo-filter)' }}
          />
          <p className="text-xs text-slate-500 light:text-slate-600 border-l border-kv-border light:border-kv-grey pl-4">
            {mode === 'residential' ? 'Comp Analysis · AI Underwriting Assistant' : 'Commercial Valuation · Income Approach'}
          </p>
        </div>
        <div className="flex items-center gap-2">

          {/* Mode switch */}
          <button
            onClick={switchMode}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors text-kv-green border-kv-green/40 hover:border-kv-green hover:bg-kv-green/5 light:text-emerald-700 light:border-emerald-300 light:hover:border-emerald-500 light:hover:bg-emerald-50"
          >
            {mode === 'residential' ? 'Switch to Commercial' : 'Switch to Residential'}
          </button>

          {/* Settings dropdown */}
          <div ref={settingsDropdownRef} className="relative">
            <button
              onClick={() => setSettingsDropdownOpen(o => !o)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-900 border border-kv-border hover:border-slate-500 light:border-kv-grey light:hover:border-kv-grey px-3 py-2 rounded-lg transition-colors"
            >
              <Settings size={13} />
              Settings
              <ChevronDown size={11} className={`transition-transform duration-150 ${settingsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {settingsDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-kv-card light:bg-white border border-kv-border light:border-kv-grey rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 1050 }}>

                {/* Theme toggle */}
                <button
                  onClick={() => { toggleTheme(); setSettingsDropdownOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-left text-slate-300 light:text-slate-700 hover:bg-kv-mid/70 light:hover:bg-kv-beige transition-colors"
                >
                  {theme === 'dark' ? <Sun size={13} className="text-slate-400" /> : <Moon size={13} className="text-slate-400" />}
                  {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>

                <div className="border-t border-kv-border/60 light:border-kv-grey" />

                {/* Residential settings */}
                <button
                  onClick={() => { setSettingsOpen(true); setSettingsDropdownOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-left text-slate-300 light:text-slate-700 hover:bg-kv-mid/70 light:hover:bg-kv-beige transition-colors"
                >
                  <Settings size={13} className="text-slate-400" />
                  Residential Settings
                </button>

                {/* Manage residential data */}
                <button
                  onClick={() => openDataDrawer('residential')}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-left text-slate-300 light:text-slate-700 hover:bg-kv-mid/70 light:hover:bg-kv-beige transition-colors"
                >
                  <Database size={13} className="text-slate-400" />
                  Manage Residential Data
                </button>

                <div className="border-t border-kv-border/60 light:border-kv-grey" />

                {/* Manage commercial data */}
                <button
                  onClick={() => openDataDrawer('commercial')}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-left text-slate-300 light:text-slate-700 hover:bg-kv-mid/70 light:hover:bg-kv-beige transition-colors"
                >
                  <Database size={13} className="text-slate-400" />
                  Manage Commercial Data
                </button>

              </div>
            )}
          </div>

        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {mode === 'residential' ? (
          <>
            {/* Row 1: Subject Property + Map */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
              <div className="lg:col-span-2">
                <PropertyForm onSubmit={handleSubmit} isLoading={isLoading} />
              </div>
              <div className="lg:col-span-3 flex flex-col">
                <MapView
                  subject={subject}
                  comps={report?.comps}
                  allProperties={mapPoints}
                  searchRadiusKm={searchRadius}
                  sizeTrigger={modeSwitchCount}
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-700 rounded-xl px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            {report && reportRevealed && (
              <ValuationReport
                report={report}
                subject={subject}
                traceSteps={traceSteps}
                isRunning={isLoading}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenTrace={() => setTraceModalOpen(true)}
              />
            )}
          </>
        ) : (
          <>
            {/* Row 1: Form + Map — mirrors residential layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
              <div className="lg:col-span-2">
                <CommercialPropertyForm onSubmit={handleCommercialSubmit} isLoading={isLoading} />
              </div>
              <div className="lg:col-span-3 flex flex-col">
                <MapView
                  subject={commercialSubject}
                  comps={commercialReport?.comps}
                  searchRadiusKm={searchRadius}
                  sizeTrigger={modeSwitchCount}
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-700 rounded-xl px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            {commercialReport && reportRevealed && (
              <CommercialReport
                report={commercialReport}
                traceSteps={traceSteps}
                isRunning={isLoading}
                onOpenSettings={() => setSettingsOpen(true)}
                subjectSqft={commercialSubject?.gba_sqft ?? commercialSubject?.nra_sqft}
                subjectUnits={commercialSubject?.num_units}
                subject={commercialSubject}
              />
            )}
          </>
        )}
      </main>

      <DataDrawer    open={drawerOpen}    onClose={() => setDrawerOpen(false)} mode={drawerMode} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
