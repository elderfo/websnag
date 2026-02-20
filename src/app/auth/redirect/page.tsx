'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleRedirect() {
      const intent = localStorage.getItem('upgrade_intent')

      if (intent === 'true') {
        localStorage.removeItem('upgrade_intent')

        try {
          const res = await fetch('/api/stripe/checkout', { method: 'POST' })
          const data = await res.json()
          if (data.url) {
            window.location.href = data.url
            return
          }
        } catch {
          // If checkout fails, fall through to dashboard
        }
      }

      router.replace('/dashboard')
    }

    handleRedirect()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#00ff88] border-t-transparent" />
        <p className="mt-4 text-sm text-gray-400">Setting up your account...</p>
      </div>
    </div>
  )
}
