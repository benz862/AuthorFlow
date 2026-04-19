import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Promote a cover_candidate asset to the active 'cover' for a project.
 * Demotes the previous 'cover' (if any) back to 'cover_candidate' and demotes
 * sibling candidates in the same batch so only one asset is type='cover'.
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
  if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the asset belongs to this project
  const { data: asset } = await admin.from('book_assets').select('*').eq('id', assetId).eq('project_id', projectId).maybeSingle()
  if (!asset) return NextResponse.json({ error: 'Asset not found for this project' }, { status: 404 })

  // Demote any currently-selected cover (keep as history)
  await admin.from('book_assets').update({ asset_type: 'cover_candidate' })
    .eq('project_id', projectId)
    .eq('asset_type', 'cover')
    .neq('id', assetId)

  // Promote selected
  const { data: promoted, error: updErr } = await admin.from('book_assets')
    .update({ asset_type: 'cover', created_at: new Date().toISOString() })
    .eq('id', assetId)
    .select()
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ asset: promoted })
}
