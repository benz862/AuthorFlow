'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BookOpen, FileText, Search, AlignLeft, Edit3,
  Image, Download, Clock, Settings2
} from 'lucide-react'

interface SidebarProps {
  projectId: string
  projectStatus: string
}

const NAV_ITEMS = [
  { href: '', label: 'Overview', icon: BookOpen },
  { href: '/intake', label: 'Intake', icon: FileText },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/outline', label: 'Outline', icon: AlignLeft },
  { href: '/chapters', label: 'Chapters', icon: Edit3 },
  { href: '/cover', label: 'Cover & Art', icon: Image },
  { href: '/exports', label: 'Exports', icon: Download },
  { href: '/versions', label: 'Versions', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export function ProjectSidebar({ projectId, projectStatus }: SidebarProps) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 px-3 py-3">
      <nav className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const fullHref = `${base}${href}`
          const isActive = href === '' ? pathname === base : pathname.startsWith(fullHref)
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
