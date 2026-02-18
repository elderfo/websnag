import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/usage'
import { LIMITS } from '@/types'
import { BillingClient } from './billing-client'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [subResult, usageResult] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
    supabase.rpc('get_current_usage', { p_user_id: user.id }),
  ])

  const plan = getUserPlan(subResult.data)
  const limits = LIMITS[plan]
  const hasStripeCustomer = !!subResult.data?.stripe_customer_id

  const requestCount = usageResult.data?.[0]?.request_count ?? 0
  const aiAnalysisCount = usageResult.data?.[0]?.ai_analysis_count ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Billing</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your plan and usage.</p>
      </div>

      <BillingClient
        plan={plan}
        hasStripeCustomer={hasStripeCustomer}
        requestCount={requestCount}
        aiAnalysisCount={aiAnalysisCount}
        maxRequests={limits.maxRequestsPerMonth}
        maxAnalyses={limits.maxAiAnalysesPerMonth}
        currentPeriodEnd={subResult.data?.current_period_end ?? null}
      />
    </div>
  )
}
