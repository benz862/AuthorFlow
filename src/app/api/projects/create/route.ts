import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, subtitle, description, category, book_type, target_audience, target_word_count, language } = body

  if (!title || !category || !book_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const entitlement = await checkEntitlement(user.id, 'create_project')
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const { data: project, error } = await supabase.from('book_projects').insert({
    user_id: user.id,
    title,
    subtitle: subtitle || null,
    description: description || null,
    category,
    book_type,
    target_audience: target_audience || null,
    target_word_count: target_word_count || null,
    language: language || 'en',
    status: 'intake',
    current_version_number: 1,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project })
}
