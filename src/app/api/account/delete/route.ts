import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const log = createRequestLogger('account-delete')
  try {
    let body: { confirm?: boolean } = {}
    try {
      body = await req.json()
    } catch {
      // No body provided
    }
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": true } to proceed.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Look up Stripe customer for this user
    const { data: subscription, error: subError } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subError) {
      log.error({ err: subError }, 'subscription lookup failed')
    }

    // Cancel Stripe subscription if one exists
    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      } catch (err) {
        // Log but don't block deletion — the subscription will eventually be
        // cleaned up by Stripe's own lifecycle or a future reconciliation job
        log.error({ err }, 'failed to cancel Stripe subscription')
      }
    }

    // Log before deletion so audit trail exists even if delete partially fails
    log.info({ userId: user.id }, 'account deletion initiated')

    // Delete the user via Supabase Admin Auth
    // This cascades to: profiles, endpoints, requests, usage, subscriptions
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      log.error({ err: deleteError }, 'failed to delete user')
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    log.info({ userId: user.id }, 'user deleted')
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error({ err }, 'unhandled error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
