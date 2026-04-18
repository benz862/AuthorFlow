/**
 * Minimal Markdown -> @react-pdf/renderer node converter.
 *
 * Intentionally small: handles the constructs we ask Claude to emit in
 * chapters.ts (headings, paragraphs, bold, italic, lists, blockquotes,
 * code, horizontal rules). Anything exotic falls back to plain text.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, RootContent, PhrasingContent } from 'mdast'
import type { Style } from '@react-pdf/types'

export interface MarkdownStyles {
  paragraph: Style
  h1: Style
  h2: Style
  h3: Style
  h4: Style
  listItem: Style
  bullet: Style
  blockquote: Style
  code: Style
  hr: Style
  bold: Style
  italic: Style
  inlineCode: Style
}

export function parseMarkdown(src: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(src) as Root
}

export function renderMarkdown(src: string, styles: MarkdownStyles): React.ReactNode {
  const tree = parseMarkdown(src)
  return tree.children.map((node, i) => renderBlock(node, i, styles))
}

function renderBlock(
  node: RootContent,
  key: number,
  styles: MarkdownStyles,
): React.ReactNode {
  switch (node.type) {
    case 'heading': {
      const style =
        node.depth === 1 ? styles.h1 :
        node.depth === 2 ? styles.h2 :
        node.depth === 3 ? styles.h3 :
        styles.h4
      return (
        <Text key={key} style={style}>
          {renderInline(node.children, styles)}
        </Text>
      )
    }
    case 'paragraph':
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInline(node.children, styles)}
        </Text>
      )
    case 'list': {
      const ordered = !!node.ordered
      return (
        <View key={key} style={{ marginBottom: 8 }}>
          {node.children.map((item, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', marginBottom: 3 }}
              wrap={false}
            >
              <Text style={styles.bullet}>
                {ordered ? `${(node.start ?? 1) + i}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>
                {item.children.map((c, j) =>
                  c.type === 'paragraph' ? (
                    <Text key={j} style={styles.listItem}>
                      {renderInline(c.children, styles)}
                    </Text>
                  ) : (
                    renderBlock(c, j, styles)
                  ),
                )}
              </View>
            </View>
          ))}
        </View>
      )
    }
    case 'blockquote':
      return (
        <View key={key} style={styles.blockquote}>
          {node.children.map((c, i) => renderBlock(c, i, styles))}
        </View>
      )
    case 'code':
      return (
        <Text key={key} style={styles.code}>
          {node.value}
        </Text>
      )
    case 'thematicBreak':
      return <View key={key} style={styles.hr} />
    case 'html':
      // Strip HTML tags, render as paragraph
      return (
        <Text key={key} style={styles.paragraph}>
          {node.value.replace(/<[^>]+>/g, '')}
        </Text>
      )
    default:
      return null
  }
}

function renderInline(
  nodes: PhrasingContent[],
  styles: MarkdownStyles,
): React.ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.value
      case 'strong':
        return (
          <Text key={i} style={styles.bold}>
            {renderInline(node.children, styles)}
          </Text>
        )
      case 'emphasis':
        return (
          <Text key={i} style={styles.italic}>
            {renderInline(node.children, styles)}
          </Text>
        )
      case 'inlineCode':
        return (
          <Text key={i} style={styles.inlineCode}>
            {node.value}
          </Text>
        )
      case 'break':
        return '\n'
      case 'link':
        return renderInline(node.children, styles)
      case 'delete':
        return (
          <Text key={i} style={{ textDecoration: 'line-through' }}>
            {renderInline(node.children, styles)}
          </Text>
        )
      default:
        return null
    }
  })
}

/** Plain-text extraction for TOC snippets, previews, etc. */
export function mdToPlainText(src: string): string {
  const tree = parseMarkdown(src)
  const parts: string[] = []
  function walk(node: { type: string; value?: string; children?: unknown[] }) {
    if (node.type === 'text' && typeof node.value === 'string') parts.push(node.value)
    if (Array.isArray(node.children)) node.children.forEach((c) => walk(c as Parameters<typeof walk>[0]))
  }
  walk(tree as unknown as Parameters<typeof walk>[0])
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
