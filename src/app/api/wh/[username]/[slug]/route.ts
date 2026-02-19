import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPlan, canReceiveRequest } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1_048_576 // 1MB

type RouteContext = { params: Promise<{ username: string; slug: string }> }

export async function handleWebhook(req: NextRequest, { params }: RouteContext) {
  const { username, slug } = await params
  const supabase = createAdminClient()

  // 1. Look up user by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

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

  if (endpointError || !endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Return identical 404 for inactive endpoints (security: no info leakage)
  if (!endpoint.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
    source_ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
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
