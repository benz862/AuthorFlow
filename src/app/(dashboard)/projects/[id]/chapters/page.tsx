'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProjectSidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BookProject, BookChapter, BookOutline } from '@/lib/types/database'
import { OutlineStructure } from '@/lib/types/app'
import { Edit3, RefreshCw, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function ChaptersPage() {
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<BookProject | null>(null)
  const [structure, setStructure] = useState<OutlineStructure | null>(null)
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [generating, setGenerating] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [bulkStopRequested, setBulkStopRequested] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: proj }, { data: outl }, { data: chaps }] = await Promise.all([
      supabase.from('book_projects').select('*').eq('id', projectId).single(),
      supabase.from('book_outlines').select('*').eq('project_id', projectId).eq('is_current', true).single(),
      supabase.from('book_chapters').select('*').eq('project_id', projectId).order('chapter_number'),
    ])
    setProject(proj)
    if (outl?.outline_json) {
      const s = outl.outline_json as OutlineStructure
      setStructure(s)
      setSelectedChapter((prev) => prev ?? s.chapters?.[0]?.number ?? null)
    }
    setChapters(chaps ?? [])
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  const handleGenerate = async (chapterNumber: number) => {
    if (!structure) return
    const chapterOutline = structure.chapters.find((c) => c.number === chapterNumber)
    if (!chapterOutline) return
    setGenerating(chapterNumber)
    const prevChapter = chapters.find((c) => c.chapter_number === chapterNumber - 1)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterOutline, previousSummary: prevChapter?.summary ?? '' }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Chapter generation failed: ${errBody.error ?? res.statusText}`)
      }
    } catch (e) {
      alert(`Chapter generation failed: ${e instanceof Error ? e.message : 'network error'}`)
    }
    await loadData()
    setGenerating(null)
  }

  const handleGenerateAll = async () => {
    if (!structure) return
    setBulkStopRequested(false)
    setBulkRunning(true)

    // Re-fetch fresh state so we know exactly what's missing right now
    const { data: freshChaps } = await supabase.from('book_chapters').select('chapter_number').eq('project_id', projectId)
    const existingSet = new Set((freshChaps ?? []).map((c) => c.chapter_number))
    const todo = structure.chapters.filter((c) => !existingSet.has(c.number))

    if (todo.length === 0) {
      setBulkRunning(false)
      setBulkProgress(null)
      alert('All chapters are already generated. Use Regenerate on individual chapters to rewrite them.')
      return
    }

    let done = 0
    for (const ch of todo) {
      if (bulkStopRequested) break
      setBulkProgress({ done, total: todo.length, current: `Chapter ${ch.number}: ${ch.title}` })

      // Get the fresh previous chapter summary from the live state
      const { data: prev } = await supabase
        .from('book_chapters').select('summary').eq('project_id', projectId).eq('chapter_number', ch.number - 1).maybeSingle()

      try {
        const res = await fetch(`/api/projects/${projectId}/generate-chapter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterOutline: ch, previousSummary: prev?.summary ?? '' }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          const stop = confirm(`Chapter ${ch.number} failed: ${err.error ?? res.statusText}\n\nOK = continue with remaining chapters, Cancel = stop bulk generation.`)
          if (!stop) break
        }
      } catch (e) {
        const stop = confirm(`Chapter ${ch.number} network error: ${e instanceof Error ? e.message : 'unknown'}\n\nOK = continue, Cancel = stop.`)
        if (!stop) break
      }
      done += 1
      setBulkProgress({ done, total: todo.length, current: done < todo.length ? `Next: chapter ${todo[done].number}` : 'Finishing…' })
      await loadData()
    }

    setBulkRunning(false)
    setBulkProgress(null)
    await loadData()
  }

  const currentChapterData = chapters.find((c) => c.chapter_number === selectedChapter)
  const currentChapterOutline = structure?.chapters.find((c) => c.number === selectedChapter)

  const handleSaveEdit = async () => {
    if (!currentChapterData) return
    setSaving(true)
    await supabase.from('book_chapters').update({
      content_markdown: editContent,
      word_count: editContent.split(/\s+/).filter(Boolean).length,
      updated_at: new Date().toISOString(),
    }).eq('id', currentChapterData.id)
    await loadData()
    setSaving(false)
    setEditing(false)
  }

  if (!project || !structure) return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus="drafting" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  return (
    <div className="flex gap-6">
      <ProjectSidebar projectId={projectId} projectStatus={project.status} />
      <div className="flex-1 flex gap-4">
        <div className="w-52 shrink-0">
          <div className="mb-3 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Chapters</h2>
            {(() => {
              const remaining = structure.chapters.filter((c) => !chapters.some((ch) => ch.chapter_number === c.number)).length
              if (remaining === 0 && !bulkRunning) {
                return <p className="text-xs text-green-600 font-medium">All {structure.chapters.length} chapters written</p>
              }
              return (
                <>
                  {!bulkRunning ? (
                    <Button size="sm" className="w-full gap-1.5" onClick={handleGenerateAll}>
                      <RefreshCw className="h-3.5 w-3.5" /> Generate All ({remaining})
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
                      <div className="flex items-center gap-2">
                        <Spinner size="sm" />
                        <p className="text-xs font-medium text-indigo-900">
                          {bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}` : 'Starting…'}
                        </p>
                      </div>
                      {bulkProgress && (
                        <>
                          <div className="h-1 bg-indigo-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-indigo-700 truncate">{bulkProgress.current}</p>
                        </>
                      )}
                      <button onClick={() => setBulkStopRequested(true)} className="text-[11px] text-indigo-700 hover:underline w-full text-left">
                        Stop after current
                      </button>
                      <p className="text-[10px] text-gray-500 leading-tight">Keep this tab open. Progress saves as each chapter finishes.</p>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
          <div className="space-y-1">
            {structure.chapters.map((ch) => {
              const written = chapters.find((c) => c.chapter_number === ch.number)
              return (
                <button key={ch.number} onClick={() => { setSelectedChapter(ch.number); setEditing(false) }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center justify-between gap-2 ${selectedChapter === ch.number ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <span className="truncate">{ch.number}. {ch.title}</span>
                  {written ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <Clock className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          {selectedChapter && currentChapterOutline && (
            <>
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900">Chapter {selectedChapter}: {currentChapterOutline.title}</h2>
                  <p className="text-xs text-gray-500">{currentChapterOutline.summary}</p>
                </div>
                <div className="flex gap-2">
                  {currentChapterData && !editing && (
                    <Button variant="outline" size="sm" onClick={() => { setEditing(true); setEditContent(currentChapterData.content_markdown ?? '') }} className="gap-1">
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleGenerate(selectedChapter)} loading={generating === selectedChapter} className="gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {currentChapterData ? 'Regenerate' : 'Generate'}
                  </Button>
                  {currentChapterData && !editing && selectedChapter < structure.chapters.length && (
                    <Button size="sm" onClick={() => setSelectedChapter(selectedChapter + 1)} className="gap-1">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {generating === selectedChapter ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Spinner size="lg" className="mb-3" /><p className="text-gray-500">Writing chapter...</p>
                  </div>
                ) : editing ? (
                  <div className="space-y-3">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-[60vh] rounded-lg border border-gray-300 p-3 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} loading={saving}>Save Changes</Button>
                      <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : currentChapterData ? (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{currentChapterData.content_markdown ?? ''}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Edit3 className="h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-gray-500 text-sm">This chapter hasn&apos;t been written yet.</p>
                    <Button className="mt-4" onClick={() => handleGenerate(selectedChapter)}>Generate Chapter</Button>
                  </div>
                )}
              </div>

              {currentChapterData && !editing && (
                <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
                  <span>{currentChapterData.word_count.toLocaleString()} words</span>
                  <span className="capitalize">{currentChapterData.status}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
