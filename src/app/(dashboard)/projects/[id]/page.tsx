import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { STATUS_LABELS, STATUS_COLORS, formatRelativeTime } from '@/lib/utils'
import { BookOpen, ArrowRight } from 'lucide-react'

const STATUS_STEPS = ['intake', 'research', 'outline', 'drafting', 'editing', 'ready_for_export', 'completed']

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('book_projects').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!project) notFound()

  const { count: chapterCount } = await supabase.from('book_chapters').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('version_number', project.current_version_number)

  const statusIdx = STATUS_STEPS.indexOf(project.status)
  const progress = Math.round(((statusIdx + 1) / STATUS_STEPS.length) * 100)

  const nextAction = ({
    intake: { label: 'Complete Intake', href: `/projects/${id}/intake` },
    research: { label: 'Start Research', href: `/projects/${id}/research` },
    outline: { label: 'Review Outline', href: `/projects/${id}/outline` },
    drafting: { label: 'Continue Writing', href: `/projects/${id}/chapters` },
    editing: { label: 'Edit Chapters', href: `/projects/${id}/chapters` },
    ready_for_export: { label: 'Export Book', href: `/projects/${id}/exports` },
    completed: { label: 'View Exports', href: `/projects/${id}/exports` },
    archived: { label: 'Settings', href: `/projects/${id}/settings` },
  } as Record<string, { label: string; href: string }>)[project.status]

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={id} projectStatus={project.status} />
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          {project.subtitle && <p className="text-gray-500 mt-0.5">{project.subtitle}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
            <span className="text-xs text-gray-400">Updated {formatRelativeTime(project.updated_at)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Project Progress</span>
            <span className="text-sm text-indigo-600 font-medium">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Chapters Written</p>
            <p className="text-2xl font-bold text-gray-900">{chapterCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Version</p>
            <p className="text-2xl font-bold text-gray-900">v{project.current_version_number}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Last Export</p>
            <p className="text-sm font-semibold text-gray-900">{project.last_exported_at ? formatRelativeTime(project.last_exported_at) : 'Never'}</p>
          </div>
        </div>

        {nextAction && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="font-semibold text-indigo-900">Next step</p>
                <p className="text-sm text-indigo-600">{STATUS_LABELS[project.status]}</p>
              </div>
            </div>
            <Link href={nextAction.href}>
              <Button className="gap-1.5">{nextAction.label} <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
