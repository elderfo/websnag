type MethodColor = {
  bg: string
  text: string
}

const METHOD_COLORS: Record<string, MethodColor> = {
  GET: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  POST: { bg: 'bg-green-500/20', text: 'text-green-400' },
  PUT: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  DELETE: { bg: 'bg-red-500/20', text: 'text-red-400' },
  PATCH: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
}

const DEFAULT_COLOR: MethodColor = { bg: 'bg-white/10', text: 'text-text-secondary' }

interface MethodBadgeProps {
  method: string
  className?: string
}

export function MethodBadge({ method, className = '' }: MethodBadgeProps) {
  const upper = method.toUpperCase()
  const color = METHOD_COLORS[upper] ?? DEFAULT_COLOR

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold uppercase ${color.bg} ${color.text} ${className}`}
    >
      {upper}
    </span>
  )
}
