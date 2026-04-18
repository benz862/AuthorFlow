import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { generateChapter } from '@/lib/ai/chapters'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { chapterOutline, previousSummary } = body

  const existingChapter = await supabase.from('book_chapters').select('*').eq('project_id', projectId).eq('chapter_number', chapterOutline.number).maybeSingle()
  const action = existingChapter.data ? 'regenerate_chapter' : 'generate_chapter'

  const entitlement = await checkEntitlement(user.id, action, { projectId, chapterNumber: chapterOutline.number })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const { data: sources } = await supabase.from('book_sources').select('*').eq('project_id', projectId)

  try {
    const { content, summary, wordCount } = await generateChapter(project, chapterOutline, previousSummary ?? '', sources ?? [])

    if (existingChapter.data) {
      // Save revision first
      await supabase.from('chapter_revisions').insert({
        chapter_id: existingChapter.data.id,
        project_id: projectId,
        revision_number: (existingChapter.data.revision_count ?? 0) + 1,
        content_markdown: existingChapter.data.content_markdown,
        word_count: existingChapter.data.word_count,
      })

      await supabase.from('book_chapters').update({
        content_markdown: content,
        summary,
        word_count: wordCount,
        status: 'draft',
        revision_count: (existingChapter.data.revision_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', existingChapter.data.id)
    } else {
      await supabase.from('book_chapters').insert({
        project_id: projectId,
        chapter_number: chapterOutline.number,
        title: chapterOutline.title,
        content_markdown: content,
        summary,
        word_count: wordCount,
        status: 'draft',
        version_number: project.current_version_number,
        revision_count: 0,
      })
    }

    await supabase.from('book_projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate chapter'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
