import Link from 'next/link'

interface EmptyStateProps {
  title: string
  description: string
  action?: { label: string; href: string }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      <p className="mt-1 text-text-secondary">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
