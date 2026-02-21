'use client'

import { useState, useEffect, useCallback } from 'react'
import { VolumeChart } from '@/components/analytics/volume-chart'
import { MethodChart } from '@/components/analytics/method-chart'
import { TopEndpoints } from '@/components/analytics/top-endpoints'
import type { AnalyticsResponse } from '@/types'

type Range = 7 | 30 | 90

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (selectedRange: Range) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/analytics?range=${selectedRange}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json: AnalyticsResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics(range)
  }, [range, fetchAnalytics])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
          <p className="mt-1 text-sm text-text-muted">
            Webhook traffic patterns and endpoint activity.
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                range === option.value
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => fetchAnalytics(range)}
            className="mt-2 text-xs text-red-400 underline transition-colors hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="h-[280px] animate-pulse rounded-lg border border-border bg-surface" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[240px] animate-pulse rounded-lg border border-border bg-surface" />
            <div className="h-[240px] animate-pulse rounded-lg border border-border bg-surface" />
          </div>
        </div>
      )}

      {/* Charts */}
      {data && (
        <div className={`space-y-6 ${loading ? 'opacity-50' : ''}`}>
          <VolumeChart data={data.volumeByDay} />

          <div className="grid gap-6 lg:grid-cols-2">
            <MethodChart data={data.methodBreakdown} />
            <TopEndpoints data={data.topEndpoints} />
          </div>
        </div>
      )}
    </div>
  )
}
