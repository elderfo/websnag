import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { LIMITS } from '@/types'
import type { Plan } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch subscription to determine plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  const plan: Plan = (subscription?.plan as Plan) ?? 'free'
  const limits = LIMITS[plan]

  // Fetch current month usage
  const { data: usageData } = await supabase.rpc('get_current_usage', {
    p_user_id: user.id,
  })

  const requestCount = usageData?.[0]?.request_count ?? 0

  return (
    <div className="min-h-screen bg-background">
      <Sidebar requestCount={requestCount} maxRequests={limits.maxRequestsPerMonth} />
      <div className="pl-60">
        <Header userEmail={user.email ?? ''} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
