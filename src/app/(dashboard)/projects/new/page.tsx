'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_LABELS, BOOK_TYPE_LABELS, BOOK_TYPES } from '@/lib/types/app'

const STEPS = ['Category', 'Type', 'Details', 'Review']
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const BOOK_TYPE_OPTIONS = BOOK_TYPES.map((t) => ({ value: t, label: BOOK_TYPE_LABELS[t] }))

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ category: '', book_type: '', title: '', subtitle: '', intent: '' })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    const response = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const result = await response.json()
    if (!response.ok) {
      setError(result.error ?? 'Failed to create project')
      setLoading(false)
    } else {
      router.push(`/projects/${result.id}/intake`)
    }
  }

  const steps = [
    <div key="cat" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">What size book do you want to write?</h2>
        <p className="text-gray-500 text-sm mt-1">This determines your book&apos;s scope and chapter count.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORY_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => set('category', opt.value)}
            className={`rounded-xl border-2 p-4 text-left transition-all ${form.category === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <span className="font-semibold text-gray-900 capitalize">{opt.value}</span><br />
            <span className="text-sm text-gray-500">{opt.label.split('(')[1]?.replace(')', '') ?? ''}</span>
          </button>
        ))}
      </div>
    </div>,

    <div key="type" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">What type of book are you writing?</h2>
        <p className="text-gray-500 text-sm mt-1">This shapes the writing style, structure, and tone.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {BOOK_TYPE_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => set('book_type', opt.value)}
            className={`rounded-xl border-2 p-3 text-left text-sm transition-all ${form.book_type === opt.value ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>,

    <div key="details" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Tell us about your book</h2>
        <p className="text-gray-500 text-sm mt-1">Don&apos;t worry — you can refine everything later.</p>
      </div>
      <Input label="Working title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. The Beginner's Guide to Investing" required />
      <Input label="Subtitle (optional)" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="e.g. Building Wealth From Zero" />
      <Textarea label="What is the goal of this book?" value={form.intent} onChange={(e) => set('intent', e.target.value)} placeholder="e.g. Help beginners understand investing without jargon" rows={3} />
    </div>,

    <div key="review" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Ready to create your project?</h2>
        <p className="text-gray-500 text-sm mt-1">We&apos;ll start the guided intake interview next.</p>
      </div>
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-3">
        {[['Category', form.category], ['Type', BOOK_TYPE_LABELS[form.book_type as keyof typeof BOOK_TYPE_LABELS] ?? form.book_type], ['Title', form.title]].map(([label, val]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium capitalize">{val}</span>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>,
  ]

  const canNext = [!!form.category, !!form.book_type, !!form.title.trim(), true][step]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-gray-500">New Book Project</span>
        </div>
        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              <span className={`text-xs mt-1 block ${i === step ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {steps[step]}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1.5">Continue <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={handleCreate} loading={loading} disabled={!canNext} className="gap-1.5">Create Project <ChevronRight className="h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  )
}
