/**
 * Book PDF document. Renders:
 *   1. Cover page (full-bleed image if available)
 *   2. Title page
 *   3. Copyright page
 *   4. Table of Contents (with page numbers via @react-pdf dynamic rendering)
 *   5. Chapter pages (markdown -> styled PDF nodes)
 *   6. Running header (book title) + footer (page number) on chapter pages
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'
import { FontPreset } from './fonts'
import { renderMarkdown, mdToPlainText, MarkdownStyles } from './markdown'
import { TrimSize, trimToPoints } from './trim-sizes'

export interface BookPdfProps {
  title: string
  subtitle?: string | null
  authorName: string
  coverImageBuffer?: Buffer | null // optional cover PNG bytes
  chapters: Array<{
    number: number
    title: string
    contentMarkdown: string
  }>
  preset: FontPreset
  trim: TrimSize
  copyrightYear?: number
  logoImageBuffer?: Buffer | null
}

/** One-time font registration. Idempotent per process. */
const registered = new Set<string>()
function registerPreset(preset: FontPreset) {
  const bodyKey = `body:${preset.body.family}`
  if (!registered.has(bodyKey)) {
    Font.register({
      family: preset.body.family,
      fonts: [
        { src: preset.body.regular },
        { src: preset.body.bold, fontWeight: 'bold' },
        { src: preset.body.italic, fontStyle: 'italic' },
        { src: preset.body.boldItalic, fontWeight: 'bold', fontStyle: 'italic' },
      ],
    })
    registered.add(bodyKey)
  }
  const headKey = `head:${preset.heading.family}`
  if (!registered.has(headKey) && preset.heading.family !== preset.body.family) {
    Font.register({
      family: preset.heading.family,
      fonts: [
        { src: preset.heading.regular },
        { src: preset.heading.bold, fontWeight: 'bold' },
      ],
    })
    registered.add(headKey)
  }
  // Prevent hyphenation (cleaner look for book text)
  Font.registerHyphenationCallback((word) => [word])
}

