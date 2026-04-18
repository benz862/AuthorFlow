import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { generateCoverConcept } from '@/lib/ai/chapters'
import { generateBookCoverImage } from '@/lib/ai/image'
import { generateText } from '@/lib/ai/client'

const COVERS_BUCKET = 'book-covers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = await checkEntitlement(user.id, 'generate_cover', { projectId })
  if (!entitlement.allowed) return NextResponse.json({ error: entitlement.reason }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const customPrompt: string | undefined = body?.customPrompt?.trim() || undefined
  const enhance: boolean = !!body?.enhance

  try {
    let imagePrompt: string
    let blurb = ''
    let tagline = ''

    if (customPrompt) {
      // User wrote their own prompt
      if (enhance) {
        // Expand user's rough idea into a cover-optimized prompt
        const enhanced = await generateText(
          `Expand this cover concept into a detailed, photorealistic image-generation prompt for a book cover.
Keep the user's intent. Add visual detail (lighting, composition, mood, color palette, texture, camera angle, style reference).
Do NOT include text/title — just scene description.

Book: "${project.title}"
Genre / tone: ${project.tone ?? 'unspecified'}
Audience: ${project.target_audience ?? project.audience ?? 'general'}

User's concept: ${customPrompt}

Return ONLY the expanded prompt, no preamble or JSON.`,
          'You are a book cover art director. Write vivid, specific image prompts.',
          600
        )
        imagePrompt = enhanced.trim() || customPrompt
      } else {
        imagePrompt = customPrompt
      }
    } else {
      // Auto-generate from project metadata (original behavior)
      const concept = await generateCoverConcept(project)
      imagePrompt = concept.prompt || `Professional book cover for "${project.title}"`
      blurb = concept.blurb
      tagline = concept.tagline
    }

    // Imagen renders the image
    const imageBuffer = await generateBookCoverImage(imagePrompt)

    // Upload to Supabase Storage
    const admin = createAdminClient()
    const objectPath = `${user.id}/${projectId}/${Date.now()}.png`
    const { error: uploadError } = await admin.storage
      .from(COVERS_BUCKET)
      .upload(objectPath, imageBuffer, { contentType: 'image/png', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}. Make sure the '${COVERS_BUCKET}' bucket exists and is public.` }, { status: 500 })
    }

    const { data: publicUrlData } = admin.storage.from(COVERS_BUCKET).getPublicUrl(objectPath)
    const publicUrl = publicUrlData.publicUrl

    const { data: asset, error: insertError } = await supabase.from('book_assets').insert({
      project_id: projectId,
      asset_type: 'cover',
      generation_prompt: imagePrompt,
      storage_path: objectPath,
      public_url: publicUrl,
      mime_type: 'image/png',
      file_size_bytes: imageBuffer.length,
      metadata: { blurb, tagline, source: customPrompt ? (enhance ? 'user_enhanced' : 'user_custom') : 'auto' },
    }).select().single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ asset })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate cover'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Separate endpoint: just enhance a prompt without generating an image.
// Lets the UI show the enhanced prompt in the textarea before the user commits.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const rough = (body?.rough ?? '').trim()
  if (!rough) return NextResponse.json({ error: 'Missing rough prompt' }, { status: 400 })

  try {
    const enhanced = await generateText(
      `Expand this rough cover concept into a detailed, photorealistic image-generation prompt for a book cover.
Keep the user's intent. Add visual detail (lighting, composition, mood, color palette, texture, camera angle, style reference).
Do NOT include the book title text or any text rendering — just scene description.

Book: "${project.title}"
Genre / tone: ${project.tone ?? 'unspecified'}
Audience: ${project.target_audience ?? project.audience ?? 'general'}

User's rough concept: ${rough}

Return ONLY the expanded prompt, no preamble or JSON.`,
      'You are a book cover art director. Write vivid, specific image prompts.',
      600
    )
    return NextResponse.json({ enhanced: enhanced.trim() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to enhance prompt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
