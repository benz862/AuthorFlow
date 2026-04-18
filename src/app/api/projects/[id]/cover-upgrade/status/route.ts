/** Returns the current upgrade state for the project's latest cover. */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cover } = await supabase
    .from('book_assets')
    .select('*')
    .eq('project_id', projectId)
    .eq('asset_type', 'cover')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cover) return NextResponse.json({ hasCover: false, upgrade: null })

  const { data: upgrade } = await supabase
    .from('cover_upgrades')
    .select('*')
    .eq('asset_id', cover.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    hasCover: true,
    coverAssetId: cover.id,
    upgrade: upgrade ?? null,
  })
}
