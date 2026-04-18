export type PlanCode = 'freedom' | 'starter' | 'creator' | 'studio' | 'unlimited'
export type BookCategory = 'freebie' | 'short' | 'medium' | 'long'
export type BookStatus = 'intake' | 'research' | 'outline' | 'drafting' | 'editing' | 'ready_for_export' | 'completed' | 'archived'
export type JobStatus = 'queued' | 'in_progress' | 'completed' | 'failed'
export type ExportType = 'pdf' | 'formatted_text'

export const BOOK_TYPES = [
  'nonfiction_educational',
  'how_to_guide',
  'workbook',
  'business_book',
  'self_help',
  'personal_development',
  'childrens_story',
  'childrens_educational',
  'reference_book',
  'memoir',
  'fiction',
] as const

export type BookType = typeof BOOK_TYPES[number]

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  nonfiction_educational: 'Nonfiction Educational',
  how_to_guide: 'How-To Guide',
  workbook: 'Workbook',
  business_book: 'Business Book',
  self_help: 'Self-Help',
  personal_development: 'Personal Development',
  childrens_story: "Children's Story",
  childrens_educational: "Children's Educational",
  reference_book: 'Reference Book',
  memoir: 'Memoir',
  fiction: 'Fiction',
}

export const CATEGORY_LABELS: Record<BookCategory, string> = {
  freebie: 'Freebie (5–15 pages)',
  short: 'Short Book (20–60 pages)',
  medium: 'Medium Book (60–140 pages)',
  long: 'Long Book (140+ pages)',
}

export const CATEGORY_ORDER: BookCategory[] = ['freebie', 'short', 'medium', 'long']

export const PLAN_LABELS: Record<string, string> = {
  freedom: 'Freedom',
  starter: 'Starter',
  creator: 'Creator',
  studio: 'Studio',
  unlimited: 'Unlimited',
}

export const PLAN_PRICES: Record<string, number> = {
  freedom: 0,
  starter: 12,
  creator: 29,
  studio: 59,
  unlimited: 99,
}

export interface EntitlementResult {
  allowed: boolean
  reason?: string
  upgradeMessage?: string
  upgradePlan?: string
}

export interface IntakeQuestion {
  key: string
  text: string
  type: 'text' | 'select' | 'multiselect' | 'textarea' | 'boolean'
  options?: string[]
  required: boolean
  dependsOn?: { key: string; value: string }
}

export interface OutlineChapter {
  number: number
  title: string
  summary: string
  estimatedWords?: number
}

export interface OutlineStructure {
  frontMatter: string[]
  chapters: OutlineChapter[]
  backMatter: string[]
}

export interface ExportProfile {
  id: string
  label: string
  width: string
  height: string
  margins: string
  pageNumbers: boolean
  header: boolean
  footer: boolean
}

export const EXPORT_PROFILES: ExportProfile[] = [
  { id: '6x9', label: '6×9 Book', width: '6in', height: '9in', margins: '0.75in', pageNumbers: true, header: false, footer: true },
  { id: '8x11', label: '8.5×11 Letter', width: '8.5in', height: '11in', margins: '1in', pageNumbers: true, header: true, footer: true },
  { id: 'square', label: 'Square Picture Book', width: '8in', height: '8in', margins: '0.5in', pageNumbers: false, header: false, footer: false },
  { id: 'workbook', label: 'Workbook Layout', width: '8.5in', height: '11in', margins: '1in', pageNumbers: true, header: true, footer: true },
  { id: 'digital', label: 'Plain Digital PDF', width: '8.5in', height: '11in', margins: '1in', pageNumbers: true, header: false, footer: false },
]
