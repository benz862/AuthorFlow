'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PLAN_PRICES } from '@/lib/types/app'
import { CheckCircle2, ExternalLink } from 'lucide-react'

const PLAN_FEATURES: Record<string, string[]> = {
  freedom: ['3 projects', '2 chapters/project', 'PDF export', 'Basic AI writing'],
  starter: ['10 projects', '20 chapters/project', 'PDF + EPUB export', 'Research engine', 'Source vault'],
  creator: ['25 projects', '50 chapters/project', 'All export formats', 'Cover generation', 'Version history'],
  studio: ['75 projects', 'Unlimited chapters', 'Priority AI', 'Children\'s illustration mode', 'Advanced research'],
  unlimited: ['Unlimited everything', 'Fastest AI models', 'White-glove support', 'API access'],
}

export default function BillingPage() {
  const supabase = createClient()
  const [plan, setPlan] = useState<string>('freedom')
  const [loading, setLoading] = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('subscription_status').select('plan_code, stripe_subscription_id').eq('user_id', user.id).single()
      if (data) {
        setPlan(data.plan_code)
        setHasSubscription(!!data.stripe_subscription_id)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleCheckout = async (planCode: string) => {
    setCheckoutPlan(planCode)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planCode }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setCheckoutPlan(null)
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
    setPortalLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
  )

  const plans = ['freedom', 'starter', 'creator', 'studio', 'unlimited'] as const

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plan</h1>
          <p className="text-sm text-gray-500 mt-1">Current plan: <span className="font-medium capitalize text-indigo-600">{plan}</span></p>
        </div>
        {hasSubscription && (
          <Button variant="outline" onClick={handlePortal} loading={portalLoading} className="gap-1.5">
            <ExternalLink className="h-4 w-4" /> Manage Subscription
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {plans.map((p) => {
          const isCurrent = plan === p
          const price = PLAN_PRICES[p]
          return (
            <div key={p} className={`rounded-xl border p-4 flex flex-col ${isCurrent ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3">
                <p className="font-semibold capitalize text-gray-900">{p}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {price === 0 ? 'Free' : `$${price}`}
                  {price > 0 && <span className="text-sm font-normal text-gray-500">/mo</span>}
                </p>
              </div>
              <ul className="space-y-1.5 flex-1 mb-4">
                {PLAN_FEATURES[p]?.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="text-center text-xs font-medium text-indigo-600 py-1.5">Current Plan</span>
              ) : (
                <Button size="sm" variant={p === 'unlimited' ? 'default' : 'outline'} onClick={() => handleCheckout(p)}
                  loading={checkoutPlan === p} className="w-full">
                  {price === 0 ? 'Downgrade' : 'Upgrade'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
