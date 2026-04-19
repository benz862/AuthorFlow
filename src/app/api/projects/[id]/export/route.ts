import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { renderBookPdf } from '@/lib/pdf/render'
import { getFontPreset } from '@/lib/pdf/fonts'
import { getTrim, TextSizeKey, MarginPresetKey } from '@/lib/pdf/trim-sizes'

export const runtime = 'nodejs'
export const maxDuration = 300

const EXPORTS_BUCKET = 'book-exports'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  // Normalize format — accept 'md', 'markdown', '.md' as markdown; anything else falls back to pdf.
  const rawFormat = String(body?.format ?? 'pdf').toLowerCase().trim()
  const format: 'pdf' | 'md' = ['md', 'markdown', '.md', 'text'].includes(rawFormat) ? 'md' : 'pdf'
  console.log('[export] request received', { rawFormat, normalized: format, projectId })
  const fontPresetKey: string | undefined = body?.fontPreset
  const trimKey: string | undefined = body?.trimSize
  const textSize: TextSizeKey = (body?.textSize as TextSizeKey) ?? 'normal'
  const marginPreset: MarginPresetKey = (body?.marginPreset as MarginPresetKey) ?? 'normal'
  const exportMode: 'full' | 'sample' = body?.exportMode === 'sample' ? 'sample' : 'full'
  const sampleOptions = {
    includeChapters: Math.max(1, Math.min(5, Number(body?.sampleOptions?.includeChapters ?? 1))),
    purchaseUrl: typeof body?.sampleOptions?.purchaseUrl === 'string' ? body.sampleOptions.purchaseUrl.trim() : undefined,
    ctaMessage: typeof body?.sampleOptions?.ctaMessage === 'string' ? body.sampleOptions.ctaMessage.trim() : undefined,
  }
  const includeLogo: boolean = body?.includeLogo !== false // default true
  const coverQuality: 'digital' | 'print' = body?.coverQuality === 'print' ? 'print' : 'digital'

  const action = format === 'pdf' ? 'export_pdf' : 'export_text'
  const entitlement = await checkEntitlement(user.id, action, { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  // Create the export job row first so we have an ID to return / update
  const { data: job, error: jobErr } = await supabase.from('export_jobs').insert({
    project_id: projectId,
    user_id: user.id,
    export_type: format,
    export_format: format,
    status: 'processing',
    version_number: project.current_version_number,
    started_at: new Date().toISOString(),
  }).select().single()

  if (jobErr || !job) return NextResponse.json({ error: jobErr?.message ?? 'Could not create job' }, { status: 500 })

  try {
    if (format !== 'pdf') {
      // Text export: stitch chapter markdown
      const { data: chapters } = await supabase
        .from('book_chapters')
        .select('chapter_number, title, content_markdown')
        .eq('project_id', projectId)
        .eq('version_number', project.current_version_number)
        .order('chapter_number', { ascending: true })

      const md = (chapters ?? [])
        .map((c) => `# Chapter ${c.chapter_number}: ${c.title}\n\n${c.content_markdown ?? ''}`)
        .join('\n\n---\n\n')

      const header = `# ${project.title}\n\n${project.subtitle ?? ''}\n\n`
      const full = header + md

      const admin = createAdminClient()
      const objectPath = `${user.id}/${projectId}/${Date.now()}.md`
      const { error: upErr } = await admin.storage
        .from(EXPORTS_BUCKET)
        .upload(objectPath, Buffer.from(full, 'utf8'), { contentType: 'text/markdown', upsert: true })
      if (upErr) throw new Error(`Storage: ${upErr.message}`)
      const { data: pub } = admin.storage.from(EXPORTS_BUCKET).getPublicUrl(objectPath)

      const { data: asset } = await supabase.from('book_assets').insert({
        project_id: projectId,
        asset_type: 'export_text',
        storage_path: objectPath,
        public_url: pub.publicUrl,
        mime_type: 'text/markdown',
        file_size_bytes: Buffer.byteLength(full, 'utf8'),
        metadata: { format: 'markdown' },
      }).select().single()

      await createAdminClient().from('export_jobs').update({
        status: 'completed',
        output_asset_id: asset?.id ?? null,
        finished_at: new Date().toISOString(),
      }).eq('id', job.id)

      await supabase.from('book_projects').update({ last_exported_at: new Date().toISOString() }).eq('id', projectId)

      return NextResponse.json({ job, asset, url: pub.publicUrl })
    }

    // ---- PDF export ----
    const { data: chapters } = await supabase
      .from('book_chapters')
      .select('chapter_number, title, content_markdown')
      .eq('project_id', projectId)
      .eq('version_number', project.current_version_number)
      .order('chapter_number', { ascending: true })

    if (!chapters || chapters.length === 0) {
      await createAdminClient().from('export_jobs').update({
        status: 'failed',
        error_message: 'No chapters to export. Generate chapters first.',
        finished_at: new Date().toISOString(),
      }).eq('id', job.id)
      return NextResponse.json({ error: 'No chapters to export' }, { status: 400 })
    }

    // Pull the latest cover (if any) as a Buffer
    const { data: coverAsset } = await supabase
      .from('book_assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('asset_type', 'cover')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Prefer print-ready upgrade URL if user asked for it AND one is ready
    let sourceCoverUrl: string | null = coverAsset?.public_url ?? null
    if (coverQuality === 'print' && coverAsset) {
      const { data: upgrade } = await supabase
        .from('cover_upgrades')
        .select('print_ready_url, status')
        .eq('asset_id', coverAsset.id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (upgrade?.print_ready_url) sourceCoverUrl = upgrade.print_ready_url
    }

    let coverBuffer: Buffer | null = null
    if (sourceCoverUrl) {
      try {
        const res = await fetch(sourceCoverUrl)
        if (res.ok) coverBuffer = Buffer.from(await res.arrayBuffer())
      } catch {
        // non-fatal; PDF will render without cover
      }
    }

    // Optional logo for title page + CTA branding
    let logoBuffer: Buffer | null = null
    if (includeLogo) {
      const { data: logoAsset } = await supabase
        .from('book_assets')
        .select('*')
        .eq('project_id', projectId)
        .eq('asset_type', 'logo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (logoAsset?.public_url) {
        try {
          const res = await fetch(logoAsset.public_url)
          if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer())
        } catch {
          // non-fatal
        }
      }
    }

    // Author name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const authorName = profile?.full_name ?? user.email ?? 'Author'

    const preset = getFontPreset(fontPresetKey ?? null)
    const trim = getTrim(trimKey ?? project.trim_size ?? null)

    const totalWordCount = chapters.reduce(
      (acc, c) => acc + (c.content_markdown ?? '').split(/\s+/).filter(Boolean).length,
      0,
    )

    const pdfBuffer = await renderBookPdf({
      title: project.title,
      subtitle: project.subtitle,
      authorName,
      coverImageBuffer: coverBuffer,
      logoImageBuffer: logoBuffer,
      overlayCoverText: ((coverAsset?.metadata as Record<string, unknown> | null)?.overlayTitle ?? true) !== false,
      chapters: chapters.map((c) => ({
        number: c.chapter_number,
        title: c.title,
        contentMarkdown: c.content_markdown ?? '',
      })),
      preset,
      trim,
      textSize,
      marginPreset,
      exportMode,
      sampleOptions: exportMode === 'sample' ? sampleOptions : undefined,
      totalChapterCount: chapters.length,
      totalWordCount,
    })

    const admin = createAdminClient()
    const objectPath = `${user.id}/${projectId}/${Date.now()}.pdf`
    const { error: upErr } = await admin.storage
      .from(EXPORTS_BUCKET)
      .upload(objectPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      throw new Error(`Storage upload failed: ${upErr.message}. Make sure the '${EXPORTS_BUCKET}' bucket exists and is public.`)
    }

    const { data: pub } = admin.storage.from(EXPORTS_BUCKET).getPublicUrl(objectPath)

    const { data: asset } = await supabase.from('book_assets').insert({
      project_id: projectId,
      asset_type: 'export_pdf',
      storage_path: objectPath,
      public_url: pub.publicUrl,
      mime_type: 'application/pdf',
      file_size_bytes: pdfBuffer.length,
      metadata: {
        font_preset: preset.key,
        trim_size: trim.key,
        text_size: textSize,
        margin_preset: marginPreset,
        chapter_count: chapters.length,
        has_cover: !!coverBuffer,
      },
    }).select().single()

    await supabase.from('export_jobs').update({
      status: 'completed',
      output_asset_id: asset?.id ?? null,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)

    await supabase.from('book_projects').update({ last_exported_at: new Date().toISOString() }).eq('id', projectId)

    return NextResponse.json({ job, asset, url: pub.publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed'
    await createAdminClient().from('export_jobs').update({
      status: 'failed',
      error_message: message,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
