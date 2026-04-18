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
  const response = await genai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '3:4', // portrait, book cover proportions
    },
  })

  const image = response.generatedImages?.[0]?.image
  if (!image?.imageBytes) {
    throw new Error('Imagen did not return image bytes')
  }

  // imageBytes is base64-encoded
  return Buffer.from(image.imageBytes, 'base64')
}
