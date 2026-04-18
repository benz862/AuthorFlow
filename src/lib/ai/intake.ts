import { generateText } from './client'
import { BookProject } from '@/lib/types/database'
import { IntakeQuestion } from '@/lib/types/app'

// Re-export for server-side imports that still reference the old path
export { getIntakeQuestions } from '@/lib/intake/questions'

const SYSTEM_PROMPT = `You are an expert publishing editor and book development consultant.
Your role is to guide authors through a structured intake process to understand their book project deeply.
Ask thoughtful, context-aware questions. Be encouraging and professional.
Always respond in JSON format as specified.`

export async function generateNextIntakeQuestion(
  projectContext: string,
  answeredSoFar: Array<{ question: string; answer: string }>,
  questionsRemaining: IntakeQuestion[]
): Promise<string> {
  if (questionsRemaining.length === 0) return ''

  const next = questionsRemaining[0]
  return next.text
}

export async function synthesizeIntakeAnswers(
  project: Partial<BookProject>,
  answers: Array<{ key: string; question: string; answer: string }>
): Promise<{
  summary: string
  audience: string
  tone: string
  readingLevel: string
  intent: string
  specialSections: string[]
  avoidTopics: string
}> {
  const prompt = `
Book Project: "${project.title}"
Category: ${project.category}
Type: ${project.book_type}

Intake Answers:
${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Synthesize these answers into a structured project brief. Return JSON with these exact keys:
{
  "summary": "Brief summary of the book's purpose and approach",
  "audience": "Target audience description",
  "tone": "Writing tone",
  "readingLevel": "Target reading level",
  "intent": "Primary intent of the book",
  "specialSections": ["array", "of", "special", "sections"],
  "avoidTopics": "Topics or styles to avoid"
}
`
  const result = await generateText(prompt, SYSTEM_PROMPT)
  try {
    const json = result.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    return JSON.parse(json)
  } catch {
    return {
      summary: '',
      audience: answers.find((a) => a.key === 'audience')?.answer ?? '',
      tone: answers.find((a) => a.key === 'tone')?.answer ?? '',
      readingLevel: answers.find((a) => a.key === 'reading_level')?.answer ?? '',
      intent: answers.find((a) => a.key === 'intent')?.answer ?? '',
      specialSections: [],
      avoidTopics: answers.find((a) => a.key === 'avoid')?.answer ?? '',
    }
  }
}
