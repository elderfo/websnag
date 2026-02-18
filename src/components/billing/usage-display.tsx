'use client'

import { useUsage } from '@/hooks/use-usage'
import { LIMITS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

function getProgressColor(percentage: number): string {
  if (percentage > 80) return 'bg-red-500'
  if (percentage > 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

interface ProgressBarProps {
  current: number
  max: number
  label: string
}

function ProgressBar({ current, max, label }: ProgressBarProps) {
  const isUnlimited = !isFinite(max)
  const percentage = isUnlimited ? 0 : Math.min((current / max) * 100, 100)
  const colorClass = getProgressColor(percentage)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-primary">
          {current} / {isUnlimited ? 'Unlimited' : max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        {!isUnlimited && (
          <div
            className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label}
          />
        )}
        {isUnlimited && (
          <div
            className="h-full w-full rounded-full bg-accent/30"
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={0}
            aria-label={label}
          />
        )}
      </div>
    </div>
  )
}

export function UsageDisplay() {
  const { usage, loading } = useUsage()

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-24 rounded bg-white/5" />
          <div className="h-2 w-full rounded bg-white/5" />
          <div className="h-2 w-full rounded bg-white/5" />
        </div>
      </Card>
    )
  }

  if (!usage) {
    return null
  }

  const limits = LIMITS[usage.plan]

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-text-primary">Current Usage</h3>
          <Badge variant={usage.plan === 'pro' ? 'success' : 'default'}>
            {usage.plan === 'pro' ? 'Pro' : 'Free'}
          </Badge>
        </div>

        <ProgressBar
          current={usage.requestCount}
          max={limits.maxRequestsPerMonth}
          label="Requests this month"
        />

        <ProgressBar
          current={usage.aiAnalysisCount}
          max={limits.maxAiAnalysesPerMonth}
          label="AI analyses this month"
        />
      </div>
    </Card>
  )
}
