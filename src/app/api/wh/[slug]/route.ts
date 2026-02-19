import { createAdminClient } from '@/lib/supabase/admin'
import { checkSlugRateLimit, checkIpRateLimit } from '@/lib/rate-limit'
import { getUserPlan, canReceiveRequest } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ slug: string }> }

function getSourceIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
}

export async function handleWebhook(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const sourceIp = getSourceIp(req)

  // 1. Rate limiting checks — BEFORE any database queries
  try {
    const [slugResult, ipResult] = await Promise.all([
      checkSlugRateLimit(slug),
      checkIpRateLimit(sourceIp),
    ])

    // Determine the most restrictive rate limit info for headers
    // Use slug result as primary (more specific), fall back to ip result
    const primaryResult = slugResult ?? ipResult

    // Check slug rate limit
    if (slugResult && !slugResult.success) {
      const retryAfterMs = Math.max(0, slugResult.reset - Date.now())
      const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSecs),
            'X-RateLimit-Limit': String(slugResult.limit),
            'X-RateLimit-Remaining': String(slugResult.remaining),
          },
        }
      )
    }

    // Check IP rate limit
    if (ipResult && !ipResult.success) {
      const retryAfterMs = Math.max(0, ipResult.reset - Date.now())
      const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSecs),
            'X-RateLimit-Limit': String(ipResult.limit),
            'X-RateLimit-Remaining': String(ipResult.remaining),
          },
        }
      )
    }

    // Store primary result for attaching to success response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(req as any)._rateLimitResult = primaryResult
  } catch {
    // Fail open: if rate limiting itself throws, allow the request
  }

  const supabase = createAdminClient()

  // 2. Look up endpoint by slug
  const { data: endpoint, error: endpointError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('slug', slug)
    .single()

  if (endpointError || !endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!endpoint.is_active) {
    return NextResponse.json({ error: 'Endpoint inactive' }, { status: 410 })
  }

  // 3. Read body (must read before checking size)
  const body = await req.text()
  if (body.length > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
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
    return NextResponse.json({ error: 'Monthly request limit reached' }, { status: 429 })
  }

  // 5. Capture the request
  const headers = Object.fromEntries(req.headers.entries())
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const sizeBytes = body ? new TextEncoder().encode(body).length : 0

  await supabase.from('requests').insert({
    endpoint_id: endpoint.id,
    method: req.method,
    headers,
    body: body || null,
    query_params: queryParams,
    content_type: req.headers.get('content-type'),
    source_ip: sourceIp !== 'unknown' ? sourceIp : null,
    size_bytes: sizeBytes,
  })

  // 6. Increment usage counter
  await supabase.rpc('increment_request_count', { p_user_id: endpoint.user_id })

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rateLimitResult = (req as any)._rateLimitResult
  if (rateLimitResult) {
    responseHeaders.set('X-RateLimit-Limit', String(rateLimitResult.limit))
    responseHeaders.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  }

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
