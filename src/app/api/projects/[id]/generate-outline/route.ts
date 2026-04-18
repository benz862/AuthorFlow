import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { generateOutline } from '@/lib/ai/outline'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = await checkEntitlement(user.id, 'generate_outline', { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const { data: answers } = await supabase.from('book_intake_answers').select('*').eq('project_id', projectId)
  const { data: sources } = await supabase.from('book_sources').select('*').eq('project_id', projectId)

  try {
    const { structure, markdown } = await generateOutline(project, answers ?? [], sources ?? [])

    // Mark old outlines as not current
    await supabase.from('book_outlines').update({ is_current: false }).eq('project_id', projectId)

    const { data: outline, error } = await supabase.from('book_outlines').insert({
      project_id: projectId,
      outline_json: structure,
      outline_markdown: markdown,
      is_current: true,
      is_approved: false,
      version_number: 1,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('book_projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)

    return NextResponse.json({ outline })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate outline'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
