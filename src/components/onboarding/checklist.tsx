'use client'

import { useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'

const DISMISSED_KEY = 'websnag_onboarding_dismissed'

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getIsDismissedSnapshot(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === 'true'
}

// Server snapshot always returns true (hidden) to prevent flash of content during SSR
function getIsDismissedServerSnapshot(): boolean {
  return true
}

interface ChecklistProps {
  hasUsername: boolean
  hasEndpoints: boolean
  hasRequests: boolean
  hasAnalysis: boolean
}

interface Step {
  label: string
  description: string
  href: string
  linkText: string
  complete: boolean
}

export function OnboardingChecklist({
  hasUsername,
  hasEndpoints,
  hasRequests,
  hasAnalysis,
}: ChecklistProps) {
  const dismissed = useSyncExternalStore(
    subscribeToStorage,
    getIsDismissedSnapshot,
    getIsDismissedServerSnapshot
  )

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    // Dispatch storage event so useSyncExternalStore picks up the change
    window.dispatchEvent(new StorageEvent('storage', { key: DISMISSED_KEY }))
  }, [])

  const steps: Step[] = [
    {
      label: 'Set your username',
      description: 'Your username becomes part of your webhook URLs.',
      href: '/settings?setup=username',
      linkText: 'Go to Settings',
      complete: hasUsername,
    },
    {
      label: 'Create your first endpoint',
      description: 'Set up a URL to start capturing webhook requests.',
      href: '/endpoints/new',
      linkText: 'Create Endpoint',
      complete: hasEndpoints,
    },
    {
      label: 'Receive your first request',
      description: 'Point a webhook or use cURL to send a test payload.',
      href: '/dashboard',
      linkText: 'View Dashboard',
      complete: hasRequests,
    },
    {
      label: 'Run your first AI analysis',
      description: 'Get a plain-English explanation of any captured payload.',
      href: '/dashboard',
      linkText: 'View Dashboard',
      complete: hasAnalysis,
    },
  ]

  const allComplete = steps.every((s) => s.complete)
  const completedCount = steps.filter((s) => s.complete).length

  // Don't render if dismissed or all steps complete
  if (dismissed || allComplete) {
    return null
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Getting Started</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {completedCount} of {steps.length} complete
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
          aria-label="Dismiss onboarding checklist"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0">
              {step.complete ? (
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${step.complete ? 'text-text-muted line-through' : 'text-text-primary'}`}
              >
                {step.label}
              </p>
              {!step.complete && (
                <>
                  <p className="mt-0.5 text-xs text-text-muted">{step.description}</p>
                  <Link
                    href={step.href}
                    className="mt-1 inline-block text-xs text-accent transition-colors hover:text-accent-hover"
                  >
                    {step.linkText} &rarr;
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
