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
  Link,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'
import { FontPreset } from './fonts'
import { renderMarkdown, mdToPlainText, MarkdownStyles } from './markdown'
import {
  TrimSize,
  trimToPoints,
  TextSizeKey,
  MarginPresetKey,
  TEXT_SIZE_DELTA,
  MARGIN_SCALE,
} from './trim-sizes'

export type ExportMode = 'full' | 'sample'

export interface SampleOptions {
  /** How many full chapters to include (default 1). */
  includeChapters: number
  /** Where readers buy the full book (optional). */
  purchaseUrl?: string
  /** Short optional teaser above the buy CTA. */
  ctaMessage?: string
}

export interface BookPdfProps {
  title: string
  subtitle?: string | null
  authorName: string
  coverImageBuffer?: Buffer | null // optional cover PNG bytes
  /** When true, overlay title/subtitle/author text on top of the cover artwork.
   *  Defaults to true for AI-generated covers. User-uploaded covers usually
   *  already have text baked in, so they pass false. */
  overlayCoverText?: boolean
  chapters: Array<{
    number: number
    title: string
    contentMarkdown: string
  }>
  preset: FontPreset
  trim: TrimSize
  textSize?: TextSizeKey
  marginPreset?: MarginPresetKey
  copyrightYear?: number
  logoImageBuffer?: Buffer | null
  /** If true, also place the logo on the cover page (in addition to title page). */
  logoOnCover?: boolean
  /** Where to put it on the cover — nine-grid position. Default 'br'. */
  logoPosition?: 'tl' | 'tc' | 'tr' | 'cl' | 'center' | 'cr' | 'bl' | 'bc' | 'br'
  /** Logo width as a percentage of cover width (5–40). Default 18. */
  logoSizePct?: number
  /** Logo opacity 0.1–1. Default 1. */
  logoOpacity?: number
  /** Cover text formatting */
  coverTextColor?: string       // hex, default '#ffffff'
  coverScrimOpacity?: number    // 0..0.8, default 0.45
  coverTitleSize?: number       // 16..72 pt, default 40
  coverTitleVPos?: 'top' | 'middle' | 'bottom'  // default 'top'
  coverSubtitleSize?: number    // 10..40 pt, default 16
  coverAuthorSize?: number      // 10..36 pt, default 18
  coverAuthorVPos?: 'top' | 'middle' | 'bottom' // default 'bottom'
  exportMode?: ExportMode
  sampleOptions?: SampleOptions
  /** Total chapters in the FULL book — used on the CTA page copy. */
  totalChapterCount?: number
  /** Approximate full-book word count — used on the CTA page copy. */
  totalWordCount?: number
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
        { src: preset.heading.italic, fontStyle: 'italic' },
        { src: preset.heading.boldItalic, fontWeight: 'bold', fontStyle: 'italic' },
      ],
    })
    registered.add(headKey)
  }
  // Prevent hyphenation (cleaner look for book text)
  Font.registerHyphenationCallback((word) => [word])
}

