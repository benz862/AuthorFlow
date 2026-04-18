import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.AI_PROVIDER_API_KEY,
})

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

export async function streamText(prompt: string, systemPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type === 'text') return content.text
  return ''
}

export async function generateText(prompt: string, systemPrompt: string, maxTokens = 4096): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type === 'text') return content.text
  return ''
}
