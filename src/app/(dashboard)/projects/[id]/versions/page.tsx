'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject, BookVersion } from '@/lib/types/database'
import { GitBranch, Plus, Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

export default function VersionsPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [versions, setVersions] = useState<BookVersion[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('book_versions').select('*').eq('project_id', projectId).order('version_number', { ascending: false }).then(({ data }) => setVersions(data ?? []))
  }, [projectId])

  const handleSaveVersion = async () => {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/save-version`, { method: 'POST' })
    if (res.ok) {
      const { version } = await res.json()
      setVersions((prev) => [version, ...prev])
      await supabase.from('book_projects').update({ current_version_number: version.version_number }).eq('id', projectId)
      setProject((p) => p ? { ...p, current_version_number: version.version_number } : p)
    }
    setSaving(false)
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="drafting" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Version History</h1>
            <p className="text-sm text-gray-500">Save snapshots of your book at any point</p>
          </div>
          <Button onClick={handleSaveVersion} loading={saving} className="gap-1.5">
            <Plus className="h-4 w-4" /> Save Version
          </Button>
        </div>

        {versions.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <GitBranch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No versions saved</h3>
            <p className="text-sm text-gray-500 mb-5">Save a version to preserve your current progress.</p>
            <Button onClick={handleSaveVersion} loading={saving} className="gap-2">
              <Plus className="h-4 w-4" /> Save First Version
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
                      <GitBranch className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Version {v.version_number}</p>
                      {v.label && <p className="text-xs text-gray-500">{v.label}</p>}
                      {v.notes && <p className="text-xs text-gray-400 mt-0.5">{v.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelativeTime(v.created_at)}
                    {v.version_number === project.current_version_number && (
                      <span className="ml-2 rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 font-medium">Current</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