function buildStyles(
  preset: FontPreset,
  trim: TrimSize,
  textSize: TextSizeKey,
  marginPreset: MarginPresetKey,
) {
  const bodyFamily = preset.body.family
  const headFamily = preset.heading.family

  // Body point size = trim default + user delta (small/normal/large)
  const basePt = trim.defaultBodyPt + TEXT_SIZE_DELTA[textSize]

  // Margins: trim default * user scale, convert inches -> points
  const marginH = trim.defaultMarginsIn[0] * MARGIN_SCALE[marginPreset] * 72
  const marginV = trim.defaultMarginsIn[1] * MARGIN_SCALE[marginPreset] * 72

  const markdown: MarkdownStyles = {
    paragraph: {
      fontFamily: bodyFamily,
      fontSize: basePt,
      lineHeight: 1.55,
      textAlign: 'justify',
      marginBottom: 8,
      // Widow/orphan control: never split so that <2 lines are alone on a page
      widows: 2,
      orphans: 2,
    },
    h1: {
      fontFamily: headFamily,
      fontSize: basePt + 10,
      fontWeight: 'bold',
      marginTop: 18,
      marginBottom: 10,
      // Don't leave a heading stranded at the bottom of a page:
      // require at least 3 lines of content to follow, or break page.
      minPresenceAhead: basePt * 4.5,
    },
    h2: {
      fontFamily: headFamily,
      fontSize: basePt + 5,
      fontWeight: 'bold',
      marginTop: 14,
      marginBottom: 8,
      minPresenceAhead: basePt * 3.5,
    },
    h3: {
      fontFamily: headFamily,
      fontSize: basePt + 2,
      fontWeight: 'bold',
      marginTop: 10,
      marginBottom: 6,
      minPresenceAhead: basePt * 3,
    },
    h4: {
      fontFamily: headFamily,
      fontSize: basePt + 1,
      fontWeight: 'bold',
      marginTop: 8,
      marginBottom: 4,
      minPresenceAhead: basePt * 2.5,
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
      paddingTop: marginV,
      paddingBottom: marginV,
      paddingHorizontal: marginH,
      fontFamily: bodyFamily,
      fontSize: basePt,
      color: '#1f2937',
    },
    coverPage: {
      padding: 0,
      margin: 0,
      position: 'relative',
    },
    coverImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    coverAuthor: {
      fontFamily: headFamily,
      fontSize: 18,
      color: '#ffffff',
      textAlign: 'center',
      letterSpacing: 1,
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
      top: marginV / 2.2,
      left: marginH,
      right: marginH,
      textAlign: 'center',
      fontFamily: headFamily,
      fontSize: 9,
      color: '#94a3b8',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    pageNumber: {
      position: 'absolute',
      bottom: marginV / 2.2,
      left: marginH,
      right: marginH,
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
    sampleBadge: {
      fontFamily: headFamily,
      fontSize: 10,
      letterSpacing: 3,
      color: '#6366f1',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 14,
      marginBottom: 6,
    },
    ctaPage: {
      paddingTop: '18%',
      paddingHorizontal: marginH,
      fontFamily: bodyFamily,
    },
    ctaEyebrow: {
      fontFamily: headFamily,
      fontSize: 10,
      letterSpacing: 3,
      color: '#6366f1',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: 14,
    },
    ctaHeadline: {
      fontFamily: headFamily,
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 18,
      color: '#111827',
    },
    ctaBody: {
      fontFamily: bodyFamily,
      fontSize: basePt + 0.5,
      lineHeight: 1.55,
      textAlign: 'center',
      color: '#334155',
      marginBottom: 14,
      paddingHorizontal: 20,
    },
    ctaMessage: {
      fontFamily: bodyFamily,
      fontSize: basePt,
      lineHeight: 1.5,
      textAlign: 'center',
      color: '#475569',
      fontStyle: 'italic',
      marginBottom: 22,
      paddingHorizontal: 30,
    },
    ctaStats: {
      fontFamily: headFamily,
      fontSize: basePt - 1,
      textAlign: 'center',
      color: '#64748b',
      marginBottom: 22,
    },
    ctaButton: {
      alignSelf: 'center',
      backgroundColor: '#6366f1',
      color: '#ffffff',
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 6,
      fontFamily: headFamily,
      fontSize: basePt + 1,
      fontWeight: 'bold',
      marginBottom: 16,
      textDecoration: 'none',
    },
    ctaUrl: {
      fontFamily: bodyFamily,
      fontSize: basePt - 1,
      color: '#6366f1',
      textAlign: 'center',
      textDecoration: 'underline',
    },
    ctaAuthor: {
      fontFamily: bodyFamily,
      fontSize: basePt - 1,
      color: '#94a3b8',
      textAlign: 'center',
      marginTop: 30,
    },
  })

  return { sheet, markdown }
}

/**
 * Compute dynamic cover overlay styles (scrims, title box, author box, text).
 * All return values are inline style objects for react-pdf.
 */
function coverOverlayStyles(opts: {
  color: string
  scrimOpacity: number
  titleSize: number
  titleVPos: 'top' | 'middle' | 'bottom'
  subtitleSize: number
  authorSize: number
  authorVPos: 'top' | 'middle' | 'bottom'
  headFamily: string
}) {
  const { color, scrimOpacity, titleSize, titleVPos, subtitleSize, authorSize, authorVPos, headFamily } = opts
  const scrim = `rgba(0,0,0,${Math.max(0, Math.min(0.8, scrimOpacity))})`

  const titleTop =
    titleVPos === 'top' ? '6%' : titleVPos === 'middle' ? '40%' : '70%'

  const authorBox: Record<string, string | number> =
    authorVPos === 'top'
      ? { position: 'absolute', top: '5%', left: '8%', right: '8%' }
      : authorVPos === 'middle'
      ? { position: 'absolute', top: '50%', left: '8%', right: '8%', transform: 'translateY(-50%)' }
      : { position: 'absolute', bottom: '5%', left: '8%', right: '8%' }

  return {
    topScrim: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: '30%',
      backgroundColor: scrim,
    },
    bottomScrim: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: '22%',
      backgroundColor: scrim,
    },
    titleBox: {
      position: 'absolute' as const,
      top: titleTop,
      left: '8%',
      right: '8%',
    },
    title: {
      fontFamily: headFamily,
      fontSize: titleSize,
      fontWeight: 'bold' as const,
      color,
      textAlign: 'center' as const,
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: headFamily,
      fontSize: subtitleSize,
      color,
      textAlign: 'center' as const,
      opacity: 0.92,
    },
    authorBox,
    author: {
      fontFamily: headFamily,
      fontSize: authorSize,
      color,
      textAlign: 'center' as const,
      letterSpacing: 1,
    },
  }
}

