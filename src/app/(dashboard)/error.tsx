'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-text-secondary">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
