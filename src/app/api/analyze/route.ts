import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { logAuditEvent } from '@/lib/audit'
import { analyzeWebhook } from '@/lib/anthropic'
import { analyzeRequestSchema } from '@/lib/validators'
import { getUserPlan } from '@/lib/usage'
import { checkApiRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { APIError } from '@anthropic-ai/sdk'
import { LIMITS } from '@/types'
import type { AiAnalysis } from '@/types'

export async function POST(req: Request) {
  const log = createRequestLogger('analyze')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate input
    const body = await req.json()
    const parsed = analyzeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { requestId } = parsed.data

    // Fetch the request and verify ownership via the inner join on endpoints
    const { data: webhookRequest } = await supabase
      .from('requests')
      .select('*, endpoint:endpoints!inner(user_id)')
      .eq('id', requestId)
      .single()

    if (!webhookRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Check AI analysis usage limits (atomic check + increment to prevent race conditions)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = getUserPlan(subscription)

    // Per-user API rate limit
    const rateLimit = await checkApiRateLimit(user.id, plan)
    if (rateLimit && !rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const analysisLimit = plan === 'pro' ? 0 : LIMITS.free.maxAiAnalysesPerMonth

    const admin = createAdminClient()
    const { data: withinLimit, error: usageError } = await admin.rpc(
      'try_increment_ai_analysis_count',
      {
        p_user_id: user.id,
        p_limit: analysisLimit,
      }
    )

    if (usageError) {
      log.error({ err: usageError, userId: user.id }, 'AI analysis usage check failed')
      return NextResponse.json({ error: 'AI analysis usage check unavailable' }, { status: 503 })
    }

    if (withinLimit !== true) {
      return NextResponse.json({ error: 'AI analysis limit reached' }, { status: 429 })
    }

    // Call Claude
    let analysis: AiAnalysis
    try {
      analysis = await analyzeWebhook(
        webhookRequest.method,
        webhookRequest.headers,
        webhookRequest.body,
        webhookRequest.content_type
      )
    } catch (error) {
      if (error instanceof APIError) {
        log.error({ err: error, requestId: requestId }, 'Anthropic API error')
        return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
      }
      log.error({ err: error, requestId: requestId }, 'AI analysis response validation failed')
      return NextResponse.json(
        { error: 'AI analysis produced an invalid response' },
        { status: 502 }
      )
    }

    // Store result
    const { error: updateError } = await admin
      .from('requests')
      .update({ ai_analysis: analysis })
      .eq('id', requestId)

    if (updateError) {
      log.error({ err: updateError, requestId }, 'failed to store analysis result')
    }

    log.info({ requestId, userId: user.id, source: analysis.source }, 'AI analysis completed')

    logAuditEvent({
      userId: user.id,
      action: 'analyze',
      resourceType: 'request',
      resourceId: requestId,
      metadata: { source: analysis.source, webhookType: analysis.webhook_type },
    })

    return NextResponse.json(analysis)
  } catch (error) {
    log.error({ err: error }, 'analysis failed')
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
