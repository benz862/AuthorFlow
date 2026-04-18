'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { BookProject } from '@/lib/types/database'
import { Save, Trash2 } from 'lucide-react'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => {
      if (data) {
        setProject(data)
        setTitle(data.title)
        setSubtitle(data.subtitle ?? '')
        setDescription(data.description ?? '')
      }
    })
  }, [projectId])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('book_projects').update({
      title,
      subtitle: subtitle || null,
      description: description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleArchive = async () => {
    if (!confirm('Archive this project? You can unarchive it later from settings.')) return
    setArchiving(true)
    await fetch(`/api/projects/${projectId}/archive`, { method: 'POST' })
    router.push('/dashboard')
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
      <div className="flex-1 max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Settings</h1>
          <p className="text-sm text-gray-500">Update your book details</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <Button onClick={handleSave} loading={saving} className="gap-1.5 w-full">
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-red-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
          <p className="text-sm text-gray-500">Archive this project to hide it from your dashboard. Your work will be preserved.</p>
          <Button variant="destructive" onClick={handleArchive} loading={archiving} className="gap-1.5">
            <Trash2 className="h-4 w-4" /> Archive Project
          </Button>
        </div>
      </div>
    </div>
  )
}
