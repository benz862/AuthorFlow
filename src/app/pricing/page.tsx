import Link from 'next/link'
import { BookOpen, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PLANS = [
  { name: 'Freedom', price: 0, description: 'Try the platform. Start your first book.', features: ['1 active project', '1 book per month', 'Freebie-size books (5–15 pages)', '1 cover generation/month', '1 watermarked PDF export'], cta: 'Start Free', href: '/signup', highlight: false },
  { name: 'Starter', price: 12, description: 'For hobbyists and casual creators.', features: ['3 active projects', '3 books/month', 'Short books (20–60 pages)', '5 cover generations/month', '5 PDF exports/month', 'Styled text export'], cta: 'Get Starter', href: '/signup?plan=starter', highlight: false },
  { name: 'Creator', price: 29, description: 'The most popular plan for serious writers.', features: ['10 active projects', '10 books/month', 'Short & medium books (140 pages)', 'Deep source-backed research', '15 PDF exports/month', 'Source vault', 'Version history', 'Chapter regeneration'], cta: 'Get Creator', href: '/signup?plan=creator', highlight: true },
  { name: 'Studio', price: 59, description: 'For educators, agencies, and power users.', features: ['25 active projects', 'All book sizes (long)', "Children's illustration mode", '50 illustration generations/month', 'Unlimited PDF exports', 'Priority processing'], cta: 'Get Studio', href: '/signup?plan=studio', highlight: false },
  { name: 'Unlimited', price: 99, description: 'Maximum throughput for high-volume creators.', features: ['Unlimited projects', 'Unlimited books (fair use)', 'All features', '150 illustration generations/month', 'Fastest queue priority'], cta: 'Get Unlimited', href: '/signup?plan=unlimited', highlight: false },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
            <BookOpen className="h-6 w-6 text-indigo-600" />
            AuthorFlow
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="outline" size="sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm">Get Started Free</Button></Link>
          </div>
        </div>
      </nav>

      <div className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
            <p className="text-lg text-gray-500">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`rounded-xl border p-6 flex flex-col ${plan.highlight ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 bg-white'}`}>
                {plan.highlight && (
                  <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white mb-3 self-start">Most Popular</span>
                )}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button className="w-full" variant={plan.highlight ? 'default' : 'outline'}>{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">14-day money-back guarantee on all paid plans.</p>
        </div>
      </div>
    </div>
  )
}
