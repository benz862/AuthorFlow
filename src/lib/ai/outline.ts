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
  // Hard caps per category: chapter count + per-chapter target word count.
  // Freebie must be a short lead magnet (≈10–15 print pages total, ~250 words/page).
  const categoryConfig: Record<string, { chapters: string; wordsPerChapter: string; totalTarget: string; framing: string }> = {
    freebie: {
      chapters: '3–4',
      wordsPerChapter: '500–900',
      totalTarget: '2,500–3,500 words TOTAL (≈10–15 pages)',
      framing:
        'This is a LEAD MAGNET / FREEBIE — a short giveaway meant to build trust and entice the reader to buy the author\'s paid product, course, or full book. Be punchy and valuable but DO NOT try to teach everything. Tease depth, surface the problem vividly, deliver one or two concrete wins, and leave the reader wanting more. No exhaustive reference material, no glossaries, no filler.',
    },
    short: { chapters: '5–8', wordsPerChapter: '1,200–2,000', totalTarget: '8,000–14,000 words', framing: 'Concise, practical, reader walks away with real value.' },
    medium: { chapters: '8–14', wordsPerChapter: '1,800–2,500', totalTarget: '20,000–32,000 words', framing: 'Full treatment of the topic at a comfortable depth.' },
    long: { chapters: '14–22', wordsPerChapter: '2,000–3,000', totalTarget: '40,000–60,000 words', framing: 'Comprehensive, deep-dive, reference-quality.' },
  }
  const cfg = categoryConfig[project.category] ?? categoryConfig.medium

  const prompt = `
Book: "${project.title}"${project.subtitle ? ` — ${project.subtitle}` : ''}
Category: ${project.category} — ${cfg.chapters} chapters at ${cfg.wordsPerChapter} words each. TOTAL BOOK LENGTH: ${cfg.totalTarget}.
Framing: ${cfg.framing}
Type: ${project.book_type}
Audience: ${project.audience}
Tone: ${project.tone}
Intent: ${project.intent}

Intake Summary:
${intakeSummary}

Research Brief:
${researchBrief}

Create a complete book outline. Every chapter's estimatedWords MUST fall in the range ${cfg.wordsPerChapter}. Total across all chapters MUST land near ${cfg.totalTarget}. Do NOT exceed these limits — the length constraint is hard, not a suggestion.

${project.category === 'freebie'
  ? 'Front matter: short intro only (no dedication, no long TOC-style preamble). Back matter: ONE "Next Steps" / CTA section pointing toward the paid offer — no glossary, no resources appendix, no lengthy author bio.'
  : ''}

Return JSON:
{
  "frontMatter": ${project.category === 'freebie' ? '["Introduction"]' : '["Dedication", "Table of Contents", "Introduction"]'},
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title",
      "summary": "What this chapter covers and why it matters to the reader",
      "estimatedWords": ${project.category === 'freebie' ? '700' : '2000'}
    }
  ],
  "backMatter": ${project.category === 'freebie' ? '["Next Steps"]' : '["Conclusion", "Glossary", "Resources", "Author Bio"]'}
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
