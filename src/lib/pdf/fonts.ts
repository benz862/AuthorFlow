/**
 * Curated font pairings for PDF export. All Google Fonts (open license).
 * We embed TTF files so the rendered PDF looks identical on every device.
 *
 * Each preset has a serif/humanist body (readable over long passages) and
 * a companion display face for headings. The author picks one per book.
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

// Google Fonts static TTF URLs — @react-pdf/renderer fetches these at render time.
const GFONTS = 'https://fonts.gstatic.com/s'

export const FONT_PRESETS: Record<FontPresetKey, FontPreset> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    description: 'Merriweather body + Montserrat headers',
    recommendedFor: 'Novels, memoir, general non-fiction',
    body: {
      family: 'Merriweather',
      regular: `${GFONTS}/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZMdeX3rg.ttf`,
      bold: `${GFONTS}/merriweather/v30/u-4n0qyriQwlOrhSvowK_l521wRpX837pvjxPA.ttf`,
      italic: `${GFONTS}/merriweather/v30/u-4l0qyriQwlOrhSvowK_l5-eRZOf-c.ttf`,
      boldItalic: `${GFONTS}/merriweather/v30/u-4j0qyriQwlOrhSvowK_l5-eR71Wvf7MGUp0Qw.ttf`,
    },
    heading: {
      family: 'Montserrat',
      regular: `${GFONTS}/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.ttf`,
      bold: `${GFONTS}/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtp6Hw5aXr-pNM.ttf`,
    },
  },
  modern: {
    key: 'modern',
    label: 'Modern',
    description: 'Lora body + Inter headers',
    recommendedFor: 'Business, self-help, how-to',
    body: {
      family: 'Lora',
      regular: `${GFONTS}/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuyJGmKxemMeZ.ttf`,
      bold: `${GFONTS}/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJGmKxemMeZ967e.ttf`,
      italic: `${GFONTS}/lora/v35/0QIgMX1D_JOuMw_7LdTDxtoMQc2nmZn4iZs.ttf`,
      boldItalic: `${GFONTS}/lora/v35/0QIgMX1D_JOuMw_7LdTDxtoMQc23m5n4iZsxEpPFi8E.ttf`,
    },
    heading: {
      family: 'Inter',
      regular: `${GFONTS}/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa2ZL7Sd3VGtH48A.ttf`,
      bold: `${GFONTS}/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7W0Q5nwc.ttf`,
    },
  },
  literary: {
    key: 'literary',
    label: 'Literary',
    description: 'EB Garamond body + Playfair Display headers',
    recommendedFor: 'Literary fiction, essays, poetry',
    body: {
      family: 'EB Garamond',
      regular: `${GFONTS}/ebgaramond/v30/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RkAo9Wlw.ttf`,
      bold: `${GFONTS}/ebgaramond/v30/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-zPRkAo9Wlw.ttf`,
      italic: `${GFONTS}/ebgaramond/v30/SlGFmQSNjdsmc35JDF1K5GRwUjcdlttVFm-rI7e8QL98Wwo.ttf`,
      boldItalic: `${GFONTS}/ebgaramond/v30/SlGFmQSNjdsmc35JDF1K5GRwUjcdlttVFm-rI1q8QL98Wwo.ttf`,
    },
    heading: {
      family: 'Playfair Display',
      regular: `${GFONTS}/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf`,
      bold: `${GFONTS}/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKf0vnDXbtM.ttf`,
    },
  },
  technical: {
    key: 'technical',
    label: 'Technical',
    description: 'Source Serif 4 body + Source Sans 3 headers',
    recommendedFor: 'Technical, academic, reference',
    body: {
      family: 'Source Serif 4',
      regular: `${GFONTS}/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjihdqrhxXD-wGvjU.ttf`,
      bold: `${GFONTS}/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjipVqrhxXD-wGvjU.ttf`,
      italic: `${GFONTS}/sourceserif4/v8/vEFI2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjihdqrhxXD-wGvjU.ttf`,
      boldItalic: `${GFONTS}/sourceserif4/v8/vEFI2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjipVqrhxXD-wGvjU.ttf`,
    },
    heading: {
      family: 'Source Sans 3',
      regular: `${GFONTS}/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky46hs.ttf`,
      bold: `${GFONTS}/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo9Kyw6hs.ttf`,
    },
  },
  friendly: {
    key: 'friendly',
    label: 'Friendly',
    description: 'Nunito throughout, warm and approachable',
    recommendedFor: "Kids', YA, light non-fiction",
    body: {
      family: 'Nunito',
      regular: `${GFONTS}/nunito/v26/XRXV3I6Li01BKofINeaBTMnFcQ.ttf`,
      bold: `${GFONTS}/nunito/v26/XRXW3I6Li01BKofA6sKUbevIWtE.ttf`,
      italic: `${GFONTS}/nunito/v26/XRXX3I6Li01BKofIMeaBXso.ttf`,
      boldItalic: `${GFONTS}/nunito/v26/XRXY3I6Li01BKofIMOaETM_FcCIG.ttf`,
    },
    heading: {
      family: 'Nunito',
      regular: `${GFONTS}/nunito/v26/XRXV3I6Li01BKofINeaBTMnFcQ.ttf`,
      bold: `${GFONTS}/nunito/v26/XRXW3I6Li01BKofA6sKUbevIWtE.ttf`,
    },
  },
}

export const DEFAULT_FONT_PRESET: FontPresetKey = 'classic'

export function getFontPreset(key: string | null | undefined): FontPreset {
  if (key && key in FONT_PRESETS) return FONT_PRESETS[key as FontPresetKey]
  return FONT_PRESETS[DEFAULT_FONT_PRESET]
}
