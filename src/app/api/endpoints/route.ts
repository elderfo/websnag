import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { createEndpointSchema } from '@/lib/validators'
import { canCreateEndpoint, getUserPlan } from '@/lib/usage'
import { generateSlug, isValidCustomSlug } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function GET() {
  const log = createRequestLogger('endpoints')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('endpoints')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      log.error({ err: error }, 'GET query failed')
      return NextResponse.json({ error: 'Failed to fetch endpoints' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    log.error({ err }, 'GET unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const log = createRequestLogger('endpoints')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user has a username set
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      log.error({ err: profileError }, 'POST profile query failed')
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (!profile?.username) {
      return NextResponse.json(
        {
          error: 'You must set a username before creating endpoints. Visit settings to set one.',
        },
        { status: 400 }
      )
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createEndpointSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get user's plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = getUserPlan(subscription)

    // Check endpoint limit
    const { count, error: countError } = await supabase
      .from('endpoints')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      log.error({ err: countError }, 'POST endpoint count query failed')
      return NextResponse.json({ error: 'Failed to check endpoint limit' }, { status: 500 })
    }

    if (!canCreateEndpoint(count ?? 0, plan)) {
      return NextResponse.json(
        {
          error: `Endpoint limit reached. ${plan === 'free' ? 'Upgrade to Pro for unlimited endpoints.' : ''}`,
        },
        { status: 403 }
      )
    }

    // Handle slug
    let slug: string
    if (parsed.data.slug) {
      // Custom slug requested
      if (!plan || plan !== 'pro') {
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
      const { data: existingSlug } = await admin
        .from('endpoints')
        .select('id')
        .eq('slug', parsed.data.slug)
        .eq('user_id', user.id)
        .single()

      if (existingSlug) {
        return NextResponse.json({ error: 'Slug already taken.' }, { status: 409 })
      }

      slug = parsed.data.slug
    } else {
      // Generate random slug
      slug = generateSlug()
    }

    // Insert endpoint
    const { data: endpoint, error: insertError } = await supabase
      .from('endpoints')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? '',
        response_code: parsed.data.response_code ?? 200,
        response_body: parsed.data.response_body ?? '{"ok": true}',
        response_headers: parsed.data.response_headers ?? { 'Content-Type': 'application/json' },
      })
      .select()
      .single()

    if (insertError) {
      log.error({ err: insertError }, 'POST endpoint insert failed')
      return NextResponse.json({ error: 'Failed to create endpoint' }, { status: 500 })
    }

    return NextResponse.json(endpoint, { status: 201 })
  } catch (err) {
    log.error({ err }, 'POST unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
