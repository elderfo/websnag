import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { usernameSchema } from '@/lib/validators'
import { isBlockedUsername } from '@/lib/blocked-usernames'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const log = createRequestLogger('username-check')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const username = req.nextUrl.searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 })
    }

    const parsed = usernameSchema.safeParse(username)
    if (!parsed.success) {
      return NextResponse.json({ available: false, reason: 'Invalid username format' })
    }

    // Blocked usernames appear as "taken" — no distinction exposed
    if (isBlockedUsername(username)) {
      return NextResponse.json({ available: false, reason: 'Username is already taken' })
    }

    const admin = createAdminClient()
    const { data: existing, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (lookupError && lookupError.code !== 'PGRST116') {
      log.error({ err: lookupError }, 'database lookup failed')
      return NextResponse.json({ error: 'Unable to check availability' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ available: false, reason: 'Username is already taken' })
    }

    return NextResponse.json({ available: true })
  } catch (err) {
    log.error({ err }, 'unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
