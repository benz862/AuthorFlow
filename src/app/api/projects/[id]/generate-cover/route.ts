import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkEntitlement } from '@/lib/entitlements/service'
import { generateCoverConcept } from '@/lib/ai/chapters'
import { generateBookCoverImage } from '@/lib/ai/image'

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

  try {
    // Step 1: Claude writes the cover concept (image prompt + blurb + tagline)
    const concept = await generateCoverConcept(project)
    const imagePrompt = concept.prompt || `Professional book cover for "${project.title}"`

    // Step 2: Imagen renders the cover image
    const imageBuffer = await generateBookCoverImage(imagePrompt)

    // Step 3: Upload to Supabase Storage under the user's project folder
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

    // Step 4: Save asset row
    const { data: asset, error: insertError } = await supabase.from('book_assets').insert({
      project_id: projectId,
      asset_type: 'cover',
      generation_prompt: imagePrompt,
      storage_path: objectPath,
      public_url: publicUrl,
      mime_type: 'image/png',
      file_size_bytes: imageBuffer.length,
      metadata: { blurb: concept.blurb, tagline: concept.tagline },
    }).select().single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ asset })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate cover'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