/**
 * Compute an absolute-position style for the cover logo.
 * `position` is a nine-grid key (tl, tc, tr, cl, center, cr, bl, bc, br).
 * `sizePct` is width as a percentage of the cover width.
 */
function logoStyleForCover(
  position: 'tl' | 'tc' | 'tr' | 'cl' | 'center' | 'cr' | 'bl' | 'bc' | 'br',
  sizePct: number,
  opacity: number,
): Record<string, string | number> {
  const margin = '5%'
  const width = `${Math.max(5, Math.min(40, sizePct))}%`
  const base: Record<string, string | number> = { position: 'absolute', width, opacity }

  switch (position) {
    case 'tl': return { ...base, top: margin, left: margin }
    case 'tc': return { ...base, top: margin, left: '50%', transform: 'translateX(-50%)' }
    case 'tr': return { ...base, top: margin, right: margin }
    case 'cl': return { ...base, top: '50%', left: margin, transform: 'translateY(-50%)' }
    case 'center': return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    case 'cr': return { ...base, top: '50%', right: margin, transform: 'translateY(-50%)' }
    case 'bl': return { ...base, bottom: margin, left: margin }
    case 'bc': return { ...base, bottom: margin, left: '50%', transform: 'translateX(-50%)' }
    case 'br':
    default: return { ...base, bottom: margin, right: margin }
  }
}

