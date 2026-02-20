'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Plan } from '@/types'

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

function isRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

interface SettingsClientProps {
  email: string
  createdAt: string
  plan: Plan
  initialUsername: string | null
  isSetup: boolean
  redirectAfterSave: string | null
}

export function SettingsClient({
  email,
  createdAt,
  plan,
  initialUsername,
  isSetup,
  redirectAfterSave,
}: SettingsClientProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername ?? '')
  const [savedUsername, setSavedUsername] = useState(initialUsername)
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const checkAbortRef = useRef<AbortController | null>(null)
  const usernameCardRef = useRef<HTMLDivElement | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // When arriving via the setup flow, scroll the username card into view
  useEffect(() => {
    if (isSetup && usernameCardRef.current) {
      usernameCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isSetup])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    setIsDeleting(true)

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setDeleteError(data.error ?? 'Failed to delete account')
        return
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('[settings] failed to delete account:', err)
      setDeleteError('Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Debounced availability check
  useEffect(() => {
    setUsernameAvailable(null)
    setUsernameError('')

    if (username.length < 3 || !USERNAME_REGEX.test(username)) {
      setUsernameChecking(false)
      return
    }

    setUsernameChecking(true)

    const timer = setTimeout(async () => {
      // Cancel any in-flight check
      checkAbortRef.current?.abort()
      const controller = new AbortController()
      checkAbortRef.current = controller

      try {
        const res = await fetch(`/api/username/check?username=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!res.ok) {
          setUsernameAvailable(null)
          setUsernameError('Could not verify availability. You can still try saving.')
          return
        }

        const data = await res.json()

        if (controller.signal.aborted) return

        if (data.available) {
          setUsernameAvailable(true)
          setUsernameError('')
        } else {
          setUsernameAvailable(false)
          setUsernameError(data.reason ?? 'Username is not available')
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setUsernameAvailable(null)
        setUsernameError('Could not verify availability. You can still try saving.')
      } finally {
        if (!controller.signal.aborted) {
          setUsernameChecking(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      checkAbortRef.current?.abort()
      setUsernameChecking(false)
    }
  }, [username])

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

      // Redirect after save: go to the requested page, or dashboard if in setup flow
      if (redirectAfterSave && isRelativePath(redirectAfterSave)) {
        router.push(redirectAfterSave)
      } else if (redirectAfterSave || isSetup) {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('[settings] failed to save username:', err)
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
      {/* Setup mode: contextual prompt shown above the username card */}
      {isSetup && !savedUsername && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-sm font-medium text-text-primary">
            Choose your username to get started
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Your username will be a permanent part of all your webhook URLs:{' '}
            <span className="font-mono text-text-muted">
              websnag.dev/wh/<span className="text-accent">your-username</span>/slug
            </span>
            . It cannot be changed after it is set.
          </p>
        </div>
      )}

      {/* Username */}
      <div ref={usernameCardRef}>
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
                      setUsernameSuccess(false)
                    }}
                    placeholder="your-username"
                    error={usernameError}
                    maxLength={32}
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="text-xs text-text-muted">
                      3-32 characters, lowercase letters, numbers, and hyphens. Cannot be changed
                      once set.
                    </p>
                  </div>
                  {usernameChecking && username.length >= 3 && (
                    <p className="mt-1 text-xs text-text-muted">Checking availability...</p>
                  )}
                  {usernameAvailable === true && !usernameChecking && (
                    <p className="mt-1 text-xs text-green-400">Username is available</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveUsername}
                  disabled={
                    username.length < 3 ||
                    !USERNAME_REGEX.test(username) ||
                    usernameSaving ||
                    usernameChecking ||
                    usernameAvailable === false
                  }
                >
                  {usernameSaving ? 'Saving...' : 'Set Username'}
                </Button>
              </div>
              {usernameSuccess && <p className="mt-2 text-xs text-green-400">Username saved.</p>}
            </>
          )}
        </Card>
      </div>

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

        {!showDeleteConfirm ? (
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              Delete Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-red-400">
                This will permanently delete your account and all data including:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
                <li>All webhook endpoints</li>
                <li>All captured requests and AI analyses</li>
                <li>Usage history</li>
                {plan === 'pro' && <li>Your Pro subscription will be canceled</li>}
              </ul>
            </div>

            <div>
              <label htmlFor="delete-confirm" className="block text-sm text-text-secondary">
                Type{' '}
                <span className="font-mono font-medium text-text-primary">delete my account</span>{' '}
                to confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteInput}
                onChange={(e) => {
                  setDeleteInput(e.target.value)
                  setDeleteError('')
                }}
                placeholder="delete my account"
                className="mt-2"
                error={deleteError}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteInput !== 'delete my account' || isDeleting}
                onClick={handleDeleteAccount}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete Account'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteInput('')
                  setDeleteError('')
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
