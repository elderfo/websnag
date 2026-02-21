import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/usage'
import { RefreshButton } from '@/components/ui/refresh-button'
import { StatCard } from '@/components/dashboard/stat-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Badge } from '@/components/ui/badge'
import { LIMITS } from '@/types'
import { UpgradeBanner } from '@/components/dashboard/upgrade-banner'
import { UsageWarningBanner } from '@/components/billing/usage-warning-banner'
import { OnboardingChecklist } from '@/components/onboarding/checklist'

export default async function DashboardPage() {
  const supabase = await createClient()

  // User ID is needed for the usage RPC call below, so fetch before the parallel block
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error(authError?.message ?? 'Authentication required')
  }

  // Fetch remaining data in parallel (user was fetched above for RPC param)
  const [
    endpointsResult,
    recentRequestsResult,
    todayCountResult,
    subscriptionResult,
    usageResult,
    profileResult,
    totalRequestCountResult,
    analysisCountResult,
  ] = await Promise.all([
    supabase.from('endpoints').select('id, name, slug, is_active'),
    supabase
      .from('requests')
      .select('id, endpoint_id, method, size_bytes, received_at')
      .order('received_at', { ascending: false })
      .limit(10),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .gte('received_at', getTodayStart()),
    supabase.from('subscriptions').select('plan, status').maybeSingle(),
    supabase.rpc('get_current_usage', { p_user_id: user.id }),
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
    supabase.from('requests').select('*', { count: 'planned', head: true }),
    supabase
      .from('requests')
      .select('*', { count: 'planned', head: true })
      .not('ai_analysis', 'is', null),
  ])

  // Throw on errors to trigger error boundary
  if (endpointsResult.error) throw new Error(endpointsResult.error.message)
  if (recentRequestsResult.error) throw new Error(recentRequestsResult.error.message)
  if (todayCountResult.error) throw new Error(todayCountResult.error.message)
  if (usageResult.error) throw new Error(usageResult.error.message)

  const endpoints = endpointsResult.data ?? []
  const recentRequests = recentRequestsResult.data ?? []
  const todayCount = todayCountResult.count ?? 0
  const subscription = subscriptionResult.data
  const usage = usageResult.data
  const hasUsername = !!profileResult.data?.username
  const hasEndpoints = endpoints.length > 0
  const hasRequests = (totalRequestCountResult.count ?? 0) > 0
  const hasAnalysis = (analysisCountResult.count ?? 0) > 0

  const plan = getUserPlan(subscription)
  const requestCount = Array.isArray(usage) ? (usage[0]?.request_count ?? 0) : 0
  const aiAnalysisCount = Array.isArray(usage) ? (usage[0]?.ai_analysis_count ?? 0) : 0

  const usageBanner =
    plan === 'free' ? (
      <div className="mb-6">
        <UsageWarningBanner
          requestCount={requestCount}
          maxRequests={LIMITS.free.maxRequestsPerMonth}
          aiAnalysisCount={aiAnalysisCount}
          maxAiAnalyses={LIMITS.free.maxAiAnalysesPerMonth}
        />
      </div>
    ) : null

  // Empty state
  if (endpoints.length === 0) {
    return (
      <div>
        <Suspense fallback={null}>
          <UpgradeBanner />
        </Suspense>
        {usageBanner}
        <OnboardingChecklist
          hasUsername={hasUsername}
          hasEndpoints={hasEndpoints}
          hasRequests={hasRequests}
          hasAnalysis={hasAnalysis}
        />
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <div className="mt-12 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-lg font-medium text-text-primary">Welcome to Websnag</p>
          <p className="mt-2 text-sm text-text-muted">
            Create a webhook endpoint to start capturing and inspecting requests in real-time.
          </p>
          <Link
            href="/endpoints/new"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Create your first endpoint
          </Link>
        </div>
      </div>
    )
  }

  const activeCount = endpoints.filter((ep) => ep.is_active).length
  const total = endpoints.length
  const limit = LIMITS[plan].maxRequestsPerMonth
  const isUnlimited = !isFinite(limit)
  const usageValue = isUnlimited ? String(requestCount) : `${requestCount} / ${limit}`
  const progress = isUnlimited ? undefined : Math.round((requestCount / limit) * 100)

  // Build endpoint name map for recent activity
  const endpointNames: Record<string, string> = {}
  for (const ep of endpoints) {
    endpointNames[ep.id] = ep.name
  }

  return (
    <div>
      <Suspense fallback={null}>
        <UpgradeBanner />
      </Suspense>
      {usageBanner}
      <OnboardingChecklist
        hasUsername={hasUsername}
        hasEndpoints={hasEndpoints}
        hasRequests={hasRequests}
        hasAnalysis={hasAnalysis}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <RefreshButton />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Requests Today" value={String(todayCount)} />
        <StatCard
          label="Active Endpoints"
          value={String(activeCount)}
          subtitle={`of ${total} total`}
        >
          <Link
            href="/endpoints"
            className="text-xs text-accent transition-colors hover:text-accent-hover"
          >
            View all endpoints
          </Link>
        </StatCard>
        <StatCard
          label="Monthly Usage"
          value={usageValue}
          progress={progress}
          subtitle={isUnlimited ? 'Unlimited' : undefined}
        >
          <Badge variant={plan === 'pro' ? 'success' : 'default'}>
            {plan === 'pro' ? 'Pro' : 'Free'}
          </Badge>
        </StatCard>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">Recent Activity</h2>
        <div className="mt-4">
          <RecentActivity requests={recentRequests} endpointNames={endpointNames} />
        </div>
      </div>
    </div>
  )
}

function getTodayStart(): string {
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return todayStart.toISOString()
}
