import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { setUsernameSchema } from '@/lib/validators'
import { isBlockedUsername } from '@/lib/blocked-usernames'
import { NextResponse } from 'next/server'

export async function GET() {
  const log = createRequestLogger('username')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (error) {
      // PGRST116 = no rows found — user simply hasn't set a username yet
      if (error.code === 'PGRST116') {
        return NextResponse.json({ username: null })
      }
      log.error({ err: error }, 'GET profile query failed')
      return NextResponse.json({ error: 'Failed to fetch username' }, { status: 500 })
    }

    return NextResponse.json({ username: data?.username ?? null })
  } catch (err) {
    log.error({ err }, 'GET unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const log = createRequestLogger('username')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = setUsernameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 })
    }

    const { username } = parsed.data

    // Blocked usernames return same response as "taken" — no information leak
    if (isBlockedUsername(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Check if user already has a username — usernames are immutable once set.
    // Fail closed: if the query errors, do NOT proceed to upsert.
    const admin = createAdminClient()
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      log.error({ err: profileError }, 'POST profile lookup failed')
      return NextResponse.json({ error: 'Failed to verify username status' }, { status: 500 })
    }

    if (existingProfile?.username) {
      return NextResponse.json({ error: 'Username cannot be changed once set' }, { status: 403 })
    }

    // Check uniqueness via admin client (bypasses RLS to see all profiles)
    const { data: existing, error: uniquenessError } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (uniquenessError && uniquenessError.code !== 'PGRST116') {
      log.error({ err: uniquenessError }, 'POST uniqueness check failed')
      return NextResponse.json({ error: 'Failed to verify username availability' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Upsert profile — a race condition can cause a unique constraint violation (23505)
    // even after the SELECT above. Handle it gracefully.
    const { error } = await admin
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' })

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation — another request raced us to claim the username
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      }
      log.error({ err: error }, 'POST upsert failed')
      return NextResponse.json({ error: 'Failed to save username' }, { status: 500 })
    }

    return NextResponse.json({ username })
  } catch (err) {
    log.error({ err }, 'POST unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
