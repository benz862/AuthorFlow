/**
 * Trim size catalog. Dimensions are in inches; @react-pdf uses points (72/inch).
 */

export type TrimOrientation = 'portrait' | 'landscape' | 'square'

export interface TrimSize {
  key: string
  label: string
  inches: [number, number] // width, height
  orientation: TrimOrientation
  category: 'portrait' | 'landscape' | 'digital'
  description: string
}

export const TRIM_SIZES: TrimSize[] = [
  // Portrait — print-friendly
  { key: '5x8', label: '5" × 8"', inches: [5, 8], orientation: 'portrait', category: 'portrait',
    description: 'Mass-market paperback. Pocket-sized novels, small non-fiction.' },
  { key: '5.25x8', label: '5.25" × 8"', inches: [5.25, 8], orientation: 'portrait', category: 'portrait',
    description: 'Slightly larger mass-market. Good for novellas.' },
  { key: '5.5x8.5', label: '5.5" × 8.5" (Digest)', inches: [5.5, 8.5], orientation: 'portrait', category: 'portrait',
    description: 'Digest size. Poetry, short fiction, workbooks.' },
  { key: '6x9', label: '6" × 9" (Trade)', inches: [6, 9], orientation: 'portrait', category: 'portrait',
    description: 'Most common trade paperback. Novels, memoir, most non-fiction. KDP default.' },
  { key: '7x10', label: '7" × 10"', inches: [7, 10], orientation: 'portrait', category: 'portrait',
    description: 'Textbook / manual size. Business books with diagrams, how-to with images.' },
  { key: '8x10', label: '8" × 10"', inches: [8, 10], orientation: 'portrait', category: 'portrait',
    description: "Children's picture books, photo books, cookbooks." },
  { key: '8.5x11', label: '8.5" × 11" (Letter)', inches: [8.5, 11], orientation: 'portrait', category: 'portrait',
    description: 'Full letter size. Workbooks, journals, reports.' },

  // Landscape — coffee table / gift style
  { key: '8x6', label: '8" × 6" (Landscape)', inches: [8, 6], orientation: 'landscape', category: 'landscape',
    description: 'Small landscape. Gift books, photo essays.' },
  { key: '9x7', label: '9" × 7" (Landscape)', inches: [9, 7], orientation: 'landscape', category: 'landscape',
    description: "Medium landscape. Children's books, photo-heavy non-fiction." },
  { key: '10x8', label: '10" × 8" (Landscape)', inches: [10, 8], orientation: 'landscape', category: 'landscape',
    description: 'Coffee table feel. Photo books, art books.' },
  { key: '11x8.5', label: '11" × 8.5" (Letter Landscape)', inches: [11, 8.5], orientation: 'landscape', category: 'landscape',
    description: 'Letter landscape. Presentations, training materials.' },

  // Digital-first
  { key: '6x9-digital', label: '6" × 9" (Digital)', inches: [6, 9], orientation: 'portrait', category: 'digital',
    description: 'Trade paperback proportions, optimized for screen. Reads well on Kindle & iPad.' },
  { key: 'ipad', label: 'iPad (4:3)', inches: [7.5, 10], orientation: 'portrait', category: 'digital',
    description: 'iPad native aspect ratio. Tablet-first reading, digital-only distribution.' },
  { key: 'square', label: 'Square (1:1)', inches: [8, 8], orientation: 'square', category: 'digital',
    description: 'Square format. Instagram-era digital books, photo essays.' },
  { key: '16x9', label: 'Widescreen (16:9)', inches: [10, 5.625], orientation: 'landscape', category: 'digital',
    description: 'Widescreen digital. Slide-deck style, video companion books.' },
]

export const DEFAULT_TRIM = '6x9'

export function getTrim(key: string | null | undefined): TrimSize {
  if (!key) return TRIM_SIZES.find((t) => t.key === DEFAULT_TRIM)!
  return TRIM_SIZES.find((t) => t.key === key) ?? TRIM_SIZES.find((t) => t.key === DEFAULT_TRIM)!
}

/** Convert trim to @react-pdf size (points, 72/inch). */
export function trimToPoints(trim: TrimSize): { width: number; height: number } {
  return { width: trim.inches[0] * 72, height: trim.inches[1] * 72 }
}
