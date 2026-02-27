import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import {
  checkSlugRateLimit,
  checkIpRateLimit,
  checkAccountRateLimit,
  fallbackSlugCheck,
  fallbackIpCheck,
  fallbackAccountCheck,
  RateLimitResult,
} from '@/lib/rate-limit'
import { isAllowedResponseHeader } from '@/lib/security'
import { getUserPlan } from '@/lib/usage'
import { LIMITS } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ segments: string[] }> }

function anonymizeIp(ip: string): string {
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return parts.slice(0, 3).join(':') + ':0:0:0:0:0'
  }
  // IPv4
  const parts = ip.split('.')
  if (parts.length === 4) {
    parts[3] = '0'
    return parts.join('.')
  }
  return ip
}

function getSourceIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const raw = forwarded.split(',')[0].trim()
    return anonymizeIp(raw)
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return anonymizeIp(realIp)
  }
  return 'unknown'
}

/**
 * Selects the most restrictive rate limit result from all active limiters.
 * "Most restrictive" = lowest `remaining` count. Ties broken by highest
 * `reset` timestamp (the window that resets furthest in the future).
 */
function selectMostRestrictive(results: RateLimitResult[]): RateLimitResult | null {
  if (results.length === 0) return null
  return results.reduce((mostRestrictive, current) => {
    if (current.remaining < mostRestrictive.remaining) return current
    if (current.remaining === mostRestrictive.remaining && current.reset > mostRestrictive.reset) {
      return current
    }
    return mostRestrictive
  })
}

function applyRateLimitHeaders(headers: Headers, rateLimitResult: RateLimitResult | null): void {
  if (rateLimitResult) {
    headers.set('X-RateLimit-Limit', String(rateLimitResult.limit))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  }
}

type BodyReadResult =
  | { status: 'ok'; body: string; sizeBytes: number }
  | { status: 'too_large'; sizeBytes: number }
  | { status: 'stream_error'; sizeBytes: number }

/**
 * Reads the request body with a byte-size limit. Checks Content-Length first
 * for an early reject, then streams chunks and aborts if the limit is exceeded.
 *
 * Returns a discriminated union:
 * - `status: 'ok'` — body was read successfully
 * - `status: 'too_large'` — Content-Length or streamed bytes exceeded maxBytes
 * - `status: 'stream_error'` — stream read failed (partial data discarded)
 */
