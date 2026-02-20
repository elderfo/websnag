import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { analyzeWebhook } from '@/lib/anthropic'
import { analyzeRequestSchema } from '@/lib/validators'
import { canAnalyze, getUserPlan } from '@/lib/usage'
import { NextResponse } from 'next/server'
import { APIError } from '@anthropic-ai/sdk'
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

    // Check AI analysis usage limits
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = getUserPlan(subscription)

    const admin = createAdminClient()
    const { data: usageData } = await admin.rpc('get_current_usage', { p_user_id: user.id })

    const currentAnalyses = usageData?.[0]?.ai_analysis_count ?? 0
    if (!canAnalyze(currentAnalyses, plan)) {
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
    await admin.from('requests').update({ ai_analysis: analysis }).eq('id', requestId)

    // Increment usage
    await admin.rpc('increment_ai_analysis_count', { p_user_id: user.id })

    return NextResponse.json(analysis)
  } catch (error) {
    log.error({ err: error }, 'analysis failed')
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
