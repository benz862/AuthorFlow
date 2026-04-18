'use client'
import Link from 'next/link'
import { BookProject } from '@/lib/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, STATUS_COLORS, formatRelativeTime } from '@/lib/utils'
import { BookOpen, MoreHorizontal, Archive, Copy, Trash2 } from 'lucide-react'
import { BOOK_TYPE_LABELS, BookType } from '@/lib/types/app'
import { useState, useRef, useEffect } from 'react'

interface ProjectCardProps {
  project: BookProject
  onArchive?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ProjectCard({ project, onArchive, onDuplicate, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const statusClass = STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
              <BookOpen className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <Link href={`/projects/${project.id}`} className="block font-semibold text-gray-900 hover:text-indigo-600 truncate">
                {project.title}
              </Link>
              {project.subtitle && (
                <p className="text-xs text-gray-500 truncate">{project.subtitle}</p>
              )}
            </div>
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {onDuplicate && (
                  <button onClick={() => { onDuplicate(project.id); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                )}
                {onArchive && (
                  <button onClick={() => { onArchive(project.id); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => { onDelete(project.id); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            <Badge variant="secondary" className="text-xs capitalize">{project.category}</Badge>
            <Badge variant="secondary" className="text-xs">
              {BOOK_TYPE_LABELS[project.book_type as BookType] ?? project.book_type}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>v{project.current_version_number}</span>
            <span>{formatRelativeTime(project.updated_at)}</span>
          </div>
        </div>

        <Link
          href={`/projects/${project.id}`}
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Open Project
        </Link>
      </CardContent>
    </Card>
  )
}
