import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
  typescript: true,
})

export const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER ?? '',
  creator: process.env.STRIPE_PRICE_ID_CREATOR ?? '',
  studio: process.env.STRIPE_PRICE_ID_STUDIO ?? '',
  unlimited: process.env.STRIPE_PRICE_ID_UNLIMITED ?? '',
}

export function planCodeFromPriceId(priceId: string): string {
  for (const [plan, pid] of Object.entries(PLAN_PRICE_IDS)) {
    if (pid === priceId) return plan
  }
  return 'freedom'
}
