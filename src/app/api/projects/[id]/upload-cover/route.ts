import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const COVERS_BUCKET = 'book-covers'
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 20 * 1024 * 1024

/**
 * User-uploaded cover. Stored as asset_type='cover' so the export picks it up
 * directly. Any previously-selected cover is demoted to 'cover_candidate'.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPG, or WebP.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be under 20 MB.' }, { status: 400 })

  const admin = createAdminClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const objectPath = `${user.id}/${projectId}/upload_${Date.now()}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from(COVERS_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 })

  const { data: pub } = admin.storage.from(COVERS_BUCKET).getPublicUrl(objectPath)

  // Demote previous cover to candidate (keep as history)
  await admin.from('book_assets').update({ asset_type: 'cover_candidate' })
    .eq('project_id', projectId)
    .eq('asset_type', 'cover')

  const { data: asset, error: insErr } = await admin.from('book_assets').insert({
    project_id: projectId,
    asset_type: 'cover',
    storage_path: objectPath,
    public_url: pub.publicUrl,
    mime_type: file.type,
    file_size_bytes: bytes.length,
    metadata: { source: 'user_upload', originalName: file.name },
  }).select().single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ asset })
}
