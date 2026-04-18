'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, LogOut, Settings, CreditCard, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  user?: { email?: string; full_name?: string } | null
  planCode?: string
}

const PLAN_COLORS: Record<string, string> = {
  freedom: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  creator: 'bg-indigo-100 text-indigo-700',
  studio: 'bg-purple-100 text-purple-700',
  unlimited: 'bg-amber-100 text-amber-700',
}

export function Header({ user, planCode = 'freedom' }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-gray-900">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <span>AuthorFlow</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Library
            </Button>
          </Link>
          <Link href="/billing">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Billing
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {planCode && (
            <span className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PLAN_COLORS[planCode] ?? PLAN_COLORS.freedom}`}>
              {planCode}
            </span>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-sm text-gray-600">{user.email}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
