import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
      console.error('[retention] cleanup RPC failed:', error)
      return NextResponse.json({ error: 'Retention cleanup failed' }, { status: 500 })
    }

    const result = (data as RetentionResult[])[0]
    return NextResponse.json({
      free_deleted: result.free_deleted,
      pro_deleted: result.pro_deleted,
    })
  } catch (err) {
    console.error('[retention] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
