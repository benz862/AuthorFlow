import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { STATUS_LABELS } from '@/lib/utils'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Simple admin check — add your user ID here or use a role column
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(user.email ?? '')) redirect('/dashboard')

  const adminClient = createAdminClient()

  const [
    { count: userCount },
    { count: projectCount },
    { data: recentProjects },
    { data: planBreakdown },
  ] = await Promise.all([
    adminClient.from('profiles').select('*', { count: 'exact', head: true }),
    adminClient.from('book_projects').select('*', { count: 'exact', head: true }),
    adminClient.from('book_projects').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(10),
    adminClient.from('subscription_status').select('plan_code'),
  ])

  const planCounts = (planBreakdown ?? []).reduce((acc, row) => {
    acc[row.plan_code] = (acc[row.plan_code] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-3xl font-bold text-gray-900">{userCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Projects</p>
          <p className="text-3xl font-bold text-gray-900">{projectCount ?? 0}</p>
        </div>
        {Object.entries(planCounts).map(([plan, count]) => (
          <div key={plan} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 capitalize">{plan} Plan</p>
            <p className="text-3xl font-bold text-gray-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Projects</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(recentProjects ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{p.title}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="capitalize">{STATUS_LABELS[p.status] ?? p.status}</span>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
