import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

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
        periodEnd = new Date(sub.current_period_end * 1000).toISOString()
      }

      await supabase
        .from('subscriptions')
        .update({
          plan: 'pro',
          status: 'active',
          stripe_subscription_id: subscriptionId ?? null,
          current_period_end: periodEnd,
        })
        .eq('stripe_customer_id', customerId)

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
      const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

      // If canceled at period end, keep as 'pro' until period ends
      if (subscription.cancel_at_period_end) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: periodEnd,
          })
          .eq('stripe_customer_id', customerId)
      } else if (isActive) {
        await supabase
          .from('subscriptions')
          .update({
            plan: 'pro',
            status: 'active',
            current_period_end: periodEnd,
          })
          .eq('stripe_customer_id', customerId)
      } else {
        await supabase
          .from('subscriptions')
          .update({
            plan: 'free',
            status: subscription.status === 'past_due' ? 'past_due' : 'canceled',
            current_period_end: periodEnd,
          })
          .eq('stripe_customer_id', customerId)
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

      await supabase
        .from('subscriptions')
        .update({
          plan: 'free',
          status: 'canceled',
        })
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (!customerId) break

      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
        })
        .eq('stripe_customer_id', customerId)

      break
    }
  }

  return NextResponse.json({ received: true })
}
