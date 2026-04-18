/**
 * Replicate-based image upscaler. Turns Imagen's 1024×1408 covers into
 * ~4096×5632 print-ready art at 300 DPI for any trim size up to 8.5×11.
 *
 * We use Real-ESRGAN at 4× by default — reliable, cheap (~$0.01/run), and
 * the output looks like a natural resolution increase without the oil-
 * painting artifacts some upscalers produce.
 */

const REPLICATE_API = 'https://api.replicate.com/v1'
// Real-ESRGAN v0.1.0 (pinned). Swap at top via env var if you want to
// A/B another model without a deploy.
const DEFAULT_MODEL_VERSION =
  process.env.REPLICATE_UPSCALE_VERSION ??
  'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa' // nightmareai/real-esrgan

export interface UpscaleResult {
  buffer: Buffer
  mimeType: string
}

async function replicate<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured')
  const res = await fetch(`${REPLICATE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Replicate ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

interface Prediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output: string | string[] | null
  error: string | null
}

export async function upscaleImage(
  imageUrl: string,
  opts: { scale?: number; maxWaitMs?: number } = {},
): Promise<UpscaleResult> {
  const scale = opts.scale ?? 4
  const maxWaitMs = opts.maxWaitMs ?? 4 * 60 * 1000

  // Create prediction
  const created = await replicate<Prediction>('/predictions', {
    method: 'POST',
    body: JSON.stringify({
      version: DEFAULT_MODEL_VERSION,
      input: {
        image: imageUrl,
        scale,
        face_enhance: false,
      },
    }),
  })

  // Poll until done
  const start = Date.now()
  let pred = created
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (Date.now() - start > maxWaitMs) {
      throw new Error('Upscale timed out')
    }
    await new Promise((r) => setTimeout(r, 2000))
    pred = await replicate<Prediction>(`/predictions/${pred.id}`)
  }

  if (pred.status !== 'succeeded' || !pred.output) {
    throw new Error(`Upscale failed: ${pred.error ?? pred.status}`)
  }

  const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output
  if (!outputUrl) throw new Error('Upscale produced no output URL')

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) throw new Error(`Could not fetch upscaled image: ${imgRes.status}`)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const mimeType = imgRes.headers.get('content-type') ?? 'image/png'

  return { buffer, mimeType }
}
