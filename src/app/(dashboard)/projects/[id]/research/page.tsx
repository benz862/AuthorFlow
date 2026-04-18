'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookSource, BookProject } from '@/lib/types/database'
import { Search, ExternalLink, Globe, ChevronRight } from 'lucide-react'

export default function ResearchPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [sources, setSources] = useState<BookSource[]>([])
  const [loading, setLoading] = useState(false)
  const [researched, setResearched] = useState(false)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('book_sources').select('*').eq('project_id', projectId).then(({ data }) => {
      if (data && data.length > 0) { setSources(data); setResearched(true) }
    })
  }, [projectId])

  const handleResearch = async () => {
    setLoading(true)
    const mockSources = Array.from({ length: 6 }, (_, i) => ({
      project_id: projectId,
      source_url: `https://example-source-${i + 1}.com/article`,
      source_title: `${project?.title} — Research Source ${i + 1}`,
      domain: `source${i + 1}.com`,
      source_type: i < 2 ? 'encyclopedia' : 'article',
      credibility_score: 0.6 + (i % 4) * 0.1,
      extracted_summary: `This source provides relevant information about ${project?.title}, covering key aspects that will inform the book's content.`,
      retrieved_at: new Date().toISOString(),
    }))
    const { data } = await supabase.from('book_sources').insert(mockSources).select()
    if (data) {
      setSources(data)
      setResearched(true)
      await supabase.from('book_projects').update({ status: 'outline', updated_at: new Date().toISOString() }).eq('id', projectId)
    }
    setLoading(false)
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="research" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Research</h1>
          <p className="text-sm text-gray-500">Sources collected to inform your book</p>
        </div>

        {!researched ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to research</h3>
            <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">We&apos;ll gather sources relevant to your book topic.</p>
            <Button onClick={handleResearch} loading={loading} className="gap-2">
              <Search className="h-4 w-4" />
              {loading ? 'Researching...' : 'Start Research'}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                        <Globe className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{source.source_title}</p>
                        <p className="text-xs text-gray-500">{source.domain}</p>
                        {source.extracted_summary && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{source.extracted_summary}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {source.credibility_score && (
                        <span className={`text-xs rounded-full px-2 py-0.5 ${source.credibility_score >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {Math.round(source.credibility_score * 100)}%
                        </span>
                      )}
                      <a href={source.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => window.location.href = `/projects/${projectId}/outline`} className="gap-1.5">
                Generate Outline <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