function buildStyles(preset: FontPreset, trim: TrimSize) {
  const bodyFamily = preset.body.family
  const headFamily = preset.heading.family

  // Body point size scales slightly to trim width
  const basePt = trim.inches[0] >= 7 ? 11.5 : 11

  const markdown: MarkdownStyles = {
    paragraph: {
      fontFamily: bodyFamily,
      fontSize: basePt,
      lineHeight: 1.55,
      textAlign: 'justify',
      marginBottom: 8,
    },
    h1: {
      fontFamily: headFamily,
      fontSize: basePt + 10,
      fontWeight: 'bold',
      marginTop: 18,
      marginBottom: 10,
    },
    h2: {
      fontFamily: headFamily,
      fontSize: basePt + 5,
      fontWeight: 'bold',
      marginTop: 14,
      marginBottom: 8,
    },
    h3: {
      fontFamily: headFamily,
      fontSize: basePt + 2,
      fontWeight: 'bold',
      marginTop: 10,
      marginBottom: 6,
    },
    h4: {
      fontFamily: headFamily,
      fontSize: basePt + 1,
      fontWeight: 'bold',
      marginTop: 8,
      marginBottom: 4,
    },
    listItem: {
      fontFamily: bodyFamily,
      fontSize: basePt,
      lineHeight: 1.45,
    },
    bullet: {
      fontFamily: bodyFamily,
      fontSize: basePt,
      width: 18,
      lineHeight: 1.45,
    },
    blockquote: {
      borderLeftWidth: 2,
      borderLeftColor: '#94a3b8',
      paddingLeft: 12,
      marginVertical: 8,
      marginLeft: 4,
    },
    code: {
      fontFamily: 'Courier',
      fontSize: basePt - 1,
      backgroundColor: '#f1f5f9',
      padding: 6,
      marginVertical: 6,
    },
    hr: {
      borderBottomWidth: 0.5,
      borderBottomColor: '#cbd5e1',
      marginVertical: 14,
    },
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
    inlineCode: {
      fontFamily: 'Courier',
      fontSize: basePt - 1,
      backgroundColor: '#f1f5f9',
    },
  }

  const sheet = StyleSheet.create({
    page: {
      paddingTop: 60,
      paddingBottom: 60,
      paddingHorizontal: trim.inches[0] >= 7 ? 72 : 54,
      fontFamily: bodyFamily,
      fontSize: basePt,
      color: '#1f2937',
    },
    coverPage: {
      padding: 0,
      margin: 0,
    },
    coverImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    titlePage: {
      paddingTop: '30%',
      paddingHorizontal: 72,
      fontFamily: bodyFamily,
      textAlign: 'center',
    },
    titlePageTitle: {
      fontFamily: headFamily,
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 14,
    },
    titlePageSubtitle: {
      fontFamily: headFamily,
      fontSize: 16,
      textAlign: 'center',
      color: '#475569',
      marginBottom: 40,
    },
    titlePageAuthor: {
      fontFamily: bodyFamily,
      fontSize: 14,
      textAlign: 'center',
      color: '#334155',
    },
    copyrightPage: {
      paddingTop: '40%',
      paddingHorizontal: 72,
      fontFamily: bodyFamily,
      fontSize: 9,
      lineHeight: 1.6,
      color: '#475569',
      textAlign: 'center',
    },
    tocHeading: {
      fontFamily: headFamily,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 24,
    },
    tocRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      fontFamily: bodyFamily,
      fontSize: basePt,
    },
    tocChapterNum: {
      fontFamily: headFamily,
      color: '#64748b',
      marginRight: 10,
    },
    tocChapterTitle: {
      flex: 1,
    },
    tocPageNum: {
      marginLeft: 10,
      color: '#64748b',
    },
    chapterHeader: {
      marginBottom: 24,
    },
    chapterNumber: {
      fontFamily: headFamily,
      fontSize: 11,
      letterSpacing: 3,
      color: '#94a3b8',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    chapterTitle: {
      fontFamily: headFamily,
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 18,
    },
    runningHeader: {
      position: 'absolute',
      top: 28,
      left: 54,
      right: 54,
      textAlign: 'center',
      fontFamily: headFamily,
      fontSize: 9,
      color: '#94a3b8',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    pageNumber: {
      position: 'absolute',
      bottom: 28,
      left: 54,
      right: 54,
      textAlign: 'center',
      fontFamily: bodyFamily,
      fontSize: 9,
      color: '#64748b',
    },
    logo: {
      position: 'absolute',
      bottom: 24,
      alignSelf: 'center',
      width: 60,
      height: 60,
      objectFit: 'contain',
    },
  })

  return { sheet, markdown }
}

export function BookPdf(props: BookPdfProps) {
  registerPreset(props.preset)
  const { sheet, markdown } = buildStyles(props.preset, props.trim)
  const pageSize = trimToPoints(props.trim)
  const year = props.copyrightYear ?? new Date().getFullYear()

  return (
    <Document title={props.title} author={props.authorName}>
      {/* Cover */}
      {props.coverImageBuffer && (
        <Page size={pageSize} style={sheet.coverPage}>
          <Image src={props.coverImageBuffer} style={sheet.coverImage} />
        </Page>
      )}

      {/* Title page */}
      <Page size={pageSize} style={sheet.titlePage}>
        <Text style={sheet.titlePageTitle}>{props.title}</Text>
        {props.subtitle && (
          <Text style={sheet.titlePageSubtitle}>{props.subtitle}</Text>
        )}
        <Text style={sheet.titlePageAuthor}>{props.authorName}</Text>
        {props.logoImageBuffer && (
          <Image src={props.logoImageBuffer} style={sheet.logo} />
        )}
      </Page>

      {/* Copyright page */}
      <Page size={pageSize} style={sheet.copyrightPage}>
        <Text>{props.title}</Text>
        <Text>Copyright © {year} {props.authorName}</Text>
        <Text> </Text>
        <Text>All rights reserved. No part of this book may be reproduced,</Text>
        <Text>stored in a retrieval system, or transmitted in any form or by</Text>
        <Text>any means without prior written permission of the author,</Text>
        <Text>except in the case of brief quotations for review purposes.</Text>
        <Text> </Text>
        <Text>First edition, {year}.</Text>
      </Page>

      {/* Table of Contents */}
      <Page size={pageSize} style={sheet.page}>
        <Text style={sheet.tocHeading}>Contents</Text>
        {props.chapters.map((ch) => (
          <View key={ch.number} style={sheet.tocRow}>
            <Text style={sheet.tocChapterNum}>{String(ch.number).padStart(2, '0')}</Text>
            <Text style={sheet.tocChapterTitle}>{ch.title}</Text>
          </View>
        ))}
      </Page>

      {/* Chapters */}
      {props.chapters.map((ch) => (
        <Page key={ch.number} size={pageSize} style={sheet.page}>
          <Text
            style={sheet.runningHeader}
            render={() => props.title.toUpperCase()}
            fixed
          />
          <View style={sheet.chapterHeader}>
            <Text style={sheet.chapterNumber}>Chapter {ch.number}</Text>
            <Text style={sheet.chapterTitle}>{ch.title}</Text>
          </View>
          {renderMarkdown(stripLeadingTitle(ch.contentMarkdown, ch.title), markdown)}
          <Text
            style={sheet.pageNumber}
            render={({ pageNumber }) => `${pageNumber}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  )
}

/** Avoid doubling the chapter title when Claude accidentally includes it. */
function stripLeadingTitle(md: string, title: string): string {
  const trimmed = md.trimStart()
  const lines = trimmed.split('\n')
  const first = lines[0]?.trim() ?? ''
  const titleLower = title.trim().toLowerCase()
  const firstLower = first.replace(/^#+\s*/, '').toLowerCase()
  if (firstLower === titleLower || firstLower === `chapter ${titleLower}`) {
    return lines.slice(1).join('\n').trimStart()
  }
  return trimmed
}

// Re-export helper so API route can use same plain-text extractor
export { mdToPlainText }
