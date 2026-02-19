'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Plan } from '@/types'

interface SettingsClientProps {
  email: string
  createdAt: string
  plan: Plan
  initialUsername: string | null
}

export function SettingsClient({ email, createdAt, plan, initialUsername }: SettingsClientProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername ?? '')
  const [savedUsername, setSavedUsername] = useState(initialUsername)
  const [usernameError, setUsernameError] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameSuccess, setUsernameSuccess] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSaveUsername() {
    setUsernameError('')
    setUsernameSuccess(false)
    setUsernameSaving(true)

    try {
      const res = await fetch('/api/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      const data = await res.json()

      if (!res.ok) {
        setUsernameError(data.error ?? 'Failed to save username')
        return
      }

      setSavedUsername(data.username)
      setUsernameSuccess(true)
    } catch {
      setUsernameError('Failed to save username')
    } finally {
      setUsernameSaving(false)
    }
  }

  // Clear success message after 3 seconds
  useEffect(() => {
    if (!usernameSuccess) return
    const timer = setTimeout(() => setUsernameSuccess(false), 3000)
    return () => clearTimeout(timer)
  }, [usernameSuccess])

  return (
    <div className="space-y-6">
      {/* Username */}
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Username</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Your username is used in webhook URLs:{' '}
          <span className="font-mono text-text-muted">
            /wh/<span className="text-accent">{savedUsername ?? 'your-username'}</span>
            /endpoint-slug
          </span>
        </p>
        {savedUsername ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-text-primary">{savedUsername}</span>
            <Badge variant="default">Locked</Badge>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase())
                    setUsernameError('')
                    setUsernameSuccess(false)
                  }}
                  placeholder="your-username"
                  error={usernameError}
                  maxLength={32}
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  3-32 characters, lowercase letters, numbers, and hyphens. Cannot be changed once
                  set.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleSaveUsername}
                disabled={username.length < 3 || usernameSaving}
              >
                {usernameSaving ? 'Saving...' : 'Set Username'}
              </Button>
            </div>
            {usernameSuccess && <p className="mt-2 text-xs text-green-400">Username saved.</p>}
          </>
        )}
      </Card>

      {/* Account info */}
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Account</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-text-secondary">Email</dt>
            <dd className="font-mono text-sm text-text-primary">{email}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-text-secondary">Member since</dt>
            <dd className="text-sm text-text-primary">
              {new Date(createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Plan */}
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Plan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Current plan</span>
            <Badge variant={plan === 'pro' ? 'success' : 'default'}>
              {plan === 'pro' ? 'Pro' : 'Free'}
            </Badge>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push('/billing')}>
            Manage Billing
          </Button>
        </div>
      </Card>

      {/* Sign out */}
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Session</h2>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/20">
        <h2 className="mb-2 text-base font-medium text-red-400">Danger Zone</h2>
        <p className="text-sm text-text-secondary">
          To delete your account and all associated data, please contact support at{' '}
          <a href="mailto:support@websnag.dev" className="text-accent hover:underline">
            support@websnag.dev
          </a>
          .
        </p>
      </Card>
    </div>
  )
}
