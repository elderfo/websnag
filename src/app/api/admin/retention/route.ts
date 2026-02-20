import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse } from 'next/server'

interface RetentionResult {
  free_deleted: number
  pro_deleted: number
}

function isAdmin(userId: string): boolean {
  const adminIds = process.env.ADMIN_USER_IDS
  if (!adminIds) return false
  return adminIds
    .split(',')
    .map((id) => id.trim())
    .includes(userId)
}

export async function POST(): Promise<NextResponse> {
  const log = createRequestLogger('retention')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!isAdmin(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('cleanup_expired_requests')

    if (error) {
      log.error({ err: error }, 'cleanup RPC failed')
      return NextResponse.json({ error: 'Retention cleanup failed' }, { status: 500 })
    }

    const resultArray = data as RetentionResult[] | null
    const result = resultArray?.[0]

    if (!result) {
      log.error('cleanup RPC returned no result')
      return NextResponse.json({ error: 'Retention cleanup returned no result' }, { status: 500 })
    }

    return NextResponse.json({
      free_deleted: result.free_deleted,
      pro_deleted: result.pro_deleted,
    })
  } catch (err) {
    log.error({ err }, 'unexpected error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
