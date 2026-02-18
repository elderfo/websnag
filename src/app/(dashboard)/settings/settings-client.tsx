'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Plan } from '@/types'

interface SettingsClientProps {
  email: string
  createdAt: string
  plan: Plan
}

export function SettingsClient({ email, createdAt, plan }: SettingsClientProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="space-y-6">
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
