import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPlan, canReceiveRequest } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ segments: string[] }> }

// ─────────────────────────────────────────────────────────────────────────────
// Legacy redirect helper (1 segment: /wh/[slug])
// ─────────────────────────────────────────────────────────────────────────────

async function handleLegacyRedirect(req: NextRequest, slug: string): Promise<NextResponse> {
  const supabase = createAdminClient()

  // Look up all endpoints with this slug (after migration, multiple users can share a slug)
  const { data: endpoints, error: endpointError } = await supabase
    .from('endpoints')
    .select('user_id, slug')
    .eq('slug', slug)
    .limit(2)

  if (endpointError) {
    console.error('[webhook] legacy redirect endpoint lookup error:', endpointError)
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
    console.error('[webhook] legacy redirect profile lookup error:', profileError)
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
  const supabase = createAdminClient()

  // 1. Look up user by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[webhook] profile lookup error:', profileError)
  }

  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 2. Look up endpoint by user_id + slug
  const { data: endpoint, error: endpointError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', slug)
    .single()

  if (endpointError && endpointError.code !== 'PGRST116') {
    console.error('[webhook] endpoint lookup error:', endpointError)
  }

  if (endpointError || !endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Return identical 404 for inactive endpoints (security: no info leakage)
  if (!endpoint.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 3. Read body (must read before checking size)
  const body = await req.text()

  // Use byte length, not character count — multi-byte chars would pass .length check
  const sizeBytes = body ? new TextEncoder().encode(body).length : 0
  if (sizeBytes > MAX_BODY_SIZE) {
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 5. Capture the request
  const headers = Object.fromEntries(req.headers.entries())
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries())

  const { error: insertError } = await supabase.from('requests').insert({
    endpoint_id: endpoint.id,
    method: req.method,
    headers,
    body: body || null,
    query_params: queryParams,
    content_type: req.headers.get('content-type'),
    source_ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    size_bytes: sizeBytes,
  })

  if (insertError) {
    console.error('[webhook] request insert error:', insertError)
  }

  // 6. Increment usage counter
  const { error: rpcError } = await supabase.rpc('increment_request_count', {
    p_user_id: endpoint.user_id,
  })

  if (rpcError) {
    console.error('[webhook] increment_request_count error:', rpcError)
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
    console.error('[webhook] unhandled error:', err)
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
