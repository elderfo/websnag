import type { Plan } from '@/types'
import { LIMITS } from '@/types'

export function canCreateEndpoint(currentCount: number, plan: Plan): boolean {
  return currentCount < LIMITS[plan].maxEndpoints
}

export function canReceiveRequest(currentMonthCount: number, plan: Plan): boolean {
  return currentMonthCount < LIMITS[plan].maxRequestsPerMonth
}

export function canAnalyze(currentMonthCount: number, plan: Plan): boolean {
  return currentMonthCount < LIMITS[plan].maxAiAnalysesPerMonth
}

export function getUserPlan(subscription: { plan: string; status: string } | null): Plan {
  if (subscription?.plan === 'pro' && subscription?.status === 'active') {
    return 'pro'
  }
  return 'free'
}
