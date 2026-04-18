'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject, BookOutline } from '@/lib/types/database'
import { OutlineStructure } from '@/lib/types/app'
import { AlignLeft, RefreshCw, Check } from 'lucide-react'

export default function OutlinePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [outline, setOutline] = useState<BookOutline | null>(null)
  const [structure, setStructure] = useState<OutlineStructure | null>(null)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('book_outlines').select('*').eq('project_id', projectId).eq('is_current', true).single().then(({ data }) => {
      if (data) { setOutline(data); if (data.outline_json) setStructure(data.outline_json as OutlineStructure) }
    })
  }, [projectId])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/generate-outline`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to generate'); setGenerating(false); return }
    setOutline(data.outline)
    if (data.outline?.outline_json) setStructure(data.outline.outline_json as OutlineStructure)
    setGenerating(false)
  }

  const handleApprove = async () => {
    if (!outline) return
    setApproving(true)
    await supabase.from('book_outlines').update({ is_approved: true }).eq('id', outline.id)
    await supabase.from('book_projects').update({ outline_locked: true, status: 'drafting', updated_at: new Date().toISOString() }).eq('id', projectId)
    router.push(`/projects/${projectId}/chapters`)
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="outline" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Outline</h1>
            <p className="text-sm text-gray-500">Review and approve your book structure</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerate} loading={generating} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              {outline ? 'Regenerate' : 'Generate Outline'}
            </Button>
            {outline && (
              <Button onClick={handleApprove} loading={approving} className="gap-1.5">
                <Check className="h-4 w-4" /> Approve & Start Writing
              </Button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        {!outline && !generating && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <AlignLeft className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No outline yet</h3>
            <p className="text-sm text-gray-500">Click &ldquo;Generate Outline&rdquo; to create your book structure.</p>
          </div>
        )}

        {generating && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center"><Spinner size="lg" className="mx-auto mb-3" /><p className="text-gray-500">Generating your outline...</p></div>
          </div>
        )}

        {structure && !generating && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {structure.frontMatter?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Front Matter</h3>
                <ul className="space-y-1">{structure.frontMatter.map((item) => <li key={item} className="text-sm text-gray-600 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gray-300" />{item}</li>)}</ul>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Chapters</h3>
              <div className="space-y-3">
                {structure.chapters?.map((ch) => (
                  <div key={ch.number} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Chapter {ch.number}: {ch.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ch.summary}</p>
                      </div>
                      {ch.estimatedWords && <span className="text-xs text-gray-400 shrink-0">~{ch.estimatedWords.toLocaleString()} words</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {structure.backMatter?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Back Matter</h3>
                <ul className="space-y-1">{structure.backMatter.map((item) => <li key={item} className="text-sm text-gray-600 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gray-300" />{item}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
