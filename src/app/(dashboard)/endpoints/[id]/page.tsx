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

function getWebhookUrl(username: string, slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${baseUrl}/api/wh/${username}/${slug}`
}

export default async function EndpointDetailPage({ params }: EndpointDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [endpointResult, userResult] = await Promise.all([
    supabase.from('endpoints').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
  ])

  if (endpointResult.error || !endpointResult.data) {
    notFound()
  }

  const endpoint = endpointResult.data as Endpoint
  const user = userResult.data.user

  const profileResult = user
    ? await supabase.from('profiles').select('username').eq('id', user.id).single()
    : null

  const username = profileResult?.data?.username ?? null
  const webhookUrl = username ? getWebhookUrl(username, endpoint.slug) : null

  return (
    <div>
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate min-w-0 text-2xl font-bold text-text-primary">{endpoint.name}</h1>
          <Badge variant={endpoint.is_active ? 'success' : 'warning'} className="shrink-0">
            {endpoint.is_active ? 'Active' : 'Paused'}
          </Badge>
        </div>
        <Link
          href={`/endpoints/${endpoint.id}/settings`}
          className="shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover min-h-[44px]"
        >
          Settings
        </Link>
      </div>

      {endpoint.description && (
        <p className="mt-2 text-sm text-text-secondary">{endpoint.description}</p>
      )}

      {webhookUrl === null ? (
        <div className="mt-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-400">Username required</p>
          <p className="mt-1 text-sm text-text-secondary">
            You must set a username before your webhook URL is available.{' '}
            <Link href="/settings" className="text-accent underline hover:text-accent-hover">
              Go to Settings
            </Link>{' '}
            to set your username.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Webhook URL
            </p>
            <div className="flex items-center gap-3 min-w-0">
              <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm text-accent break-all min-w-0">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} label="Copy URL" className="shrink-0" />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Maximum payload size: 1 MB. Requests exceeding this limit receive a 413 response.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              cURL Example
            </p>
            <div className="flex items-center gap-3 min-w-0">
              <code className="flex-1 truncate rounded bg-background px-3 py-2 font-mono text-xs text-text-secondary min-w-0">
                {`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"test": true}'`}
              </code>
              <CopyButton
                text={`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"test": true}'`}
                label="Copy"
                className="shrink-0"
              />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Request Feed</h2>
            <RequestFeed endpointId={endpoint.id} endpointUrl={webhookUrl} />
          </div>
        </>
      )}
    </div>
  )
}
