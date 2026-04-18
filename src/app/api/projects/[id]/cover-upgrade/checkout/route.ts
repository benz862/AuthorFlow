/**
 * Starts a Stripe Checkout session for the $4.99 print-ready cover upgrade.
 * One-time payment tied to a specific book_assets row (the cover being
 * upgraded). The webhook processes the upscale after Stripe confirms payment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'

const COVER_UPGRADE_PRICE_CENTS = 499 // $4.99

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('book_projects')
    .select('id, title, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Most recent cover on this project
  const { data: cover } = await supabase
    .from('book_assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('asset_type', 'cover')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cover) {
    return NextResponse.json({ error: 'Generate a cover before upgrading it.' }, { status: 400 })
  }

  // If they already have a ready upgrade for THIS cover, no need to charge again.
  const { data: existing } = await supabase
    .from('cover_upgrades')
    .select('*')
    .eq('asset_id', cover.id)
    .eq('status', 'ready')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      alreadyPurchased: true,
      upgrade: existing,
    })
  }

  // Create the pending upgrade row first so the webhook has something to update
  const { data: upgrade, error: upgradeErr } = await supabase
    .from('cover_upgrades')
    .insert({
      user_id: user.id,
      project_id: projectId,
      asset_id: cover.id,
      amount_cents: COVER_UPGRADE_PRICE_CENTS,
      status: 'pending',
    })
    .select()
    .single()

  if (upgradeErr || !upgrade) {
    return NextResponse.json({ error: upgradeErr?.message ?? 'Could not create upgrade record' }, { status: 500 })
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Prefer a pre-configured Stripe Price if one exists, else inline price_data
  const priceId = process.env.STRIPE_PRICE_ID_COVER_UPGRADE
  const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Print-Ready Cover Upgrade',
              description: `4× upscale of your cover for "${project.title}" to 300 DPI print quality.`,
            },
            unit_amount: COVER_UPGRADE_PRICE_CENTS,
          },
          quantity: 1,
        },
      ]

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: user.email ?? undefined,
    line_items: lineItems,
    success_url: `${origin}/projects/${projectId}/exports?cover_upgrade=success&upgrade_id=${upgrade.id}`,
    cancel_url: `${origin}/projects/${projectId}/exports?cover_upgrade=canceled`,
    metadata: {
      type: 'cover_upgrade',
      user_id: user.id,
      project_id: projectId,
      asset_id: cover.id,
      upgrade_id: upgrade.id,
    },
  })

  await supabase
    .from('cover_upgrades')
    .update({ stripe_session_id: session.id })
    .eq('id', upgrade.id)

  return NextResponse.json({ url: session.url, upgradeId: upgrade.id })
}
