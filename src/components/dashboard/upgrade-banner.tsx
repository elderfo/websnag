'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function UpgradeBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  if (searchParams.get('upgrade') !== 'success') {
    return null
  }

  function handleDismiss() {
    router.replace('/dashboard')
  }

  return (
    <div className="mb-6 flex items-start justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-green-300">Welcome to Pro!</p>
          <p className="mt-0.5 text-sm text-green-400/80">
            You now have unlimited endpoints, requests, and AI analyses.
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDismiss}
        className="ml-4 flex-shrink-0 border-green-500/20 text-green-400 hover:bg-green-500/10"
        aria-label="Dismiss upgrade confirmation"
      >
        Dismiss
      </Button>
    </div>
  )
}
