import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY ?? '' })

// Imagen 4 preview on the Gemini API. Swap to 'imagen-3.0-generate-002' if you
// don't have preview access.
const IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL ?? 'imagen-4.0-generate-preview-06-06'

/**
 * Generate a book cover image from a text prompt using Google Imagen.
 * Returns a Buffer of PNG bytes — caller is responsible for storing it.
 */
export async function generateBookCoverImage(prompt: string): Promise<Buffer> {
  const [buf] = await generateBookCoverImages(prompt, 1)
  return buf
}

/**
 * Multi-variant cover generation. Imagen supports numberOfImages up to 4.
 * Returns an array of PNG Buffers. Caller stores each and lets the user pick.
 */
export async function generateBookCoverImages(prompt: string, n: number = 3): Promise<Buffer[]> {
  const count = Math.max(1, Math.min(4, Math.floor(n)))
  const response = await genai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: {
      numberOfImages: count,
      aspectRatio: '3:4',
    },
  })

  const images = response.generatedImages ?? []
  if (images.length === 0) throw new Error('Imagen did not return any images')

  return images.map((img, idx) => {
    const bytes = img?.image?.imageBytes
    if (!bytes) throw new Error(`Imagen variant ${idx + 1} missing image bytes`)
    return Buffer.from(bytes, 'base64')
  })
}
