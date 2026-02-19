import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  progress?: number // 0-100
  children?: ReactNode
}

function getProgressColor(progress: number): string {
  if (progress > 80) return 'bg-red-500'
  if (progress > 50) return 'bg-yellow-500'
  return 'bg-accent'
}

export function StatCard({ label, value, subtitle, progress, children }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-full rounded-full ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
    </Card>
  )
}
