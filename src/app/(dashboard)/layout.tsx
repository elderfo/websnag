import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { LIMITS } from '@/types'
import { getUserPlan } from '@/lib/usage'

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
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  const plan = getUserPlan(subscription)
  const limits = LIMITS[plan]

  // Fetch current month usage
  const { data: usageData } = await supabase.rpc('get_current_usage', {
    p_user_id: user.id,
  })

  const requestCount = usageData?.[0]?.request_count ?? 0
  const aiAnalysisCount = usageData?.[0]?.ai_analysis_count ?? 0

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar
          requestCount={requestCount}
          maxRequests={limits.maxRequestsPerMonth}
          aiAnalysisCount={aiAnalysisCount}
          maxAiAnalyses={limits.maxAiAnalysesPerMonth}
          plan={plan}
        />
      </div>

      <div className="lg:pl-60">
        <Header
          userEmail={user.email ?? ''}
          mobileNav={
            <MobileNav
              requestCount={requestCount}
              maxRequests={limits.maxRequestsPerMonth}
              aiAnalysisCount={aiAnalysisCount}
              maxAiAnalyses={limits.maxAiAnalysesPerMonth}
              plan={plan}
            />
          }
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
