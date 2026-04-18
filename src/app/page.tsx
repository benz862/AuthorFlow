import Link from 'next/link'
import { BookOpen, CheckCircle2, Zap, Globe, Shield, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: Globe, title: 'Research-Backed Writing', desc: 'We search the web, collect sources, and write from real evidence — not hallucinations.' },
  { icon: Zap, title: 'AI Intake Interview', desc: 'A guided editor-style onboarding collects everything needed to write your specific book.' },
  { icon: BookOpen, title: 'Chapter-by-Chapter Generation', desc: 'Each chapter is written individually, saved independently, and editable at any time.' },
  { icon: Shield, title: 'Source Vault', desc: 'All research sources are saved to your project. Know exactly where every claim came from.' },
  { icon: CheckCircle2, title: 'One-Click Export', desc: 'Export to formatted PDF in standard book sizes or styled text. Ready to publish.' },
  { icon: Star, title: 'Version History', desc: 'Every major draft is preserved. Compare versions, restore earlier content anytime.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
            <BookOpen className="h-6 w-6 text-indigo-600" />
            AuthorFlow
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing"><Button variant="ghost" size="sm">Pricing</Button></Link>
            <Link href="/login"><Button variant="outline" size="sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm">Get Started Free</Button></Link>
          </div>
        </div>
      </nav>

      <section className="px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700 font-medium mb-6">
            <Zap className="h-3.5 w-3.5" />
            Research-backed AI authoring platform
          </div>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4">
            Turn your idea into a{' '}
            <span className="text-indigo-600">complete book</span>
          </h1>
          <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
            AuthorFlow guides you through research, outlines, chapter writing, cover design, and export — all in one platform.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/signup"><Button size="lg">Start Writing Free</Button></Link>
            <Link href="/pricing"><Button variant="outline" size="lg">See Pricing</Button></Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card required · Free plan available forever</p>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Everything you need to write a real book</h2>
          <p className="text-center text-gray-500 mb-10">Not a prompt box. A publishing platform.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-white border border-gray-200 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 mb-3">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Ready to write your book?</h2>
          <p className="text-gray-500 mb-6">Join authors, educators, and business owners creating books with AI assistance.</p>
          <Link href="/signup"><Button size="lg">Create Your Free Account</Button></Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 px-4 py-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between flex-wrap gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <strong className="text-gray-600">AuthorFlow</strong>
          </span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/login" className="hover:text-gray-600">Login</Link>
            <Link href="/signup" className="hover:text-gray-600">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
