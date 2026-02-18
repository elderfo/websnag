'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface HeaderProps {
  userEmail: string
  mobileNav?: React.ReactNode
}

export function Header({ userEmail, mobileNav }: HeaderProps) {
  const router = useRouter()
  const initial = userEmail.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {mobileNav}
        {/* Mobile logo — visible only when sidebar is hidden */}
        <span className="font-mono text-lg font-bold text-accent lg:hidden">websnag</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden text-sm text-text-secondary sm:inline">{userEmail}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
          {initial}
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary sm:px-3"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
