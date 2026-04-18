/**
 * Curated font pairings for PDF export.
 *
 * We serve fonts from the jsdelivr CDN mirror of @fontsource — stable,
 * versioned URLs that won't 404 the way hashed fonts.gstatic.com URLs do.
 * @react-pdf/renderer fetches these TTFs at render time.
 */

export type FontPresetKey =
  | 'classic'
  | 'modern'
  | 'literary'
  | 'technical'
  | 'friendly'

export interface FontPreset {
  key: FontPresetKey
  label: string
  description: string
  recommendedFor: string
  body: {
    family: string
    regular: string
    bold: string
    italic: string
    boldItalic: string
  }
  heading: {
    family: string
    regular: string
    bold: string
  }
}

/**
 * Fontsource TTF files on jsdelivr.
 * Pattern: https://cdn.jsdelivr.net/npm/@fontsource/{pkg}@5/files/{pkg}-latin-{weight}-{style}.ttf
 */
const FS = 'https://cdn.jsdelivr.net/npm/@fontsource'

function fsUrl(pkg: string, weight: 400 | 700, style: 'normal' | 'italic'): string {
  // Fontsource ships .woff on jsdelivr; @react-pdf/renderer supports woff.
  return `${FS}/${pkg}@5/files/${pkg}-latin-${weight}-${style}.woff`
}

export const FONT_PRESETS: Record<FontPresetKey, FontPreset> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    description: 'Merriweather body + Montserrat headers',
    recommendedFor: 'Novels, memoir, general non-fiction',
    body: {
      family: 'Merriweather',
      regular: fsUrl('merriweather', 400, 'normal'),
      bold: fsUrl('merriweather', 700, 'normal'),
      italic: fsUrl('merriweather', 400, 'italic'),
      boldItalic: fsUrl('merriweather', 700, 'italic'),
    },
    heading: {
      family: 'Montserrat',
      regular: fsUrl('montserrat', 400, 'normal'),
      bold: fsUrl('montserrat', 700, 'normal'),
    },
  },
  modern: {
    key: 'modern',
    label: 'Modern',
    description: 'Lora body + Inter headers',
    recommendedFor: 'Business, self-help, how-to',
    body: {
      family: 'Lora',
      regular: fsUrl('lora', 400, 'normal'),
      bold: fsUrl('lora', 700, 'normal'),
      italic: fsUrl('lora', 400, 'italic'),
      boldItalic: fsUrl('lora', 700, 'italic'),
    },
    heading: {
      family: 'Inter',
      regular: fsUrl('inter', 400, 'normal'),
      bold: fsUrl('inter', 700, 'normal'),
    },
  },
  literary: {
    key: 'literary',
    label: 'Literary',
    description: 'EB Garamond body + Playfair Display headers',
    recommendedFor: 'Literary fiction, essays, poetry',
    body: {
      family: 'EB Garamond',
      regular: fsUrl('eb-garamond', 400, 'normal'),
      bold: fsUrl('eb-garamond', 700, 'normal'),
      italic: fsUrl('eb-garamond', 400, 'italic'),
      boldItalic: fsUrl('eb-garamond', 700, 'italic'),
    },
    heading: {
      family: 'Playfair Display',
      regular: fsUrl('playfair-display', 400, 'normal'),
      bold: fsUrl('playfair-display', 700, 'normal'),
    },
  },
  technical: {
    key: 'technical',
    label: 'Technical',
    description: 'Source Serif body + Source Sans headers',
    recommendedFor: 'Technical, academic, reference',
    body: {
      family: 'Source Serif Pro',
      regular: fsUrl('source-serif-pro', 400, 'normal'),
      bold: fsUrl('source-serif-pro', 700, 'normal'),
      italic: fsUrl('source-serif-pro', 400, 'italic'),
      boldItalic: fsUrl('source-serif-pro', 700, 'italic'),
    },
    heading: {
      family: 'Source Sans Pro',
      regular: fsUrl('source-sans-pro', 400, 'normal'),
      bold: fsUrl('source-sans-pro', 700, 'normal'),
    },
  },
  friendly: {
    key: 'friendly',
    label: 'Friendly',
    description: 'Nunito throughout, warm and approachable',
    recommendedFor: "Kids', YA, light non-fiction",
    body: {
      family: 'Nunito',
      regular: fsUrl('nunito', 400, 'normal'),
      bold: fsUrl('nunito', 700, 'normal'),
      italic: fsUrl('nunito', 400, 'italic'),
      boldItalic: fsUrl('nunito', 700, 'italic'),
    },
    heading: {
      family: 'Nunito',
      regular: fsUrl('nunito', 400, 'normal'),
      bold: fsUrl('nunito', 700, 'normal'),
    },
  },
}

export const DEFAULT_FONT_PRESET: FontPresetKey = 'classic'

export function getFontPreset(key: string | null | undefined): FontPreset {
  if (key && key in FONT_PRESETS) return FONT_PRESETS[key as FontPresetKey]
  return FONT_PRESETS[DEFAULT_FONT_PRESET]
}
