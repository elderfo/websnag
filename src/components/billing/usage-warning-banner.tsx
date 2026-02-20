import Link from 'next/link'

interface UsageWarningBannerProps {
  requestCount: number
  maxRequests: number
  aiAnalysisCount: number
  maxAiAnalyses: number
}

export function UsageWarningBanner({
  requestCount,
  maxRequests,
  aiAnalysisCount,
  maxAiAnalyses,
}: UsageWarningBannerProps) {
  const requestsAtLimit = isFinite(maxRequests) && requestCount >= maxRequests
  const requestsWarning =
    isFinite(maxRequests) && requestCount >= maxRequests * 0.8 && !requestsAtLimit
  const aiAtLimit = isFinite(maxAiAnalyses) && aiAnalysisCount >= maxAiAnalyses
  const aiWarning = isFinite(maxAiAnalyses) && aiAnalysisCount >= maxAiAnalyses * 0.8 && !aiAtLimit

  if (!requestsAtLimit && !requestsWarning && !aiAtLimit && !aiWarning) {
    return null
  }

  return (
    <div className="space-y-3">
      {requestsAtLimit && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-red-400">Monthly request limit reached</p>
            <p className="mt-1 text-sm text-text-secondary">
              You&apos;ve used all {maxRequests} requests this month. Your endpoints are no longer
              capturing webhooks.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {requestsWarning && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-yellow-400">Approaching request limit</p>
            <p className="mt-1 text-sm text-text-secondary">
              You&apos;ve used {requestCount} of {maxRequests} requests this month.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {aiAtLimit && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-red-400">AI analysis limit reached</p>
            <p className="mt-1 text-sm text-text-secondary">
              You&apos;ve used all {maxAiAnalyses} AI analyses this month.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {aiWarning && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-yellow-400">Approaching AI analysis limit</p>
            <p className="mt-1 text-sm text-text-secondary">
              You&apos;ve used {aiAnalysisCount} of {maxAiAnalyses} AI analyses this month.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}
    </div>
  )
}
