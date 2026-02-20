import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { checkSlugRateLimit, checkIpRateLimit, RateLimitResult } from '@/lib/rate-limit'
import { getUserPlan, canReceiveRequest } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ segments: string[] }> }

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

type BodyReadResult = { body: string; sizeBytes: number } | { body: null; sizeBytes: number }

/**
 * Reads the request body with a byte-size limit. Checks Content-Length first
 * for an early reject, then streams chunks and aborts if the limit is exceeded.
 */
async function readBodyWithLimit(req: NextRequest, maxBytes: number): Promise<BodyReadResult> {
  // Fast path: reject based on Content-Length header before reading any bytes
  const contentLength = req.headers.get('content-length')
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10)
    if (!isNaN(declared) && declared > maxBytes) {
      return { body: null, sizeBytes: declared }
    }
  }

  // No readable body (GET/HEAD or empty)
  if (!req.body) {
    return { body: '', sizeBytes: 0 }
  }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        return { body: null, sizeBytes: totalBytes }
      }

      chunks.push(value)
    }
  } catch {
    // If the stream errors out, treat whatever we have as the body
    // This mirrors the previous req.text() behavior
  }

  const decoder = new TextDecoder()
  const body =
    chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()

  return { body, sizeBytes: totalBytes }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy redirect helper (1 segment: /wh/[slug])
// ─────────────────────────────────────────────────────────────────────────────

async function handleLegacyRedirect(req: NextRequest, slug: string): Promise<NextResponse> {
  const log = createRequestLogger('webhook-legacy')
  const supabase = createAdminClient()

  // Look up all endpoints with this slug (after migration, multiple users can share a slug)
  const { data: endpoints, error: endpointError } = await supabase
    .from('endpoints')
    .select('user_id, slug')
    .eq('slug', slug)
    .limit(2)

  if (endpointError) {
    log.error({ err: endpointError, slug }, 'endpoint lookup failed')
  }

  if (!endpoints || endpoints.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ambiguous: multiple users own an endpoint with this slug — can't redirect safely
  if (endpoints.length > 1) {
    return NextResponse.json(
      {
        error: 'This endpoint URL format is deprecated. Use /wh/{username}/{slug} instead.',
      },
      { status: 404 }
    )
  }

  const endpoint = endpoints[0]

  // Look up the owner's username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', endpoint.user_id)
    .single()

  if (profileError) {
    log.error({ err: profileError, slug }, 'profile lookup failed')
  }

  if (!profile?.username) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 308 Permanent Redirect — preserves HTTP method (critical for POST webhooks)
  const newUrl = new URL(req.url)
  newUrl.pathname = `/api/wh/${profile.username}/${slug}`

  return NextResponse.redirect(newUrl.toString(), 308)
}

// ─────────────────────────────────────────────────────────────────────────────
// Namespaced webhook capture helper (2 segments: /wh/[username]/[slug])
// ─────────────────────────────────────────────────────────────────────────────

async function handleWebhookCapture(
  req: NextRequest,
  username: string,
  slug: string
): Promise<NextResponse> {
  const log = createRequestLogger('webhook')
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
    log.error({ err: error }, 'rate limiting check failed, allowing request')
  }

  const supabase = createAdminClient()

  // 2. Look up user by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    log.error({ err: profileError, username }, 'profile lookup failed')
  }

  if (!profile) {
    const notFoundHeaders = new Headers()
    applyRateLimitHeaders(notFoundHeaders, primaryResult)
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: notFoundHeaders })
  }

  // 3. Look up endpoint by user_id + slug
  const { data: endpoint, error: endpointError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', slug)
    .single()

  if (endpointError && endpointError.code !== 'PGRST116') {
    log.error({ err: endpointError, username, slug }, 'endpoint lookup failed')
  }

  if (endpointError || !endpoint) {
    const notFoundHeaders = new Headers()
    applyRateLimitHeaders(notFoundHeaders, primaryResult)
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: notFoundHeaders })
  }

  // Return identical 404 for inactive endpoints (security: no info leakage)
  if (!endpoint.is_active) {
    const notFoundHeaders = new Headers()
    applyRateLimitHeaders(notFoundHeaders, primaryResult)
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: notFoundHeaders })
  }

  // 4. Read body with streaming size limit
  const { body, sizeBytes } = await readBodyWithLimit(req, MAX_BODY_SIZE)

  if (body === null) {
    const tooLargeHeaders = new Headers()
    applyRateLimitHeaders(tooLargeHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413, headers: tooLargeHeaders }
    )
  }

  // 5. Check usage limits
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
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: limitHeaders })
  }

  // 6. Capture the request
  const headers = Object.fromEntries(req.headers.entries())
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries())

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
    log.error({ err: insertError, endpointId: endpoint.id }, 'request insert failed')
  } else {
    log.info({ endpointId: endpoint.id, method: req.method, sizeBytes }, 'webhook captured')
  }

  // 7. Increment usage counter
  const { error: rpcError } = await supabase.rpc('increment_request_count', {
    p_user_id: endpoint.user_id,
  })

  if (rpcError) {
    log.error({ err: rpcError, userId: endpoint.user_id }, 'increment_request_count failed')
  }

  // 8. Return configured response
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

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher: route based on number of segments
// ─────────────────────────────────────────────────────────────────────────────

export async function handleWebhook(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { segments } = await params

    if (segments.length === 1) {
      // Legacy: /wh/[slug]
      return await handleLegacyRedirect(req, segments[0])
    }

    if (segments.length === 2) {
      // Namespaced: /wh/[username]/[slug]
      return await handleWebhookCapture(req, segments[0], segments[1])
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    const log = createRequestLogger('webhook')
    log.error({ err }, 'unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
