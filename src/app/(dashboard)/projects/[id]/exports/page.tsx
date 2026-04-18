'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject } from '@/lib/types/database'
import { Download, FileType2, FileText, CheckCircle2, XCircle, Clock, BookOpen, Gift, Trash2, Upload, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react'
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

type CoverUpgrade = {
  id: string
  status: 'pending' | 'paid' | 'processing' | 'ready' | 'failed'
  print_ready_url: string | null
  error_message?: string | null
  asset_id: string
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
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [exportMode, setExportMode] = useState<'full' | 'sample'>('full')
  const [includeChapters, setIncludeChapters] = useState<number>(1)
  const [purchaseUrl, setPurchaseUrl] = useState<string>('')
  const [ctaMessage, setCtaMessage] = useState<string>('')

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [includeLogo, setIncludeLogo] = useState(true)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [chapterCount, setChapterCount] = useState(0)

  // Print-ready cover upgrade state
  const [coverQuality, setCoverQuality] = useState<'digital' | 'print'>('digital')
  const [hasCover, setHasCover] = useState<boolean>(false)
  const [coverUpgrade, setCoverUpgrade] = useState<CoverUpgrade | null>(null)
  const [upgradeProcessing, setUpgradeProcessing] = useState<boolean>(false)
  const [upgradeNotice, setUpgradeNotice] = useState<string>('')

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => {
      setProject(data)
      if (data?.trim_size) setTrimKey(data.trim_size)
    })
    supabase
      .from('book_chapters')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .then(({ count }) => setChapterCount(count ?? 0))
    supabase
      .from('book_assets')
      .select('public_url')
      .eq('project_id', projectId)
      .eq('asset_type', 'logo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLogoUrl(data?.public_url ?? null))
    refreshJobs()
    refreshCoverUpgrade()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Stripe Checkout redirect back from the cover upgrade flow.
  useEffect(() => {
    const status = searchParams.get('cover_upgrade')
    const upgradeId = searchParams.get('upgrade_id')
    if (!status) return

    if (status === 'canceled') {
      setUpgradeNotice('Cover upgrade canceled — you were not charged.')
      router.replace(`/projects/${projectId}/exports`)
      return
    }
    if (status === 'success') {
      setCoverQuality('print')
      setUpgradeNotice('Payment received — upscaling your cover to print quality. This takes about a minute.')
      // Kick off the upscale (idempotent) and poll.
      runUpgradeProcess(upgradeId ?? undefined).finally(() => {
        router.replace(`/projects/${projectId}/exports`)
      })
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCoverUpgrade = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cover-upgrade/status`)
      const data = await res.json()
      setHasCover(!!data.hasCover)
      setCoverUpgrade(data.upgrade ?? null)
      if (data.upgrade?.status === 'ready') setCoverQuality((q) => q) // keep user choice
    } catch {
      // non-fatal
    }
  }

  const runUpgradeProcess = async (upgradeId?: string) => {
    setUpgradeProcessing(true)
    try {
      // Poll: call process (may kick off work), then keep checking status until ready/failed.
      await fetch(`/api/projects/${projectId}/cover-upgrade/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upgradeId ? { upgradeId } : {}),
      })

      // Poll status
      const start = Date.now()
      while (Date.now() - start < 5 * 60_000) {
        await new Promise((r) => setTimeout(r, 2500))
        const res = await fetch(`/api/projects/${projectId}/cover-upgrade/status`)
        const data = await res.json()
        setCoverUpgrade(data.upgrade ?? null)
        if (data.upgrade?.status === 'ready') {
          setUpgradeNotice('Print-ready cover is ready. It will be used on your next PDF export.')
          break
        }
        if (data.upgrade?.status === 'failed') {
          setUpgradeNotice(`Upscale failed: ${data.upgrade.error_message ?? 'unknown error'}. We can retry.`)
          break
        }
      }
    } finally {
      setUpgradeProcessing(false)
    }
  }

  const startCoverUpgradeCheckout = async () => {
    setError('')
    setUpgradeNotice('')
    const res = await fetch(`/api/projects/${projectId}/cover-upgrade/checkout`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not start checkout')
      return
    }
    if (data.alreadyPurchased) {
      setCoverUpgrade(data.upgrade)
      setUpgradeNotice('This cover is already upgraded — print-ready version will be used.')
      return
    }
    if (data.url) window.location.href = data.url
  }

  const retryUpgradeProcess = async () => {
    if (!coverUpgrade) return
    setUpgradeNotice('Retrying upscale...')
    await runUpgradeProcess(coverUpgrade.id)
  }

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/logo`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Logo upload failed')
    } else if (data.asset?.public_url) {
      setLogoUrl(data.asset.public_url)
    }
    setLogoUploading(false)
  }

  const handleLogoDelete = async () => {
    await fetch(`/api/projects/${projectId}/logo`, { method: 'DELETE' })
    setLogoUrl(null)
  }

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
    setError('')
    setLastUrl(null)

    // If user selected print-ready but upgrade is not ready, route them to Stripe first.
    if (format === 'pdf' && coverQuality === 'print' && hasCover) {
      if (!coverUpgrade || coverUpgrade.status === 'pending') {
        await startCoverUpgradeCheckout()
        return
      }
      if (coverUpgrade.status !== 'ready') {
        await runUpgradeProcess(coverUpgrade.id)
        // Re-check
        const res = await fetch(`/api/projects/${projectId}/cover-upgrade/status`)
        const data = await res.json()
        setCoverUpgrade(data.upgrade ?? null)
        if (data.upgrade?.status !== 'ready') {
          setError('Print-ready cover is not ready yet — try again in a moment.')
          return
        }
      }
    }

    setExporting(true)
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        fontPreset,
        trimSize: trimKey,
        textSize,
        marginPreset,
        exportMode,
        sampleOptions: { includeChapters, purchaseUrl: purchaseUrl.trim(), ctaMessage: ctaMessage.trim() },
        includeLogo,
        coverQuality,
      }),
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
            {/* Export mode: Full vs Sample */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Export Mode</h2>
                <p className="text-xs text-gray-500 mt-0.5">Full book, or a short freebie to give away as a lead magnet.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportMode('full')}
                  className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${exportMode === 'full' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <BookOpen className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Full Book</p>
                    <p className="text-xs text-gray-500">All {chapterCount || '—'} chapters, for sale or distribution.</p>
                  </div>
                </button>
                <button
                  onClick={() => setExportMode('sample')}
                  className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${exportMode === 'sample' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Gift className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sample / Freebie</p>
                    <p className="text-xs text-gray-500">First few chapters + a call-to-action to buy the full book.</p>
                  </div>
                </button>
              </div>

              {exportMode === 'sample' && (
                <div className="pt-2 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Include chapters</label>
                    <div className="grid grid-cols-5 gap-2 mt-1.5">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const disabled = n > chapterCount
                        return (
                          <button
                            key={n}
                            disabled={disabled}
                            onClick={() => setIncludeChapters(n)}
                            className={`rounded-lg border-2 py-2 text-sm font-medium transition-all ${
                              includeChapters === n && !disabled
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : disabled
                                  ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {n === 1 ? 'Ch. 1' : `First ${n}`}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {chapterCount > 0
                        ? `${includeChapters} of ${chapterCount} chapters will be included. The rest appear as locked entries in the TOC.`
                        : 'No chapters found yet — generate chapters before exporting a sample.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600">Purchase URL (where readers buy the full book)</label>
                    <input
                      type="url"
                      value={purchaseUrl}
                      onChange={(e) => setPurchaseUrl(e.target.value)}
                      placeholder="https://authorflow.app/books/your-book"
                      className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave blank if you want to fill it in later. The CTA page includes a button linking here.</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600">Short teaser line (optional)</label>
                    <input
                      type="text"
                      value={ctaMessage}
                      onChange={(e) => setCtaMessage(e.target.value)}
                      placeholder="The rest of the story unfolds into..."
                      maxLength={160}
                      className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">One italicized line above the Buy button. Keep it under 160 characters.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Logo / branding */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Logo &amp; Branding</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Adds your logo to the title page and the sample CTA page.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 shrink-0">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    className="rounded"
                  />
                  Include in PDF
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleLogoUpload(f)
                      e.target.value = ''
                    }}
                  />
                  {logoUrl ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        loading={logoUploading}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" /> Replace
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleLogoDelete} className="gap-1.5 text-red-600">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      loading={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload logo
                    </Button>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">PNG, JPEG, WebP, or SVG. Max 5 MB. Transparent PNG recommended.</p>
                </div>
              </div>
            </div>

            {/* Cover Quality — $4.99 print-ready upgrade */}
            {hasCover && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Cover Quality</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Digital covers look great on screen. For print-on-demand (KDP, IngramSpark), you&apos;ll want 300 DPI.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    onClick={() => setCoverQuality('digital')}
                    className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${coverQuality === 'digital' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <ImageIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Digital <span className="text-xs text-green-600 font-normal">(included)</span></p>
                      <p className="text-xs text-gray-500">Crisp on-screen. Perfect for ebooks, blog, ads.</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setCoverQuality('print')}
                    className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${coverQuality === 'print' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Print-Ready{' '}
                        {coverUpgrade?.status === 'ready'
                          ? <span className="text-xs text-green-600 font-normal">(purchased)</span>
                          : <span className="text-xs text-amber-600 font-normal">+$4.99</span>}
                      </p>
                      <p className="text-xs text-gray-500">4× upscale to 300 DPI. Ready for KDP / IngramSpark.</p>
                    </div>
                  </button>
                </div>

                {coverQuality === 'print' && (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    {coverUpgrade?.status === 'ready' && (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Print-ready version on file — it will be embedded in your next PDF export.</span>
                      </div>
                    )}
                    {(coverUpgrade?.status === 'paid' || coverUpgrade?.status === 'processing' || upgradeProcessing) && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        <span>Upscaling your cover to 300 DPI — this usually takes under a minute.</span>
                      </div>
                    )}
                    {coverUpgrade?.status === 'failed' && (
                      <div className="flex items-start justify-between gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-2.5">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Upscale failed: {coverUpgrade.error_message ?? 'unknown error'}.</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={retryUpgradeProcess} loading={upgradeProcessing}>Retry</Button>
                      </div>
                    )}
                    {(!coverUpgrade || coverUpgrade.status === 'pending') && (
                      <div className="flex items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
                        <span>You&apos;ll be sent to Stripe to complete the $4.99 one-time purchase, then we upscale your cover automatically.</span>
                        <Button size="sm" onClick={startCoverUpgradeCheckout} className="gap-1.5 shrink-0">
                          <Sparkles className="h-3.5 w-3.5" /> Upgrade $4.99
                        </Button>
                      </div>
                    )}
                    {upgradeNotice && (
                      <p className="text-xs text-gray-500 italic">{upgradeNotice}</p>
                    )}
                  </div>
                )}
              </div>
            )}

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
