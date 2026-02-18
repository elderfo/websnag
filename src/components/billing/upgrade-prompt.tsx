'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface UpgradePromptProps {
  feature: string
}

const PRO_BENEFITS = [
  'Unlimited endpoints',
  'Unlimited requests per month',
  'Unlimited AI analyses',
  '30-day request history',
  'Webhook replay',
  'Custom endpoint slugs',
]

export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false)

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

  return (
    <Card className="border-accent/20">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-text-primary">
            You&apos;ve reached your {feature} limit
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Upgrade to Pro to unlock the full power of Websnag.
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
  )
}
