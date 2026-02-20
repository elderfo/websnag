import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse } from 'next/server'

const BulkDeleteSchema = z.object({
  requestIds: z.array(z.string()).min(1).max(100),
})

export async function POST(req: Request) {
  const log = createRequestLogger('bulk-delete-requests')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = BulkDeleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { requestIds } = parsed.data

  // Verify ownership: join through endpoints to check user_id
  const { data: ownedRequests, error: lookupError } = await supabase
    .from('requests')
    .select('id, endpoints(user_id)')
    .in('id', requestIds)

  if (lookupError) {
    log.error({ err: lookupError }, 'ownership lookup failed')
    return NextResponse.json({ error: 'Failed to verify ownership' }, { status: 500 })
  }

  const ownedIds = (ownedRequests ?? [])
    .filter((r) => {
      const endpoint = r.endpoints as unknown as { user_id: string }
      return endpoint.user_id === user.id
    })
    .map((r) => r.id)

  if (ownedIds.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('requests').delete().in('id', ownedIds)

  if (error) {
    log.error({ err: error }, 'bulk delete failed')
    return NextResponse.json({ error: 'Failed to delete requests' }, { status: 500 })
  }

  return NextResponse.json({ deleted: ownedIds.length })
}
