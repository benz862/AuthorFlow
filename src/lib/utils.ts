import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}

export const STATUS_LABELS: Record<string, string> = {
  intake: 'Gathering Details',
  research: 'Researching',
  outline: 'Outlining',
  drafting: 'Writing',
  editing: 'Editing',
  ready_for_export: 'Ready to Export',
  completed: 'Completed',
  archived: 'Archived',
}

export const STATUS_COLORS: Record<string, string> = {
  intake: 'bg-blue-100 text-blue-800',
  research: 'bg-purple-100 text-purple-800',
  outline: 'bg-yellow-100 text-yellow-800',
  drafting: 'bg-orange-100 text-orange-800',
  editing: 'bg-indigo-100 text-indigo-800',
  ready_for_export: 'bg-green-100 text-green-800',
  completed: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-gray-100 text-gray-600',
}
