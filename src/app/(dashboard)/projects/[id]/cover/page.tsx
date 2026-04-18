'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { BookProject, BookAsset } from '@/lib/types/database'
import { ImageIcon, RefreshCw, Download, Sparkles, Wand2 } from 'lucide-react'

type Mode = 'auto' | 'custom'

export default function CoverPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [cover, setCover] = useState<BookAsset | null>(null)
  const [generating, setGenerating] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<Mode>('auto')
  const [customPrompt, setCustomPrompt] = useState('')

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('book_assets').select('*').eq('project_id', projectId).eq('asset_type', 'cover').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      if (data && data.length > 0) setCover(data[0])
    })
  }, [projectId])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    const payload = mode === 'custom' ? { customPrompt } : {}
    const res = await fetch(`/api/projects/${projectId}/generate-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to generate cover'); setGenerating(false); return }
    if (data.asset) setCover(data.asset)
    setGenerating(false)
  }

  const handleEnhance = async () => {
    if (!customPrompt.trim()) return
    setEnhancing(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/generate-cover`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rough: customPrompt }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to enhance prompt') }
    else if (data.enhanced) setCustomPrompt(data.enhanced)
    setEnhancing(false)
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="drafting" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cover & Art</h1>
          <p className="text-sm text-gray-500">AI-generated cover image for your book</p>
        </div>

        {/* Prompt controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('auto')}
              className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${mode === 'auto' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              ✨ Auto-generate from book details
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${mode === 'custom' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              ✍️ Write my own prompt
            </button>
          </div>

          {mode === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Describe your cover</label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="A 50-year-old man standing in a grocery store checkout line, worried expression, muted documentary-photo lighting, shallow depth of field..."
                rows={5}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Tip: describe the scene, mood, lighting, and art style. Don&apos;t include the book title — Imagen handles images only.</p>
                <Button variant="outline" size="sm" onClick={handleEnhance} loading={enhancing} disabled={!customPrompt.trim()} className="gap-1.5 shrink-0 ml-3">
                  <Wand2 className="h-3.5 w-3.5" /> Enhance with AI
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button onClick={handleGenerate} loading={generating} disabled={mode === 'custom' && !customPrompt.trim()} className="gap-1.5">
              {cover ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {cover ? 'Regenerate Cover' : 'Generate Cover'}
            </Button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        {/* Cover display */}
        {generating ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center"><Spinner size="lg" className="mx-auto mb-3" /><p className="text-gray-500">Generating your cover...</p></div>
          </div>
        ) : cover ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-center">
              <div className="relative w-64 shadow-2xl rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.public_url ?? ''} alt="Book cover" className="w-full" />
              </div>
            </div>
            {cover.public_url && (
              <div className="flex justify-center">
                <a href={cover.public_url} download>
                  <Button variant="outline" className="gap-1.5">
                    <Download className="h-4 w-4" /> Download Cover
                  </Button>
                </a>
              </div>
            )}
            {cover.generation_prompt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Generation prompt</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{cover.generation_prompt}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No cover yet</h3>
            <p className="text-sm text-gray-500">Pick a mode above and click Generate Cover.</p>
          </div>
        )}
      </div>
    </div>
  )
}
