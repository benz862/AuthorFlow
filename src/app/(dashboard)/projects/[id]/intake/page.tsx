'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { BookProject } from '@/lib/types/database'
import { getIntakeQuestions } from '@/lib/ai/intake'
import { IntakeQuestion } from '@/lib/types/app'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function IntakePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [questions, setQuestions] = useState<IntakeQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => {
      if (data) {
        setProject(data)
        setQuestions(getIntakeQuestions(data))
      }
    })
  }, [projectId])

  const currentQ = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1

  const handleNext = async () => {
    if (isLast) {
      setSaving(true)
      await fetch(`/api/projects/${projectId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: questions.map((q) => ({ key: q.key, question: q.text, answer: answers[q.key] ?? '' })) }),
      })
      setSaving(false)
      setDone(true)
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }

  if (!project || questions.length === 0) {
    return (
      <div className="flex gap-6">
        <ProjectSidebar projectId={projectId} projectStatus="intake" />
        <div className="flex-1 flex items-center justify-center py-20"><Spinner size="lg" /></div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex gap-6">
        <ProjectSidebar projectId={projectId} projectStatus="research" />
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Intake Complete!</h2>
          <p className="text-gray-500 mb-6 max-w-sm">Your book details have been saved. Now let&apos;s research your topic.</p>
          <Button onClick={() => router.push(`/projects/${projectId}/research`)}>
            Start Research <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Book Intake</h1>
          <p className="text-sm text-gray-500">Question {currentIdx + 1} of {questions.length}</p>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mb-6">
          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{currentQ.text}</h2>
            {!currentQ.required && <p className="text-xs text-gray-400">Optional</p>}
          </div>

          {currentQ.type === 'select' && currentQ.options && (
            <div className="grid gap-2">
              {currentQ.options.map((opt) => (
                <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [currentQ.key]: opt }))}
                  className={`rounded-lg border-2 px-4 py-2.5 text-left text-sm transition-all ${answers[currentQ.key] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'multiselect' && currentQ.options && (
            <div className="grid gap-2">
              {currentQ.options.map((opt) => {
                const selected = (answers[currentQ.key] ?? '').split(',').filter(Boolean)
                const isSelected = selected.includes(opt)
                return (
                  <button key={opt}
                    onClick={() => {
                      const newSel = isSelected ? selected.filter((s) => s !== opt) : [...selected, opt]
                      setAnswers((a) => ({ ...a, [currentQ.key]: newSel.join(',') }))
                    }}
                    className={`rounded-lg border-2 px-4 py-2.5 text-left text-sm transition-all flex items-center gap-2 ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <div className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {(currentQ.type === 'text' || currentQ.type === 'textarea') && (
            <Textarea value={answers[currentQ.key] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [currentQ.key]: e.target.value }))} placeholder="Type your answer here..." rows={currentQ.type === 'textarea' ? 4 : 2} />
          )}

          {currentQ.type === 'boolean' && (
            <div className="flex gap-3">
              {['Yes', 'No'].map((opt) => (
                <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [currentQ.key]: opt }))}
                  className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-all ${answers[currentQ.key] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>Back</Button>
            <Button onClick={handleNext} loading={saving} disabled={currentQ.required && !answers[currentQ.key]} className="gap-1.5">
              {isLast ? 'Complete Intake' : 'Next'} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
