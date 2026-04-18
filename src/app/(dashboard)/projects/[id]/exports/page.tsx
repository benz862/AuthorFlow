'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject, ExportJob } from '@/lib/types/database'
import { Download, FileText, FileType2, Clock, CheckCircle2, XCircle } from 'lucide-react'

const FORMAT_LABELS: Record<string, string> = { pdf: 'PDF', epub: 'EPUB', docx: 'Word (.docx)', txt: 'Plain Text', md: 'Markdown' }
const FORMAT_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileType2 className="h-5 w-5 text-red-500" />,
  epub: <FileText className="h-5 w-5 text-blue-500" />,
  docx: <FileText className="h-5 w-5 text-indigo-500" />,
  txt: <FileText className="h-5 w-5 text-gray-500" />,
  md: <FileText className="h-5 w-5 text-green-500" />,
}

export default function ExportsPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [exports, setExports] = useState<ExportJob[]>([])
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('book_projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
    supabase.from('export_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).then(({ data }) => setExports(data ?? []))
  }, [projectId])

  const handleExport = async (format: string) => {
    setExporting(format)
    const res = await fetch(`/api/projects/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    })
    if (res.ok) {
      const { job } = await res.json()
      setExports((prev) => [job, ...prev])
    }
    setExporting(null)
  }

  if (!project) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="drafting" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  const formats = ['pdf', 'epub', 'docx', 'txt', 'md']

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exports</h1>
          <p className="text-sm text-gray-500">Download your book in various formats</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Export Format</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {formats.map((fmt) => (
              <button key={fmt} onClick={() => handleExport(fmt)} disabled={!!exporting}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left">
                {FORMAT_ICONS[fmt]}
                <div>
                  <p className="text-sm font-medium text-gray-900">{FORMAT_LABELS[fmt]}</p>
                  {exporting === fmt && <p className="text-xs text-indigo-600">Generating...</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {exports.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Export History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {exports.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {FORMAT_ICONS[exp.export_format] ?? <FileText className="h-5 w-5 text-gray-400" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{FORMAT_LABELS[exp.export_format] ?? exp.export_format}</p>
                      <p className="text-xs text-gray-400">{new Date(exp.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exp.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                    {exp.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {exp.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                    {exp.status === 'completed' && exp.file_url && (
                      <a href={exp.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      </a>
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
