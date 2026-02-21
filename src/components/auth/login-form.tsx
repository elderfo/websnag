'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/ui/wordmark'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('intent') === 'upgrade') {
      localStorage.setItem('upgrade_intent', 'true')
    } else {
      localStorage.removeItem('upgrade_intent')
    }
  }, [])

  async function handleGitHubLogin() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-lg border border-[#1f1f23] bg-[#111113] p-8">
        {/* Branding */}
        <div className="mb-6 text-center">
          <Wordmark size="lg" className="block" />
          <p className="mt-1 text-sm text-gray-400">Sign in to your account</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {magicLinkSent ? (
          /* Success state after magic link sent */
          <div className="text-center">
            <div className="mb-3 text-3xl">&#x2709;</div>
            <h2 className="text-lg font-medium text-white">Check your email</h2>
            <p className="mt-2 text-sm text-gray-400">
              We sent a sign-in link to <span className="font-medium text-white">{email}</span>
            </p>
            <button
              onClick={() => {
                setMagicLinkSent(false)
                setEmail('')
              }}
              className="mt-4 text-sm text-[#00ff88] hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* GitHub OAuth */}
            <button
              onClick={handleGitHubLogin}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#1f1f23] bg-[#0a0a0b] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1f1f23]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1f1f23]" />
              <span className="text-xs text-gray-500">or</span>
              <div className="h-px flex-1 bg-[#1f1f23]" />
            </div>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink}>
              <label htmlFor="email" className="mb-1.5 block text-sm text-gray-400">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-md border border-[#1f1f23] bg-[#0a0a0b] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-3 w-full rounded-md bg-[#00ff88] px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Sending link...' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
