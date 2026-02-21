'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Plan } from '@/types'

interface SidebarProps {
  requestCount?: number
  maxRequests?: number
  aiAnalysisCount?: number
  maxAiAnalyses?: number
  plan?: Plan
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Endpoints',
    href: '/endpoints',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
  },
]

export function Sidebar({
  requestCount = 0,
  maxRequests = 100,
  aiAnalysisCount = 0,
  maxAiAnalyses,
  plan,
}: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/dashboard" className="font-mono text-lg font-bold text-accent">
          websnag
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/5 text-accent'
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-xs text-text-muted">Requests this month</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="font-mono text-sm text-text-secondary">
            {requestCount}
            {isFinite(maxRequests) && <span className="text-text-muted">/{maxRequests}</span>}
          </p>
          {isFinite(maxRequests) && requestCount >= maxRequests && (
            <span className="h-2 w-2 rounded-full bg-red-500" title="Limit reached" />
          )}
          {isFinite(maxRequests) &&
            requestCount >= maxRequests * 0.8 &&
            requestCount < maxRequests && (
              <span className="h-2 w-2 rounded-full bg-yellow-500" title="Approaching limit" />
            )}
        </div>
        {isFinite(maxRequests) && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all ${
                requestCount >= maxRequests
                  ? 'bg-red-500'
                  : requestCount >= maxRequests * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-accent'
              }`}
              style={{
                width: `${Math.min((requestCount / maxRequests) * 100, 100)}%`,
              }}
            />
          </div>
        )}

        {maxAiAnalyses !== undefined && isFinite(maxAiAnalyses) && (
          <>
            <p className="mt-3 text-xs text-text-muted">AI analyses this month</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm text-text-secondary">
                {aiAnalysisCount}
                <span className="text-text-muted">/{maxAiAnalyses}</span>
              </p>
              {aiAnalysisCount >= maxAiAnalyses && (
                <span className="h-2 w-2 rounded-full bg-red-500" title="Limit reached" />
              )}
              {aiAnalysisCount >= maxAiAnalyses * 0.8 && aiAnalysisCount < maxAiAnalyses && (
                <span className="h-2 w-2 rounded-full bg-yellow-500" title="Approaching limit" />
              )}
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full transition-all ${
                  aiAnalysisCount >= maxAiAnalyses
                    ? 'bg-red-500'
                    : aiAnalysisCount >= maxAiAnalyses * 0.8
                      ? 'bg-yellow-500'
                      : 'bg-accent'
                }`}
                style={{
                  width: `${Math.min((aiAnalysisCount / maxAiAnalyses) * 100, 100)}%`,
                }}
              />
            </div>
          </>
        )}

        {plan === 'free' && (
          <Link
            href="/billing"
            className="mt-3 block text-xs text-accent transition-colors hover:text-accent-hover"
          >
            Upgrade to Pro
          </Link>
        )}
      </div>
    </aside>
  )
}
