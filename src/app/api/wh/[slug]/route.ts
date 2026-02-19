import { createAdminClient } from '@/lib/supabase/admin'
import { checkSlugRateLimit, checkIpRateLimit, RateLimitResult } from '@/lib/rate-limit'
import { getUserPlan, canReceiveRequest } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ slug: string }> }

function getSourceIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function applyRateLimitHeaders(headers: Headers, rateLimitResult: RateLimitResult | null): void {
  if (rateLimitResult) {
    headers.set('X-RateLimit-Limit', String(rateLimitResult.limit))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  }
}

export async function handleWebhook(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const sourceIp = getSourceIp(req)

  // 1. Rate limiting checks — BEFORE any database queries
  let primaryResult: RateLimitResult | null = null

  try {
    const [slugResult, ipResult] = await Promise.all([
      checkSlugRateLimit(slug),
      sourceIp !== 'unknown' ? checkIpRateLimit(sourceIp) : Promise.resolve(null),
    ])

    // Prefer slug-based rate limit info (more specific), fall back to IP-based
    primaryResult = slugResult ?? ipResult

    // Check slug rate limit
    if (slugResult && !slugResult.success) {
      const retryAfterMs = Math.max(0, slugResult.reset - Date.now())
      const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
      const rlHeaders = new Headers({
        'Retry-After': String(retryAfterSecs),
        'X-RateLimit-Limit': String(slugResult.limit),
        'X-RateLimit-Remaining': String(slugResult.remaining),
      })
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rlHeaders }
      )
    }

    // Check IP rate limit
    if (ipResult && !ipResult.success) {
      const retryAfterMs = Math.max(0, ipResult.reset - Date.now())
      const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
      const rlHeaders = new Headers({
        'Retry-After': String(retryAfterSecs),
        'X-RateLimit-Limit': String(ipResult.limit),
        'X-RateLimit-Remaining': String(ipResult.remaining),
      })
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rlHeaders }
      )
    }
  } catch (error) {
    // Fail open: if rate limiting itself throws, allow the request
    console.error('[webhook] Rate limiting check failed, allowing request:', error)
  }

  const supabase = createAdminClient()

  // 2. Look up endpoint by slug
  const { data: endpoint, error: endpointError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('slug', slug)
    .single()

  if (endpointError || !endpoint) {
    const notFoundHeaders = new Headers()
    applyRateLimitHeaders(notFoundHeaders, primaryResult)
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: notFoundHeaders })
  }

  if (!endpoint.is_active) {
    const inactiveHeaders = new Headers()
    applyRateLimitHeaders(inactiveHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Endpoint inactive' },
      { status: 410, headers: inactiveHeaders }
    )
  }

  // 3. Read body (must read before checking size)
  const body = await req.text()
  if (body.length > MAX_BODY_SIZE) {
    const tooLargeHeaders = new Headers()
    applyRateLimitHeaders(tooLargeHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413, headers: tooLargeHeaders }
    )
  }

  // 4. Check usage limits
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', endpoint.user_id)
    .single()

  const plan = getUserPlan(subscription)

  const { data: usageData } = await supabase.rpc('get_current_usage', {
    p_user_id: endpoint.user_id,
  })

  const currentRequests = usageData?.[0]?.request_count ?? 0

  if (!canReceiveRequest(currentRequests, plan)) {
    const limitHeaders = new Headers()
    applyRateLimitHeaders(limitHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Monthly request limit reached' },
      { status: 429, headers: limitHeaders }
    )
  }

  // 5. Capture the request
  const headers = Object.fromEntries(req.headers.entries())
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const sizeBytes = body ? new TextEncoder().encode(body).length : 0

  const { error: insertError } = await supabase.from('requests').insert({
    endpoint_id: endpoint.id,
    method: req.method,
    headers,
    body: body || null,
    query_params: queryParams,
    content_type: req.headers.get('content-type'),
    source_ip: sourceIp !== 'unknown' ? sourceIp : null,
    size_bytes: sizeBytes,
  })

  if (insertError) {
    console.error('[webhook] Failed to insert request:', insertError)
  }

  // 6. Increment usage counter
  const { error: rpcError } = await supabase.rpc('increment_request_count', {
    p_user_id: endpoint.user_id,
  })

  if (rpcError) {
    console.error('[webhook] Failed to increment request count:', rpcError)
  }

  // 7. Return configured response
  const responseHeaders = new Headers()
  if (endpoint.response_headers) {
    for (const [key, value] of Object.entries(
      endpoint.response_headers as Record<string, string>
    )) {
      responseHeaders.set(key, String(value))
    }
  }

  // Attach rate limit headers to the success response when available
  applyRateLimitHeaders(responseHeaders, primaryResult)

  return new NextResponse(endpoint.response_body, {
    status: endpoint.response_code,
    headers: responseHeaders,
  })
}

// Export handlers for all HTTP methods
export async function GET(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  return handleWebhook(req, ctx)
}
