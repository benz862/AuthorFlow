import { NextRequest, NextResponse } from 'next/server'
import { stripe, planCodeFromPriceId } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const userId = session.metadata?.user_id

      // One-time cover upgrade purchase
      if (userId && session.mode === 'payment' && session.metadata?.type === 'cover_upgrade') {
        const upgradeId = session.metadata.upgrade_id
        if (upgradeId) {
          await supabase
            .from('cover_upgrades')
            .update({
              status: 'paid',
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', upgradeId)
        }
        break
      }

      if (!userId || session.mode !== 'subscription') break

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      // Upsert customer record
      await supabase.from('subscription_customers').upsert({
        user_id: userId,
        stripe_customer_id: customerId,
      }, { onConflict: 'user_id' })

      // Get the subscription to find price
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id
      const planCode = planCodeFromPriceId(priceId) ?? 'starter'
      const currentPeriodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()

      await supabase.from('subscription_status').upsert({
        user_id: userId,
        plan_code: planCode,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        subscription_status: 'active',
        current_period_end: currentPeriodEnd,
      }, { onConflict: 'user_id' })
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id
      if (!userId) break

      const priceId = subscription.items.data[0]?.price.id
      const planCode = planCodeFromPriceId(priceId) ?? 'freedom'
      const currentPeriodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()

      await supabase.from('subscription_status').update({
        plan_code: planCode,
        stripe_price_id: priceId,
        subscription_status: subscription.status,
        current_period_end: currentPeriodEnd,
      }).eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      await supabase.from('subscription_status').update({
        plan_code: 'freedom',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        stripe_price_id: null,
      }).eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = (invoice as unknown as { subscription?: string }).subscription
      if (subId) {
        await supabase.from('subscription_status').update({ subscription_status: 'past_due' }).eq('stripe_subscription_id', subId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
