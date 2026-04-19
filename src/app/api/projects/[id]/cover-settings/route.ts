import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Update per-cover settings stored in book_assets.metadata.
 * Currently supports: overlayTitle (boolean).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const assetId: string | undefined = body?.assetId
  const overlayTitle: boolean | undefined = typeof body?.overlayTitle === 'boolean' ? body.overlayTitle : undefined
  const ALLOWED_POSITIONS = ['tl', 'tc', 'tr', 'cl', 'center', 'cr', 'bl', 'bc', 'br'] as const
  const ALLOWED_VPOS = ['top', 'middle', 'bottom'] as const
  const logoOnCover: boolean | undefined = typeof body?.logoOnCover === 'boolean' ? body.logoOnCover : undefined
  const logoPosition: string | undefined = ALLOWED_POSITIONS.includes(body?.logoPosition) ? body.logoPosition : undefined
  const logoSizePct: number | undefined = typeof body?.logoSizePct === 'number' && body.logoSizePct >= 5 && body.logoSizePct <= 40 ? body.logoSizePct : undefined
  const logoOpacity: number | undefined = typeof body?.logoOpacity === 'number' && body.logoOpacity >= 0.1 && body.logoOpacity <= 1 ? body.logoOpacity : undefined
  // Cover text formatting
  const isHex = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
  const textColor: string | undefined = isHex(body?.textColor) ? body.textColor : undefined
  const scrimOpacity: number | undefined = typeof body?.scrimOpacity === 'number' && body.scrimOpacity >= 0 && body.scrimOpacity <= 0.8 ? body.scrimOpacity : undefined
  const titleSize: number | undefined = typeof body?.titleSize === 'number' && body.titleSize >= 16 && body.titleSize <= 72 ? body.titleSize : undefined
  const titleVPos: string | undefined = ALLOWED_VPOS.includes(body?.titleVPos) ? body.titleVPos : undefined
  const subtitleSize: number | undefined = typeof body?.subtitleSize === 'number' && body.subtitleSize >= 10 && body.subtitleSize <= 40 ? body.subtitleSize : undefined
  const authorSize: number | undefined = typeof body?.authorSize === 'number' && body.authorSize >= 10 && body.authorSize <= 36 ? body.authorSize : undefined
  const authorVPos: string | undefined = ALLOWED_VPOS.includes(body?.authorVPos) ? body.authorVPos : undefined
  if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: asset } = await admin.from('book_assets').select('*').eq('id', assetId).eq('project_id', projectId).maybeSingle()
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const currentMeta = (asset.metadata as Record<string, unknown> | null) ?? {}
  const newMeta = { ...currentMeta }
  if (overlayTitle !== undefined) newMeta.overlayTitle = overlayTitle
  if (logoOnCover !== undefined) newMeta.logoOnCover = logoOnCover
  if (logoPosition !== undefined) newMeta.logoPosition = logoPosition
  if (logoSizePct !== undefined) newMeta.logoSizePct = logoSizePct
  if (logoOpacity !== undefined) newMeta.logoOpacity = logoOpacity
  if (textColor !== undefined) newMeta.textColor = textColor
  if (scrimOpacity !== undefined) newMeta.scrimOpacity = scrimOpacity
  if (titleSize !== undefined) newMeta.titleSize = titleSize
  if (titleVPos !== undefined) newMeta.titleVPos = titleVPos
  if (subtitleSize !== undefined) newMeta.subtitleSize = subtitleSize
  if (authorSize !== undefined) newMeta.authorSize = authorSize
  if (authorVPos !== undefined) newMeta.authorVPos = authorVPos

  const { data: updated, error } = await admin.from('book_assets')
    .update({ metadata: newMeta })
    .eq('id', assetId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: updated })
}
