import { generateText } from './client'
import { BookProject } from '@/lib/types/database'
import { IntakeQuestion } from '@/lib/types/app'

const SYSTEM_PROMPT = `You are an expert publishing editor and book development consultant.
Your role is to guide authors through a structured intake process to understand their book project deeply.
Ask thoughtful, context-aware questions. Be encouraging and professional.
Always respond in JSON format as specified.`

export function getIntakeQuestions(project: Pick<BookProject, 'category' | 'book_type' | 'children_mode'>): IntakeQuestion[] {
  const base: IntakeQuestion[] = [
    { key: 'audience', text: 'Who is the primary audience for this book?', type: 'textarea', required: true },
    { key: 'goal', text: 'What is the main goal or outcome for readers of this book?', type: 'textarea', required: true },
    { key: 'tone', text: 'What tone should the book have?', type: 'select', options: ['Professional', 'Casual', 'Fun', 'Warm', 'Academic', 'Persuasive', 'Inspirational', 'Conversational'], required: true },
    { key: 'reading_level', text: 'What reading level should be used?', type: 'select', options: ['Elementary', 'Middle School', 'High School', 'College', 'Adult General', 'Professional/Expert'], required: true },
    { key: 'content_type', text: 'Should the content be factual, creative, or a blend?', type: 'select', options: ['Primarily Factual', 'Primarily Creative', 'Equal Blend'], required: true },
    { key: 'special_sections', text: 'What special sections should be included?', type: 'multiselect', options: ['Table of Contents', 'Introduction', 'Worksheets', 'Examples', 'Checklists', 'Case Studies', 'Chapter Summaries', 'Glossary', 'Resources', 'Appendix', 'References', 'Acknowledgments', 'Author Page'], required: false },
    { key: 'avoid', text: 'Are there any topics, language, or styles to avoid?', type: 'textarea', required: false },
    { key: 'intent', text: 'What is the primary intent of this book?', type: 'select', options: ['Sell a product/service', 'Educate readers', 'Entertain', 'Build authority', 'Generate leads', 'Personal expression'], required: true },
  ]

  if (project.children_mode) {
    return [
      { key: 'target_age', text: 'What is the target age range for the children?', type: 'select', options: ['0–2 (Baby/Toddler)', '3–5 (Preschool)', '6–8 (Early Reader)', '9–12 (Middle Grade)'], required: true },
      { key: 'book_tone', text: 'What tone should this book have?', type: 'select', options: ['Bedtime / Calming', 'Fun / Playful', 'Educational', 'Adventure', 'Emotional / Empathetic'], required: true },
      { key: 'moral_lesson', text: 'What is the main moral or lesson of the story?', type: 'textarea', required: true },
      { key: 'rhyme', text: 'Should the text rhyme?', type: 'boolean', required: true },
      { key: 'character_description', text: 'Describe the main character(s) (name, appearance, personality):', type: 'textarea', required: true },
      { key: 'setting', text: 'Where does the story take place?', type: 'textarea', required: true },
      { key: 'art_style', text: 'What illustration style do you prefer?', type: 'select', options: ['Watercolor', 'Cartoon', 'Realistic', 'Folk Art', 'Digital Flat', 'Storybook Classic'], required: true },
      { key: 'scene_count', text: 'How many scenes or spreads should the book have?', type: 'select', options: ['8–10', '12–14', '16–20', '24–32'], required: true },
    ]
  }

  return base
}

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
