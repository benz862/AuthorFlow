'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { BookProject, BookAsset } from '@/lib/types/database'
import { ImageIcon, RefreshCw, Download, Sparkles, Wand2, Upload, CheckCircle2 } from 'lucide-react'

type Mode = 'auto' | 'custom' | 'upload'

export default function CoverPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [cover, setCover] = useState<BookAsset | null>(null)
  const [candidates, setCandidates] = useState<BookAsset[]>([])
  const [generating, setGenerating] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<Mode>('auto')
  const [customPrompt, setCustomPrompt] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    refreshAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const refreshAssets = async () => {
    const { data } = await supabase
      .from('book_assets')
      .select('*')
      .eq('project_id', projectId)
      .in('asset_type', ['cover', 'cover_candidate'])
      .order('created_at', { ascending: false })
    const all = (data ?? []) as BookAsset[]
    const current = all.find((a) => a.asset_type === 'cover') ?? null
    setCover(current)
    // Group the most recent candidates (same batchId as the current batch)
    const meta = (a: BookAsset | undefined) => ((a?.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
    const latestBatch = meta(all[0]).batchId as string | undefined
    const latestCandidates = latestBatch
      ? all.filter((a) => meta(a).batchId === latestBatch)
      : all.filter((a) => a.asset_type === 'cover_candidate').slice(0, 4)
    setCandidates(latestCandidates)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    const payload: Record<string, unknown> = { variants: 3 }
    if (mode === 'custom' && customPrompt.trim()) payload.customPrompt = customPrompt.trim()
    const res = await fetch(`/api/projects/${projectId}/generate-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to generate cover'); setGenerating(false); return }
    setCandidates((data.candidates ?? []) as BookAsset[])
    setCover(null) // force user to pick
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

  const handleSelect = async (assetId: string) => {
    setSelecting(assetId)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/select-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to select cover') }
    else await refreshAssets()
    setSelecting(null)
  }

  const handleToggleOverlay = async (next: boolean) => {
    if (!cover) return
    // Optimistic update
    const prev = cover
    setCover({ ...cover, metadata: { ...(cover.metadata as object ?? {}), overlayTitle: next } as never })
    const res = await fetch(`/api/projects/${projectId}/cover-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: cover.id, overlayTitle: next }),
    })
    if (!res.ok) {
      setCover(prev)
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to update cover setting')
    }
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file (PNG/JPG/WebP).'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20 MB.'); return }
    setUploading(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/upload-cover`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Upload failed'); setUploading(false); return }
    await refreshAssets()
    setUploading(false)
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
          <p className="text-sm text-gray-500">Generate three variants with AI, or upload your own.</p>
        </div>

        {/* Mode picker */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setMode('auto')}
              className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${mode === 'auto' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              ✨ Auto
            </button>
            <button type="button" onClick={() => setMode('custom')}
              className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${mode === 'custom' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              ✍️ Custom prompt
            </button>
            <button type="button" onClick={() => setMode('upload')}
              className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${mode === 'upload' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              ⬆️ Upload my own
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
                <p className="text-xs text-gray-400">Describe the scene, mood, lighting, and art style. Don&apos;t include the book title — it&apos;ll be overlaid in real text at export time.</p>
                <Button variant="outline" size="sm" onClick={handleEnhance} loading={enhancing} disabled={!customPrompt.trim()} className="gap-1.5 shrink-0 ml-3">
                  <Wand2 className="h-3.5 w-3.5" /> Enhance with AI
                </Button>
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center space-y-2">
              <input
                ref={uploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
              />
              <Upload className="h-8 w-8 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600">Upload a PNG, JPG, or WebP (up to 20 MB)</p>
              <p className="text-xs text-gray-400">Best results: at least 1600×2400 px, 3:4 portrait ratio.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => uploadRef.current?.click()} loading={uploading} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Choose image
              </Button>
            </div>
          )}

          {mode !== 'upload' && (
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button onClick={handleGenerate} loading={generating} disabled={mode === 'custom' && !customPrompt.trim()} className="gap-1.5">
                {candidates.length > 0 ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                Generate 3 variants
              </Button>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        {/* Variant picker */}
        {generating ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center"><Spinner size="lg" className="mx-auto mb-3" /><p className="text-gray-500">Generating 3 cover variants…</p></div>
          </div>
        ) : candidates.length > 1 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Pick your favorite</h2>
              <p className="text-xs text-gray-500">Click a variant to make it your cover. The title and author will be overlaid as real text at export time.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {candidates.map((c) => {
                const isSelected = cover?.id === c.id
                const isLoading = selecting === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className={`relative rounded-lg overflow-hidden border-4 transition-all ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent hover:border-gray-300'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.public_url ?? ''} alt="Cover variant" className="w-full aspect-[3/4] object-cover" />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1 shadow-lg">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : cover ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-center">
              <div className="relative w-64 shadow-2xl rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.public_url ?? ''} alt="Book cover" className="w-full" />
              </div>
            </div>

            {/* Title overlay toggle */}
            {(() => {
              const meta = (cover.metadata as Record<string, unknown> | null) ?? {}
              const overlay = meta.overlayTitle !== false // default true
              return (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Overlay title & author on cover</p>
                    <p className="text-xs text-gray-500">Turn off if your cover already has the title and author baked in.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleOverlay(!overlay)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${overlay ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    aria-pressed={overlay}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${overlay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )
            })()}

            {cover.public_url && (
              <div className="flex justify-center">
                <a href={cover.public_url} download>
                  <Button variant="outline" className="gap-1.5">
                    <Download className="h-4 w-4" /> Download Cover
                  </Button>
                </a>
              </div>
            )}
            {(cover as unknown as { generation_prompt?: string }).generation_prompt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Generation prompt</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{(cover as unknown as { generation_prompt?: string }).generation_prompt}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No cover yet</h3>
            <p className="text-sm text-gray-500">Pick a mode above and click Generate, or upload your own.</p>
          </div>
        )}
      </div>
    </div>
  )
}
