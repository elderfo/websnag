'use client'

import { UserMenu } from '@/components/layout/user-menu'
import type { Plan } from '@/types'

interface HeaderProps {
  userEmail: string
  plan: Plan
  mobileNav?: React.ReactNode
}

export function Header({ userEmail, plan, mobileNav }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {mobileNav}
        {/* Mobile logo — visible only when sidebar is hidden */}
        <span className="font-mono text-lg font-bold text-accent lg:hidden">websnag</span>
      </div>
      <UserMenu email={userEmail} plan={plan} />
    </header>
  )
}
