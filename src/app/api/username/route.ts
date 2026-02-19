import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setUsernameSchema } from '@/lib/validators'
import { isBlockedUsername } from '@/lib/blocked-usernames'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single()

  return NextResponse.json({ username: data?.username ?? null })
}

export async function POST(req: Request) {
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

  if (isBlockedUsername(username)) {
    return NextResponse.json({ error: 'This username is not available' }, { status: 400 })
  }

  // Check uniqueness via admin client (bypasses RLS to see all profiles)
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  // Upsert profile
  const { error } = await admin
    .from('profiles')
    .upsert({ id: user.id, username }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ username })
}
