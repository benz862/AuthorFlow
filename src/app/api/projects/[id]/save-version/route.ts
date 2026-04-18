import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = await checkEntitlement(user.id, 'save_version', { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { label, notes } = body

  const { data: chapters } = await supabase.from('book_chapters').select('*').eq('project_id', projectId)
  const totalWords = (chapters ?? []).reduce((sum, c) => sum + (c.word_count ?? 0), 0)

  const newVersionNumber = (project.current_version_number ?? 1) + 1

  const { data: version, error } = await supabase.from('book_versions').insert({
    project_id: projectId,
    version_number: newVersionNumber,
    label: label || null,
    notes: notes || null,
    chapter_count: (chapters ?? []).length,
    total_word_count: totalWords,
    snapshot_json: { chapters: chapters ?? [] },
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('book_projects').update({
    current_version_number: newVersionNumber,
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  return NextResponse.json({ version })
}
