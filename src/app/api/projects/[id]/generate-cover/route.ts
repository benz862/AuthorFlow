import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { generateCoverConcept } from '@/lib/ai/chapters'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = await checkEntitlement(user.id, 'generate_cover', { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  try {
    const prompt = await generateCoverConcept(project)

    const { data: asset, error } = await supabase.from('book_assets').insert({
      project_id: projectId,
      asset_type: 'cover',
      generation_prompt: prompt,
      storage_path: '',
      mime_type: 'image/png',
      file_size_bytes: 0,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ asset })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate cover'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
