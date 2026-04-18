/**
 * Runs (or resumes) the upscale for a paid upgrade. Idempotent:
 *  - status=ready  → returns the existing URL
 *  - status=paid   → kicks off upscale
 *  - status=processing → no-op (another caller is already running it)
 *  - status=failed → retries
 *
 * Called by the client after Stripe returns success, or by the webhook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { upscaleImage } from '@/lib/ai/upscale'

export const runtime = 'nodejs'
export const maxDuration = 300

const COVERS_BUCKET = 'book-covers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const upgradeId: string | undefined = body?.upgradeId

  // Look up upgrade — prefer explicit id, else latest for project's latest cover
  let upgrade
  if (upgradeId) {
    const { data } = await supabase.from('cover_upgrades').select('*').eq('id', upgradeId).eq('user_id', user.id).maybeSingle()
    upgrade = data
  } else {
    const { data: cover } = await supabase
      .from('book_assets')
      .select('id')
      .eq('project_id', projectId)
      .eq('asset_type', 'cover')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cover) return NextResponse.json({ error: 'No cover found' }, { status: 404 })
    const { data } = await supabase
      .from('cover_upgrades')
      .select('*')
      .eq('asset_id', cover.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    upgrade = data
  }

  if (!upgrade) return NextResponse.json({ error: 'No upgrade record' }, { status: 404 })

  if (upgrade.status === 'ready') {
    return NextResponse.json({ upgrade })
  }
  if (upgrade.status === 'processing') {
    return NextResponse.json({ upgrade, note: 'Already processing' })
  }
  if (upgrade.status === 'pending') {
    return NextResponse.json({ error: 'Payment not yet confirmed by Stripe' }, { status: 400 })
  }
  // status === 'paid' or 'failed' → proceed

  const admin = createAdminClient()

  // Mark processing
  await admin.from('cover_upgrades').update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() }).eq('id', upgrade.id)

  try {
    // Get source cover URL
    const { data: cover } = await admin.from('book_assets').select('*').eq('id', upgrade.asset_id).single()
    if (!cover?.public_url) throw new Error('Source cover has no public URL')

    const { buffer } = await upscaleImage(cover.public_url, { scale: 4 })

    // Upload upscaled file alongside cover
    const objectPath = `${upgrade.user_id}/${projectId}/${upgrade.id}-print.png`
    const { error: upErr } = await admin.storage
      .from(COVERS_BUCKET)
      .upload(objectPath, buffer, { contentType: 'image/png', upsert: true })
    if (upErr) throw new Error(`Storage: ${upErr.message}`)

    const { data: pub } = admin.storage.from(COVERS_BUCKET).getPublicUrl(objectPath)

    await admin
      .from('cover_upgrades')
      .update({
        status: 'ready',
        print_ready_url: pub.publicUrl,
        print_ready_path: objectPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', upgrade.id)

    const { data: updated } = await admin.from('cover_upgrades').select('*').eq('id', upgrade.id).single()
    return NextResponse.json({ upgrade: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upscale failed'
    await admin
      .from('cover_upgrades')
      .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', upgrade.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
