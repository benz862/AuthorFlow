import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { synthesizeIntakeAnswers } from '@/lib/ai/intake'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { answers } = body

  // Save individual answers
  const rows = answers.map((a: { key: string; question: string; answer: string }) => ({
    project_id: projectId,
    question_key: a.key,
    question_text: a.question,
    answer_text: a.answer,
  }))
  await supabase.from('book_intake_answers').upsert(rows, { onConflict: 'project_id,question_key' })

  // Synthesize into an AI brief
  const synthesis = await synthesizeIntakeAnswers(project, answers)

  // Update project with synthesis and advance status
  await supabase.from('book_projects').update({
    ai_brief: synthesis,
    status: 'research',
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  return NextResponse.json({ success: true })
}
