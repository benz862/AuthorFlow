import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectCard } from '@/components/dashboard/project-card'
import { Button } from '@/components/ui/button'
import { PlusCircle, BookOpen, TrendingUp } from 'lucide-react'
import { BookProject } from '@/lib/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sub } = await supabase.from('subscription_status').select('plan_code').eq('user_id', user.id).single()
  const planCode = sub?.plan_code ?? 'freedom'

  const [{ data: projects }, { data: limits }] = await Promise.all([
    supabase.from('book_projects').select('*').eq('user_id', user.id).eq('archived', false).order('updated_at', { ascending: false }),
    supabase.from('plan_limits').select('max_active_projects, max_books_per_month').eq('plan_code', planCode).single(),
  ])

  const activeProjects = projects?.length ?? 0
  const maxProjects = limits?.max_active_projects ?? 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Book Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeProjects} of {maxProjects === 9999 ? 'unlimited' : maxProjects} projects used
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Book
          </Button>
        </Link>
      </div>

      {activeProjects === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900">No books yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
            Start your first book project. We&apos;ll guide you through every step.
          </p>
          <Link href="/projects/new">
            <Button>Create Your First Book</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects as BookProject[]).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {planCode === 'freedom' && (
        <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5" />
            <span className="font-semibold">Upgrade to write more books</span>
          </div>
          <p className="text-sm text-indigo-100 mb-3">
            You&apos;re on the free plan. Upgrade to Starter ($12/mo) for 3 projects, medium books, and clean PDF exports.
          </p>
          <Link href="/billing">
            <Button variant="secondary" size="sm">View Plans</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
