'use client'

import Link from 'next/link'
import type { TopEndpoint } from '@/app/api/analytics/route'

interface TopEndpointsProps {
  data: TopEndpoint[]
}

export function TopEndpoints({ data }: TopEndpointsProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-text-muted">No endpoint data for this period</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-text-primary">Top Endpoints</h3>
        <p className="font-mono text-xs text-text-muted">by request count</p>
      </div>

      <div className="space-y-3">
        {data.map((d, i) => {
          const pct = (d.count / maxCount) * 100
          return (
            <div key={d.id} className="group">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-xs text-text-muted">{i + 1}.</span>
                  <Link
                    href={`/endpoints/${d.id}`}
                    className="truncate text-sm font-medium text-text-primary transition-colors group-hover:text-accent"
                  >
                    {d.name}
                  </Link>
                  <span className="hidden shrink-0 font-mono text-xs text-text-muted sm:inline">
                    /wh/{d.slug}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs text-text-secondary">
                  {d.count.toLocaleString()}
                </span>
              </div>

              <div className="ml-6 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    opacity: 1 - i * 0.08,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
