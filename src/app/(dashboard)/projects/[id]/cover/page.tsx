'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject, BookAsset } from '@/lib/types/database'
import { ImageIcon, RefreshCw, Download } from 'lucide-react'

export default function CoverPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [cover, setCover] = useState<BookAsset | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('book_assets').select('*').eq('project_id', projectId).eq('asset_type', 'cover').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      if (data && data.length > 0) setCover(data[0])
    })
  }, [projectId])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    const res = await fetch(`/api/projects/${projectId}/generate-cover`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to generate cover'); setGenerating(false); return }
    if (data.asset) setCover(data.asset)
    setGenerating(false)
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
            <h1 className="text-xl font-bold text-gray-900">Cover & Art</h1>
            <p className="text-sm text-gray-500">AI-generated cover image for your book</p>
          </div>
          <Button onClick={handleGenerate} loading={generating} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            {cover ? 'Regenerate Cover' : 'Generate Cover'}
          </Button>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        {generating ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center"><Spinner size="lg" className="mx-auto mb-3" /><p className="text-gray-500">Generating your cover...</p></div>
          </div>
        ) : cover ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-center">
              <div className="relative w-64 shadow-2xl rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.storage_path} alt="Book cover" className="w-full" />
              </div>
            </div>
            {cover.storage_path && (
              <div className="flex justify-center">
                <a href={cover.storage_path} download>
                  <Button variant="outline" className="gap-1.5">
                    <Download className="h-4 w-4" /> Download Cover
                  </Button>
                </a>
              </div>
            )}
            {cover.generation_prompt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Generation prompt</p>
                <p className="text-sm text-gray-700">{cover.generation_prompt}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No cover yet</h3>
            <p className="text-sm text-gray-500 mb-5">Generate an AI-designed cover for your book.</p>
            <Button onClick={handleGenerate} loading={generating} className="gap-2">
              <ImageIcon className="h-4 w-4" /> Generate Cover
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
