import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/usage'
import { SettingsClient } from './settings-client'
import { AuditLog } from '@/components/settings/audit-log'

interface SettingsPageProps {
  searchParams: Promise<{ setup?: string; redirect?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  const plan = getUserPlan(subscription)

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your account settings.</p>
      </div>

      <SettingsClient
        email={user.email ?? ''}
        createdAt={user.created_at}
        plan={plan}
        initialUsername={profile?.username ?? null}
        isSetup={params.setup === 'username'}
        redirectAfterSave={params.redirect ?? null}
      />

      <AuditLog />
    </div>
  )
}
