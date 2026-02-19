import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setUsernameSchema } from '@/lib/validators'
import { isBlockedUsername } from '@/lib/blocked-usernames'
import { NextResponse } from 'next/server'

export async function GET() {
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
      console.error('[username] GET profile query error:', error)
      return NextResponse.json({ error: 'Failed to fetch username' }, { status: 500 })
    }

    return NextResponse.json({ username: data?.username ?? null })
  } catch (err) {
    console.error('[username] GET unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
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

    // Check if user already has a username — usernames are immutable once set
    const admin = createAdminClient()
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (existingProfile?.username) {
      return NextResponse.json({ error: 'Username cannot be changed once set' }, { status: 403 })
    }

    // Check uniqueness via admin client (bypasses RLS to see all profiles)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existing && existing.id !== user.id) {
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
      console.error('[username] POST upsert error:', error)
      return NextResponse.json({ error: 'Failed to save username' }, { status: 500 })
    }

    return NextResponse.json({ username })
  } catch (err) {
    console.error('[username] POST unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
