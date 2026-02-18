import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/ui/copy-button'
import { RequestFeed } from '@/components/requests/request-feed'
import type { Endpoint } from '@/types'

interface EndpointDetailPageProps {
  params: Promise<{ id: string }>
}

function getWebhookUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${baseUrl}/api/wh/${slug}`
}

export default async function EndpointDetailPage({ params }: EndpointDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.from('endpoints').select('*').eq('id', id).single()

  if (error || !data) {
    notFound()
  }

  const endpoint = data as Endpoint
  const webhookUrl = getWebhookUrl(endpoint.slug)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">{endpoint.name}</h1>
          <Badge variant={endpoint.is_active ? 'success' : 'warning'}>
            {endpoint.is_active ? 'Active' : 'Paused'}
          </Badge>
        </div>
        <Link
          href={`/endpoints/${endpoint.id}/settings`}
          className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
        >
          Settings
        </Link>
      </div>

      {endpoint.description && (
        <p className="mt-2 text-sm text-text-secondary">{endpoint.description}</p>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Webhook URL
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm text-accent">
            {webhookUrl}
          </code>
          <CopyButton text={webhookUrl} label="Copy URL" />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          cURL Example
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 truncate rounded bg-background px-3 py-2 font-mono text-xs text-text-secondary">
            {`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"test": true}'`}
          </code>
          <CopyButton
            text={`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"test": true}'`}
            label="Copy"
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Request Feed</h2>
        <RequestFeed endpointId={endpoint.id} endpointUrl={webhookUrl} />
      </div>
    </div>
  )
}
