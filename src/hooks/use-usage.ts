'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Plan } from '@/types'

interface UsageData {
  requestCount: number
  aiAnalysisCount: number
  plan: Plan
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [usageResult, subResult] = await Promise.all([
        supabase.rpc('get_current_usage', { p_user_id: user.id }),
        supabase.from('subscriptions').select('plan, status').eq('user_id', user.id).single(),
      ])

      const plan: Plan =
        subResult.data?.plan === 'pro' && subResult.data?.status === 'active' ? 'pro' : 'free'

      setUsage({
        requestCount: usageResult.data?.[0]?.request_count ?? 0,
        aiAnalysisCount: usageResult.data?.[0]?.ai_analysis_count ?? 0,
        plan,
      })
      setLoading(false)
    }

    fetchUsage()
  }, [])

  return { usage, loading }
}
