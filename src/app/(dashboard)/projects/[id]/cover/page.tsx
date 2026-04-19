'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { BookProject, BookAsset } from '@/lib/types/database'
import { ImageIcon, RefreshCw, Download, Sparkles, Wand2, Upload, CheckCircle2, Trash2 } from 'lucide-react'

type Mode = 'auto' | 'custom' | 'upload'
type LogoPos = 'tl' | 'tc' | 'tr' | 'cl' | 'center' | 'cr' | 'bl' | 'bc' | 'br'

const LOGO_POS_STYLE: Record<LogoPos, React.CSSProperties> = {
  tl:     { top: '5%',  left: '5%' },
  tc:     { top: '5%',  left: '50%', transform: 'translateX(-50%)' },
  tr:     { top: '5%',  right: '5%' },
  cl:     { top: '50%', left: '5%',  transform: 'translateY(-50%)' },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  cr:     { top: '50%', right: '5%', transform: 'translateY(-50%)' },
  bl:     { bottom: '5%', left: '5%' },
  bc:     { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
  br:     { bottom: '5%', right: '5%' },
}

export default function CoverPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [cover, setCover] = useState<BookAsset | null>(null)
  const [candidates, setCandidates] = useState<BookAsset[]>([])
  const [logo, setLogo] = useState<BookAsset | null>(null)
  const [generating, setGenerating] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<Mode>('auto')
  const [customPrompt, setCustomPrompt] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

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
      .in('asset_type', ['cover', 'cover_candidate', 'logo'])
      .order('created_at', { ascending: false })
    const all = (data ?? []) as BookAsset[]
    const current = all.find((a) => a.asset_type === 'cover') ?? null
    setCover(current)
    const latestLogo = all.find((a) => a.asset_type === 'logo') ?? null
    setLogo(latestLogo)
    // Group the most recent candidates (same batchId as the current batch)
    const covers = all.filter((a) => a.asset_type === 'cover' || a.asset_type === 'cover_candidate')
    const meta = (a: BookAsset | undefined) => ((a?.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
    const latestBatch = meta(covers[0]).batchId as string | undefined
    const latestCandidates = latestBatch
      ? covers.filter((a) => meta(a).batchId === latestBatch)
      : covers.filter((a) => a.asset_type === 'cover_candidate').slice(0, 4)
    setCandidates(latestCandidates)
  }

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5 MB.'); return }
    setUploadingLogo(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/logo`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Logo upload failed'); setUploadingLogo(false); return }
    setLogo(data.asset)
    // If we have a cover, turn on logoOnCover by default
    if (cover) await patchCover({ logoOnCover: true })
    setUploadingLogo(false)
  }

  const handleLogoDelete = async () => {
    await fetch(`/api/projects/${projectId}/logo`, { method: 'DELETE' })
    setLogo(null)
    if (cover) await patchCover({ logoOnCover: false })
  }

  const patchCover = async (patch: Record<string, unknown>) => {
    if (!cover) return
    const prev = cover
    const prevMeta = (cover.metadata as Record<string, unknown> | null) ?? {}
    setCover({ ...cover, metadata: { ...prevMeta, ...patch } as never })
    const res = await fetch(`/api/projects/${projectId}/cover-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: cover.id, ...patch }),
    })
    if (!res.ok) {
      setCover(prev)
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to update')
    }
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
    await patchCover({ overlayTitle: next })
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
        ) : (
          <>
            {candidates.length > 1 && (
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
            )}
            {cover ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            {(() => {
              const meta = (cover.metadata as Record<string, unknown> | null) ?? {}
              const overlay = meta.overlayTitle !== false // default true
              const logoOnCover = !!meta.logoOnCover
              const logoPosition = (meta.logoPosition as LogoPos) ?? 'br'
              const logoSizePct = typeof meta.logoSizePct === 'number' ? meta.logoSizePct : 18
              const logoOpacity = typeof meta.logoOpacity === 'number' ? meta.logoOpacity : 1
              const textColor = typeof meta.textColor === 'string' ? meta.textColor : '#ffffff'
              const scrimOpacity = typeof meta.scrimOpacity === 'number' ? meta.scrimOpacity : 0.45
              const titleSize = typeof meta.titleSize === 'number' ? meta.titleSize : 40
              const titleVPos = (meta.titleVPos as 'top' | 'middle' | 'bottom') ?? 'top'
              const authorSize = typeof meta.authorSize === 'number' ? meta.authorSize : 18
              const authorVPos = (meta.authorVPos as 'top' | 'middle' | 'bottom') ?? 'bottom'
              const titleTopCss = titleVPos === 'top' ? '6%' : titleVPos === 'middle' ? '40%' : '70%'
              const authorPosCss: React.CSSProperties =
                authorVPos === 'top'
                  ? { top: '5%', left: '8%', right: '8%' }
                  : authorVPos === 'middle'
                    ? { top: '50%', left: '8%', right: '8%', transform: 'translateY(-50%)' }
                    : { bottom: '5%', left: '8%', right: '8%' }
              const PRESET_COLORS = ['#ffffff', '#000000', '#facc15', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7']

              return (
                <>
                  {/* Live preview */}
                  <div className="flex justify-center">
                    <div className="relative w-64 shadow-2xl rounded-lg overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cover.public_url ?? ''} alt="Book cover" className="w-full h-full object-cover" />
                      {overlay && (
                        <>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: `rgba(0,0,0,${scrimOpacity})` }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%', background: `rgba(0,0,0,${scrimOpacity})` }} />
                          <div style={{ position: 'absolute', top: titleTopCss, left: '8%', right: '8%', textAlign: 'center', color: textColor }}>
                            <div style={{ fontSize: `${titleSize * 0.32}px`, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>{project.title}</div>
                            {project.subtitle && (
                              <div style={{ fontSize: '11px', opacity: 0.92 }}>{project.subtitle}</div>
                            )}
                          </div>
                          <div style={{ position: 'absolute', textAlign: 'center', color: textColor, letterSpacing: 1, fontSize: `${authorSize * 0.6}px`, ...authorPosCss }}>
                            AUTHOR
                          </div>
                        </>
                      )}
                      {logo && logoOnCover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo.public_url ?? ''}
                          alt="Logo"
                          style={{
                            position: 'absolute',
                            width: `${logoSizePct}%`,
                            opacity: logoOpacity,
                            ...LOGO_POS_STYLE[logoPosition],
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Title overlay toggle */}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Overlay title &amp; author on cover</p>
                      <p className="text-xs text-gray-500">Turn off if your cover already has text baked in.</p>
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

                  {/* Text styling */}
                  {overlay && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Text styling</p>
                        <p className="text-xs text-gray-500">Color, size, and position of the title and author on the cover.</p>
                      </div>

                      {/* Color */}
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Text color</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => patchCover({ textColor: c })}
                              className={`h-7 w-7 rounded-full border-2 ${textColor.toLowerCase() === c ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-300'}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => patchCover({ textColor: e.target.value })}
                            className="h-7 w-10 rounded border border-gray-300 cursor-pointer"
                            title="Custom color"
                          />
                        </div>
                      </div>

                      {/* Scrim opacity */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-600">Scrim darkness</p>
                          <span className="text-xs text-gray-500">{Math.round(scrimOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.8}
                          step={0.05}
                          value={scrimOpacity}
                          onChange={(e) => patchCover({ scrimOpacity: Number(e.target.value) })}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-400 mt-1">Dark bands behind the title/author for legibility over busy artwork.</p>
                      </div>

                      {/* Title size */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-600">Title size</p>
                          <span className="text-xs text-gray-500">{titleSize} pt</span>
                        </div>
                        <input
                          type="range"
                          min={16}
                          max={72}
                          step={1}
                          value={titleSize}
                          onChange={(e) => patchCover({ titleSize: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>

                      {/* Title vertical position */}
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Title vertical position</p>
                        <div className="grid grid-cols-3 gap-1">
                          {(['top', 'middle', 'bottom'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => patchCover({ titleVPos: p })}
                              className={`rounded border-2 px-2 py-1.5 text-xs capitalize transition-all ${titleVPos === p ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Author size */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-600">Author size</p>
                          <span className="text-xs text-gray-500">{authorSize} pt</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={36}
                          step={1}
                          value={authorSize}
                          onChange={(e) => patchCover({ authorSize: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>

                      {/* Author vertical position */}
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Author position</p>
                        <div className="grid grid-cols-3 gap-1">
                          {(['top', 'middle', 'bottom'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => patchCover({ authorVPos: p })}
                              className={`rounded border-2 px-2 py-1.5 text-xs capitalize transition-all ${authorVPos === p ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logo / branding */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Logo on cover</p>
                        <p className="text-xs text-gray-500">Upload a transparent PNG for best results.</p>
                      </div>
                      {logo ? (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logo.public_url ?? ''} alt="Logo preview" className="h-10 w-10 object-contain bg-white rounded border border-gray-200" />
                          <Button type="button" variant="outline" size="sm" onClick={handleLogoDelete} className="gap-1">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = '' }}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} loading={uploadingLogo} className="gap-1.5">
                            <Upload className="h-3.5 w-3.5" /> Upload logo
                          </Button>
                        </>
                      )}
                    </div>

                    {logo && (
                      <>
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-900">Show logo on cover</p>
                          <button
                            type="button"
                            onClick={() => patchCover({ logoOnCover: !logoOnCover })}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${logoOnCover ? 'bg-indigo-600' : 'bg-gray-300'}`}
                            aria-pressed={logoOnCover}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${logoOnCover ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>

                        {logoOnCover && (
                          <div className="space-y-3 pt-2 border-t border-gray-200">
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-1.5">Position</p>
                              <div className="grid grid-cols-3 gap-1 w-32">
                                {(['tl','tc','tr','cl','center','cr','bl','bc','br'] as LogoPos[]).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => patchCover({ logoPosition: p })}
                                    className={`aspect-square rounded border-2 transition-all ${logoPosition === p ? 'border-indigo-500 bg-indigo-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    title={p}
                                  >
                                    <span className="block w-1.5 h-1.5 rounded-full bg-indigo-600 mx-auto" style={{ opacity: logoPosition === p ? 1 : 0.3 }} />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium text-gray-600">Size</p>
                                <span className="text-xs text-gray-500">{logoSizePct}% of cover width</span>
                              </div>
                              <input
                                type="range"
                                min={5}
                                max={40}
                                step={1}
                                value={logoSizePct}
                                onChange={(e) => patchCover({ logoSizePct: Number(e.target.value) })}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium text-gray-600">Opacity</p>
                                <span className="text-xs text-gray-500">{Math.round(logoOpacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={logoOpacity}
                                onChange={(e) => patchCover({ logoOpacity: Number(e.target.value) })}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {cover.public_url && (
                    <div className="flex justify-center">
                      <a href={cover.public_url} download>
                        <Button variant="outline" className="gap-1.5">
                          <Download className="h-4 w-4" /> Download Cover (artwork only)
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
                </>
              )
            })()}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No cover yet</h3>
            <p className="text-sm text-gray-500">Pick a mode above and click Generate, or upload your own.</p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
