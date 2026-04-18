'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject } from '@/lib/types/database'
import { Download, FileType2, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { FONT_PRESETS, DEFAULT_FONT_PRESET, FontPresetKey } from '@/lib/pdf/fonts'
import { TRIM_SIZES, DEFAULT_TRIM } from '@/lib/pdf/trim-sizes'

type JobRow = {
  id: string
  export_format: string
  status: string
  created_at: string
  error_message?: string | null
  output_asset_id?: string | null
}

type AssetRow = {
  id: string
  public_url: string | null
  asset_type: string
}

export default function ExportsPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [assets, setAssets] = useState<Record<string, AssetRow>>({})
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const [fontPreset, setFontPreset] = useState<FontPresetKey>(DEFAULT_FONT_PRESET)
  const [trimKey, setTrimKey] = useState<string>(DEFAULT_TRIM)
  const [format, setFormat] = useState<'pdf' | 'md'>('pdf')

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => {
      setProject(data)
      if (data?.trim_size) setTrimKey(data.trim_size)
    })
    refreshJobs()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshJobs = async () => {
    const { data: jobData } = await supabase.from('export_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    setJobs((jobData ?? []) as JobRow[])
    const ids = (jobData ?? []).map((j: JobRow) => j.output_asset_id).filter(Boolean) as string[]
    if (ids.length > 0) {
      const { data: assetData } = await supabase.from('book_assets').select('id, public_url, asset_type').in('id', ids)
      const map: Record<string, AssetRow> = {}
      for (const a of (assetData ?? []) as AssetRow[]) map[a.id] = a
      setAssets(map)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, fontPreset, trimSize: trimKey }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Export failed')
      setExporting(false)
      return
    }
    setExporting(false)
    await refreshJobs()
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="drafting" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  const portraitTrims = TRIM_SIZES.filter((t) => t.category === 'portrait')
  const landscapeTrims = TRIM_SIZES.filter((t) => t.category === 'landscape')
  const digitalTrims = TRIM_SIZES.filter((t) => t.category === 'digital')

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exports</h1>
          <p className="text-sm text-gray-500">Generate a polished PDF of your finished book</p>
        </div>

        {/* Format */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Format</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('pdf')}
              className={`flex-1 flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all text-left ${format === 'pdf' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <FileType2 className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">PDF</p>
                <p className="text-xs text-gray-500">Print-ready, with cover + TOC</p>
              </div>
            </button>
            <button
              onClick={() => setFormat('md')}
              className={`flex-1 flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all text-left ${format === 'md' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <FileText className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Markdown</p>
                <p className="text-xs text-gray-500">Plain source text, for editing</p>
              </div>
            </button>
          </div>
        </div>

        {format === 'pdf' && (
          <>
            {/* Font preset */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Typography</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(FONT_PRESETS).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setFontPreset(p.key)}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${fontPreset === p.key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{p.description}</p>
                    <p className="text-xs text-gray-400 mt-1 italic">{p.recommendedFor}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Trim size */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Trim Size</h2>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Portrait (standard print)</p>
                <div className="space-y-1.5">
                  {portraitTrims.map((t) => (
                    <TrimOption key={t.key} trim={t} selected={trimKey === t.key} onSelect={() => setTrimKey(t.key)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Landscape</p>
                <div className="space-y-1.5">
                  {landscapeTrims.map((t) => (
                    <TrimOption key={t.key} trim={t} selected={trimKey === t.key} onSelect={() => setTrimKey(t.key)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Digital-first</p>
                <div className="space-y-1.5">
                  {digitalTrims.map((t) => (
                    <TrimOption key={t.key} trim={t} selected={trimKey === t.key} onSelect={() => setTrimKey(t.key)} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        <div className="flex justify-end">
          <Button onClick={handleExport} loading={exporting} className="gap-1.5">
            <Download className="h-4 w-4" /> {exporting ? 'Generating...' : `Generate ${format.toUpperCase()}`}
          </Button>
        </div>

        {jobs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Export History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {jobs.map((job) => {
                const asset = job.output_asset_id ? assets[job.output_asset_id] : null
                return (
                  <div key={job.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {job.export_format === 'pdf'
                        ? <FileType2 className="h-5 w-5 text-red-500" />
                        : <FileText className="h-5 w-5 text-green-500" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job.export_format.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">{new Date(job.created_at).toLocaleString()}</p>
                        {job.status === 'failed' && job.error_message && (
                          <p className="text-xs text-red-500 mt-0.5">{job.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'processing' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {job.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {job.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {job.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                      {job.status === 'completed' && asset?.public_url && (
                        <a href={asset.public_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1">
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TrimOption({
  trim,
  selected,
  onSelect,
}: {
  trim: (typeof TRIM_SIZES)[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-3 rounded-lg border p-2.5 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
        {selected && <div className="h-full w-full rounded-full bg-white scale-[0.4]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{trim.label}</p>
        <p className="text-xs text-gray-500">{trim.description}</p>
      </div>
    </button>
  )
}
