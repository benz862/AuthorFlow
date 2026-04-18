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

  const body = await request.json()
  const { format } = body

  const action = format === 'pdf' ? 'export_pdf' : 'export_text'
  const entitlement = await checkEntitlement(user.id, action, { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const { data: job, error } = await supabase.from('export_jobs').insert({
    project_id: projectId,
    user_id: user.id,
    export_format: format,
    status: 'pending',
    version_number: project.current_version_number,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('book_projects').update({ last_exported_at: new Date().toISOString() }).eq('id', projectId)

  return NextResponse.json({ job })
}