export function BookPdf(props: BookPdfProps) {
  registerPreset(props.preset)
  const { sheet, markdown } = buildStyles(
    props.preset,
    props.trim,
    props.textSize ?? 'normal',
    props.marginPreset ?? 'normal',
  )
  const pageSize = trimToPoints(props.trim)
  const year = props.copyrightYear ?? new Date().getFullYear()

  const cover = coverOverlayStyles({
    color: props.coverTextColor ?? '#ffffff',
    scrimOpacity: props.coverScrimOpacity ?? 0.45,
    titleSize: props.coverTitleSize ?? 40,
    titleVPos: props.coverTitleVPos ?? 'top',
    subtitleSize: props.coverSubtitleSize ?? 16,
    authorSize: props.coverAuthorSize ?? 18,
    authorVPos: props.coverAuthorVPos ?? 'bottom',
    headFamily: props.preset.heading.family,
  })

  const isSample = props.exportMode === 'sample'
  const includeCount = Math.max(1, props.sampleOptions?.includeChapters ?? 1)
  const totalChapters = props.totalChapterCount ?? props.chapters.length
  const chaptersToRender = isSample
    ? props.chapters.slice(0, includeCount)
    : props.chapters
  const hiddenChapters = isSample
    ? props.chapters.slice(includeCount, totalChapters)
    : []
  const remainingCount = totalChapters - chaptersToRender.length

  return (
    <Document
      title={isSample ? `${props.title} — Sample` : props.title}
      author={props.authorName}
    >
      {/* Cover — artwork, with optional title/subtitle/author overlay and optional logo */}
      {props.coverImageBuffer && (
        <Page size={pageSize} style={sheet.coverPage}>
          <Image src={props.coverImageBuffer} style={sheet.coverImage} />
          {props.overlayCoverText !== false && (
            <>
              {/* Scrims for legibility over any artwork */}
              <View style={cover.topScrim} fixed />
              <View style={cover.bottomScrim} fixed />
              <View style={cover.titleBox}>
                <Text style={cover.title}>{props.title}</Text>
                {props.subtitle && (
                  <Text style={cover.subtitle}>{props.subtitle}</Text>
                )}
              </View>
              <View style={cover.authorBox}>
                <Text style={cover.author}>{props.authorName.toUpperCase()}</Text>
              </View>
            </>
          )}
          {props.logoImageBuffer && props.logoOnCover && (
            <Image
              src={props.logoImageBuffer}
              style={logoStyleForCover(props.logoPosition ?? 'br', props.logoSizePct ?? 18, props.logoOpacity ?? 1)}
            />
          )}
        </Page>
      )}

      {/* Title page */}
      <Page size={pageSize} style={sheet.titlePage}>
        <Text style={sheet.titlePageTitle}>{props.title}</Text>
        {props.subtitle && (
          <Text style={sheet.titlePageSubtitle}>{props.subtitle}</Text>
        )}
        <Text style={sheet.titlePageAuthor}>{props.authorName}</Text>
        {isSample && <Text style={sheet.sampleBadge}>Free Preview Edition</Text>}
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
        {isSample && (
          <>
            <Text> </Text>
            <Text>This is a free preview edition. Redistribution is permitted</Text>
            <Text>provided the content is not altered.</Text>
          </>
        )}
      </Page>

      {/* Table of Contents */}
      <Page size={pageSize} style={sheet.page} bookmark="Contents">
        <Text style={sheet.tocHeading}>Contents</Text>
        {chaptersToRender.map((ch) => (
          <Link
            key={ch.number}
            src={`#chapter-${ch.number}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <View style={sheet.tocRow}>
              <Text style={sheet.tocChapterNum}>{String(ch.number).padStart(2, '0')}</Text>
              <Text style={sheet.tocChapterTitle}>{ch.title}</Text>
            </View>
          </Link>
        ))}
        {isSample && hiddenChapters.length > 0 && (
          <>
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: '#e2e8f0',
                marginTop: 10,
                marginBottom: 10,
              }}
            />
            {hiddenChapters.map((ch) => (
              <Link
                key={ch.number}
                src="#cta"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <View style={{ ...sheet.tocRow, opacity: 0.35 }}>
                  <Text style={sheet.tocChapterNum}>{String(ch.number).padStart(2, '0')}</Text>
                  <Text style={sheet.tocChapterTitle}>{ch.title}</Text>
                  <Text style={sheet.tocPageNum}>🔒</Text>
                </View>
              </Link>
            ))}
            <Text
              style={{
                fontFamily: props.preset.heading.family,
                fontSize: 10,
                color: '#6366f1',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {remainingCount} more {remainingCount === 1 ? 'chapter' : 'chapters'} available in the full book
            </Text>
          </>
        )}
      </Page>

      {/* Chapters */}
      {chaptersToRender.map((ch) => (
        <Page
          key={ch.number}
          size={pageSize}
          style={sheet.page}
          bookmark={`Chapter ${ch.number}: ${ch.title}`}
        >
          <Text
            style={sheet.runningHeader}
            render={() =>
              isSample
                ? `${props.title.toUpperCase()} — PREVIEW`
                : props.title.toUpperCase()
            }
            fixed
          />
          <View style={sheet.chapterHeader} wrap={false} id={`chapter-${ch.number}`}>
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

      {/* Sample CTA page */}
      {isSample && (
        <Page size={pageSize} style={sheet.ctaPage} bookmark="Get the Full Book" id="cta">
          <Text style={sheet.ctaEyebrow}>End of Preview</Text>
          <Text style={sheet.ctaHeadline}>Enjoying the read?</Text>
          <Text style={sheet.ctaBody}>
            You&apos;ve just finished the preview of{' '}
            <Text style={{ fontWeight: 'bold' }}>{props.title}</Text>
            {props.subtitle ? `: ${props.subtitle}` : ''}.
          </Text>
          {remainingCount > 0 && (
            <Text style={sheet.ctaStats}>
              {remainingCount} more {remainingCount === 1 ? 'chapter' : 'chapters'}
              {props.totalWordCount
                ? ` · ~${props.totalWordCount.toLocaleString()} words`
                : ''}{' '}
              await in the full book
            </Text>
          )}
          {props.sampleOptions?.ctaMessage && (
            <Text style={sheet.ctaMessage}>
              &ldquo;{props.sampleOptions.ctaMessage}&rdquo;
            </Text>
          )}
          {props.sampleOptions?.purchaseUrl ? (
            <>
              <Link src={props.sampleOptions.purchaseUrl} style={sheet.ctaButton}>
                Get the Full Book →
              </Link>
              <Link src={props.sampleOptions.purchaseUrl} style={sheet.ctaUrl}>
                {props.sampleOptions.purchaseUrl}
              </Link>
            </>
          ) : (
            <Text style={{ ...sheet.ctaBody, color: '#94a3b8', fontSize: markdown.paragraph.fontSize as number }}>
              (Add your purchase link when exporting to turn this into a trackable CTA.)
            </Text>
          )}
          <Text style={sheet.ctaAuthor}>— {props.authorName}</Text>
          {props.logoImageBuffer && (
            <Image
              src={props.logoImageBuffer}
              style={{
                alignSelf: 'center',
                marginTop: 24,
                width: 80,
                height: 80,
                objectFit: 'contain',
              }}
            />
          )}
        </Page>
      )}
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
