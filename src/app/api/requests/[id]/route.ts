import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const log = createRequestLogger('delete-request')
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user owns the endpoint this request belongs to
  const { data: request } = await supabase
    .from('requests')
    .select('id, endpoint_id, endpoints(user_id)')
    .eq('id', id)
    .single()

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  const endpoint = request.endpoints as unknown as { user_id: string }
  if (endpoint.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('requests').delete().eq('id', id)

  if (error) {
    log.error({ err: error, requestId: id }, 'failed to delete request')
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
