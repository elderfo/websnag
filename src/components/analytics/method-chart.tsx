'use client'

import type { MethodBreakdown } from '@/types'

interface MethodChartProps {
  data: MethodBreakdown[]
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#3b82f6', // blue
  POST: '#22c55e', // green
  PUT: '#f97316', // orange
  DELETE: '#ef4444', // red
  PATCH: '#a855f7', // purple
  HEAD: '#6b7280', // gray
  OPTIONS: '#8b5cf6', // violet
}

function getMethodColor(method: string): string {
  return METHOD_COLORS[method] ?? '#6b7280'
}

export function MethodChart({ data }: MethodChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-text-muted">No request data for this period</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const totalRequests = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-text-primary">Method Breakdown</h3>
        <p className="font-mono text-xs text-text-muted">
          {data.length} method{data.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div
        className="space-y-3"
        role="img"
        aria-label={`Horizontal bar chart showing HTTP method breakdown. ${data.map((d) => `${d.method}: ${d.count}`).join(', ')}.`}
      >
        {data.map((d) => {
          const pct = (d.count / maxCount) * 100
          const totalPct = totalRequests > 0 ? ((d.count / totalRequests) * 100).toFixed(1) : '0'
          return (
            <div key={d.method} className="flex items-center gap-3">
              <span
                className="w-16 shrink-0 text-right font-mono text-xs font-semibold"
                style={{ color: getMethodColor(d.method) }}
              >
                {d.method}
              </span>

              <div className="relative h-6 flex-1 overflow-hidden rounded bg-white/5">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: getMethodColor(d.method),
                    opacity: 0.7,
                  }}
                />
              </div>

              <span className="w-20 shrink-0 text-right font-mono text-xs text-text-secondary">
                {d.count.toLocaleString()} <span className="text-text-muted">({totalPct}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
