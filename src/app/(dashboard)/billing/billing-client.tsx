'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Plan } from '@/types'

interface BillingClientProps {
  plan: Plan
  hasStripeCustomer: boolean
  requestCount: number
  aiAnalysisCount: number
  maxRequests: number
  maxAnalyses: number
  currentPeriodEnd: string | null
}

function getProgressColor(percentage: number): string {
  if (percentage > 80) return 'bg-red-500'
  if (percentage > 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

const PRO_BENEFITS = [
  'Unlimited endpoints',
  'Unlimited requests per month',
  'Unlimited AI analyses',
  '30-day request history',
  'Webhook replay',
  'Custom endpoint slugs',
]

export function BillingClient({
  plan,
  hasStripeCustomer,
  requestCount,
  aiAnalysisCount,
  maxRequests,
  maxAnalyses,
  currentPeriodEnd,
}: BillingClientProps) {
  const [loading, setLoading] = useState(false)

  const isPro = plan === 'pro'
  const requestsUnlimited = !isFinite(maxRequests)
  const analysesUnlimited = !isFinite(maxAnalyses)
  const requestPercent = requestsUnlimited ? 0 : Math.min((requestCount / maxRequests) * 100, 100)
  const analysisPercent = analysesUnlimited
    ? 0
    : Math.min((aiAnalysisCount / maxAnalyses) * 100, 100)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  async function handleManage() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Plan info */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-medium text-text-primary">Current Plan</h2>
              <Badge variant={isPro ? 'success' : 'default'}>{isPro ? 'Pro' : 'Free'}</Badge>
            </div>
            {isPro && currentPeriodEnd && (
              <p className="text-sm text-text-secondary">
                Renews on {new Date(currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {!isPro && (
              <p className="text-sm text-text-secondary">
                Limited to 2 endpoints, 100 requests/mo, 5 AI analyses/mo
              </p>
            )}
          </div>

          {isPro && hasStripeCustomer ? (
            <Button variant="secondary" onClick={handleManage} disabled={loading}>
              {loading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Usage */}
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Usage This Month</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Requests</span>
              <span className="font-mono text-text-primary">
                {requestCount} / {requestsUnlimited ? 'Unlimited' : maxRequests}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              {requestsUnlimited ? (
                <div className="h-full w-full rounded-full bg-accent/30" />
              ) : (
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getProgressColor(requestPercent)}`}
                  style={{ width: `${requestPercent}%` }}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">AI Analyses</span>
              <span className="font-mono text-text-primary">
                {aiAnalysisCount} / {analysesUnlimited ? 'Unlimited' : maxAnalyses}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              {analysesUnlimited ? (
                <div className="h-full w-full rounded-full bg-accent/30" />
              ) : (
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getProgressColor(analysisPercent)}`}
                  style={{ width: `${analysisPercent}%` }}
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Upgrade CTA (free users only) */}
      {!isPro && (
        <Card className="border-accent/20">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-text-primary">Upgrade to Pro</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Unlock the full power of Websnag for $7/mo.
              </p>
            </div>

            <ul className="space-y-2">
              {PRO_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-text-secondary">
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>

            <Button onClick={handleUpgrade} disabled={loading} className="w-full">
              {loading ? 'Redirecting...' : 'Upgrade to Pro \u2014 $7/mo'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
