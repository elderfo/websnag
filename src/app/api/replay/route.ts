import { createClient } from '@/lib/supabase/server'
import { replayRequestSchema } from '@/lib/validators'
import { getUserPlan } from '@/lib/usage'
import { validateTargetUrl } from '@/lib/url-validator'
import { NextResponse } from 'next/server'

const REPLAY_TIMEOUT = 10_000 // 10 seconds
const MAX_RESPONSE_BODY = 102_400 // 100KB

// Headers to NOT forward
const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ray',
  'cf-visitor',
  'cdn-loop',
])

export async function POST(req: Request) {
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
    const parsed = replayRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { requestId, targetUrl } = parsed.data

    // SSRF protection: validate the target URL does not resolve to internal addresses
    const validation = await validateTargetUrl(targetUrl)
    if (!validation.safe) {
      return NextResponse.json({ error: 'Target URL is not allowed' }, { status: 400 })
    }

    // Verify user is Pro
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = getUserPlan(subscription)
    if (plan !== 'pro') {
      return NextResponse.json({ error: 'Replay is a Pro feature' }, { status: 403 })
    }

    // Fetch the request and verify ownership
    const { data: webhookRequest } = await supabase
      .from('requests')
      .select('*, endpoint:endpoints!inner(user_id)')
      .eq('id', requestId)
      .single()

    if (!webhookRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Build headers to forward
    const forwardHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(webhookRequest.headers as Record<string, string>)) {
      if (!SKIP_HEADERS.has(key.toLowerCase())) {
        forwardHeaders[key] = value
      }
    }

    // Replay the request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REPLAY_TIMEOUT)

    try {
      const response = await fetch(targetUrl, {
        method: webhookRequest.method,
        headers: forwardHeaders,
        body: ['GET', 'HEAD'].includes(webhookRequest.method) ? undefined : webhookRequest.body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Capture response
      const responseBody = await response.text()
      const truncatedBody =
        responseBody.length > MAX_RESPONSE_BODY
          ? responseBody.slice(0, MAX_RESPONSE_BODY) + '\n...[truncated]'
          : responseBody

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return NextResponse.json({
        status: response.status,
        headers: responseHeaders,
        body: truncatedBody,
      })
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timed out after 10 seconds' }, { status: 504 })
      }

      return NextResponse.json(
        {
          error: `Failed to reach target: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('Replay error:', error)
    return NextResponse.json({ error: 'Replay failed' }, { status: 500 })
  }
}
