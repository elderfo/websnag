import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { logAuditEvent } from '@/lib/audit'
import { updateEndpointSchema } from '@/lib/validators'
import { getUserPlan } from '@/lib/usage'
import { isValidCustomSlug } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const log = createRequestLogger('endpoints')
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.from('endpoints').select('*').eq('id', id).single()

  if (error) {
    log.error({ err: error, endpointId: id }, 'GET endpoint query failed')
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const log = createRequestLogger('endpoints')
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify endpoint exists and belongs to user (RLS handles ownership)
  const { data: existing, error: fetchError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateEndpointSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // If slug is being changed, validate and check uniqueness
  if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
    // Get user's plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = getUserPlan(subscription)

    if (plan !== 'pro') {
      return NextResponse.json(
        { error: 'Custom slugs are only available on the Pro plan.' },
        { status: 403 }
      )
    }

    if (!isValidCustomSlug(parsed.data.slug)) {
      return NextResponse.json(
        {
          error:
            'Invalid slug. Must be 3-48 characters, lowercase alphanumeric and hyphens, no leading/trailing hyphens.',
        },
        { status: 400 }
      )
    }

    // Check slug uniqueness per-user (slugs are namespaced under a user now)
    const adminClient = createAdminClient()
    const { data: existingSlug } = await adminClient
      .from('endpoints')
      .select('id')
      .eq('slug', parsed.data.slug)
      .eq('user_id', user.id)
      .single()

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug already taken.' }, { status: 409 })
    }
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.slug !== undefined) updateData.slug = parsed.data.slug
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description
  if (parsed.data.response_code !== undefined) updateData.response_code = parsed.data.response_code
  if (parsed.data.response_body !== undefined) updateData.response_body = parsed.data.response_body
  if (parsed.data.response_headers !== undefined)
    updateData.response_headers = parsed.data.response_headers
  if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('endpoints')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    log.error({ err: updateError, endpointId: id }, 'endpoint update failed')
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  log.info({ endpointId: id, fields: Object.keys(updateData) }, 'endpoint updated')

  logAuditEvent({
    userId: user.id,
    action: 'update',
    resourceType: 'endpoint',
    resourceId: id,
    metadata: { updatedFields: Object.keys(updateData) },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger('endpoints')
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS ensures only the owner can delete
  const { error, count } = await supabase.from('endpoints').delete({ count: 'exact' }).eq('id', id)

  if (error) {
    log.error({ err: error, endpointId: id }, 'endpoint deletion failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  log.info({ endpointId: id }, 'endpoint deleted')

  logAuditEvent({
    userId: user.id,
    action: 'delete',
    resourceType: 'endpoint',
    resourceId: id,
  })

  return new NextResponse(null, { status: 204 })
}
