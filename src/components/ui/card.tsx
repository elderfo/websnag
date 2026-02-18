import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}
