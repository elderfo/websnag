import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { logAuditEvent } from '@/lib/audit'
import { NextResponse } from 'next/server'

async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.user_id ?? null
}

export async function POST(req: Request) {
  const log = createRequestLogger('stripe-webhook')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    log.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook handler misconfigured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    log.warn({ err: error }, 'Stripe webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  log.info({ eventId: event.id, eventType: event.type }, 'processing stripe event')

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id

      if (!customerId) break

      // Retrieve the subscription to get period end
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      let periodEnd: string | null = null
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const firstItem = sub.items.data[0]
        if (firstItem) {
          periodEnd = new Date(firstItem.current_period_end * 1000).toISOString()
        }
      }

      const { error: checkoutError } = await supabase
        .from('subscriptions')
        .update({
          plan: 'pro',
          status: 'active',
          stripe_subscription_id: subscriptionId ?? null,
          current_period_end: periodEnd,
        })
        .eq('stripe_customer_id', customerId)

      if (checkoutError) {
        log.error({ err: checkoutError, customerId }, 'checkout subscription update failed')
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      log.info({ customerId, subscriptionId }, 'checkout completed, upgraded to pro')

      const checkoutUserId = await resolveUserId(supabase, customerId)
      if (checkoutUserId) {
        logAuditEvent({
          userId: checkoutUserId,
          action: 'subscription_changed',
          resourceType: 'subscription',
          metadata: { event: 'checkout.session.completed', plan: 'pro' },
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

      if (!customerId) break

      const isActive = subscription.status === 'active' || subscription.status === 'trialing'
      const firstItem = subscription.items.data[0]
      const periodEnd = firstItem
        ? new Date(firstItem.current_period_end * 1000).toISOString()
        : null

      // If canceled at period end, keep as 'pro' until period ends
      let subUpdateError: unknown = null
      if (subscription.cancel_at_period_end) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: 'pro',
            status: 'active',
            current_period_end: periodEnd,
            cancel_at_period_end: true,
          })
          .eq('stripe_customer_id', customerId)
        subUpdateError = error
      } else if (isActive) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: 'pro',
            status: 'active',
            current_period_end: periodEnd,
            cancel_at_period_end: false,
          })
          .eq('stripe_customer_id', customerId)
        subUpdateError = error
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: 'free',
            status: subscription.status === 'past_due' ? 'past_due' : 'canceled',
            current_period_end: periodEnd,
            cancel_at_period_end: false,
          })
          .eq('stripe_customer_id', customerId)
        subUpdateError = error
      }

      if (subUpdateError) {
        log.error({ err: subUpdateError, customerId }, 'subscription update failed')
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      log.info(
        {
          customerId,
          subscriptionStatus: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        'subscription updated'
      )

      const updatedUserId = await resolveUserId(supabase, customerId)
      if (updatedUserId) {
        logAuditEvent({
          userId: updatedUserId,
          action: 'subscription_changed',
          resourceType: 'subscription',
          metadata: {
            event: 'customer.subscription.updated',
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

      if (!customerId) break

      const { error: deleteError } = await supabase
        .from('subscriptions')
        .update({
          plan: 'free',
          status: 'canceled',
          cancel_at_period_end: false,
        })
        .eq('stripe_customer_id', customerId)

      if (deleteError) {
        log.error({ err: deleteError, customerId }, 'subscription deletion update failed')
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      log.info({ customerId }, 'subscription deleted, downgraded to free')

      const deletedUserId = await resolveUserId(supabase, customerId)
      if (deletedUserId) {
        logAuditEvent({
          userId: deletedUserId,
          action: 'subscription_changed',
          resourceType: 'subscription',
          metadata: { event: 'customer.subscription.deleted', plan: 'free' },
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (!customerId) break

      const { error: paymentError } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
        })
        .eq('stripe_customer_id', customerId)

      if (paymentError) {
        log.error({ err: paymentError, customerId }, 'payment failed status update failed')
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      log.info({ customerId }, 'invoice payment failed, marked as past_due')

      const pastDueUserId = await resolveUserId(supabase, customerId)
      if (pastDueUserId) {
        logAuditEvent({
          userId: pastDueUserId,
          action: 'subscription_changed',
          resourceType: 'subscription',
          metadata: { event: 'invoice.payment_failed', status: 'past_due' },
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
