import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ slug: string }> }

export async function handleWebhook(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Look up endpoint by slug to find the owner
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('user_id')
    .eq('slug', slug)
    .single()

  if (!endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Look up the owner's username
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', endpoint.user_id)
    .single()

  if (!profile?.username) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Redirect to the new namespaced URL (301 permanent redirect)
  const newUrl = new URL(req.url)
  newUrl.pathname = `/api/wh/${profile.username}/${slug}`

  return NextResponse.redirect(newUrl.toString(), 301)
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
