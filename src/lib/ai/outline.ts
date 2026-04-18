import { generateText } from './client'
import { BookProject } from '@/lib/types/database'
import { OutlineStructure } from '@/lib/types/app'

const SYSTEM_PROMPT = `You are a professional book editor and structure specialist.
Your job is to create compelling, well-organized book outlines that serve the reader's needs and the author's goals.
Always return valid JSON as specified.`

export async function generateOutline(
  project: Pick<BookProject, 'title' | 'subtitle' | 'category' | 'book_type' | 'tone' | 'audience' | 'intent'>,
  intakeSummary: string,
  researchBrief: string
): Promise<{ markdown: string; structure: OutlineStructure }> {
  const chapterCountMap: Record<string, string> = {
    freebie: '3–5',
    short: '5–8',
    medium: '8–14',
    long: '14–22',
  }

  const prompt = `
Book: "${project.title}"${project.subtitle ? ` — ${project.subtitle}` : ''}
Category: ${project.category} (${chapterCountMap[project.category] ?? '5–10'} chapters)
Type: ${project.book_type}
Audience: ${project.audience}
Tone: ${project.tone}
Intent: ${project.intent}

Intake Summary:
${intakeSummary}

Research Brief:
${researchBrief}

Create a complete book outline. Return JSON:
{
  "frontMatter": ["Dedication", "Table of Contents", "Introduction"],
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title",
      "summary": "What this chapter covers and why it matters to the reader",
      "estimatedWords": 2000
    }
  ],
  "backMatter": ["Conclusion", "Glossary", "Resources", "Author Bio"]
}
`

  const result = await generateText(prompt, SYSTEM_PROMPT, 4096)

  let structure: OutlineStructure = { frontMatter: [], chapters: [], backMatter: [] }
  try {
    const json = result.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    structure = JSON.parse(json)
  } catch {
    structure = {
      frontMatter: ['Introduction'],
      chapters: [{ number: 1, title: 'Chapter 1', summary: 'Opening chapter', estimatedWords: 2000 }],
      backMatter: ['Conclusion'],
    }
  }

  const markdown = generateOutlineMarkdown(project.title, structure)
  return { markdown, structure }
}

function generateOutlineMarkdown(title: string, structure: OutlineStructure): string {
  const lines: string[] = [`# ${title} — Outline\n`]

  if (structure.frontMatter?.length > 0) {
    lines.push('## Front Matter')
    structure.frontMatter.forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }

  lines.push('## Chapters')
  structure.chapters?.forEach((ch) => {
    lines.push(`\n### Chapter ${ch.number}: ${ch.title}`)
    lines.push(ch.summary)
    if (ch.estimatedWords) lines.push(`*Estimated: ~${ch.estimatedWords.toLocaleString()} words*`)
  })

  if (structure.backMatter?.length > 0) {
    lines.push('\n## Back Matter')
    structure.backMatter.forEach((item) => lines.push(`- ${item}`))
  }

  return lines.join('\n')
}
