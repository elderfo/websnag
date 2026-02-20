'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Plan } from '@/types'

interface BillingClientProps {
  plan: Plan
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  hasStripeCustomer: boolean
  requestCount: number
  aiAnalysisCount: number
  maxRequests: number
  maxAnalyses: number
  currentPeriodEnd: string | null
  // TODO: add cancelAtPeriodEnd boolean once the subscriptions table has a cancel_at_period_end
  // column. The Stripe webhook handler already reads this value from the Stripe API but does not
  // persist it. A migration is required before this can be surfaced in the UI.
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
  status,
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
        return
      }
      setLoading(false)
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
        return
      }
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Past-due payment warning */}
      {status === 'past_due' && (
        <div className="flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">Payment failed</p>
              <p className="mt-0.5 text-sm text-amber-400/80">
                Your payment failed. Pro features are suspended until payment is updated.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManage}
            disabled={loading}
            className="ml-4 flex-shrink-0 border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
          >
            Update Payment
          </Button>
        </div>
      )}

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
