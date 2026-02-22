import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/ui/copy-button'
import type { Endpoint } from '@/types'

interface EndpointCardProps {
  endpoint: Endpoint
  username: string | null
}

function getWebhookUrl(username: string | null, slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  if (username) {
    return `${baseUrl}/api/wh/${username}/${slug}`
  }
  return `${baseUrl}/api/wh/${slug}`
}

export function EndpointCard({ endpoint, username }: EndpointCardProps) {
  const webhookUrl = getWebhookUrl(username, endpoint.slug)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <Link
          href={`/endpoints/${endpoint.id}`}
          className="truncate min-w-0 text-base font-semibold text-text-primary hover:text-accent transition-colors"
        >
          {endpoint.name}
        </Link>
        <Badge variant={endpoint.is_active ? 'success' : 'warning'} className="shrink-0">
          {endpoint.is_active ? 'Active' : 'Paused'}
        </Badge>
      </div>

      {endpoint.description && (
        <p className="text-sm text-text-secondary line-clamp-2">{endpoint.description}</p>
      )}

      <div className="flex items-center gap-2 min-w-0">
        <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-text-muted min-w-0">
          {webhookUrl}
        </code>
        <CopyButton text={webhookUrl} label="Copy" className="shrink-0" />
      </div>

      <div className="flex items-center justify-end pt-1">
        <Link
          href={`/endpoints/${endpoint.id}`}
          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          View details
        </Link>
      </div>
    </Card>
  )
}
