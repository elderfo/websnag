'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import type { Plan } from '@/types'

interface MobileNavProps {
  requestCount?: number
  maxRequests?: number
  aiAnalysisCount?: number
  maxAiAnalyses?: number
  plan?: Plan
}

export function MobileNav({
  requestCount,
  maxRequests,
  aiAnalysisCount,
  maxAiAnalyses,
  plan,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)

  const close = useCallback(() => setIsOpen(false), [])

  // Close on any client-side navigation (pathname change).
  // Uses the "adjusting state during render" pattern recommended by React
  // to avoid calling setState inside an effect.
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    if (isOpen) {
      setIsOpen(false)
    }
  }

  // Close on any navigation (popstate) or when links are clicked inside the sidebar
  useEffect(() => {
    if (!isOpen) return

    const handlePopState = () => setIsOpen(false)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isOpen])

  // Prevent body scroll when nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary lg:hidden"
        aria-label="Open navigation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Slide-out sidebar — clicking any link inside closes the nav */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => {
          // Close when a link is clicked inside the sidebar
          const target = e.target as HTMLElement
          if (target.closest('a')) {
            close()
          }
        }}
      >
        <Sidebar
          requestCount={requestCount}
          maxRequests={maxRequests}
          aiAnalysisCount={aiAnalysisCount}
          maxAiAnalyses={maxAiAnalyses}
          plan={plan}
        />
        <button
          onClick={close}
          className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          aria-label="Close navigation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </>
  )
}
