import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { full_name, pen_name, preferred_genre, bio } = body

  const { error } = await supabase.from('profiles').update({
    full_name: full_name ?? null,
    pen_name: pen_name ?? null,
    preferred_genre: preferred_genre ?? null,
    bio: bio ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
