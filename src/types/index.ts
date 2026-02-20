// Database row types

export interface Profile {
  id: string
  username: string | null
  created_at: string
  updated_at: string
}

export interface Endpoint {
  id: string
  user_id: string
  name: string
  slug: string
  description: string
  response_code: number
  response_body: string
  response_headers: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WebhookRequest {
  id: string
  endpoint_id: string
  method: string
  headers: Record<string, string>
  body: string | null
  query_params: Record<string, string>
  content_type: string | null
  source_ip: string | null
  size_bytes: number
  received_at: string
  ai_analysis: AiAnalysis | null
}

export interface Usage {
  user_id: string
  month: string
  request_count: number
  ai_analysis_count: number
}

export interface Subscription {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'free' | 'pro'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

// AI analysis response

export interface AiAnalysis {
  source: string
  webhook_type: string
  summary: string
  key_fields: Array<{ path: string; description: string }>
  schema_notes: string
  handler_node: string
  handler_python: string
}

// Tier limits

export type Plan = 'free' | 'pro'

export interface TierLimits {
  maxEndpoints: number
  maxRequestsPerMonth: number
  maxAiAnalysesPerMonth: number
  historyRetentionHours?: number
  historyRetentionDays?: number
  customSlugs: boolean
}

export const LIMITS: Record<Plan, TierLimits> = {
  free: {
    maxEndpoints: 2,
    maxRequestsPerMonth: 100,
    maxAiAnalysesPerMonth: 5,
    historyRetentionHours: 24,
    customSlugs: false,
  },
  pro: {
    maxEndpoints: Infinity,
    maxRequestsPerMonth: Infinity,
    maxAiAnalysesPerMonth: Infinity,
    historyRetentionDays: 30,
    customSlugs: true,
  },
}
