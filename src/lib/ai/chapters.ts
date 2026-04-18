import { generateText } from './client'
import { BookProject, BookChapter } from '@/lib/types/database'
import { OutlineChapter } from '@/lib/types/app'

const SYSTEM_PROMPT = `You are a professional ghostwriter and book author with expertise across many genres and topics.
Your writing is engaging, clear, and well-structured. You adapt your style to match the specified tone and audience.
Write complete, polished chapters that deliver real value to readers.`

export async function generateChapter(
  project: Pick<BookProject, 'title' | 'book_type' | 'tone' | 'audience' | 'reading_level' | 'factual_mode'>,
  chapter: OutlineChapter,
  previousChapterSummary: string,
  researchContext: string,
  intakeSummary: string
): Promise<{ content: string; wordCount: number }> {
  const targetWords = chapter.estimatedWords ?? 2000

  const prompt = `
You are writing Chapter ${chapter.number}: "${chapter.title}" for the book "${project.title}".

Book Context:
- Type: ${project.book_type}
- Tone: ${project.tone}
- Audience: ${project.audience}
- Reading Level: ${project.reading_level}
- Factual Mode: ${project.factual_mode}
- Chapter Intent: ${chapter.summary}
- Target Length: approximately ${targetWords} words

Previous Chapter Summary:
${previousChapterSummary || 'This is the first chapter.'}

Relevant Research:
${researchContext || 'No specific research context provided.'}

Author's Project Summary:
${intakeSummary}

FORMAT THE CHAPTER WITH PROPER MARKDOWN STRUCTURE:
- Use "## Section Heading" every ~800-1200 words to break up the chapter into clear sections
- Use "### Subsection" inside sections when a further break helps the reader
- Use bulleted lists ("- item") for enumerations, steps, key takeaways, checklists
- Use numbered lists ("1. item") for ordered sequences or processes
- Use "> quote" for block quotes, testimonials, or emphasis callouts
- Use **bold** for key terms on first mention and important phrases
- Use *italics* for book/product names and subtle emphasis
- Keep paragraphs tight (3-5 sentences typical). White space aids readability.
- For ${project.book_type === 'fiction' ? 'fiction: lean on prose and scene, use formatting sparingly' : 'non-fiction: use headers, bullets, and callouts liberally to aid scannability'}.

Start directly with the chapter content (no chapter number prefix — it will be added automatically by the renderer).
Target approximately ${targetWords} words.
`

  const content = await generateText(prompt, SYSTEM_PROMPT, 8192)
  const wordCount = content.split(/\s+/).filter(Boolean).length

  return { content, wordCount }
}

export async function regenerateChapter(
  project: Pick<BookProject, 'title' | 'book_type' | 'tone' | 'audience'>,
  chapter: BookChapter,
  instruction: string
): Promise<{ content: string; wordCount: number }> {
  const prompt = `
Rewrite this chapter from "${project.title}".

Chapter: "${chapter.title}"
Instruction: ${instruction}

Current content:
${chapter.content_markdown}

Apply the instruction and return the improved chapter in Markdown format.
`
  const content = await generateText(prompt, SYSTEM_PROMPT, 8192)
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return { content, wordCount }
}

export async function generateCoverConcept(
  project: Pick<BookProject, 'title' | 'subtitle' | 'book_type' | 'audience' | 'tone'>
): Promise<{ prompt: string; blurb: string; tagline: string }> {
  const systemPrompt = `You are a book cover designer and marketing copywriter.
  Return JSON with cover concept details.`

  const prompt = `
Create a cover concept for:
Title: "${project.title}"
Subtitle: "${project.subtitle ?? ''}"
Type: ${project.book_type}
Audience: ${project.audience}
Tone: ${project.tone}

Return JSON:
{
  "prompt": "Detailed image generation prompt for the cover artwork",
  "blurb": "2-3 sentence back cover blurb",
  "tagline": "Short compelling tagline for the cover"
}
`
  const result = await generateText(prompt, systemPrompt, 1024)
  try {
    const json = result.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    return JSON.parse(json)
  } catch {
    return {
      prompt: `Professional book cover for "${project.title}"`,
      blurb: `A comprehensive guide to ${project.title}.`,
      tagline: project.title,
    }
  }
}
