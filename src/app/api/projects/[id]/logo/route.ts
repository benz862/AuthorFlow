import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const LOGOS_BUCKET = 'book-logos'
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('id, user_id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type ${file.type}. Use PNG, JPEG, WebP, or SVG.` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max 5 MB).` }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() ?? 'png'
  const admin = createAdminClient()
  const objectPath = `${user.id}/${projectId}/${Date.now()}.${ext}`
  const { error: upErr } = await admin.storage
    .from(LOGOS_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: true })
  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}. Make sure the '${LOGOS_BUCKET}' bucket exists and is public.` }, { status: 500 })
  }

  const { data: pub } = admin.storage.from(LOGOS_BUCKET).getPublicUrl(objectPath)

  const { data: asset, error: insertErr } = await supabase.from('book_assets').insert({
    project_id: projectId,
    asset_type: 'logo',
    storage_path: objectPath,
    public_url: pub.publicUrl,
    mime_type: file.type,
    file_size_bytes: bytes.length,
    metadata: { original_filename: file.name },
  }).select().single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ asset })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: logo } = await supabase
    .from('book_assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('asset_type', 'logo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!logo) return NextResponse.json({ ok: true })

  // Remove DB row (user-scoped); keep storage file since bucket is admin-write.
  await supabase.from('book_assets').delete().eq('id', logo.id)

  return NextResponse.json({ ok: true })
}
