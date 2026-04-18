'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject } from '@/lib/types/database'
import { Download, FileType2, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { FONT_PRESETS, DEFAULT_FONT_PRESET, FontPresetKey, FontPreset } from '@/lib/pdf/fonts'
import {
  TRIM_SIZES,
  DEFAULT_TRIM,
  TextSizeKey,
  MarginPresetKey,
  TEXT_SIZE_DELTA,
} from '@/lib/pdf/trim-sizes'

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

/** Inject @font-face rules so the browser renders the same fonts as the PDF. */
function useFontFaceInjection() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const styleId = 'pdf-preset-fonts'
    if (document.getElementById(styleId)) return

    const rules: string[] = []
    for (const p of Object.values(FONT_PRESETS)) {
      for (const [family, cfg, hasItalic] of [
        [p.body.family, p.body, true],
        [p.heading.family, p.heading, false],
      ] as const) {
        rules.push(`
          @font-face {
            font-family: "${family}";
            font-weight: 400;
            font-style: normal;
            src: url("${cfg.regular}") format("woff");
            font-display: swap;
          }
          @font-face {
            font-family: "${family}";
            font-weight: 700;
            font-style: normal;
            src: url("${cfg.bold}") format("woff");
            font-display: swap;
          }`)
        if (hasItalic && 'italic' in cfg && 'boldItalic' in cfg) {
          rules.push(`
            @font-face {
              font-family: "${family}";
              font-weight: 400;
              font-style: italic;
              src: url("${cfg.italic}") format("woff");
              font-display: swap;
            }
            @font-face {
              font-family: "${family}";
              font-weight: 700;
              font-style: italic;
              src: url("${cfg.boldItalic}") format("woff");
              font-display: swap;
            }`)
        }
      }
    }

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = rules.join('\n')
    document.head.appendChild(style)
  }, [])
}

export default function ExportsPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  useFontFaceInjection()

  const [project, setProject] = useState<BookProject | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [assets, setAssets] = useState<Record<string, AssetRow>>({})
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  const [fontPreset, setFontPreset] = useState<FontPresetKey>(DEFAULT_FONT_PRESET)
  const [trimKey, setTrimKey] = useState<string>(DEFAULT_TRIM)
  const [format, setFormat] = useState<'pdf' | 'md'>('pdf')
  const [textSize, setTextSize] = useState<TextSizeKey>('normal')
  const [marginPreset, setMarginPreset] = useState<MarginPresetKey>('normal')

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
    setLastUrl(null)
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, fontPreset, trimSize: trimKey, textSize, marginPreset }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Export failed')
      setExporting(false)
      return
    }
    setExporting(false)
    if (data.url) {
      setLastUrl(data.url)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    }
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
  const selectedTrim = TRIM_SIZES.find((t) => t.key === trimKey) ?? TRIM_SIZES[0]
  const effectiveBodyPt = selectedTrim.defaultBodyPt + TEXT_SIZE_DELTA[textSize]

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
            {/* Font preset — with live previews */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Typography</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  What you see below is exactly how the PDF will render.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(FONT_PRESETS).map((p) => (
                  <FontPresetCard
                    key={p.key}
                    preset={p}
                    selected={fontPreset === p.key}
                    onSelect={() => setFontPreset(p.key)}
                  />
                ))}
              </div>
            </div>

            {/* Trim size */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Trim Size</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selected: <span className="font-medium text-gray-700">{selectedTrim.label}</span> · default body{' '}
                  <span className="font-medium text-gray-700">{selectedTrim.defaultBodyPt}pt</span>
                </p>
              </div>

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

            {/* Text size + margins */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Text Size &amp; Margins</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Effective body size: <span className="font-medium text-gray-700">{effectiveBodyPt}pt</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Text size</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'normal', 'large'] as TextSizeKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setTextSize(k)}
                      className={`rounded-lg border-2 p-2.5 text-sm font-medium capitalize transition-all ${textSize === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {k}
                      <span className="block text-xs font-normal text-gray-400 mt-0.5">
                        {TEXT_SIZE_DELTA[k] === 0 ? `${selectedTrim.defaultBodyPt}pt` :
                          `${selectedTrim.defaultBodyPt + TEXT_SIZE_DELTA[k]}pt`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Margins</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['tight', 'normal', 'wide'] as MarginPresetKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setMarginPreset(k)}
                      className={`rounded-lg border-2 p-2.5 text-sm font-medium capitalize transition-all ${marginPreset === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        {lastUrl && (
          <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900">Your {format.toUpperCase()} is ready</p>
                <p className="text-xs text-green-700">If it didn&apos;t open automatically, click below.</p>
              </div>
            </div>
            <a href={lastUrl} target="_blank" rel="noopener noreferrer" download>
              <Button className="gap-1.5 bg-green-600 hover:bg-green-700">
                <Download className="h-4 w-4" /> Open / Download
              </Button>
            </a>
          </div>
        )}

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

function FontPresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: FontPreset
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col rounded-lg border-2 text-left overflow-hidden transition-all ${selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className="px-4 pt-3 pb-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
          {selected && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">Selected</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
        <p className="text-xs text-gray-400 italic mt-0.5">{preset.recommendedFor}</p>
      </div>
      <div className="px-4 py-3 bg-white">
        {/* Chapter title */}
        <p
          style={{
            fontFamily: `"${preset.heading.family}", serif`,
            fontWeight: 700,
            fontSize: 20,
            marginBottom: 8,
            color: '#111827',
          }}
        >
          Chapter Title
        </p>
        {/* Section heading */}
        <p
          style={{
            fontFamily: `"${preset.heading.family}", serif`,
            fontWeight: 700,
            fontSize: 14,
            marginTop: 8,
            marginBottom: 4,
            color: '#1f2937',
          }}
        >
          A Section Heading
        </p>
        {/* Body paragraph */}
        <p
          style={{
            fontFamily: `"${preset.body.family}", serif`,
            fontSize: 11,
            lineHeight: 1.55,
            color: '#374151',
            marginBottom: 6,
          }}
        >
          The body copy reads in <strong>{preset.body.family}</strong> with{' '}
          <em style={{ fontStyle: 'italic' }}>italics</em> and{' '}
          <strong>bold emphasis</strong> on key terms. Long passages feel
          comfortable at this size — the point of a body face is disappearing.
        </p>
        {/* Subheading */}
        <p
          style={{
            fontFamily: `"${preset.heading.family}", serif`,
            fontWeight: 700,
            fontSize: 12,
            marginTop: 6,
            marginBottom: 3,
            color: '#1f2937',
          }}
        >
          A Subheading
        </p>
        {/* Bullet list */}
        <ul
          style={{
            fontFamily: `"${preset.body.family}", serif`,
            fontSize: 11,
            lineHeight: 1.45,
            color: '#374151',
            listStyleType: 'disc',
            paddingLeft: 18,
            margin: 0,
          }}
        >
          <li>Bulleted takeaway</li>
          <li>Second point for emphasis</li>
        </ul>
      </div>
    </button>
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
