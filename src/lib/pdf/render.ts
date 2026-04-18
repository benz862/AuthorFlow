import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BookPdf, BookPdfProps } from './document'

/** Renders the Book PDF to a Buffer (for upload to Supabase Storage). */
export async function renderBookPdf(props: BookPdfProps): Promise<Buffer> {
  return await renderToBuffer(React.createElement(BookPdf, props))
}
