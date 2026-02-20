import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST() {
  try {
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
      console.error('[account-delete] subscription lookup failed:', subError)
    }

    // Cancel Stripe subscription if one exists
    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      } catch (err) {
        // Log but don't block deletion — the subscription will eventually be
        // cleaned up by Stripe's own lifecycle or a future reconciliation job
        console.error('[account-delete] failed to cancel Stripe subscription:', err)
      }
    }

    // Delete the user via Supabase Admin Auth
    // This cascades to: profiles, endpoints, requests, usage, subscriptions
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('[account-delete] failed to delete user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    console.info('[account-delete] user deleted:', user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account-delete] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
