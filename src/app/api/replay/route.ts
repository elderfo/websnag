import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logger'
import { logAuditEvent } from '@/lib/audit'
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
  const log = createRequestLogger('replay')
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
      return NextResponse.json(
        { error: 'Target URL is not allowed', reason: validation.reason },
        { status: 400 }
      )
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

    // Build the fetch URL using the resolved IP to prevent DNS rebinding TOCTOU attacks.
    // Set the Host header to the original hostname so TLS/virtual hosting still works.
    const originalUrl = new URL(targetUrl)
    const fetchUrl = new URL(targetUrl)
    if (validation.resolvedIp) {
      // For IPv6 addresses, wrap in brackets for URL hostname
      const isIPv6 = validation.resolvedIp.includes(':')
      fetchUrl.hostname = isIPv6 ? `[${validation.resolvedIp}]` : validation.resolvedIp
      forwardHeaders['Host'] = originalUrl.host
    }

    // Replay the request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REPLAY_TIMEOUT)

    const truncatedTargetUrl = (() => {
      const parsed = new URL(targetUrl)
      return `${parsed.hostname}${parsed.pathname}`.substring(0, 50)
    })()

    let replayOutcome: 'success' | 'timeout' | 'error' = 'success'
    let replayResponseStatus: number | undefined
    let replayErrorMessage: string | undefined

    try {
      const response = await fetch(fetchUrl.toString(), {
        method: webhookRequest.method,
        headers: forwardHeaders,
        body: ['GET', 'HEAD'].includes(webhookRequest.method) ? undefined : webhookRequest.body,
        signal: controller.signal,
        redirect: 'manual',
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

      replayResponseStatus = response.status

      return NextResponse.json({
        status: response.status,
        headers: responseHeaders,
        body: truncatedBody,
      })
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        replayOutcome = 'timeout'
        replayErrorMessage = 'Request timed out after 10 seconds'
        return NextResponse.json({ error: replayErrorMessage }, { status: 504 })
      }

      replayOutcome = 'error'
      replayErrorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        {
          error: `Failed to reach target: ${replayErrorMessage}`,
        },
        { status: 502 }
      )
    } finally {
      logAuditEvent({
        userId: user.id,
        action: 'replay',
        resourceType: 'request',
        resourceId: requestId,
        metadata: {
          targetUrl: truncatedTargetUrl,
          outcome: replayOutcome,
          ...(replayResponseStatus !== undefined && { responseStatus: replayResponseStatus }),
          ...(replayErrorMessage !== undefined && { error: replayErrorMessage }),
        },
      })
    }
  } catch (error) {
    log.error({ err: error }, 'replay failed')
    return NextResponse.json({ error: 'Replay failed' }, { status: 500 })
  }
}