async function readBodyWithLimit(
  req: NextRequest,
  maxBytes: number,
  log: ReturnType<typeof createRequestLogger>
): Promise<BodyReadResult> {
  // Fast path: reject based on Content-Length header before reading any bytes
  const contentLength = req.headers.get('content-length')
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10)
    if (!isNaN(declared) && declared > maxBytes) {
      return { status: 'too_large', sizeBytes: declared }
    }
  }

  // No readable body (GET/HEAD or empty)
  if (!req.body) {
    return { status: 'ok', body: '', sizeBytes: 0 }
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
        return { status: 'too_large', sizeBytes: totalBytes }
      }

      chunks.push(value)
    }
  } catch (error) {
    // Discard partial chunks — returning truncated data could cause
    // corrupt payloads to be stored silently.
    log.error({ err: error, totalBytesRead: totalBytes }, 'request body stream read failed')
    return { status: 'stream_error', sizeBytes: totalBytes }
  }

  const decoder = new TextDecoder()
  const body =
    chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()

  return { status: 'ok', body, sizeBytes: totalBytes }
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
  const allRateLimitResults: RateLimitResult[] = []

  try {
    const [slugResult, ipResult] = await Promise.all([
      checkSlugRateLimit(slug),
      sourceIp !== 'unknown' ? checkIpRateLimit(sourceIp) : Promise.resolve(null),
    ])

    if (slugResult) allRateLimitResults.push(slugResult)
    if (ipResult) allRateLimitResults.push(ipResult)
    primaryResult = selectMostRestrictive(allRateLimitResults)

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
    log.error({ err: error }, 'rate limiting check failed, using in-memory fallback')
    const slugResult = fallbackSlugCheck(slug)
    const ipResult = sourceIp !== 'unknown' ? fallbackIpCheck(sourceIp) : null

    if (slugResult) allRateLimitResults.push(slugResult)
    if (ipResult) allRateLimitResults.push(ipResult)
    primaryResult = selectMostRestrictive(allRateLimitResults)

    if (!slugResult.success) {
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

  // 4. Check usage limits and per-account rate limit BEFORE reading body
  //    to avoid consuming up to 1MB of data for requests that will be rejected.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', endpoint.user_id)
    .single()

  const plan = getUserPlan(subscription)

  // 4b. Per-account rate limit (tier-aware, checked after plan resolution)
  try {
    const accountResult = await checkAccountRateLimit(profile.id, plan)
    if (accountResult) {
      allRateLimitResults.push(accountResult)

      if (!accountResult.success) {
        const retryAfterMs = Math.max(0, accountResult.reset - Date.now())
        const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
        const rlHeaders = new Headers({
          'Retry-After': String(retryAfterSecs),
          'X-RateLimit-Limit': String(accountResult.limit),
          'X-RateLimit-Remaining': String(accountResult.remaining),
        })
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429, headers: rlHeaders }
        )
      }
    }
  } catch (error) {
    log.error(
      { err: error, userId: profile.id },
      'account rate limiting check failed, using in-memory fallback'
    )
    const accountResult = fallbackAccountCheck(profile.id, plan)
    allRateLimitResults.push(accountResult)

    if (!accountResult.success) {
      const retryAfterMs = Math.max(0, accountResult.reset - Date.now())
      const retryAfterSecs = Math.ceil(retryAfterMs / 1000)
      const rlHeaders = new Headers({
        'Retry-After': String(retryAfterSecs),
        'X-RateLimit-Limit': String(accountResult.limit),
        'X-RateLimit-Remaining': String(accountResult.remaining),
      })
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rlHeaders }
      )
    }
  }

  // Select the most restrictive rate limit result across all active limiters
  primaryResult = selectMostRestrictive(allRateLimitResults)

  // 5. Read body with streaming size limit
  const readResult = await readBodyWithLimit(req, MAX_BODY_SIZE, log)

  if (readResult.status === 'stream_error') {
    const errorHeaders = new Headers()
    applyRateLimitHeaders(errorHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Failed to read request body' },
      { status: 500, headers: errorHeaders }
    )
  }

  if (readResult.status === 'too_large') {
    const tooLargeHeaders = new Headers()
    applyRateLimitHeaders(tooLargeHeaders, primaryResult)
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413, headers: tooLargeHeaders }
    )
  }

  const { body, sizeBytes } = readResult

  // 5b. Atomic usage check + increment (fixes race condition #73)
  const requestLimit = plan === 'pro' ? 0 : LIMITS.free.maxRequestsPerMonth
  const { data: withinLimit, error: usageError } = await supabase.rpc(
    'try_increment_request_count',
    {
      p_user_id: endpoint.user_id,
      p_limit: requestLimit,
    }
  )

  if (usageError) {
    log.error({ err: usageError, userId: endpoint.user_id }, 'usage increment RPC failed')
    // Fail closed for free tier (prevent unlimited usage), fail open for pro
    if (plan !== 'pro') {
      const limitHeaders = new Headers()
      applyRateLimitHeaders(limitHeaders, primaryResult)
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: limitHeaders })
    }
  }

  if (withinLimit === false) {
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
    return NextResponse.json({ error: 'Failed to capture request' }, { status: 500 })
  }

  log.info({ endpointId: endpoint.id, method: req.method, sizeBytes }, 'webhook captured')

  // 7. Return configured response
  const responseHeaders = new Headers()
  if (endpoint.response_headers) {
    for (const [key, value] of Object.entries(
      endpoint.response_headers as Record<string, string>
    )) {
      if (isAllowedResponseHeader(key)) {
        responseHeaders.set(key, String(value))
      }
    }
  }

  // Attach rate limit headers to the success response when available
  applyRateLimitHeaders(responseHeaders, primaryResult)

  // Runtime guard: default null response_code to 200, override 3xx to prevent redirect abuse (#75)
  const baseCode = endpoint.response_code ?? 200
  const responseCode = baseCode >= 300 && baseCode < 400 ? 200 : baseCode

  return new NextResponse(endpoint.response_body, {
    status: responseCode,
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
