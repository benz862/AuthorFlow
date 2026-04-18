import { generateText } from './client'
import { BookProject } from '@/lib/types/database'

const SYSTEM_PROMPT = `You are a professional research assistant specializing in book research and source analysis.
Your job is to identify relevant topics, generate research briefs, and extract key claims from sources.
Always return well-structured, actionable research data.`

export async function generateResearchBrief(
  project: Pick<BookProject, 'title' | 'category' | 'book_type' | 'factual_mode'>,
  intakeSummary: string,
  researchDepth: string
): Promise<{ brief: string; topicsToResearch: string[]; warningFlags: string[] }> {
  const prompt = `
Book Title: "${project.title}"
Category: ${project.category}
Type: ${project.book_type}
Factual Mode: ${project.factual_mode}
Research Depth: ${researchDepth}

Intake Summary:
${intakeSummary}

Generate a research brief for this book project. Return JSON:
{
  "brief": "Comprehensive research brief describing what needs to be researched and why",
  "topicsToResearch": ["topic 1", "topic 2", "topic 3"],
  "warningFlags": ["any high-risk topics or areas requiring careful sourcing"]
}
`
  const result = await generateText(prompt, SYSTEM_PROMPT, 2048)
  try {
    const json = result.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    return JSON.parse(json)
  } catch {
    return { brief: result, topicsToResearch: [], warningFlags: [] }
  }
}

export async function extractClaimsFromContent(
  content: string,
  sourceTitle: string
): Promise<Array<{ claim: string; type: string; confidence: number; excerpt: string }>> {
  const prompt = `
Source: "${sourceTitle}"
Content:
${content.slice(0, 3000)}

Extract key factual claims from this content. Return JSON array:
[
  {
    "claim": "The specific factual claim",
    "type": "statistic|fact|definition|example|quote",
    "confidence": 0.9,
    "excerpt": "The exact text this was derived from"
  }
]
Return at most 10 most important claims.
`
  const result = await generateText(prompt, SYSTEM_PROMPT, 2048)
  try {
    const json = result.match(/\[[\s\S]*\]/)?.[0] ?? '[]'
    return JSON.parse(json)
  } catch {
    return []
  }
}

export function generateMockSources(topic: string, count = 5) {
  const domains = ['wikipedia.org', 'harvard.edu', 'nature.com', 'sciencedirect.com', 'ncbi.nlm.nih.gov']
  return Array.from({ length: count }, (_, i) => ({
    source_url: `https://${domains[i % domains.length]}/article/${topic.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
    source_title: `${topic} - Research Article ${i + 1}`,
    domain: domains[i % domains.length],
    source_type: i === 0 ? 'encyclopedia' : 'journal',
    credibility_score: 0.7 + (i % 3) * 0.1,
    extracted_summary: `This source covers key aspects of ${topic} with relevant data and analysis.`,
  }))
}
