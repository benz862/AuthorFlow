import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('book_projects').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!project) notFound()

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('subscription_status').select('plan_code').eq('user_id', user.id).single(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={profile ?? { email: user.email }} planCode={sub?.plan_code ?? 'freedom'} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
