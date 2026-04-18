import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLAN_PRICE_IDS } from '@/lib/stripe/client'
import { PlanCode } from '@/lib/types/app'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { planCode } = body as { planCode: PlanCode }

  if (planCode === 'freedom') {
    return NextResponse.json({ error: 'Cannot checkout free plan' }, { status: 400 })
  }

  const priceId = PLAN_PRICE_IDS[planCode]
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: customer } = await supabase.from('subscription_customers').select('stripe_customer_id').eq('user_id', user.id).single()

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customer?.stripe_customer_id ?? undefined,
    customer_email: !customer?.stripe_customer_id ? (user.email ?? undefined) : undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/billing`,
    metadata: { user_id: user.id, plan_code: planCode },
    subscription_data: { metadata: { user_id: user.id, plan_code: planCode } },
  })

  return NextResponse.json({ url: session.url })
}
