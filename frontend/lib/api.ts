import { SubjectProperty, TraceEvent, AppConfig, CommercialSubjectProperty, CommercialTraceEvent, CommercialAdjustmentRates, MarketBenchmark } from './types'

const API_BASE = ''  // proxied through Next.js rewrites → http://localhost:8000

export async function* streamValuation(
  subject: SubjectProperty
): AsyncGenerator<TraceEvent> {
  const res = await fetch(`${API_BASE}/api/valuations/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  })

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as TraceEvent
        } catch {}
      }
    }
  }
}

export async function fetchSeeds() {
  const res = await fetch(`${API_BASE}/api/admin/seeds`)
  return res.json()
}

export async function regenerateData(seed: number, target: number, seedName?: string) {
  const res = await fetch(`${API_BASE}/api/admin/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, target, seed_name: seedName }),
  })
  return res.json()
}

export async function fetchMapPoints() {
  const res = await fetch(`${API_BASE}/api/properties/map`)
  return res.json()
}

export async function saveSeed(name: string, seed: number, description?: string) {
  const res = await fetch(`${API_BASE}/api/admin/seeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, seed_name: name, seed_description: description }),
  })
  return res.json()
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/api/admin/config`)
  if (!res.ok) throw new Error('Failed to load config')
  return res.json()
}

export async function* streamCommercialValuation(
  subject: CommercialSubjectProperty
): AsyncGenerator<CommercialTraceEvent> {
  const res = await fetch(`${API_BASE}/api/commercial/valuations/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  })

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as CommercialTraceEvent
        } catch {}
      }
    }
  }
}

export async function fetchCommercialConfig(): Promise<CommercialAdjustmentRates> {
  const res = await fetch(`${API_BASE}/api/admin/commercial/config`)
  if (!res.ok) throw new Error('Failed to load commercial config')
  return res.json()
}

export async function updateCommercialConfig(config: CommercialAdjustmentRates): Promise<CommercialAdjustmentRates> {
  const res = await fetch(`${API_BASE}/api/admin/commercial/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Failed to save commercial config')
  return res.json()
}

export async function fetchMarketBenchmarks(): Promise<MarketBenchmark[]> {
  const res = await fetch(`${API_BASE}/api/admin/commercial/benchmarks`)
  if (!res.ok) throw new Error('Failed to load benchmarks')
  return res.json()
}

export async function updateConfig(config: AppConfig): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/api/admin/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Failed to save config')
  return res.json()
}
